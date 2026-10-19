/*
 * Apply a fixture to a Ghost install.
 *
 *   node --env-file=.env scripts/ghost/import.mjs
 *   GHOST_URL=http://localhost:2369 GHOST_SESSION_FILE=.ghost-session-day-one.json \
 *     node --env-file=.env scripts/ghost/import.mjs --fixture scripts/ghost/fixture-day-one.json
 *
 * Idempotent, keyed on a natural identifier per record type — slug for posts, pages and tags,
 * email for users, url for recommendations, name for tiers. A second run updates rather than
 * duplicates, which is what makes it safe to re-run against an install someone has been clicking
 * around in. The demo-publication gate asserts that rather than assuming it.
 *
 * TWO MECHANISMS, ON PURPOSE. Ghost's Admin API cannot create staff users at all — there is no
 * POST /users/, only an invite flow that needs a mailbox — so the five writers go in through
 * Ghost's own JSON importer, which matches users on email and does not duplicate them. Everything
 * else goes through the Admin API, because the importer is the wrong tool for it: measured on this
 * install, a repeat import left `probe-post-2` beside `probe-post` and added a bookkeeping
 * `hash-import-<timestamp>` tag to the publication, which would have shown up in the Tags
 * Directory and broken the fourteen-subject count.
 *
 * AUTH IS AN OWNER SESSION, NOT AN API KEY — see `scripts/ghost/admin.mjs`, which this script and
 * the two check scripts share.
 */
import { readFileSync, writeFileSync, existsSync, statSync, openAsBlob } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

import { api, base, ownerSession } from './admin.mjs';

/*
 * WHICH FIXTURE, AND WHERE ITS IMAGE MAP LIVES. `--fixture` applies a different publication to
 * whatever GHOST_URL points at — the Day-one publication is the second caller, and it runs against
 * its own Ghost rather than the install the score run measures.
 *
 * The map of uploaded images is per fixture AND therefore per install, because it caches the URLs
 * one Ghost gave back and a second Ghost would answer with different ones. The default fixture
 * keeps the original filename deliberately: renaming it would look harmless and would re-upload
 * 4.4 MB of photographs, which Ghost stores as `-1` duplicates rather than recognising.
 *
 * BOTH CHECKS BELOW GUARD THAT SAME RE-UPLOAD, reached by spelling rather than by renaming.
 * `resolve()` and not string equality, because `--fixture ./scripts/ghost/fixture.json` names the
 * default fixture and would otherwise derive a map that does not exist. And the derived name has to
 * differ from the fixture it is derived from: `.replace(/\.json$/…)` is a no-op on a path with the
 * extension left off, and the import writes the map back — over the fixture it had just read.
 */
const DEFAULT_FIXTURE = 'scripts/ghost/fixture.json';
const flag = process.argv.indexOf('--fixture');
if (flag >= 0 && !process.argv[flag + 1]) {
	throw new Error('--fixture needs a path');
}
const FIXTURE = flag < 0 ? DEFAULT_FIXTURE : process.argv[flag + 1];
const IMAGE_MAP =
	resolve(FIXTURE) === resolve(DEFAULT_FIXTURE)
		? 'scripts/ghost/uploaded-images.json'
		: FIXTURE.replace(/\.json$/, '-images.json');
if (resolve(IMAGE_MAP) === resolve(FIXTURE)) {
	throw new Error(`--fixture ${FIXTURE} must end in .json; the image map is derived from it and would overwrite it`);
}
const SUPPORTED_VERSION = 2;

/** A GET that treats 404 as "not there yet" rather than as a failure. */
async function find(path) {
	try {
		return await api('GET', path);
	} catch (error) {
		if (String(error).includes('→ 404')) {
			return null;
		}
		throw error;
	}
}

/**
 * Page through a browse endpoint and return every row.
 *
 * `limit=all` is a trap on Ghost 6: applyLimitCap silently caps every browse at 100
 * (core/shared/max-limit-cap.js), so asking for "all" of a 104-post publication returns 100 and
 * reports success.
 */
async function browse(resource, query = '') {
	const rows = [];
	for (let page = 1; ; page += 1) {
		const payload = await api('GET', `/${resource}/?limit=100&page=${page}${query}`);
		rows.push(...payload[resource]);
		if (page >= (payload.meta?.pagination?.pages ?? 1)) {
			return { [resource]: rows };
		}
	}
}

/*
 * Ghost sniffs the multipart part's content type and answers 415 "Please select a valid image" for
 * an untyped one — and openAsBlob produces exactly that unless the type is passed in.
 */
const MIME = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
};

async function upload(endpoint, field, file, extra = {}) {
	const type = MIME[extname(file).toLowerCase()];
	if (!type) {
		throw new Error(`no content type known for ${file}; Ghost rejects an untyped upload with 415.`);
	}
	const form = new FormData();
	form.set(field, await openAsBlob(file, { type }), basename(file));
	for (const [k, v] of Object.entries(extra)) {
		form.set(k, v);
	}
	const auth = await ownerSession();
	const response = await fetch(`${base}/ghost/api/admin${endpoint}`, {
		method: 'POST',
		headers: { ...auth, 'Accept-Version': 'v6.0' },
		body: form,
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`POST ${endpoint} → ${response.status} ${text.slice(0, 200)}`);
	}
	return text ? JSON.parse(text) : {};
}

/* ── fixture ──────────────────────────────────────────────────────────────────────────── */

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
if (fixture.version !== SUPPORTED_VERSION) {
	throw new Error(
		`${FIXTURE} is version ${fixture.version}; this importer understands ${SUPPORTED_VERSION}. ` +
			`Re-run scripts/ghost/build-fixture.mjs.`,
	);
}

const report = [];
const log = (line) => {
	report.push(line);
	console.log(line);
};

/* ── 1. images ────────────────────────────────────────────────────────────────────────── */

/*
 * The design's photographs live in public/ and Ghost serves nothing from there, so every one has
 * to be uploaded into the publication's content directory and the fixture's /img/… paths rewritten
 * to what Ghost gives back. Ghost has no "does this image exist" endpoint and re-uploading the
 * same file produces a second copy with a -1 suffix, so the returned URLs are cached: that cache
 * is what makes a second import free instead of duplicating 4.4 MB of photographs.
 */
const imageMap = existsSync(IMAGE_MAP) ? JSON.parse(readFileSync(IMAGE_MAP, 'utf8')) : {};

const localImages = new Set();
const collectImages = (value) => {
	if (typeof value === 'string' && value.startsWith('/img/')) {
		localImages.add(value);
	} else if (Array.isArray(value)) {
		value.forEach(collectImages);
	} else if (value && typeof value === 'object') {
		Object.values(value).forEach(collectImages);
	}
};
collectImages(fixture);

let uploaded = 0;
let reused = 0;
for (const path of [...localImages].sort()) {
	const cached = imageMap[path];
	if (cached) {
		const head = await fetch(cached, { method: 'HEAD' });
		if (head.ok) {
			reused += 1;
			continue;
		}
	}
	const file = `public${path}`;
	if (!existsSync(file)) {
		throw new Error(`${FIXTURE} references ${path}, which is not in public/img/.`);
	}
	const result = await upload('/images/upload/', 'file', file, { purpose: 'image' });
	imageMap[path] = result.images[0].url;
	uploaded += 1;
}
writeFileSync(IMAGE_MAP, JSON.stringify(imageMap, null, '\t') + '\n');

const remote = (path) => (path ? (imageMap[path] ?? path) : null);

/*
 * Body HTML needs the same rewrite as the image fields. The styleguide page embeds a figure
 * pointing at /img/…, which Ghost serves nothing from — it rendered as a broken image until this
 * existed, because only feature_image and profile_image were being mapped.
 */
const remoteHtml = (html) =>
	html ? html.replace(/\/img\/[A-Za-z0-9._-]+/g, (match) => imageMap[match] ?? match) : html;
const bytes = [...localImages].reduce(
	(total, p) => total + (existsSync(`public${p}`) ? statSync(`public${p}`).size : 0),
	0,
);
log(`images  ${uploaded} uploaded, ${reused} already present (${(bytes / 1048576).toFixed(2)} MB referenced)`);

/* ── 2. authors ───────────────────────────────────────────────────────────────────────── */

/*
 * Created through Ghost's own importer, because the Admin API has no way to create a staff user.
 * Imported users land with status "locked" — they cannot sign in until they reset a password,
 * which is correct for demo authors and does not affect authorship or their archive Surface.
 * The importer sets only the basics, so the bio, location, links and portrait are applied after.
 *
 * AN AUTHOR MAY BE THE OWNER INSTEAD. `"owner": true` on a fixture author means "whoever this
 * install's owner is" — the Day-one publication is one solo writer, and that writer is the person
 * who ran setup. It cannot be expressed as an email, because the owner's address is chosen at
 * install time and a fixture that named one would either fail or, worse, create a SECOND staff
 * account beside the owner and make the About page's writer count read 2 on a one-writer blog.
 */
const existingUsers = await api('GET', '/users/?limit=all&include=roles');
const byEmail = new Map(existingUsers.users.map((u) => [u.email, u]));

const ownerUser = existingUsers.users.find((u) => u.roles?.some((role) => role.name === 'Owner'));
if (fixture.authors.some((a) => a.owner) && !ownerUser) {
	throw new Error('the fixture claims an author is the owner, but this install reports no Owner role');
}
const addressOf = (author) => (author.owner ? ownerUser.email : author.email);

const missing = fixture.authors.filter((a) => !a.owner && !byEmail.has(a.email));

if (missing.length) {
	const payload = {
		db: [
			{
				meta: { exported_on: Date.now(), version: '6.60.0' },
				data: {
					roles: [{ id: 1, name: 'Author' }],
					users: missing.map((a, i) => ({
						id: 1000 + i,
						name: a.name,
						slug: a.slug,
						email: a.email,
						status: 'active',
					})),
					roles_users: missing.map((_, i) => ({ id: 1000 + i, user_id: 1000 + i, role_id: 1 })),
				},
			},
		],
	};
	const tmp = '/tmp/mirror-users-import.json';
	writeFileSync(tmp, JSON.stringify(payload));
	const result = await upload('/db/', 'importfile', tmp);
	if (result.problems?.length) {
		throw new Error(`user import reported problems: ${JSON.stringify(result.problems)}`);
	}
}

const afterUsers = await api('GET', '/users/?limit=all');
const userByEmail = new Map(afterUsers.users.map((u) => [u.email, u]));

let authorsUpdated = 0;
for (const author of fixture.authors) {
	const user = userByEmail.get(addressOf(author));
	if (!user) {
		throw new Error(`user ${addressOf(author)} was not created by the import.`);
	}
	await api('PUT', `/users/${user.id}/`, {
		users: [
			{
				...user,
				name: author.name,
				slug: author.slug,
				bio: author.bio,
				location: author.location,
				website: author.website,
				twitter: author.twitter,
				profile_image: remote(author.profile_image),
				updated_at: user.updated_at,
			},
		],
	});
	authorsUpdated += 1;
}
log(`authors ${missing.length} created, ${authorsUpdated} profiles applied`);

/* ── 3. tags ──────────────────────────────────────────────────────────────────────── */

let tagsCreated = 0;
let tagsUpdated = 0;
for (const tag of fixture.tags) {
	const existing = await find(`/tags/slug/${tag.slug}/`);
	const payload = {
		name: tag.name,
		slug: tag.slug,
		description: tag.description,
		feature_image: remote(tag.feature_image),
	};
	if (existing) {
		const current = existing.tags[0];
		await api('PUT', `/tags/${current.id}/`, { tags: [{ ...payload, updated_at: current.updated_at }] });
		tagsUpdated += 1;
	} else {
		await api('POST', '/tags/', { tags: [payload] });
		tagsCreated += 1;
	}
}
log(`tags    ${tagsCreated} created, ${tagsUpdated} updated`);

/* ── 4. posts ─────────────────────────────────────────────────────────────────────────── */

/*
 * `?source=html` is what makes the bodies portable: Ghost converts the HTML to Lexical on the way
 * in, so the fixture never has to encode an editor format that changes between versions.
 *
 * Relations go by natural key — authors by email, tags by name, first tag becoming primary_tag —
 * which the Admin API resolves. That keeps the fixture free of this install's ids.
 */
const authorEmail = new Map(fixture.authors.map((a) => [a.name, addressOf(a)]));

let postsCreated = 0;
let postsUpdated = 0;
for (const post of fixture.posts) {
	const existing = await find(`/posts/slug/${post.slug}/`);
	const payload = {
		title: post.title,
		slug: post.slug,
		html: remoteHtml(post.html),
		custom_excerpt: post.custom_excerpt,
		feature_image: remote(post.feature_image),
		feature_image_alt: post.feature_image_alt,
		published_at: post.published_at,
		visibility: post.visibility,
		featured: post.featured,
		/* A Layout override (ADR 0006). Only the Demo site's publication sets one; null elsewhere,
		 * which is also what clears an override a previous import left behind. */
		custom_template: post.template ?? null,
		status: 'published',
		authors: [{ email: authorEmail.get(post.author) }],
		tags: post.tags.map((name) => ({ name })),
	};
	if (existing) {
		const current = existing.posts[0];
		await api('PUT', `/posts/${current.id}/?source=html`, {
			posts: [{ ...payload, updated_at: current.updated_at }],
		});
		postsUpdated += 1;
	} else {
		await api('POST', '/posts/?source=html', { posts: [payload] });
		postsCreated += 1;
	}
}
log(`posts   ${postsCreated} created, ${postsUpdated} updated`);

/* ── 5. standing pages ───────────────────────────────────────────────────────────────── */

let pagesCreated = 0;
let pagesUpdated = 0;
for (const page of fixture.pages) {
	const existing = await find(`/pages/slug/${page.slug}/`);
	const payload = {
		title: page.title,
		slug: page.slug,
		html: remoteHtml(page.body),
		/* The standing Pages carry a one-sentence standfirst that is NOT the opening of the body:
		 * a directory's lead describes the list below it, and About's describes the publication
		 * while its body opens on "Why this exists". `{{excerpt}}` prefers custom_excerpt and only
		 * falls back to the first 50 words, so the pages that need a distinct lead state one. */
		custom_excerpt: page.excerpt ?? null,
		feature_image: remote(page.image),
		feature_image_alt: page.image_alt ?? null,
		custom_template: page.template,
		/* The Demo site's duplicate Pages point at the page they copy (demo-overlay.mjs). */
		canonical_url: page.canonical_url ?? null,
		status: 'published',
	};
	if (existing) {
		const current = existing.pages[0];
		await api('PUT', `/pages/${current.id}/?source=html`, {
			pages: [{ ...payload, updated_at: current.updated_at }],
		});
		pagesUpdated += 1;
	} else {
		await api('POST', '/pages/?source=html', { pages: [payload] });
		pagesCreated += 1;
	}
}
log(`pages   ${pagesCreated} created, ${pagesUpdated} updated`);

/* ── 6. site settings ─────────────────────────────────────────────────────────────────── */

/*
 * ONLY THE KEYS THE FIXTURE STATES. These are not decoration: portal_button:false stops Ghost
 * injecting a floating button into the bottom-right of every scored screenshot; accent_color is
 * what the theme's one chromatic token reads; and navigation has to be real data, because the
 * theme renders the publication's menu rather than a hardcoded list.
 *
 * The list is derived rather than literal so a fixture can leave a setting ALONE. The Day-one
 * publication states four — title, description and both menus, which is what Ghost's own setup
 * wizard asks for plus the two the theme renders chrome from — and everything else keeps the
 * platform's default. That includes `accent_color`, whose default is `#FF1A75`: an unbranded
 * publication renders the theme's one chromatic token HOT PINK, not amber, which is a finding
 * rather than a thing to correct here. Enumerating the fourteen keys instead would force that
 * fixture to hard-code Ghost's defaults for the other ten, pinning them to whatever this Ghost
 * version happens to default to today.
 *
 * Three keys need a value shaped for the API rather than for the fixture: the two image paths go
 * through the upload map, and Ghost stores the menus as JSON strings.
 */
const site = fixture.site;
const SHAPE = {
	icon: remote,
	logo: remote,
	portal_plans: JSON.stringify,
	navigation: JSON.stringify,
	secondary_navigation: JSON.stringify,
};
const settings = Object.entries(site).map(([key, value]) => ({
	key,
	value: SHAPE[key] ? SHAPE[key](value) : value,
}));
await api('PUT', '/settings/', { settings });

/*
 * READ BACK THE KEYS, because the endpoint FILTERS rather than rejects: Ghost accepts a payload
 * containing a key it does not recognise with a 200 and silently drops it (the same trap score.mjs
 * records for its own capture settings). While the fourteen keys were a literal array in this file
 * a typo was impossible to introduce without a reviewer seeing it; now they come out of a JSON
 * fixture, so the spelling has to be checked against what Ghost knows. `accent_color` and
 * `portal_button` are the two every scored reference PNG was drawn with, which is what makes a
 * silent drop expensive.
 *
 * THE KEY, NOT THE VALUE. A dropped key is absent from the settings list entirely, so presence is
 * the exact test for the failure this guards — and comparing values would fail on a correct write:
 * Ghost NORMALISES some of them. Measured here: `icon` is stored as a resized derivative, so a
 * write of `…/2026/08/icon-home.png` reads back as `…/size/w256h256/2026/08/icon-home.png`. That is
 * the platform doing its job, and a check that called it a mismatch would have to grow an exemption
 * list per key, which is the kind of thing that rots into being switched off.
 */
const known = new Set((await api('GET', '/settings/')).settings.map((entry) => entry.key));
const unknown = settings.map((s) => s.key).filter((key) => !known.has(key));
if (unknown.length) {
	throw new Error(
		`Ghost does not recognise these setting key(s) and dropped them with a 200: ${unknown.join(', ')} — ` +
			`check the spelling in ${FIXTURE}'s site block`,
	);
}
log(`settings ${settings.length} applied, keys read back (${settings.map((s) => s.key).join(', ')})`);

/* ── 7. tiers ─────────────────────────────────────────────────────────────────────────── */

/*
 * Prices are integers in the currency's smallest unit, which is why the theme renders them through
 * the {{price}} helper rather than printing {{monthly_price}} and showing "800".
 *
 * A paid tier's prices are only settable once Stripe is connected, so a failure here is reported
 * and does not fail the import: it is a documented manual follow-up, not a broken fixture.
 */
const existingTiers = await api('GET', '/tiers/?limit=all');
const tierByName = new Map(existingTiers.tiers.map((t) => [t.name.toLowerCase(), t]));

let tiersApplied = 0;
const tierProblems = [];
for (const tier of fixture.tiers) {
	const current = tierByName.get(tier.name.toLowerCase());
	const payload = {
		name: tier.name,
		description: tier.description,
		benefits: tier.benefits,
		visibility: 'public',
	};
	if (tier.monthly_price !== null) {
		payload.monthly_price = tier.monthly_price;
		payload.yearly_price = tier.yearly_price;
		payload.currency = tier.currency;
	}
	try {
		if (current) {
			await api('PUT', `/tiers/${current.id}/`, { tiers: [payload] });
		} else {
			await api('POST', '/tiers/', { tiers: [payload] });
		}
		tiersApplied += 1;
	} catch (error) {
		tierProblems.push(`${tier.name}: ${String(error).split('\n')[0]}`);
	}
}
log(
	`tiers   ${tiersApplied}/${fixture.tiers.length} applied${tierProblems.length ? ` · ${tierProblems.join(' · ')}` : ''}`,
);

/* ── 8. recommendations ──────────────────────────────────────────────────────────────── */

const existingRecs = await api('GET', '/recommendations/?limit=all');
const recByUrl = new Map(existingRecs.recommendations.map((r) => [r.url.replace(/\/$/, ''), r]));

let recsCreated = 0;
let recsUpdated = 0;
for (const rec of fixture.recommendations) {
	const payload = {
		title: rec.title,
		url: rec.url,
		description: rec.description,
		featured_image: remote(rec.featured_image),
		favicon: remote(rec.favicon),
		one_click_subscribe: rec.one_click_subscribe,
	};
	const current = recByUrl.get(rec.url.replace(/\/$/, ''));
	if (current) {
		await api('PUT', `/recommendations/${current.id}/`, { recommendations: [payload] });
		recsUpdated += 1;
	} else {
		await api('POST', '/recommendations/', { recommendations: [payload] });
		recsCreated += 1;
	}
}
log(`recs    ${recsCreated} created, ${recsUpdated} updated`);

/* ── 9. prune, only when asked ───────────────────────────────────────────────────────── */

/*
 * A fresh Ghost is not empty: it ships a "Coming soon" post and a `news` tag, and the design's
 * publication is exactly 104 posts and 14 subjects — so on a fresh install the two collide and the
 * feed reads 105. Pruning is how the demo site becomes the design's publication and not the
 * design's publication plus whatever was already there.
 *
 * Off by default and irreversible when on, because the same script pointed at a real publication
 * would delete that publication's posts. It never touches users: deleting a staff account is a
 * different kind of destructive, and the owner cannot be deleted at all.
 */
if (process.argv.includes('--prune')) {
	const keepPosts = new Set(fixture.posts.map((p) => p.slug));
	const keepPages = new Set(fixture.pages.map((p) => p.slug));
	const keepTags = new Set(fixture.tags.map((t) => t.slug));

	/*
	 * Paged, not `limit=all`. Ghost 6 caps every browse at 100 (applyLimitCap in
	 * core/shared/max-limit-cap.js) and reports success, so `limit=all` against a 104-post
	 * publication returns 100 — and a prune that only sees 100 leaves foreign posts behind while
	 * reporting that it pruned everything.
	 */
	const [allPosts, allPages, allTags] = await Promise.all([browse('posts'), browse('pages'), browse('tags')]);

	let pruned = 0;
	for (const post of allPosts.posts.filter((p) => !keepPosts.has(p.slug))) {
		await api('DELETE', `/posts/${post.id}/`);
		log(`prune   post /${post.slug}/`);
		pruned += 1;
	}
	for (const page of allPages.pages.filter((p) => !keepPages.has(p.slug))) {
		await api('DELETE', `/pages/${page.id}/`);
		log(`prune   page /${page.slug}/`);
		pruned += 1;
	}
	for (const tag of allTags.tags.filter((t) => !keepTags.has(t.slug) && !t.slug.startsWith('#'))) {
		await api('DELETE', `/tags/${tag.id}/`);
		log(`prune   tag ${tag.slug}`);
		pruned += 1;
	}
	/*
	 * Tiers are never deleted — they are financial records, and Ghost has no DELETE for them — so a
	 * tier the fixture does not own is deactivated and hidden instead. A fresh install auto-creates
	 * one paid tier named after the site ("MIRROR", $5/$50, no copy), which would otherwise render
	 * as a fourth column on the Membership Surface beside the design's three.
	 *
	 * A fixture that states NO tiers has no opinion about them, and the platform's own tier is part
	 * of what it is testing: the Day-one publication keeps Ghost's auto-created paid tier exactly
	 * as a buyer would have it. Absence of a claim is not a claim of absence.
	 */
	const keepTiers = new Set(fixture.tiers.map((t) => t.name.toLowerCase()));
	const allTiers = fixture.tiers.length ? await api('GET', '/tiers/?limit=all') : { tiers: [] };
	for (const tier of allTiers.tiers) {
		if (tier.type === 'free' || keepTiers.has(tier.name.toLowerCase()) || !tier.active) {
			continue;
		}
		await api('PUT', `/tiers/${tier.id}/`, { tiers: [{ active: false, visibility: 'none' }] });
		log(`prune   tier ${tier.name} deactivated`);
		pruned += 1;
	}

	log(`prune   ${pruned} record(s) not in the fixture`);
}

console.log(`\n${fixture.concessions.length} reconciliation concession(s) are recorded in DECISIONS.md.`);

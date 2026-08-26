/*
 * Apply scripts/ghost/fixture.json to a Ghost install.
 *
 *   node --env-file=.env scripts/ghost/import.mjs
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
 * AUTH IS AN OWNER SESSION, NOT AN API KEY. An Admin API key looks like the right answer and is
 * not: integrations are refused by every endpoint this script needs beyond content — importing db
 * content, editing a staff user, writing settings, tiers and recommendations all answer 403
 * (`API tokens do not have permission to access this endpoint`). Since the owner credentials are
 * required regardless, a key would be a second credential that only covers the easy half.
 * GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD live in .env, which is gitignored.
 */
import { readFileSync, writeFileSync, existsSync, statSync, openAsBlob } from 'node:fs';
import { basename, extname } from 'node:path';

const FIXTURE = 'scripts/ghost/fixture.json';
const IMAGE_MAP = 'scripts/ghost/uploaded-images.json';
const SUPPORTED_VERSION = 2;

const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');
/**
 * Every call carries the owner session; see the note at the top of this file for why an Admin API
 * key is not enough.
 */
async function api(method, path, body) {
	const auth = await ownerSession();
	const response = await fetch(`${base}/ghost/api/admin${path}`, {
		method,
		headers: {
			...auth,
			'Content-Type': 'application/json',
			'Accept-Version': 'v6.0',
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : {};
	if (!response.ok) {
		const detail = payload.errors?.[0];
		throw new Error(
			`${method} ${path} → ${response.status} ${detail?.context ?? detail?.message ?? text.slice(0, 200)}`,
		);
	}
	return payload;
}

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

/**
 * The owner session, memoised. One login per run.
 */
let sessionAuth;
async function ownerSession() {
	if (sessionAuth) {
		return sessionAuth;
	}
	const email = process.env.GHOST_ADMIN_EMAIL;
	const password = process.env.GHOST_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error('GHOST_ADMIN_EMAIL and GHOST_ADMIN_PASSWORD are needed to create and edit staff users.');
	}
	const response = await fetch(`${base}/ghost/api/admin/session/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept-Version': 'v6.0', Origin: base },
		body: JSON.stringify({ username: email, password }),
	});
	if (!response.ok) {
		throw new Error(`session → ${response.status} ${(await response.text()).slice(0, 200)}`);
	}
	sessionAuth = {
		Cookie: response.headers
			.getSetCookie()
			.map((c) => c.split(';')[0])
			.join('; '),
		Origin: base,
	};
	return sessionAuth;
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
const bytes = [...localImages].reduce(
	(total, p) => total + (existsSync(`public${p}`) ? statSync(`public${p}`).size : 0),
	0,
);
log(`images  ${uploaded} uploaded, ${reused} already present (${(bytes / 1048576).toFixed(2)} MB referenced)`);

/* ── 2. writers ───────────────────────────────────────────────────────────────────────── */

/*
 * Created through Ghost's own importer, because the Admin API has no way to create a staff user.
 * Imported users land with status "locked" — they cannot sign in until they reset a password,
 * which is correct for demo authors and does not affect authorship or their archive Surface.
 * The importer sets only the basics, so the bio, location, links and portrait are applied after.
 */
const existingUsers = await api('GET', '/users/?limit=all');
const byEmail = new Map(existingUsers.users.map((u) => [u.email, u]));
const missing = fixture.authors.filter((a) => !byEmail.has(a.email));

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

let writersUpdated = 0;
for (const author of fixture.authors) {
	const user = userByEmail.get(author.email);
	if (!user) {
		throw new Error(`user ${author.email} was not created by the import.`);
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
	writersUpdated += 1;
}
log(`writers ${missing.length} created, ${writersUpdated} profiles applied`);

/* ── 3. subjects ──────────────────────────────────────────────────────────────────────── */

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
log(`subjects ${tagsCreated} created, ${tagsUpdated} updated`);

/* ── 4. posts ─────────────────────────────────────────────────────────────────────────── */

/*
 * `?source=html` is what makes the bodies portable: Ghost converts the HTML to Lexical on the way
 * in, so the fixture never has to encode an editor format that changes between versions.
 *
 * Relations go by natural key — authors by email, tags by name, first tag becoming primary_tag —
 * which the Admin API resolves. That keeps the fixture free of this install's ids.
 */
const authorEmail = new Map(fixture.authors.map((a) => [a.name, a.email]));

let postsCreated = 0;
let postsUpdated = 0;
for (const post of fixture.posts) {
	const existing = await find(`/posts/slug/${post.slug}/`);
	const payload = {
		title: post.title,
		slug: post.slug,
		html: post.html,
		custom_excerpt: post.custom_excerpt,
		feature_image: remote(post.feature_image),
		feature_image_alt: post.feature_image_alt,
		published_at: post.published_at,
		visibility: post.visibility,
		featured: post.featured,
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
		html: page.body,
		custom_template: page.template,
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
 * These are not decoration. portal_button:false stops Ghost injecting a floating button into the
 * bottom-right of every scored screenshot; accent_color is what the theme's one chromatic token
 * reads; and navigation has to be real data, because the theme renders the publication's menu
 * rather than a hardcoded list.
 */
const site = fixture.site;
const settings = [
	{ key: 'title', value: site.title },
	{ key: 'description', value: site.description },
	{ key: 'accent_color', value: site.accent_color },
	{ key: 'icon', value: remote(site.icon) },
	{ key: 'logo', value: remote(site.logo) },
	{ key: 'portal_button', value: site.portal_button },
	{ key: 'comments_enabled', value: site.comments_enabled },
	{ key: 'recommendations_enabled', value: site.recommendations_enabled },
	{ key: 'members_signup_access', value: site.members_signup_access },
	{ key: 'locale', value: site.locale },
	{ key: 'timezone', value: site.timezone },
	{ key: 'navigation', value: JSON.stringify(site.navigation) },
	{ key: 'secondary_navigation', value: JSON.stringify(site.secondary_navigation) },
];
await api('PUT', '/settings/', { settings });
log(`settings ${settings.length} applied (accent ${site.accent_color}, portal_button ${site.portal_button})`);

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

	const [allPosts, allPages, allTags] = await Promise.all([
		api('GET', '/posts/?limit=all&formats=html'),
		api('GET', '/pages/?limit=all'),
		api('GET', '/tags/?limit=all'),
	]);

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
	 */
	const keepTiers = new Set(fixture.tiers.map((t) => t.name.toLowerCase()));
	const allTiers = await api('GET', '/tiers/?limit=all');
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

/*
 * Build the demo site's import artifact.
 *
 *   node scripts/ghost/build-demo-zip.mjs        → dist/mirror-demo.zip
 *                                                  dist/mirror-demo-setup.md
 *
 * The publication in `fixture.json` reaches a Ghost two ways. `import.mjs` drives the Admin API as
 * the owner, which is complete but needs credentials, and needs them for a PUBLIC install where
 * Ghost 6 answers the first login with `2FA_NEW_DEVICE_DETECTED` and mails a code. This script
 * produces the other transport: one file, uploaded in admin at Settings → Import content, by
 * someone already signed in.
 *
 * WHAT THE FILE IS. Ghost's own export shape — `{ db: [ { meta, data } ] }` — inside a zip beside
 * the photographs, which is what lets the importer rewrite image references as it stores them
 * (`core/server/data/importer/content-file-importer.js`). `meta.version` must be valid semver or
 * the import is refused outright (`importers/data/data-importer.js:107-125`).
 *
 * WHAT IT DELIBERATELY OMITS, each one measured against Ghost 6.60's own importer rather than
 * assumed. Every omission is written into the checklist beside the zip:
 *
 *   - TIERS. `products-importer.js:63-89` drops any tier whose `monthly_price_id`/`yearly_price_id`
 *     matches no `stripe_prices` row in the file or the database. A publication with no Stripe has
 *     neither, so priced tiers cannot arrive this way at all — and inventing Stripe ids would
 *     import tiers whose Portal buttons 404 against a real Stripe account. Tiers are made by hand
 *     after Stripe is connected, which is the same sitting.
 *   - TIER BENEFITS. `benefits` and `products_benefits` are tables with no importer.
 *   - RECOMMENDATIONS. No importer either. Their images still travel in the zip so the checklist
 *     can name a URL that resolves.
 *   - ROUTES. `routes.yaml` is not importable content; the demo's own menu points at `/archive/`,
 *     which only exists once the theme's routes file is uploaded.
 *   - THE DESIGN TOKENS SHEET. A Surface for the scoring harness, not for a reader.
 *   - THEME SETTINGS. `custom_theme_settings` would bind to whichever theme is active at import
 *     time; the demo ships the Layouts a buyer gets on upload instead.
 *
 * IMAGES SIT AT THE ROOT OF THE ZIP under a `mirror-demo-` filename prefix, which is what keeps
 * Ghost's files handler from claiming them a second time and moving every post's photograph
 * outside the image-resizing path. The constant below carries the measurement.
 *
 * DETERMINISM. Ids are hashes of natural keys and `meta.exported_on` is derived from the content,
 * so two runs of an unchanged fixture produce byte-identical output.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from 'node:fs';
import { basename } from 'node:path';

const FIXTURE = 'scripts/ghost/fixture.json';
const OUT_DIR = 'dist';
const STAGE = `${OUT_DIR}/mirror-demo`;
const ZIP = `${OUT_DIR}/mirror-demo.zip`;
const CHECKLIST = `${OUT_DIR}/mirror-demo-setup.md`;

/*
 * THE PHOTOGRAPHS SIT IN `content/mirror-demo/` INSIDE THE ZIP, WHICH IS NOT WHERE THEY END UP,
 * and the gap between those two paths is load-bearing. Both were measured on Ghost 6.60.
 *
 * `.jpg` and `.png` are in BOTH the image handler's extension list and the files handler's
 * (`shared/config/overrides.json`), and `import-manager.js:289-294` globs each handler's
 * extensions across every directory, ignoring the `directories` the handler declares. So every
 * photograph is claimed twice, and rewritten twice, with the files pass running last
 * (`importers/content-file-importer.js:99-107`). With the images under `content/images/…` the
 * second pass matched the first pass's own output and every post's `feature_image` came out as
 * `/content/files/images/…` — a path Ghost's image-size pipeline does not serve, so every
 * responsive `srcset` in the theme silently lost its sources while the page still looked fine.
 *
 * A directory that is NOT `images/` breaks that chain. The image handler strips the leading
 * `content/` and stores the rest under `content/images/`, so `content/mirror-demo/x.jpg` becomes
 * `/content/images/mirror-demo/x.jpg` — which no longer contains the zip path the files pass
 * matches on. The files handler still stores its own unreferenced copy under `content/files/`;
 * that is waste, not breakage, and nothing links to it.
 *
 * THE ROOT OF THE ZIP IS NOT AN OPTION, tempting as it looks: a root-level image resolves to the
 * storage root itself, and `adapters/storage/LocalStorageBase.js:87-97` rejects a path equal to
 * the root — the whole import fails with "is not valid for this storage".
 */
const FOLDER = 'mirror-demo';
const ZIP_DIR = `content/${FOLDER}`;
const IMAGE_URL = `/content/images/${FOLDER}`;

/* Ghost's importer refuses a `meta.version` that is not semver; it is the version the file claims
 * to have been exported from, not the version it can be imported into. */
const EXPORT_VERSION = '6.60.0';

/* The one Surface the scoring harness needs and a reader does not. */
const EXCLUDED_PAGES = new Set(['design-tokens']);

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));

/* ── identifiers ──────────────────────────────────────────────────────────────────────── */

/*
 * Every id in the file is a join key and nothing else: `importers/data/base.js:89-99` replaces all
 * of them with fresh ObjectIds on the way in, remembering the original only to resolve relations.
 * Hashing the natural key keeps the file stable across runs, which a random ObjectId would not.
 */
const id = (kind, key) => createHash('sha1').update(`${kind}:${key}`).digest('hex').slice(0, 24);

/* ── images ───────────────────────────────────────────────────────────────────────────── */

/*
 * Every `/img/…` the fixture mentions, wherever it mentions it — feature images, portraits, tag
 * covers, the logo and icon, and the bodies, where the styleguide page embeds figures directly.
 */
const localImages = new Set();
const collect = (value) => {
	if (typeof value === 'string') {
		for (const match of value.matchAll(/\/img\/[A-Za-z0-9._-]+/g)) {
			localImages.add(match[0]);
		}
	} else if (Array.isArray(value)) {
		value.forEach(collect);
	} else if (value && typeof value === 'object') {
		Object.values(value).forEach(collect);
	}
};
collect(fixture);

const missingImages = [...localImages].filter((path) => !existsSync(`public${path}`));
if (missingImages.length) {
	throw new Error(`the fixture references images that are not in public/: ${missingImages.join(', ')}`);
}

/*
 * TWO SPELLINGS OF THE SAME IMAGE, because the importer rewrites some fields and not others.
 *
 * `zipRef` is the name as it appears in the zip. Post bodies, feature images, tag covers and
 * portraits are written this way and the image pass rewrites them to their final URL
 * (`content-file-importer.js:7-53`) — written as the final URL instead, the rewrite would match
 * the tail of the path and produce `/content/images/content/images/…`.
 *
 * `finalUrl` is that same final URL, and it is what settings must carry: the importer rewrites
 * posts, tags and users only, so the logo and the icon have to be correct as written.
 */
const zipRef = (path) => (path ? `${ZIP_DIR}/${basename(path)}` : null);
const finalUrl = (path) => (path ? `${IMAGE_URL}/${basename(path)}` : null);
const mappedHtml = (html) => (html ? html.replace(/\/img\/[A-Za-z0-9._-]+/g, (match) => zipRef(match)) : html);

/*
 * One folder and a rewrite driven by unanchored substring match, so two names where one ends with
 * the other would rewrite each other's references.
 */
const names = [...localImages].map((path) => zipRef(path));
for (const name of names) {
	const clash = names.find((other) => other !== name && other.includes(name));
	if (clash) {
		throw new Error(`image ${name} is a substring of ${clash}; one would rewrite the other's references`);
	}
}

/* ── the publication ──────────────────────────────────────────────────────────────────── */

/*
 * Dates. Ghost wants `created_at`/`updated_at` on every row and will substitute "now" for anything
 * it cannot parse (`base.js:70-87`), which would make two runs differ. A post is stamped with its
 * own publication date; everything standing is stamped with the publication's first day.
 */
const postDates = fixture.posts.map((post) => Date.parse(post.published_at)).filter(Number.isFinite);
const FIRST_DAY = new Date(Math.min(...postDates)).toISOString();
const LAST_DAY = new Date(Math.max(...postDates)).toISOString();

const roleId = id('role', 'author');
const roles = [{ id: roleId, name: 'Author' }];

/*
 * Imported staff land locked and with a random password (`users-importer.js:24-31`): they hold
 * bylines and archives, and nobody can sign in as them. The addresses are `@mirror.test` — a
 * reserved TLD (RFC 6761) that can never resolve, so no invitation or reset can escape the demo.
 */
const users = fixture.authors.map((author) => ({
	id: id('user', author.email),
	name: author.name,
	slug: author.slug,
	email: author.email,
	bio: author.bio,
	location: author.location,
	website: author.website,
	twitter: author.twitter,
	profile_image: zipRef(author.profile_image),
	status: 'active',
	created_at: FIRST_DAY,
	updated_at: FIRST_DAY,
}));

const roles_users = users.map((user) => ({
	id: id('roles_users', user.email),
	user_id: user.id,
	role_id: roleId,
}));

const tags = fixture.tags.map((tag) => ({
	id: id('tag', tag.slug),
	name: tag.name,
	slug: tag.slug,
	description: tag.description,
	feature_image: zipRef(tag.feature_image),
	visibility: 'public',
	created_at: FIRST_DAY,
	updated_at: FIRST_DAY,
}));

const userIdByName = new Map(fixture.authors.map((author) => [author.name, id('user', author.email)]));
const tagIdBySlug = new Map(fixture.tags.map((tag) => [tag.slug, id('tag', tag.slug)]));
const tagIdByName = new Map(fixture.tags.map((tag) => [tag.name, id('tag', tag.slug)]));

const posts = [];
const posts_tags = [];
const posts_authors = [];

/*
 * `feature_image_alt` is written onto the post rather than into a `posts_meta` row: the importer
 * picks the meta attributes off the model itself when no row matches (`posts-importer.js:59-73`),
 * so one field beats a second table to keep in step.
 */
for (const post of fixture.posts) {
	const postId = id('post', post.slug);
	posts.push({
		id: postId,
		title: post.title,
		slug: post.slug,
		html: mappedHtml(post.html),
		feature_image: zipRef(post.feature_image),
		feature_image_alt: post.feature_image_alt ?? null,
		custom_excerpt: post.custom_excerpt ?? null,
		featured: Boolean(post.featured),
		type: 'post',
		status: 'published',
		visibility: post.visibility,
		created_at: post.published_at,
		updated_at: post.published_at,
		published_at: post.published_at,
	});

	const authorId = userIdByName.get(post.author);
	if (!authorId) {
		throw new Error(`post ${post.slug} is by ${post.author}, who is not one of the fixture's authors`);
	}
	posts_authors.push({ id: id('posts_authors', post.slug), post_id: postId, author_id: authorId, sort_order: 0 });

	post.tags.forEach((name, index) => {
		const tagId = tagIdByName.get(name);
		if (!tagId) {
			throw new Error(`post ${post.slug} carries the tag ${name}, which the fixture does not define`);
		}
		posts_tags.push({
			id: id('posts_tags', `${post.slug}:${name}`),
			post_id: postId,
			tag_id: tagId,
			sort_order: index,
		});
	});
}

/*
 * STANDING PAGES CARRY NO AUTHOR ROW ON PURPOSE. On the scored install the pages belong to the
 * owner, because the Admin API attributes them to whoever is signed in — and that is what keeps
 * them out of every writer's post count and off the masthead, which counts published posts. An
 * imported page with no `posts_authors` row falls back to this install's owner the same way.
 */
const pages = fixture.pages.filter((page) => !EXCLUDED_PAGES.has(page.slug));
for (const page of pages) {
	posts.push({
		id: id('page', page.slug),
		title: page.title,
		slug: page.slug,
		html: mappedHtml(page.body),
		feature_image: zipRef(page.image),
		feature_image_alt: page.image_alt ?? null,
		custom_excerpt: page.excerpt ?? null,
		custom_template: page.template ?? null,
		featured: false,
		type: 'page',
		status: 'published',
		visibility: 'public',
		created_at: FIRST_DAY,
		updated_at: FIRST_DAY,
		published_at: FIRST_DAY,
	});
}

/*
 * SETTINGS ARE EMITTED WITHOUT A GROUP. The importer only maps `group`/`type` when a `type` is
 * present, and then discards everything it classes as `core` or `theme`
 * (`settings-importer.js:164-189`); a bare `{key, value}` pair goes straight to `Settings.edit`.
 * Ghost stores the menus and the plan list as JSON strings, and the two image paths must already
 * be their final URL because the importer does not rewrite settings.
 */
const SHAPE = {
	logo: finalUrl,
	icon: finalUrl,
	navigation: JSON.stringify,
	secondary_navigation: JSON.stringify,
	portal_plans: JSON.stringify,
};
const settings = Object.entries(fixture.site).map(([key, value]) => ({
	key,
	value: SHAPE[key] ? SHAPE[key](value) : value,
}));

const data = {
	meta: { exported_on: Date.parse(LAST_DAY), version: EXPORT_VERSION },
	data: { roles, users, roles_users, tags, posts, posts_tags, posts_authors, settings },
};

/* ── stage, copy, zip ─────────────────────────────────────────────────────────────────── */

rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP, { force: true });
mkdirSync(`${STAGE}/${ZIP_DIR}`, { recursive: true });

writeFileSync(`${STAGE}/content.json`, JSON.stringify({ db: [data] }, null, '\t') + '\n');

let bytes = 0;
for (const path of [...localImages].sort()) {
	const source = `public${path}`;
	copyFileSync(source, `${STAGE}/${zipRef(path)}`);
	bytes += statSync(source).size;
}

/*
 * ONE TIMESTAMP ON EVERY ENTRY. A zip stores each file's mtime, so two runs of an unchanged
 * fixture produced two different archives until the staged tree was stamped — which defeats the
 * point of hashing the ids. The stamp is the publication's own last publication date, and `-X`
 * drops the extra attributes (uid, gid, resource forks) that would vary the same way.
 */
const stamp = new Date(LAST_DAY);
for (const path of [
	STAGE,
	`${STAGE}/content`,
	`${STAGE}/${ZIP_DIR}`,
	`${STAGE}/content.json`,
	...[...localImages].map((image) => `${STAGE}/${zipRef(image)}`),
]) {
	utimesSync(path, stamp, stamp);
}

/* Zipped from inside the staging directory so `content.json` sits at the root, the way Ghost's own
 * export does. */
execFileSync('zip', ['-rqX', '../mirror-demo.zip', '.'], { cwd: STAGE });

/* ── the checklist ────────────────────────────────────────────────────────────────────── */

/*
 * WRITTEN BESIDE THE ZIP, NEVER INSIDE IT. `handlers/markdown.js:80-84` registers `.md` as a data
 * handler, and `import-manager.js:355-361` refuses a zip holding two data formats — so one
 * markdown file anywhere in the archive would make Ghost reject the whole import.
 */
const money = (cents, currency) =>
	cents == null ? null : `${currency.toUpperCase()} ${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;

const tierLines = fixture.tiers
	.map((tier) => {
		const price =
			tier.monthly_price == null
				? 'free'
				: `${money(tier.monthly_price, tier.currency)}/month · ${money(tier.yearly_price, tier.currency)}/year`;
		const benefits = tier.benefits.map((benefit) => `     - ${benefit}`).join('\n');
		return `   - **${tier.name}** — ${price}\n     _${tier.description}_\n${benefits}`;
	})
	.join('\n');

const recLines = fixture.recommendations
	.map(
		(rec) =>
			`   - **${rec.title}** — <${rec.url}>\n     _${rec.description}_\n` +
			`     cover \`${finalUrl(rec.featured_image)}\` · favicon \`${finalUrl(rec.favicon)}\``,
	)
	.join('\n');

const counted = {
	posts: fixture.posts.length,
	pages: pages.length,
	tags: tags.length,
	authors: users.length,
	images: localImages.size,
	gated: fixture.posts.filter((post) => post.visibility !== 'public').length,
};

const checklist = `# MIRROR demo site — setup

Generated by \`pnpm ghost:demo\` from \`scripts/ghost/fixture.json\`. Do not edit by hand.

\`dist/mirror-demo.zip\` carries **${counted.posts} posts** (${counted.gated} of them gated),
**${counted.pages} pages**, **${counted.tags} tags**, **${counted.authors} writers** and
**${counted.images} photographs** (${(bytes / 1048576).toFixed(1)} MB), plus the publication's
title, description, accent colour, logo, icon, both menus and its membership settings.

Ghost's importer cannot carry the rest. The steps below are the whole of it.

## Before the import

1. **Upload and activate the theme.** \`dist/mirror.zip\`, under Settings → Design & branding →
   Change theme. The importer refuses to set \`active_theme\` itself
   (\`settings-importer.js:99-106\`), and the import writes settings the theme reads.
2. **Upload the routes file.** \`docs/routes.example.yaml\` from the theme's repository, under
   Settings → Labs → Routes. The demo's menu links \`/archive/\`, which does not exist on stock
   Ghost routing.
3. **Delete Ghost's own starter content** — the post *Coming soon*, the page *About this site*
   and the tag *news*, under Posts, Pages and Tags. This one is not housekeeping. Ghost's
   importer never replaces: the starter page already owns the slug \`about\`, so the demo's About
   page lands at \`/about-2/\` while the menu still points at \`/about/\`, and the starter post
   makes the feed 105 posts long. Both were measured on a fresh install.

## The import

4. **Settings → Import content**, upload \`dist/mirror-demo.zip\`, and wait for the emailed
   confirmation. Writers arrive locked — nobody can sign in as them, and their \`@mirror.test\`
   addresses can never receive mail. The photographs land in \`/content/images/${FOLDER}/\`.

## After the import

5. **Connect Stripe**, under Settings → Membership. Nothing below can exist without it.
6. **Create the paid tiers**, under Settings → Membership → Tiers. Ghost's importer drops any tier
   whose Stripe price it cannot resolve (\`products-importer.js:63-89\`), so these are made by
   hand — including their benefits, which have no importer at all:

${tierLines}

   Then set **Featured tier** to \`Pro\` in the theme's settings if you changed it, and enable the
   paid plans under Settings → Portal — a new Ghost offers the free plan only.
7. **Add the recommendations**, under Settings → Recommendations. Ghost fetches each publication's
   own cover and favicon, and these domains are invented, so it will find none; the zip carries the
   images the design uses, at the paths below.

${recLines}

8. **Check the Layouts.** The demo runs the theme's own defaults — Magazine cover, List,
   Editorial rows, Centered classic, Centered statement — which is what a buyer sees on upload.
   Each has an alternate in Settings → Design & branding if you want the other drawing.

## Not in the zip, by design

- **The design tokens sheet** (\`/design-tokens/\`) — a Surface for the scoring harness.
- **Theme settings** — they bind to whichever theme is active, so the demo takes the defaults.
- **Members and their subscriptions** — a demo site should have none.

## Two things to expect

- **A second copy of every photograph under \`content/files/\`.** Ghost registers \`.jpg\` and
  \`.png\` on both its image and its file handler and stores the archive's images twice
  (${(bytes / 1048576).toFixed(1)} MB of it). Nothing links to that copy; delete the folder if the
  disk matters.
- **Re-importing does not replace.** Ghost ignores duplicates and reports them
  (\`base.js:120-131\`). To rebuild the demo, start from an empty publication.
`;

writeFileSync(CHECKLIST, checklist);

const zipBytes = statSync(ZIP).size;
console.log(
	`demo zip: ${counted.posts} posts (${counted.gated} gated), ${counted.pages} pages, ` +
		`${counted.tags} tags, ${counted.authors} writers, ${counted.images} images`,
);
console.log(`          ${settings.length} settings; tiers, benefits, recommendations and routes are checklist steps`);
console.log(`          → ${ZIP} (${(zipBytes / 1048576).toFixed(2)} MB)`);
console.log(`          → ${CHECKLIST}`);

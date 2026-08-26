/*
 * Regenerate the smoke-test route configs from the fixture and the running site.
 *
 *   node --env-file=.env scripts/ghost/build-routes.mjs
 *
 * Three rules this exists to enforce:
 *
 *   1. Routes come from the fixture, not from whatever the install happens to contain. The first
 *      version of these configs pointed at Ghost's seeded /coming-soon/ post and `news` tag, which
 *      passed until the demo publication replaced them.
 *
 *   2. Every assertion is verified present on its own route before it is written. An assertion
 *      nobody checked is a silently inert check.
 *
 *   3. Every assertion is verified ABSENT from a control route. This is the rule the first version
 *      lacked and it mattered: the markers were design strings like "Subjects" and "About", and
 *      once the demo publication seeded a real navigation menu those five strings appeared in the
 *      Chrome of every page. The config still reported 12/12 while proving nothing about which
 *      template rendered. Presence alone is not evidence of resolution.
 *
 * Hence `data-surface`: one attribute on each template's outermost element, naming the Surface it
 * renders. body_class cannot do this job — `/about/` is `page-template page-about` whether
 * page-about.hbs rendered or page.hbs fell back — and design copy cannot either, because it is
 * neither unique nor layout-independent ("Latest" exists only in the A1 home layout).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');
const fixture = JSON.parse(readFileSync('scripts/ghost/fixture.json', 'utf8'));

/* Deterministic picks: the fixture is a pure function of src/data, so these slugs are stable. */

/*
 * The Post Surface is captured on a designed post with a post on each side of it. The design
 * draws both adjacent cards, and the newest post in the fixture has no next — capturing that
 * one would score a page the design has no drawing for and hide the "Next →" card from every
 * run. Public, because the gated rows capture the members-only slug on purpose.
 */
const byDate = [...fixture.posts].sort((a, b) => b.published_at.localeCompare(a.published_at));
const post = byDate.find((p, i) => p.designed && p.visibility === 'public' && i > 0 && i < byDate.length - 1);
if (!post) {
	throw new Error('no designed public post with a post on each side — the Post Surface has nothing to capture');
}
const tag = fixture.tags.reduce((a, b) => (a.count >= b.count ? a : b));
const author = fixture.authors.reduce((a, b) => (a.count >= b.count ? a : b));
const slug = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

const surface = (name) => `data-surface="${name}"`;

const bare = [
	{ path: '/', expect: surface('home') },
	{ path: `/${post.slug}/`, expect: surface('post') },
	{ path: `/tag/${slug(tag.name)}/`, expect: surface('tag') },
	{ path: `/author/${author.slug}/`, expect: surface('author') },
	{ path: '/tags/', expect: surface('page-tags') },
	{ path: '/authors/', expect: surface('page-authors') },
	{ path: '/about/', expect: surface('page-about') },
	{ path: '/membership/', expect: surface('page-membership') },
	{ path: '/recommendations/', expect: surface('page-recommendations') },
	{ path: '/sign-in/', expect: surface('sign-in') },
	{ path: '/sign-up/', expect: surface('sign-up') },
];

const configured = [...bare, { path: '/archive/', expect: surface('feed') }];

const body = async (path) => {
	const response = await fetch(`${base}${path}`);
	return response.ok ? await response.text() : null;
};

const problems = [];

/*
 * The control is every other route in the set: a marker that shows up on a Surface it does not
 * belong to is not a marker. This is a stronger check than one fixed control page and it costs
 * nothing — the bodies are already fetched.
 */
const bodies = new Map();
for (const route of configured) {
	const html = await body(route.path);
	if (html === null) {
		problems.push(`${route.path} did not answer 200`);
		continue;
	}
	bodies.set(route.path, html);
}

for (const route of configured) {
	const own = bodies.get(route.path);
	if (own === undefined) {
		continue;
	}
	if (!own.includes(route.expect)) {
		problems.push(`${route.path} does not contain ${JSON.stringify(route.expect)}`);
	}
	for (const [path, html] of bodies) {
		if (path !== route.path && html.includes(route.expect)) {
			problems.push(`${JSON.stringify(route.expect)} is not unique — it also appears on ${path}`);
		}
	}
}

if (problems.length) {
	console.error('refusing to write a config with unverified or inert assertions:');
	for (const problem of [...new Set(problems)]) {
		console.error(`  ${problem}`);
	}
	process.exit(1);
}

writeFileSync('scripts/ghost/routes-bare.json', JSON.stringify(bare, null, '\t') + '\n');
writeFileSync('scripts/ghost/routes.json', JSON.stringify(configured, null, '\t') + '\n');

console.log(
	`routes: ${bare.length} bare, ${configured.length} configured — every assertion present on its own ` +
		`Surface and absent from all ${configured.length - 1} others`,
);

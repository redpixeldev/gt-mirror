/*
 * Regenerate the smoke-test route configs from the fixture and the running site.
 *
 *   node --env-file=.env scripts/ghost/build-routes.mjs
 *
 * Two rules this exists to enforce:
 *
 *   1. Routes come from the fixture, not from whatever the install happens to contain. The first
 *      version of these configs pointed at Ghost's seeded /coming-soon/ post and `news` tag, which
 *      passed until the demo publication replaced them.
 *
 *   2. Every `expect` string is verified against a live response before it is written. An assertion
 *      nobody checked is a silently inert check, and a config full of them reports twelve passes
 *      while proving nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');
const fixture = JSON.parse(readFileSync('scripts/ghost/fixture.json', 'utf8'));

/* Deterministic picks: the fixture is a pure function of src/data, so these slugs are stable. */
const post = fixture.posts.find((p) => p.designed);
const tag = fixture.tags.reduce((a, b) => (a.count >= b.count ? a : b));
const author = fixture.authors.reduce((a, b) => (a.count >= b.count ? a : b));
const slug = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/* Each marker belongs to exactly one template, which is what makes the run prove resolution. */
const bare = [
	{ path: '/', expect: 'Latest' },
	{ path: `/${post.slug}/`, expect: 'mirror-content' },
	{ path: `/tag/${slug(tag.name)}/`, expect: '>Tag<' },
	{ path: `/author/${author.slug}/`, expect: '>Writer<' },
	{ path: '/tags/', expect: 'Subjects' },
	{ path: '/authors/', expect: 'Writers' },
	{ path: '/about/', expect: 'About' },
	{ path: '/membership/', expect: 'Membership' },
	{ path: '/recommendations/', expect: 'Recommendations' },
	{ path: '/sign-in/', expect: 'data-members-form="signin"' },
	{ path: '/sign-up/', expect: 'data-members-form="signup"' },
];

const configured = [...bare, { path: '/archive/', expect: 'pagination' }];

const problems = [];
for (const route of configured) {
	const response = await fetch(`${base}${route.path}`);
	if (!response.ok) {
		problems.push(`${route.path} → ${response.status}`);
		continue;
	}
	const body = await response.text();
	if (!body.includes(route.expect)) {
		problems.push(`${route.path} does not contain ${JSON.stringify(route.expect)}`);
	}
}

if (problems.length) {
	console.error('refusing to write a config with unverified assertions:');
	for (const problem of problems) {
		console.error(`  ${problem}`);
	}
	process.exit(1);
}

writeFileSync('scripts/ghost/routes-bare.json', JSON.stringify(bare, null, 2) + '\n');
writeFileSync('scripts/ghost/routes.json', JSON.stringify(configured, null, 2) + '\n');

console.log(
	`routes: ${bare.length} bare, ${configured.length} configured — every assertion verified against a live response`,
);

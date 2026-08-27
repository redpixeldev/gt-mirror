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
 *   4. A marker belongs to as many routes as declare it, and to no others. Two routes are the
 *      Post Surface — one gated, one not — so `data-surface="post"` is on both by design, while
 *      `data-gate` is on exactly one. Checking uniqueness per route rather than per marker would
 *      have made the second Post route unrepresentable.
 *
 *   5. An `absent` marker is corroborated before it is written. Rules 2 and 3 cannot apply to it
 *      — the run can prove a string is off the page, never that the string is one any page could
 *      produce — so each one must either be some route's `expect` or be named in UNCORROBORATED
 *      below with the reason it cannot be shown.
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

/*
 * The Gate is a state of the same Surface, so it needs its own route: the run has to see a Post
 * that gates and a Post that does not, and the interesting failure — a paywall that silently
 * opens — is invisible on any single page. Picked by the same expression build-jobs.mjs uses for
 * the paywalled capture rows, so the two configs cannot name different posts.
 */
const gated = fixture.posts.find((p) => p.designed && p.visibility !== 'public');
if (!gated) {
	throw new Error('no designed gated post — the Gate state has nothing to capture');
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
	{
		path: `/${post.slug}/`,
		expect: surface('post'),
		absent: ['data-gate=', 'class="gh-post-upgrade-cta'],
	},
	{
		path: `/${gated.slug}/`,
		expect: [surface('post'), `data-gate="${gated.visibility}"`],
		absent: 'class="gh-post-upgrade-cta',
	},
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

const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/* Marker -> the routes that claim it. Everything else is a control for that marker. */
const owners = new Map();
for (const route of configured) {
	for (const marker of list(route.expect)) {
		owners.set(marker, [...(owners.get(marker) ?? []), route.path]);
	}
}

for (const [marker, claimed] of owners) {
	for (const [path, html] of bodies) {
		const present = html.includes(marker);
		if (claimed.includes(path) && !present) {
			problems.push(`${path} does not contain ${JSON.stringify(marker)}`);
		}
		if (!claimed.includes(path) && present) {
			problems.push(`${JSON.stringify(marker)} is claimed by ${claimed.join(', ')} but also appears on ${path}`);
		}
	}
}

/*
 * An `absent` marker is the only way to assert a state the page does NOT enter, and it is the one
 * assertion this file can only verify one way: a run can prove the string is not on the page, and
 * cannot prove the string is one any page could ever produce. A typo would pass forever.
 *
 * So each one has to be corroborated — either it is some route's `expect`, and therefore shown
 * live somewhere in this set, or it is named below with the reason it cannot be. The list is short
 * on purpose: adding to it is a deliberate act, not a default.
 */
const UNCORROBORATED = new Map([
	[
		'class="gh-post-upgrade-cta',
		'Ghost core emits this panel from its own content-cta.hbs when a template calls {{content}} ' +
			'on a post the reader cannot read. The theme renders its own Gate instead, so no page in ' +
			'this configuration can show it — which is exactly the regression this marker guards.',
	],
]);

for (const route of configured) {
	for (const marker of list(route.absent)) {
		if (bodies.get(route.path)?.includes(marker)) {
			problems.push(`${route.path} contains ${JSON.stringify(marker)}, which it declares absent`);
		}
		const shown = [...owners.keys()].some((claimed) => claimed.includes(marker));
		if (!shown && !UNCORROBORATED.has(marker)) {
			problems.push(
				`${route.path} declares ${JSON.stringify(marker)} absent, but no route shows that string — ` +
					'an absent marker nobody can produce is a check that cannot fail',
			);
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

const absent = configured.reduce((n, route) => n + list(route.absent).length, 0);
console.log(
	`routes: ${bare.length} bare, ${configured.length} configured — ${owners.size} marker(s) present on ` +
		`every route that claims one and on no other, ${absent} asserted absent`,
);

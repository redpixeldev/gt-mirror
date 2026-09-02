/*
 * Build the Day-one publication: one Author, seven Posts, no Tags, no images, one About page.
 *
 *   node scripts/ghost/build-day-one.mjs
 *   node scripts/ghost/build-day-one.mjs --posts 5
 *
 * The Day-one publication is what a buyer has before configuring anything, and it is the only
 * place the theme's absence paths render at all: the demo publication has a photograph on
 * everything, fourteen Tags and five Authors, so `chrome/wordmark.hbs`'s text mark, both monogram
 * fallbacks and every "no content for this band" branch are structurally unreachable there.
 * See CONTEXT.md for Day-one publication and Orphan, and docs/adr/0003 for the treatment rule.
 *
 * THIS FILE OWNS FIVE OUTPUTS, and that is the point. The route lists, the capture jobs and the
 * audit's path list all need the post slugs, and a hand-maintained list of them beside a generator
 * that invents them is a drift waiting to happen — `--posts 5` has to change all five at once or
 * the smoke run asserts a URL that no longer exists.
 *
 *   fixture-day-one.json        the publication, for scripts/ghost/import.mjs --fixture
 *   routes-day-one.json         smoke with docs/routes.example.yaml applied
 *   routes-day-one-bare.json    smoke on Ghost's own default routes
 *   jobs-day-one.json           the unscored capture matrix, for scripts/verify/shoot.py
 *   audit-day-one.json          the width sweep's paths, for scripts/ghost/audit.mjs --surfaces
 *
 * NOTHING HERE IS SCORED. A Day-one publication has no Pixel identity and no Floor, because the
 * design source was drawn with Demo content and an absence has nothing to be scored against. That
 * is not a comment: every capture job carries `"scored": false`, which is shoot.py's own contract
 * for a page that is fit to look at and unfit to measure — it reports a drift and does not fail
 * the run over it.
 */
import { writeFileSync } from 'node:fs';

const FIXTURE = 'scripts/ghost/fixture-day-one.json';
const ROUTES = 'scripts/ghost/routes-day-one.json';
const ROUTES_BARE = 'scripts/ghost/routes-day-one-bare.json';
const JOBS = 'scripts/ghost/jobs-day-one.json';
const AUDIT = 'scripts/ghost/audit-day-one.json';

/* The same GHOST_URL the import and audit scripts read, so one origin has one name. The default
 * matches config.day-one.json's port. */
const BASE = (process.env.GHOST_URL ?? 'http://localhost:2369').replace(/\/$/, '');

/* The one writer. `owner: true` rather than an email, because the owner's address is chosen at
 * install time — see the note in import.mjs. No bio and no portrait: this writer has not filled
 * anything in yet, which is what puts the monogram fallback and the bio-less profile on screen. */
const AUTHOR = {
	name: 'Nadia Okonjo',
	slug: 'nadia-okonjo',
	owner: true,
	bio: null,
	location: null,
	website: null,
	twitter: null,
	profile_image: null,
};

/*
 * SEVEN SHAPES, EACH WITH A REASON. These are not seven samples of one thing: every post exists to
 * put one absence or one extreme on screen, and the `why` is carried into the fixture so a later
 * reader cannot mistake the set for filler. Order is newest first; dates are fixed.
 *
 * The bodies are hand-written rather than generated. Exact word counts are what the demo fixture
 * needs, because its reading-time labels are scored against the design source; nothing here is
 * scored, and prose a human can read is worth more in a screenshot than prose that hits a number.
 */
const SHAPES = [
	{
		role: 'long-title',
		title: 'The long slow work of building an archive from nothing',
		date: '2026-08-28',
		why: "the longest title in the publication — it wraps in every card size and in the post header, and the audit's own heading limit (3 lines, 4 below 380px) is the contract it must not break",
		html: `<p>The hardest part of starting was not the writing. It was accepting that for a while there would be nothing to point at — no archive to browse, no back catalogue to justify the subscription, no photograph of me at a desk looking thoughtful.</p>
<p>So this is the first thing. It is not a manifesto. It is a note that the lights are on.</p>`,
	},
	{
		title: 'On keeping a list',
		date: '2026-08-21',
		why: 'a body whose only content is a list — no paragraph before it, nothing after',
		html: `<ul><li>Write the thing before deciding whether it is any good.</li><li>Publish on a schedule you can keep in a bad week, not a good one.</li><li>Reply to everyone who writes back, for as long as that is possible.</li><li>Do not buy a logo yet.</li><li>Keep the list short enough to remember.</li></ul>`,
	},
	{
		role: 'headings',
		title: 'What I mean by attention',
		date: '2026-08-14',
		why: 'three h2 sections, so this is the one post where the table of contents renders at all — and the one that proves the audit\u2019s EMPTYNAV rule does not fire on toc.hbs\u2019s Alpine-filled <ol>',
		html: `<p>The word gets used for two different things, and the difference matters more than it sounds.</p>
<h2>Attention as a resource</h2>
<p>In the first sense attention is something a reader spends. It is finite, it is depleted by everything else competing for it, and the economics of that are what most writing about media is actually about.</p>
<p>That framing is useful and slightly grim. It makes every publication a competitor for the same scarce thing, and it makes any argument about quality collapse into an argument about efficiency.</p>
<h2>Attention as a practice</h2>
<p>In the second sense attention is something a writer does. It is the difference between describing a room and noticing it. It cannot be bought and it does not scale, which is exactly why it is worth anything.</p>
<h2>Why both readings survive</h2>
<p>They survive because they are both true and they pull in opposite directions. A publication that treats attention only as a resource optimises itself into something nobody wants to read. One that treats it only as a practice never finds the people it was written for.</p>
<p>I do not have a resolution. I have a preference, and it is the second one.</p>`,
	},
	{
		title: 'Two sentences on revision',
		date: '2026-08-07',
		why: 'the shortest post the publication has — the smallest reading time the theme ever prints',
		html: `<p>Every draft I have ever liked was the fourth one, and every draft I have ever regretted was the first one I sent. The only technique I trust is waiting one day, which is not a technique so much as an admission.</p>`,
	},
	{
		title: 'A note on borrowed authority',
		date: '2026-07-31',
		why: 'a blockquote as the body\u2019s centre of gravity, with prose either side',
		html: `<p>I keep coming back to a line from an old style guide, which I have never been able to source properly and which I therefore quote with some embarrassment.</p>
<blockquote><p>Write as though the reader is intelligent, busy, and has never heard of you. Two of those are always true.</p></blockquote>
<p>What I like about it is the refusal of the third assumption. Most writing about writing assumes an audience that already cares. Almost nobody has one.</p>`,
	},
	{
		title: 'The setup, for anyone curious',
		date: '2026-07-24',
		why: 'a fenced code block, so the Syntax palette renders with no feature image above it',
		html: `<p>A few people asked what this runs on. The answer is boring and I intend to keep it that way.</p>
<pre><code class="language-sh">#!/usr/bin/env bash
set -euo pipefail

# Publish, then get on with the day.
git add content/
git commit -m "post: $1"
git push</code></pre>
<p>That is the whole pipeline. There is no build step, because there is nothing to build.</p>`,
	},
	{
		role: 'heading-free',
		title: 'Why I am not going to write about the industry',
		date: '2026-07-17',
		why: 'four hundred words with no headings at all: an empty table of contents, so A2\u2019s rail is share-only',
		html: `<p>There is a genre of writing about publishing that consists almost entirely of writing about publishing. It is comfortable to produce and it flatters everyone involved, because it treats the mechanics of the trade as though they were the subject.</p>
<p>I have written a great deal of it. Most of it was fine and none of it was necessary. The tell is that you can write it without going anywhere or asking anyone anything, which means the only research it requires is having read other pieces of the same kind. That is a closed loop, and closed loops get smaller.</p>
<p>What I want to do instead is duller to describe and harder to do. I want to write about specific things that happened, to specific people, in enough detail that the general point has to be inferred rather than announced. This is not a new idea. It is the oldest idea in reporting and it keeps being rediscovered because it keeps being abandoned, usually for good reasons: it is slow, it does not scale, and it produces one piece where a trend argument would have produced five.</p>
<p>The other reason I am avoiding it is more selfish. Writing about the industry means writing for the industry, and the industry is a small audience that already agrees with itself. It rewards you quickly and then holds you there. I have watched several people I admire disappear into that particular cul-de-sac, publishing to a few hundred colleagues and mistaking the response for reach.</p>
<p>So the plan is: no takes about the platform of the month, no predictions, no pieces whose argument is that a thing is either dying or being reinvented. If something in the trade genuinely changes how a reader encounters writing, that is worth an essay, and I will try to write it from the reader's side rather than the seller's.</p>
<p>I expect to break this rule. It is easier to hold a position before anything is at stake, and nothing is at stake yet — there is no archive to be consistent with and nobody to be inconsistent in front of. But it is worth writing down now, while it is still cheap, so that later there is something to be caught out by.</p>`,
	},
];

/*
 * The About page. Three paragraphs and nothing else: no image, no standfirst, no team roster and
 * no statistics written into the body. The slug is `about` and that is not a choice — Ghost
 * resolves page-{slug}.hbs before anything else (page-about.hbs), so a page a buyer simply names
 * "About" gets the designed About Surface with its split hero, its counted stats band and its
 * writers masthead whether the publication has content for them or not. That makes this page the
 * richest Orphan ground in the publication, which is exactly why it is here.
 */
const ABOUT = {
	slug: 'about',
	title: 'About',
	template: null,
	excerpt: null,
	image: null,
	image_alt: null,
	body: `<p>I am Nadia. I write here about attention, craft, and the small economics of publishing on your own.</p>
<p>There is not much to look at yet. Posts arrive most Thursdays, and they are usually about something that actually happened rather than about publishing itself.</p>
<p>If you want to argue with any of it, reply to the email — it comes to me.</p>`,
};

/* ── the publication ──────────────────────────────────────────────────────────────────── */

const slugify = (s) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

const flag = process.argv.indexOf('--posts');
const requested = flag < 0 ? SHAPES.length : Number(process.argv[flag + 1]);
if (!Number.isInteger(requested) || requested < 1) {
	throw new Error('--posts needs a whole number of at least 1');
}
if (requested > SHAPES.length) {
	throw new Error(
		`--posts ${requested} asks for more than the ${SHAPES.length} shapes this file defines. ` +
			'Add a shape with a reason rather than repeating one: a duplicate post proves nothing ' +
			'the original did not.',
	);
}

/*
 * SEVEN IS THE COMMITTED DEFAULT because of where it falls in the homepage window. Both Layouts
 * slice the same fourteen posts (partials/home/window.hbs): A1 takes 1 for the cover, 2 for the
 * lead, 3–5 for the rows beside it and 6–14 for the grid; A2 takes 1, 2–5 and 6–14. At seven the
 * grid holds two of its nine slots — a ragged partial row, which is what a real small blog looks
 * like — while A2's shortlist is still full. `--posts 5` empties the grid band entirely and
 * `--posts 1` leaves the cover alone on the page; both are worth looking at, and neither is worth
 * a second committed fixture.
 */
const shapes = SHAPES.slice(0, requested);

const posts = shapes.map((shape) => ({
	title: shape.title,
	slug: slugify(shape.title),
	/* `role` and `why` are fixture fields the importer ignores. They are here so the publication
	 * carries its own explanation: a later reader opening fixture-day-one.json finds out why each
	 * post exists without having to infer it from the prose. */
	role: shape.role ?? null,
	why: shape.why,
	html: shape.html,
	custom_excerpt: null,
	feature_image: null,
	feature_image_alt: null,
	published_at: `${shape.date}T09:00:00.000Z`,
	visibility: 'public',
	featured: false,
	author: AUTHOR.name,
	tags: [],
}));

const fixture = {
	version: 2,
	/*
	 * Four settings: the two Ghost's own setup wizard asks for, plus both menus. Everything else is
	 * left at the platform's default ON PURPOSE, and the one that matters most is `accent_color`:
	 * Ghost's default is `#FF1A75`, a hot pink (default-settings.json), so on a publication nobody
	 * has branded the theme's single chromatic token — every link hover, the date eyebrow, the
	 * subscribe button and both initial-monogram portraits — comes out pink rather than the amber
	 * the design was drawn in. That is the true first-day appearance and it is a finding, not
	 * something to paper over by writing an accent here.
	 *
	 * `portal_button` needs no line either: its platform default is already false, so the demo
	 * fixture's explicit `false` is belt-and-braces rather than a correction.
	 *
	 * import.mjs derives its settings list from the keys present here, so adding a key to this
	 * block is the whole of what it takes to start writing one.
	 */
	site: {
		title: 'Nadia Okonjo',
		description: 'Notes on attention, craft, and publishing alone.',
		/* Ghost's own default menus, stated rather than inherited so the fixture is the record of
		 * what the run tested. The secondary menu is empty, which is what an owner who has not
		 * touched Settings → Navigation has once they remove the sample item — and it is what put
		 * the theme's three empty <nav> landmarks on screen. */
		navigation: [
			{ label: 'Home', url: '/' },
			{ label: 'About', url: '/about/' },
		],
		secondary_navigation: [],
	},
	/* No tiers and no recommendations. An empty list is not a claim: import.mjs leaves Ghost's
	 * auto-created paid tier exactly as a buyer would have it, benefit-less and named after the
	 * site, and `recommendations_enabled` keeps whatever the platform defaults to. */
	tiers: [],
	recommendations: [],
	authors: [AUTHOR],
	tags: [],
	posts,
	pages: [ABOUT],
	/* `concessions` is read unguarded by import.mjs's closing report, so it has to exist. The demo
	 * fixture's `secondaries` does not: nothing outside build-fixture.mjs's own reconciliation ever
	 * asks for it, so it is not carried here. */
	concessions: [],
};

writeFileSync(FIXTURE, JSON.stringify(fixture, null, '\t') + '\n');

/* ── the two route lists ──────────────────────────────────────────────────────────────── */

/*
 * The absences are asserted, not merely unvisited. If `/tags/` ever gained a `route:` it would
 * render an empty Directory at 200 rather than a 404, and a list that only checked the Surfaces
 * that exist would pass that without a word. `status` is smoke.py's own field.
 *
 * The byte floors are lower than the demo publication's for the honest reason: seven short posts
 * make a smaller page than a hundred and four long ones, and a floor copied from the demo would
 * fail every Day-one Surface for being correct.
 */
const MIN = 6000;

const errorRoute = (path) => ({ path, status: 404, expect: 'data-surface="error-404"', min_bytes: 4000 });

const present = [
	{ path: '/', expect: 'data-surface="home"', min_bytes: MIN },
	...posts.map((post) => ({
		path: `/${post.slug}/`,
		expect: 'data-surface="post"',
		/* A Day-one post is not gated and the publication has no paid content at all, so the Gate
		 * must not appear. That is not provable by anything the page does contain. */
		absent: ['data-gate=', 'class="gh-post-upgrade-cta'],
		min_bytes: MIN,
	})),
	{ path: '/about/', expect: 'data-surface="page-about"', min_bytes: MIN },
	{ path: `/author/${AUTHOR.slug}/`, expect: 'data-surface="author"', min_bytes: MIN },
];

/*
 * Every Surface the demo publication owns and this one does not. They are Pages and a channel in
 * the demo, so here they are simply missing — which is the correct answer, and the theme's own
 * designed 404 is what a Day-one visitor following a stale link actually reaches.
 */
const absent = [
	'/tags/',
	'/authors/',
	'/membership/',
	'/recommendations/',
	'/sign-in/',
	'/sign-up/',
	/* A taxonomy route exists with zero Tags; only the slug is missing. */
	'/tag/essays/',
	/* Seven posts do not fill a page, so there is no page two under either routing. */
	'/page/2/',
].map(errorRoute);

writeFileSync(
	ROUTES,
	JSON.stringify(
		[...present, { path: '/archive/', expect: 'data-surface="feed"', min_bytes: MIN }, ...absent],
		null,
		'\t',
	) + '\n',
);

/* Bare: Ghost's defaults, nothing pasted into Labs → Routes. `/` is the posts collection, so
 * home.hbs still owns page 1 — and with seven posts there is no /page/2/ for index.hbs to
 * render, which is why the Feed is only reachable in the other pass. */
writeFileSync(ROUTES_BARE, JSON.stringify([...present, errorRoute('/archive/'), ...absent], null, '\t') + '\n');

/* ── the capture matrix and the width sweep ───────────────────────────────────────────── */

/*
 * One row per Surface per Layout per Mode, unscored. The Layout axis is a theme setting rather
 * than a URL, so the rows carry the settings they need and shoot.py groups by them exactly as the
 * score run does — `group` is a JSON string because that is the field's existing contract.
 *
 * Three of the seven posts are captured. The heading-free one, whose rail has no contents list;
 * the long-titled one, which is where the title wraps; and the one WITH headings, which is the
 * only page on which `toc.hbs`'s `<ol>` is filled by Alpine — the case the audit's EMPTYNAV rule
 * would false-positive on if `checkVisibility()` were not the test.
 *
 * BY DECLARED ROLE, NOT BY SNIFFING THE BODY. `posts.find(p => !p.html.includes('<h2>'))` looked
 * equivalent and was not: the long-titled post has no headings either, so it matched first and both
 * pairs of captures pointed at one URL — four files, two of them named after a post that was never
 * photographed. A role is stated once, beside the body it describes, and cannot resolve to the
 * wrong post.
 */
const byRole = (role) => posts.find((entry) => entry.role === role) ?? null;

/*
 * A ROLE THAT `--posts N` SLICED OFF CONTRIBUTES NO ROWS.
 *
 * The first version substituted `posts[0]`, which walked straight back into the bug the roles were
 * introduced to kill: `heading-free` is the oldest shape, so any N below seven made it resolve to
 * the long-titled post and the matrix captured one URL under four filenames — and `audit.mjs`'s
 * Set silently collapsed the duplicate rows, so the check count dropped with no explanation.
 * Dropping the rows instead keeps every filename meaning what it says, and the note names what is
 * missing rather than quietly standing something else in its place.
 */
const postSurfaces = [
	['post', 'heading-free'],
	['post-long', 'long-title'],
	['post-toc', 'headings'],
].flatMap(([name, role]) => {
	const post = byRole(role);
	if (!post) {
		console.log(`note: no post carries the role "${role}" at this size — ${name}-01/02 are not captured`);
		return [];
	}
	return [
		{ name: `${name}-01`, path: `/${post.slug}/`, settings: { post_layout: 'Centered classic' } },
		{ name: `${name}-02`, path: `/${post.slug}/`, settings: { post_layout: 'Title page' } },
	];
});

const SURFACES = [
	{ name: 'home-01', path: '/', settings: { homepage_layout: 'Magazine cover' } },
	{ name: 'home-02', path: '/', settings: { homepage_layout: 'Editorial masthead' } },
	{ name: 'feed-01', path: '/archive/', settings: { feed_layout: 'List' } },
	{ name: 'feed-02', path: '/archive/', settings: { feed_layout: 'Grid' } },
	...postSurfaces,
	{ name: 'about-01', path: '/about/', settings: { page_hero: 'Centered statement' } },
	{ name: 'about-02', path: '/about/', settings: { page_hero: 'Split hero' } },
	{ name: 'author-01', path: `/author/${AUTHOR.slug}/`, settings: {} },
	{ name: 'error-01', path: '/no-such-url-day-one/', settings: { page_hero: 'Centered statement' } },
	{ name: 'error-02', path: '/no-such-url-day-one/', settings: { page_hero: 'Split hero' } },
];

const MODES = ['light', 'dark'];

/*
 * `out` is a bare filename because shoot.py treats a relative `out` as relative to `--out-dir`,
 * and one 6000px height serves every row. The demo run takes its heights from the reference PNG
 * it is scored against; nothing here is scored, so the only real risk is a capture SHORTER than
 * the page — which would cut off the footer, and the footer is where Orphans live. Trailing blank
 * space on a short Surface is the cheaper mistake.
 *
 * `scored: false` IS THE WHOLE OF THE UNSCORED POLICY, and it belongs here rather than in a
 * wrapper. shoot.py still captures every job twice and still prints the measurement; what the flag
 * changes is the verdict — a pair that differs beyond the jitter bound is reported as `DRIFT …
 * [unscored]` and does not fail the run (scripts/verify/shoot.py:243-296). Measured on this
 * publication: one capture in twenty-six came out 5KB larger with visibly lighter type, which is
 * `font-display: swap` letting a frame paint before the variable font's optical size applied.
 * Eight controlled repeats were identical, so that is a paint race, not a page that moves — and a
 * page in that state is unfit to score and perfectly fit to look at, which is exactly what
 * shoot.py's own comment says the flag is for.
 */
const HEIGHT = 6000;

const jobs = [];
for (const surface of SURFACES) {
	for (const mode of MODES) {
		jobs.push({
			url: `${BASE}${surface.path}?mode=${mode}`,
			out: `day-one-${surface.name}-${mode}.png`,
			height: HEIGHT,
			width: 1568,
			scored: false,
			group: JSON.stringify(surface.settings),
		});
	}
}

writeFileSync(JOBS, JSON.stringify(jobs, null, '\t') + '\n');

/*
 * The width sweep visits each path once per settings group it appears in; the Mode is irrelevant
 * to geometry, so it is not an axis here. It runs with docs/routes.example.yaml applied, which is
 * the configuration in which every Surface is reachable — under bare routing `/archive/` does not
 * exist and the Feed's geometry would simply go unmeasured.
 */
const audit = SURFACES.map((surface) => ({ path: surface.path, settings: surface.settings }));
writeFileSync(AUDIT, JSON.stringify(audit, null, '\t') + '\n');

/* ── report ───────────────────────────────────────────────────────────────────────────── */

console.log(
	`day-one: ${posts.length} posts, 1 author (the owner), 0 tags, 0 images, ${fixture.pages.length} page, ` +
		`${Object.keys(fixture.site).length} settings`,
);
for (const post of posts) {
	console.log(`  /${post.slug}/ — ${post.why}`);
}
console.log(
	`\n${FIXTURE}\n${ROUTES} (${present.length + 1 + absent.length} routes)\n` +
		`${ROUTES_BARE} (${present.length + 1 + absent.length} routes)\n` +
		`${JOBS} (${jobs.length} captures)\n${AUDIT} (${audit.length} paths)`,
);

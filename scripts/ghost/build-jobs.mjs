/*
 * Generate the Ghost capture jobs and the score index from the Surface map.
 *
 *   node scripts/ghost/build-jobs.mjs
 *
 * The identity axis measures one thing: a Surface as Ghost renders it against the reference PNG the
 * design was drawn as, read next to the Floor that PNG's own design source scores. Two of those
 * three are already recorded for the reference build — `scripts/verify/baseline-index.json` holds
 * the PNG and the height it was rendered at, `baseline-scores.json` holds the Floor — so this script
 * replaces exactly one column: the URL. Nothing about the reference is re-derived here, because a
 * second copy of a Floor is a Floor that can drift.
 *
 * `surfaces.json` is the mapping, and it is the reviewable half: 27 Astro preview routes
 * (Surface × Layout) collapse onto the 14 `data-surface` values this theme emits, whose Layout is a
 * setting rather than a URL. A row that cannot be captured yet carries a `skip` naming what unblocks
 * it — scoring an A1 render against the A2 PNG would produce a number, and the number would be a lie.
 *
 * Paths come from `routes.json` by `data-surface` marker rather than being written again here:
 * `build-routes.mjs` already proves every one of those markers is present on its own Surface and
 * absent from the other eleven, so the harness captures the same URL the route map asserts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const SURFACES = 'scripts/ghost/surfaces.json';
const ROUTES = 'scripts/ghost/routes.json';
const FIXTURE = 'scripts/ghost/fixture.json';
const REFERENCE_INDEX = 'scripts/verify/baseline-index.json';
const UNSCORED = 'scripts/ghost/unscored.json';
const OUT_INDEX = 'scripts/ghost/score-index.json';
const OUT_JOBS = 'scripts/ghost/jobs.json';
const SHOTS = '.shots/ghost';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');

const surfaces = read(SURFACES);
const routes = read(ROUTES);
const fixture = read(FIXTURE);
const reference = read(REFERENCE_INDEX);

const problems = [];

/*
 * The Gate is a state of one Post rather than a Surface of its own, so the paywalled rows need a
 * members-only slug of their own. `routes.json` now carries that slug too — a Post that gates and
 * a Post that does not are both the Post Surface — which is exactly why the map below cannot read
 * whichever route mentions `data-surface="post"` last.
 */
const gated = fixture.posts.find((post) => post.designed && post.visibility !== 'public');
if (!gated) {
	problems.push('no designed members-only post in the fixture — the paywalled rows have nothing to capture');
}

/*
 * surface -> the route that IS that Surface and nothing else. A route claiming a second marker is
 * a state of a Surface (the gated Post claims `data-gate` as well), and capturing a Surface at its
 * gated slug would score the wrong page against every reference PNG the Surface has — silently,
 * because both pages are the Post Surface and both answer 200.
 *
 * The test is the marker COUNT, not the JSON shape: build-routes.mjs treats a bare string and a
 * one-element array as the same thing everywhere else, so reading `Array.isArray` here would make
 * a route stop registering its Surface over a spelling.
 */
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

const pathBySurface = new Map();
for (const route of routes) {
	const markers = list(route.expect);
	if (markers.length !== 1) {
		continue;
	}
	const surface = /data-surface="([^"]+)"/.exec(markers[0])?.[1];
	if (!surface) {
		continue;
	}
	if (pathBySurface.has(surface)) {
		problems.push(`two routes claim data-surface="${surface}" alone: ${pathBySurface.get(surface)} and ${route.path}`);
	}
	pathBySurface.set(surface, route.path);
}

const referenceByKey = new Map(reference.map((row) => [`${row.route}|${row.mode}`, row]));
const modes = [...new Set(reference.map((row) => row.mode))];

/* A Surface the map forgot is worse than one it defers: the run would report a clean sweep of a
 * smaller set than the design has. */
const mapped = new Set(surfaces.map((entry) => entry.route));
for (const route of new Set(reference.map((row) => row.route))) {
	if (!mapped.has(route)) {
		problems.push(`${route} is in ${REFERENCE_INDEX} but not in ${SURFACES} — every reference route needs a row`);
	}
}

const index = [];
const jobs = [];

for (const entry of surfaces) {
	const resolved =
		entry.path === '{gated_post}' ? `/${gated?.slug}/` : (entry.path ?? pathBySurface.get(entry.surface));
	if (!entry.skip && !resolved) {
		problems.push(`${entry.route}: no path — data-surface="${entry.surface}" is not in ${ROUTES}`);
	}

	for (const mode of modes) {
		const ref = referenceByKey.get(`${entry.route}|${mode}`);
		if (!ref) {
			problems.push(`${entry.route} ${mode}: no row in ${REFERENCE_INDEX}, so there is no reference PNG or height`);
			continue;
		}

		const out = `ghost-${entry.route}-${mode}.png`;
		const row = {
			route: entry.route,
			mode,
			layout: entry.layout,
			surface: entry.surface,
			path: resolved ?? null,
			status: entry.status ?? 200,
			settings: entry.settings ?? {},
			build: `${SHOTS}/${out}`,
			ref: basename(ref.ref),
			h: ref.h,
			w: ref.w,
		};
		if (entry.skip) {
			row.skip = entry.skip;
		}
		index.push(row);

		if (!entry.skip) {
			jobs.push({
				url: `${base}${resolved}?mode=${mode}`,
				out,
				height: ref.h,
				width: ref.w,
				group: JSON.stringify(row.settings),
			});
		}
	}
}

/*
 * THE UNSCORED ROWS.
 *
 * A Surface that exists to be looked at rather than compared cannot enter the index above: every
 * row there is keyed to a reference PNG out of `baseline-index.json`, and the style guide has none —
 * the design draws no audio player, no embed and no footnotes, which is exactly why that Page
 * exists. Inventing a baseline row to carry it would put a fabricated Floor in the file that holds
 * the real ones.
 *
 * So these rows are captured and never scored. They state their own height and width, because
 * there is no reference to read either from, and they are appended to the jobs with the empty
 * settings group so a Layout picker never has to know about them.
 *
 * `out` is overridable because a capture name is derived from the PATH here and from the ROUTE
 * above, and the two namespaces met: the drawing's sheet is still the `styleguide` route while
 * /styleguide/ is now this Page. The collision check below is what makes that safe to get wrong —
 * two jobs writing one filename is not a warning in the output, it is one row silently never
 * captured and a stale PNG scored in its place.
 */
for (const row of read(UNSCORED)) {
	for (const mode of modes) {
		jobs.push({
			url: `${base}${row.path}?mode=${mode}`,
			out: `${row.out ?? `ghost-${row.path.replace(/^\/|\/$/g, '')}`}-${mode}.png`,
			height: row.height,
			width: row.width,
			group: JSON.stringify({}),
			/* `shoot.py` fails a run on any capture that does not come out the same twice. These
			 * rows say they are not scored so that check reports instead of failing: the style
			 * guide's own images move it by a fraction of a pixel between passes, because Ghost's
			 * srcset variants round to different aspect ratios — the note in shoot.py has the
			 * measurement. A page nothing is measured against cannot fail a measurement. */
			scored: false,
		});
	}
}

const seen = new Map();
for (const job of jobs) {
	const first = seen.get(job.out);
	if (first) {
		problems.push(`two captures write ${job.out}: ${first} and ${job.url}`);
	} else {
		seen.set(job.out, job.url);
	}
}

if (problems.length) {
	console.error('refusing to write a capture set that does not cover the reference:');
	for (const problem of [...new Set(problems)]) {
		console.error(`  ${problem}`);
	}
	process.exit(1);
}

writeFileSync(OUT_INDEX, JSON.stringify(index, null, '\t') + '\n');
writeFileSync(OUT_JOBS, JSON.stringify(jobs, null, '\t') + '\n');

const pending = index.filter((row) => row.skip).length;
const groups = new Set(jobs.map((job) => job.group)).size;
console.log(
	`${index.length} rows over ${modes.length} Modes: ${jobs.length} captures in ${groups} settings ` +
		`group${groups === 1 ? '' : 's'}, ${pending} pending a layout picker`,
);

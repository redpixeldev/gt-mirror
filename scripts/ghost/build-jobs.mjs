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

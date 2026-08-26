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
 * members-only slug that no route config carries: `routes.json` asserts one marker per Surface and
 * `data-surface="post"` is already spoken for by the public Post.
 */
const gated = fixture.posts.find((post) => post.designed && post.visibility !== 'public');
if (!gated) {
	problems.push('no designed members-only post in the fixture — the paywalled rows have nothing to capture');
}

/* Every marker in routes.json is unique by construction, so surface -> path is a function. */
const pathBySurface = new Map();
for (const route of routes) {
	const surface = /data-surface="([^"]+)"/.exec(route.expect)?.[1];
	if (surface) {
		pathBySurface.set(surface, route.path);
	}
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

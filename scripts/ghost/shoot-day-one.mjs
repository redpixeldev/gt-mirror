/*
 * Capture the Day-one publication, in every Layout, in both Modes.
 *
 *   GHOST_URL=http://localhost:2369 GHOST_SESSION_FILE=.ghost-session-day-one.json \
 *     node --env-file=.env scripts/ghost/shoot-day-one.mjs
 *
 * WHY THIS EXISTS RATHER THAN A BARE shoot.py CALL, AND WHY IT DOES NOTHING ELSE. A Layout is a
 * theme setting, not a URL, so a capture set that spans Layouts has to drive the settings between
 * batches — `pnpm ghost:shots` gets away without it only because someone has already applied the
 * settings by hand. Pointed at a matrix spanning ten settings groups, a bare call would photograph
 * every Surface under whichever Layout happened to be live and name the files after Layouts nobody
 * rendered. Driving the settings is the whole of this file's job.
 *
 * In particular it does NOT decide what an unstable capture means. The jobs carry
 * `"scored": false` and shoot.py owns that policy already: it still captures twice and still
 * prints the measurement, and a pair beyond the jitter bound is reported as DRIFT rather than
 * failed. An earlier version of this file re-implemented that carve-out around the exit code, which
 * gave the harness two disagreeing answers to one question and condemned a whole settings group for
 * one bad frame.
 *
 * The settings are restored in a `finally`, through the same module the score run and the width
 * audit use, so a failed capture does not leave the publication showing a Layout its owner did not
 * choose. A Ctrl-C is not covered and cannot be: shoot.py runs under `spawnSync`, which blocks the
 * event loop, so no signal handler would get to run before the process died.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { base } from './admin.mjs';
import { applyThemeSettings, restoreThemeSettings } from './theme-settings.mjs';

const PYTHON = '.venv/bin/python3';
const JOBS = 'scripts/ghost/jobs-day-one.json';
const SHOTS = '.shots/day-one';

const jobs = JSON.parse(readFileSync(JOBS, 'utf8'));
if (!jobs.length) {
	throw new Error(`${JOBS} is empty — run scripts/ghost/build-day-one.mjs first`);
}

/*
 * The jobs carry absolute URLs so shoot.py can be run on one of them by hand, which means the file
 * pins an origin. A run pointed somewhere else would silently photograph the wrong publication, so
 * the mismatch is a failure rather than a rewrite.
 */
const foreign = jobs.filter((job) => !job.url.startsWith(`${base}/`));
if (foreign.length) {
	throw new Error(
		`${JOBS} points at ${new URL(foreign[0].url).origin} and this run is pointed at ${base}. ` +
			'Set GHOST_DAY_ONE_URL and re-run scripts/ghost/build-day-one.mjs.',
	);
}

mkdirSync(SHOTS, { recursive: true });

const groups = [...new Set(jobs.map((job) => job.group))];
let captured = 0;
const failed = [];

try {
	for (const group of groups) {
		await applyThemeSettings(JSON.parse(group));

		const batch = jobs.filter((job) => job.group === group);
		const file = `${SHOTS}/jobs-${groups.indexOf(group)}.json`;
		writeFileSync(file, JSON.stringify(batch, null, '\t') + '\n');

		console.log(`\ncapture    ${batch.length} shots with ${group}`);
		const result = spawnSync(PYTHON, ['scripts/verify/shoot.py', '--jobs', file, '--out-dir', SHOTS], {
			stdio: 'inherit',
		});

		/* Counted only when the batch actually ran. `spawnSync` reports `status: null` when the
		 * binary is missing, and the closing line is a claim about files on disk. */
		if (result.status === 0) {
			captured += batch.length;
		} else {
			failed.push(group);
			console.error(`\ncapture FAILED under ${group} (shoot.py exited ${result.status}) — continuing`);
		}
	}
} finally {
	for (const failure of await restoreThemeSettings()) {
		console.error(`NOT RESTORED ${failure} — put it back in Ghost admin before the next run`);
	}
}

console.log(
	`\n${captured}/${jobs.length} captures over ${groups.length} settings group(s) → ${SHOTS}/ — ` +
		'unscored, read them rather than diffing them',
);

/* A drifted capture is shoot.py's business and does not land here. This is shoot.py failing to
 * run at all, which means the artefacts are missing rather than uncertain. */
if (failed.length) {
	console.error(`\n${failed.length} settings group(s) did not capture: ${failed.join(', ')}`);
	process.exit(1);
}

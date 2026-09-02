/*
 * Score every Ghost Surface against the reference PNGs, in one command.
 *
 *   node --env-file=.env scripts/ghost/score.mjs [--refs DIR] [--max-drop N] [--only SUBSTRING]
 *   node --env-file=.env scripts/ghost/score.mjs --score-only     # re-score the captures on disk
 *
 * The gate for the port. Until this ran, no Surface ticket could prove it had not regressed: the
 * reference build's identity numbers were recorded against the design PNGs and nothing was pointed
 * at the Ghost render at all.
 *
 * Five things happen here, and four of them are refusals:
 *
 *   1. Smoke every URL the run is about to capture — status, byte floor, and the Surface's own
 *      `data-surface` marker read out of the live page. A 200 is not proof a Surface rendered, and
 *      an assertion nobody checked is worse than no assertion: this repo has shipped both.
 *   2. Refuse to capture while the publication is showing platform chrome no reference PNG contains
 *      — Portal's floating button, an announcement bar. Both are real settings, so the run turns
 *      them off and puts them back rather than hiding them in markup.
 *   3. Capture in settings groups. A Surface whose Layout is a setting is captured once per Layout,
 *      and a flip the API accepted but the front end ignored is caught by comparing the rendered
 *      bodies between groups: two Layouts that render byte-identical HTML are one Layout.
 *   4. Read Ghost's own log across the run. A template that throws inside a `{{#get}}` still answers
 *      200 with a plausible page; the error lands in the log where nobody is looking.
 *   5. Score, and report each capture against the noise floor its design source scores, as a
 *      signed gap.
 *
 * The identity gap is reported, not gated: with every Surface still below the reference build's
 * noise floor by design, an armed `--max-drop` would fail every run, so pass one deliberately once
 * a Surface has landed. What fails the run today is smoke, the settings read-back, the Layout guard
 * and the log — the four refusals above. The Ship ticket owns the first recorded Ghost floor.
 *
 * Layout, restore and log handling live here rather than in the Python harness on purpose: the
 * harness under `scripts/verify/` is copied between themes unchanged, and everything in this file
 * is Ghost's.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { api, base, request } from './admin.mjs';
import { applyThemeSettings, restoreThemeSettings } from './theme-settings.mjs';

const PYTHON = '.venv/bin/python3';
const INDEX = 'scripts/ghost/score-index.json';
const JOBS = 'scripts/ghost/jobs.json';
const FLOORS = 'scripts/verify/baseline-scores.json';
const SHOTS = '.shots/ghost';

/* Platform chrome the design never drew. Portal's floating button sits over the footer of every
 * Surface and an announcement bar pushes the whole page down, so either one silently costs every
 * capture in the run. They are settings, not markup, and they go back exactly as they were. */
const CAPTURE_SETTINGS = { portal_button: false, announcement_content: '' };

/*
 * The floor every captured Surface's rendered body must clear. Measured on this install: the
 * smallest body a Surface renders is the error Surface at 2,601 bytes and About at 2,631, while
 * `{{ghost_head}}` alone is 6.1 KB — so a whole-document floor cannot fail here and the byte
 * check has to measure what the theme is responsible for.
 */
const MIN_BODY_BYTES = 2000;

const logDir = process.env.GHOST_LOG_DIR ?? join(homedir(), 'ghost-mirror/content/logs');

const argv = process.argv.slice(2);
const VALUED = new Set(['--refs', '--max-drop', '--only']);
const BARE = new Set(['--score-only']);

/**
 * Refuse an argument this file does not understand.
 *
 * `--max-drop=0.5` parses to nothing under indexOf, so the run would score with no threshold while
 * the operator believed a gate was armed — the file's own cardinal sin, from a plausible typo.
 */
function validateArgv() {
	for (const [at, argument] of argv.entries()) {
		if (!argument.startsWith('--')) {
			if (!VALUED.has(argv[at - 1])) {
				throw new Error(`unexpected argument ${argument}`);
			}
			continue;
		}
		if (!VALUED.has(argument) && !BARE.has(argument)) {
			const hint = argument.includes('=') ? ' — flags take a separate value' : '';
			throw new Error(`unknown argument ${argument}${hint}`);
		}
		if (VALUED.has(argument) && (argv[at + 1] === undefined || argv[at + 1].startsWith('--'))) {
			throw new Error(`${argument} needs a value`);
		}
	}
}

const flag = (name) => {
	const at = argv.indexOf(name);
	return at === -1 ? undefined : argv[at + 1];
};
const only = flag('--only');
const refs = flag('--refs');
const maxDrop = flag('--max-drop');
const scoreOnly = argv.includes('--score-only');

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Run a child with its output on this terminal; a non-zero exit is this run's failure, not a stack. */
function run(command, args) {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${command} ${args[0]} exited ${result.status}`);
	}
}

const python = (args) => run(PYTHON, args);

/* ── settings, and putting them back ─────────────────────────────────────────────────── */

const restore = { settings: {} };

/**
 * Force the publication's own settings, remembering what they were.
 *
 * The write is read back because Ghost's settings endpoint filters the payload to keys it
 * recognises rather than rejecting it: a renamed or misspelled key is accepted with a 200 and
 * dropped, which would leave Portal's button over the footer of all 32 captures while the run
 * reported a clean sweep.
 */
async function applySettings(values) {
	const settings = async () =>
		Object.fromEntries((await api('GET', '/settings/')).settings.map((entry) => [entry.key, entry.value]));
	const current = await settings();
	const changes = Object.entries(values).filter(([key, value]) => (current[key] ?? '') !== value);
	if (!changes.length) {
		return;
	}
	for (const [key] of changes) {
		if (!(key in restore.settings)) {
			restore.settings[key] = current[key];
		}
	}
	await api('PUT', '/settings/', { settings: changes.map(([key, value]) => ({ key, value })) });
	const written = await settings();
	for (const [key, value] of changes) {
		if ((written[key] ?? '') !== value) {
			delete restore.settings[key];
			throw new Error(
				`${key} came back as ${JSON.stringify(written[key])}, not ${JSON.stringify(value)} — the ` +
					`publication is still showing chrome no reference PNG contains`,
			);
		}
	}
	console.log(`settings   ${changes.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ')}`);
}

/* The theme's own settings are driven by ./theme-settings.mjs, shared with the width audit and the
 * Day-one capture. The publication's settings above stay here: only this run forces them, because
 * only this run is comparing against reference PNGs that were drawn with Portal's button off. */

/**
 * Put every forced value back, the theme's through the shared module and the publication's here.
 *
 * Each write is independent and none of them may throw: this runs in a `finally`, where a throw
 * would replace the failure that brought the run here, and a half-restore would leave the live
 * publication mutated by a harness whose whole promise is that it does not.
 */
async function restoreSettings() {
	const failures = await restoreThemeSettings();
	const entries = Object.entries(restore.settings);
	if (entries.length) {
		try {
			await api('PUT', '/settings/', { settings: entries.map(([name, value]) => ({ key: name, value })) });
			console.log(`restored   ${entries.map(([name]) => name).join(', ')}`);
		} catch (error) {
			failures.push(`${entries.map(([name]) => name).join(', ')}: ${error.message}`);
		}
	}
	for (const failure of failures) {
		console.error(`NOT RESTORED ${failure} — put it back in Ghost admin before the next run`);
	}
}

/* ── Ghost's own log, across the run ─────────────────────────────────────────────────── */

/** Byte offsets of every log file, taken before the run so only this run's lines are read. */
function logCursor() {
	if (!existsSync(logDir)) {
		throw new Error(`no Ghost log directory at ${logDir} — set GHOST_LOG_DIR`);
	}
	const files = readdirSync(logDir).filter((name) => name.endsWith('.log'));
	if (!files.length) {
		throw new Error(`no .log files in ${logDir} — a run with no log to read cannot claim a clean one`);
	}
	return new Map(files.map((name) => [join(logDir, name), statSync(join(logDir, name)).size]));
}

/**
 * The one exclusion the log check makes — see logSince below for why.
 *
 * `ENOTFOUND` is a DNS failure on an outbound request Ghost made; the oembed provider message is
 * the same failure reported through the recommendation refresher. Neither can be produced by a
 * template.
 */
const UNRESOLVABLE = /"code":"ENOTFOUND"|No provider found for supplied URL/;

/**
 * Everything Ghost logged during the run that it considers an error.
 *
 * The dedicated `.error.log` is the signal: a front-end 404 does not reach it — measured, and it
 * matters, because the error Surface's capture would otherwise dirty every run. The main log
 * carries a line per request, so it is scanned for bunyan's error levels only.
 *
 * The directory is listed again rather than walked from the cursor: a log file created during the
 * run has no cursor entry, and a rotated one is smaller than its old offset. Either way the lines
 * are read from zero, because the alternative is discarding them and calling the log clean.
 *
 * ONE CLASS OF LINE IS EXCLUDED, AND ONLY ONE. Ghost refreshes a recommendation's metadata over
 * the network, and this publication's nine recommended publications are the design's inventions —
 * `secondread.club` and the rest resolve nowhere — so every run that touches the Recommendations
 * Surface logs `ENOTFOUND` and `No provider found for supplied URL` at level 50. That is the
 * demo content being fictional, not a Surface failing to render, and leaving it in would train
 * whoever runs this to ignore the check. The filter is deliberately narrow: an outbound fetch
 * that could not resolve, and nothing else. A template that throws still fails the run.
 */
async function logSince(cursor) {
	const dirty = [];
	for (const name of readdirSync(logDir).filter((entry) => entry.endsWith('.log'))) {
		const path = join(logDir, name);
		const size = statSync(path).size;
		const recorded = cursor.get(path) ?? 0;
		const offset = size < recorded ? 0 : recorded;
		if (size <= offset) {
			continue;
		}
		const buffer = Buffer.alloc(size - offset);
		const handle = await open(path, 'r');
		await handle.read(buffer, 0, buffer.length, offset);
		await handle.close();
		const lines = buffer.toString().split('\n').filter(Boolean);
		const relevant = name.endsWith('.error.log') ? lines : lines.filter((line) => /"level":(50|60)\b/.test(line));
		dirty.push(...relevant.filter((line) => !UNRESOLVABLE.test(line)).map((line) => `${name}: ${line.slice(0, 300)}`));
	}
	return dirty;
}

/* ── the capture set ─────────────────────────────────────────────────────────────────── */

/**
 * The rows and jobs this run covers.
 *
 * Regenerated every time: a `surfaces.json` edit that never reached the index would score the old
 * set and report it as the whole design.
 */
function captureSet() {
	run('node', ['scripts/ghost/build-jobs.mjs']);

	const index = read(INDEX).filter((row) => !only || row.route.includes(only));
	const jobs = read(JOBS).filter((job) => !only || job.out.includes(only));
	if (!index.length) {
		throw new Error(`--only ${only} matched no route in ${INDEX}`);
	}
	if (!scoreOnly && !jobs.length) {
		throw new Error(
			`all ${index.length} selected row(s) are pending, so this run would smoke nothing, capture ` +
				`nothing and score nothing`,
		);
	}

	let indexPath = INDEX;
	if (only) {
		indexPath = `${SHOTS}/score-index.json`;
		writeFileSync(indexPath, JSON.stringify(index, null, '\t') + '\n');
	}
	return { index, jobs, indexPath };
}

function smoke(index) {
	/* One entry per URL, not per capture: both Modes are the same document with a different class
	 * on <html>, resolved client-side from `?mode=`. */
	const seen = new Map();
	for (const row of index) {
		if (!row.skip && !seen.has(row.path)) {
			seen.set(row.path, {
				path: row.path,
				expect: `data-surface="${row.surface}"`,
				status: row.status,
				min_body_bytes: MIN_BODY_BYTES,
			});
		}
	}
	const routes = `${SHOTS}/smoke-routes.json`;
	writeFileSync(routes, JSON.stringify([...seen.values()], null, '\t') + '\n');
	python(['scripts/verify/smoke.py', '--base', base, '--routes', routes]);
}

async function capture(index, jobs) {
	await applySettings(CAPTURE_SETTINGS);

	const groups = [...new Set(jobs.map((job) => job.group))];
	const digests = new Map();

	for (const group of groups) {
		await applyThemeSettings(JSON.parse(group));

		/*
		 * A settings write the API accepted proves nothing about the render — the value can be
		 * orphaned, the template can ignore it. So the guard is on the Layout rather than on the
		 * setting: two Layouts of one URL must put different documents on screen, whether they
		 * differ by a setting this run flipped or were declared with the same one by mistake.
		 */
		const rows = index.filter((row) => !row.skip && JSON.stringify(row.settings) === group);
		for (const path of new Set(rows.map((row) => row.path))) {
			const expected = rows.find((entry) => entry.path === path).status;
			const response = await request(`${base}${path}`);
			if (response.status !== expected) {
				throw new Error(`${path} answered ${response.status}, expected ${expected}, under ${group}`);
			}
			const digest = createHash('sha256')
				.update(await response.text())
				.digest('hex')
				.slice(0, 12);
			const byLayout = digests.get(path) ?? new Map();
			for (const row of rows.filter((entry) => entry.path === path)) {
				for (const [layout, seen] of byLayout) {
					if (layout !== row.layout && seen === digest) {
						throw new Error(
							`${path} renders byte-identical HTML as Layout ${layout} and as Layout ` +
								`${row.layout} — one of those two captures is a duplicate of the other, so ` +
								`the Layout setting is not reaching the template`,
						);
					}
				}
				byLayout.set(row.layout, digest);
			}
			digests.set(path, byLayout);
		}

		const groupJobs = jobs.filter((job) => job.group === group);
		const file = `${SHOTS}/jobs-${groups.indexOf(group)}.json`;
		writeFileSync(file, JSON.stringify(groupJobs, null, '\t') + '\n');
		console.log(`\ncapture    ${groupJobs.length} shots with ${group}`);
		python(['scripts/verify/shoot.py', '--jobs', file, '--out-dir', SHOTS]);
	}
}

/* ── the run ─────────────────────────────────────────────────────────────────────────── */

async function main() {
	validateArgv();
	mkdirSync(SHOTS, { recursive: true });

	const { index, jobs, indexPath } = captureSet();

	if (!scoreOnly) {
		smoke(index);

		const cursor = logCursor();
		try {
			await capture(index, jobs);
		} finally {
			await restoreSettings();
		}

		const dirty = await logSince(cursor);
		if (dirty.length) {
			console.error(`\nGhost logged ${dirty.length} error line(s) during the run:`);
			for (const line of dirty.slice(0, 10)) {
				console.error(`  ${line}`);
			}
			throw new Error('a Surface that answers 200 over a caught error is not a Surface that rendered');
		}
	}

	console.log('');
	python([
		'scripts/verify/report.py',
		'--index',
		indexPath,
		'--floors',
		FLOORS,
		'--out',
		`${SHOTS}/scores.json`,
		...(refs ? ['--refs', refs] : []),
		...(maxDrop ? ['--max-drop', maxDrop] : []),
	]);
}

try {
	await main();
} catch (error) {
	console.error(`\n${error.message}`);
	process.exit(1);
}

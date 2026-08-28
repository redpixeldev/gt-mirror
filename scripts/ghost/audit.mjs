/*
 * The responsive audit, pointed at the Ghost theme.
 *
 *   node --env-file=.env scripts/ghost/audit.mjs
 *
 * Every Surface the theme draws, at twelve widths, in every Layout the publication can pick —
 * against the reference build's own rules, run unchanged. "No rule silently disabled" is the whole
 * point of the exercise, so `scripts/verify/probe-audit.js` is the single source of those rules and
 * this file refuses to run if `public/probe-mobile.html`'s inline copy has drifted from it.
 *
 * THE LAYOUTS ARE SETTINGS, NOT ROUTES. On the Astro build each Layout is its own URL, so one pass
 * covers all of them; here `/tags/` is one URL that renders two drawings depending on
 * `directory_layout`. The pass structure is therefore the score run's: group the Surfaces by the
 * settings they need, apply each group, audit the URLs it covers, and put the settings back.
 *
 * WHY CDP AND NOT A HEADLESS SCREENSHOT. The audit has to run JavaScript in the page and read a
 * value back, which `--dump-dom` cannot do without `--virtual-time-budget`, and virtual time makes
 * every `setTimeout` in the page fire at once — measured: a probe that waited for an iframe's load
 * event measured empty documents instead and reported a clean pass. Chrome's own debugging
 * protocol asks the question directly. Node ships a WebSocket client, so this needs no dependency
 * and no browser-automation library, and it sets the viewport rather than iframing anything:
 * headless Chrome will not open a WINDOW under about 500px, but `Emulation.setDeviceMetricsOverride`
 * has no such floor.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { api, base } from './admin.mjs';

const INDEX = 'scripts/ghost/score-index.json';
const RULES = 'scripts/verify/probe-audit.js';
const ASTRO_PROBE = 'public/probe-mobile.html';

/* The design's own breakpoints, and one pixel either side of each — a rule that only breaks at
 * exactly the width it turns on is the one nobody finds by resizing a window. */
const WIDTHS = [320, 380, 767, 768, 1023, 1024, 1199, 1200, 1279, 1280, 1535, 1536];

const CHROME_CANDIDATES = [
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/Applications/Chromium.app/Contents/MacOS/Chromium',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium-browser',
];

/**
 * The rule block, lifted from a file by its two landmarks.
 *
 * Both files are hand-written, so the block is identified by the first and last things in it — the
 * comment that opens the rules and whatever consumes them — rather than by line numbers.
 */
function rules(path) {
	const source = readFileSync(path, 'utf8');
	const start = source.indexOf('// an element clipped by an ancestor');
	const end = source.indexOf('const jobs = [];');
	const slice = end < 0 ? source.slice(start) : source.slice(start, end);
	if (start < 0 || !slice.trim()) {
		throw new Error(`${path}: cannot find the audit rule block — its landmarks moved`);
	}
	return slice.trim();
}

/* ── a minimal CDP client ────────────────────────────────────────────────────────────── */

function chromeBinary() {
	const found = CHROME_CANDIDATES.find((path) => existsSync(path));
	if (!found) {
		throw new Error('no Chrome or Chromium found');
	}
	return found;
}

/** Launch headless Chrome and resolve its DevTools endpoint, which it prints on stderr. */
function launch(profile) {
	const child = spawn(
		chromeBinary(),
		[
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--remote-debugging-port=0',
			`--user-data-dir=${profile}`,
			/*
			 * EXTERNAL DNS IS BLOCKED. Every Surface pulls Portal and sodo-search from a CDN out of
			 * {{ghost_head}}, and waiting on them turns 180 page loads into an afternoon. Nothing
			 * the audit measures depends on either script: what is under test is CSS.
			 */
			'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
			'about:blank',
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] },
	);

	return new Promise((resolve, reject) => {
		let buffer = '';
		const timer = setTimeout(() => reject(new Error('Chrome never printed a DevTools endpoint')), 30_000);
		child.stderr.on('data', (chunk) => {
			buffer += chunk;
			const match = buffer.match(/ws:\/\/[^\s]+/);
			if (match) {
				clearTimeout(timer);
				resolve({ child, endpoint: match[0] });
			}
		});
		child.on('exit', (code) => {
			clearTimeout(timer);
			reject(new Error(`Chrome exited ${code} before it was ready`));
		});
	});
}

/** One CDP connection, with `send` returning the result of a command and `once` awaiting an event. */
async function connect(endpoint) {
	const socket = new WebSocket(endpoint);
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', () => reject(new Error(`cannot reach ${endpoint}`)), { once: true });
	});

	let id = 0;
	const pending = new Map();
	const waiters = new Map();

	socket.addEventListener('message', (event) => {
		const message = JSON.parse(event.data);
		if (message.id && pending.has(message.id)) {
			const { resolve, reject } = pending.get(message.id);
			pending.delete(message.id);
			message.error ? reject(new Error(message.error.message)) : resolve(message.result);
		} else if (message.method && waiters.has(message.method)) {
			for (const resolve of waiters.get(message.method)) {
				resolve(message.params);
			}
			waiters.delete(message.method);
		}
	});

	return {
		send(method, params = {}, sessionId) {
			id += 1;
			const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };
			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject });
				socket.send(JSON.stringify(message));
			});
		},
		once(method, timeout = 20_000) {
			return new Promise((resolve, reject) => {
				const list = waiters.get(method) ?? [];
				list.push(resolve);
				waiters.set(method, list);
				setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeout);
			});
		},
		close: () => socket.close(),
	};
}

/* ── settings, and putting them back ─────────────────────────────────────────────────── */

const restore = {};

async function applyThemeSettings(values) {
	const entries = Object.entries(values);
	if (!entries.length) {
		return;
	}
	const current = await api('GET', '/custom_theme_settings/');
	const known = new Map(current.custom_theme_settings.map((setting) => [setting.key, setting.value]));
	for (const [key, value] of entries) {
		if (!known.has(key)) {
			throw new Error(`the theme declares no @custom.${key}, so this run cannot select that Layout`);
		}
		if (!(key in restore)) {
			restore[key] = known.get(key);
		}
		if (known.get(key) === value) {
			continue;
		}
		const written = await api('PUT', '/custom_theme_settings/', {
			custom_theme_settings: [{ key, value }],
		});
		const applied = written.custom_theme_settings.find((setting) => setting.key === key)?.value;
		if (applied !== value) {
			throw new Error(`@custom.${key} read back as ${JSON.stringify(applied)}, not ${JSON.stringify(value)}`);
		}
	}
}

async function restoreThemeSettings() {
	const entries = Object.entries(restore);
	if (!entries.length) {
		return;
	}
	await api('PUT', '/custom_theme_settings/', {
		custom_theme_settings: entries.map(([key, value]) => ({ key, value })),
	});
	console.log(`restored   ${entries.map(([key]) => key).join(', ')}`);
}

/* ── the run ─────────────────────────────────────────────────────────────────────────── */

async function main() {
	if (rules(RULES) !== rules(ASTRO_PROBE)) {
		throw new Error(
			`the audit rules in ${RULES} and ${ASTRO_PROBE} have drifted apart.\n` +
				'The probe carries its copy inline because it runs in a browser tab with no build step to\n' +
				'inject anything, and this check is the whole of what keeps the two builds audited by the\n' +
				'same rules. Reconcile them; do not delete this check.',
		);
	}

	spawnSync('node', ['scripts/ghost/build-jobs.mjs'], { stdio: 'inherit' });

	const index = JSON.parse(readFileSync(INDEX, 'utf8')).filter((row) => !row.skip && row.path);
	const groups = new Map();
	for (const row of index) {
		const key = JSON.stringify(row.settings ?? {});
		const paths = groups.get(key) ?? new Set();
		paths.add(row.path);
		groups.set(key, paths);
	}

	const source = readFileSync(RULES, 'utf8');
	const profile = mkdtempSync(join(tmpdir(), 'mirror-audit-'));
	const { child, endpoint } = await launch(profile);
	const browser = await connect(endpoint);

	let checks = 0;
	const failures = [];
	const declared = [];

	try {
		const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
		const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
		await browser.send('Page.enable', {}, sessionId);
		await browser.send('Runtime.enable', {}, sessionId);

		for (const [key, paths] of groups) {
			await applyThemeSettings(JSON.parse(key));

			for (const width of WIDTHS) {
				await browser.send(
					'Emulation.setDeviceMetricsOverride',
					{ width, height: 900, deviceScaleFactor: 1, mobile: false },
					sessionId,
				);

				for (const path of paths) {
					const loaded = browser.once('Page.loadEventFired');
					await browser.send('Page.navigate', { url: `${base}${path}` }, sessionId);
					await loaded;

					const { result, exceptionDetails } = await browser.send(
						'Runtime.evaluate',
						{
							expression: `(() => { ${source}\nreturn JSON.stringify(audit(document, ${width})); })()`,
							returnByValue: true,
						},
						sessionId,
					);
					if (exceptionDetails) {
						throw new Error(`${path} @${width}px: ${exceptionDetails.text}`);
					}

					checks += 1;
					for (const problem of JSON.parse(result.value)) {
						/* A declared exception is reported, never hidden: it is the difference between
						 * a rule with a documented carve-out and a rule quietly turned off. */
						const line = `${path} @${width}px  ${problem}`;
						(problem.startsWith('DECLARED ') ? declared : failures).push(line);
					}
				}
			}
		}
	} finally {
		browser.close();
		child.kill();
		rmSync(profile, { recursive: true, force: true });
		await restoreThemeSettings();
	}

	for (const note of declared) {
		console.log(note);
	}
	for (const failure of failures) {
		console.log(failure);
	}
	console.log(
		`\n${checks} checks over ${groups.size} settings group(s): ${failures.length} failure(s), ` +
			`${declared.length} declared scroll container(s)`,
	);
	if (failures.length) {
		process.exit(1);
	}
}

try {
	await main();
} catch (error) {
	console.error(`\n${error.message}`);
	process.exit(1);
}

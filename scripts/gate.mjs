/*
 * The done-gate: every check a change to the theme has to pass, in one command.
 *
 *   node scripts/gate.mjs                     (pnpm gate)          everything
 *   node scripts/gate.mjs --static            (pnpm gate:static)   no Ghost needed — the pre-commit hook and CI
 *   node scripts/gate.mjs --static --staged   prettier/eslint on the staged files only (the hook)
 *   node scripts/gate.mjs --static --base REF prettier/eslint on files changed since REF (CI)
 *
 * WHY ONE COMMAND. The list used to live in an agent's memory and was retyped as a different
 * `pnpm a; pnpm b; …` chain on every run, so each run checked a different subset — and the checks
 * that needed the Day-one Ghost were reported "not run, :2369 is down" four times in one session
 * without anyone starting it. Here a Ghost that is not listening fails the gate before anything
 * runs, with the command that starts it. Nothing is skipped quietly.
 *
 * Each check's full output goes to a log file; the terminal gets one PASS/FAIL line per check,
 * plus the tail of the log for a failure. A failed build stops the run, because every later check
 * would read stale assets.
 *
 * Prettier and ESLint see changed files only (against HEAD, the index, or --base), not the tree:
 * the reference build has files that predate the formatter and whose rendered whitespace the
 * parity scores depend on, so reformatting them is a decision, not a gate.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const baseAt = argv.indexOf('--base');
const base = baseAt >= 0 ? argv[baseAt + 1] : null;
for (const [index, arg] of argv.entries()) {
	const isRef = baseAt >= 0 && index === baseAt + 1;
	if (!isRef && !['--static', '--staged', '--base'].includes(arg)) {
		throw new Error(`unknown argument ${arg}`);
	}
}
if (baseAt >= 0 && !base) {
	throw new Error('--base needs a git ref');
}

const STATIC = flag('--static');
const LOGS = join(tmpdir(), 'mirror-gate');
mkdirSync(LOGS, { recursive: true });

/* The three local Ghosts, each with its own config in ~/ghost-mirror (ghost/README.md, Development). */
const GHOST = '/opt/homebrew/opt/node@22/bin/node current/index.js';
const INSTANCES = {
	2368: { name: 'scored install', start: `cd ~/ghost-mirror && NODE_ENV=development ${GHOST}` },
	2369: { name: 'Day-one publication', start: `cd ~/ghost-mirror && NODE_ENV=day-one ${GHOST}` },
	2370: { name: 'Demo site', start: `cd ~/ghost-mirror && NODE_ENV=demo ${GHOST}` },
};

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

function changedFiles() {
	if (flag('--staged')) {
		return git('diff', '--cached', '--name-only', '--diff-filter=ACMR');
	}
	if (base) {
		if (spawnSync('git', ['cat-file', '-e', `${base}^{commit}`]).status !== 0) {
			throw new Error(`--base ${base} is not a commit in this clone`);
		}
		return git('diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`);
	}
	return [
		...git('diff', '--name-only', '--diff-filter=ACMR', 'HEAD'),
		...git('ls-files', '--others', '--exclude-standard'),
	];
}

const files = changedFiles();
const lintable = files.filter((file) => /\.(m?js|ts|astro)$/.test(file));

/* `needs` is the port a check talks to; `fatal` stops the run when it fails. */
const checks = [
	{ name: 'build', cmd: 'pnpm -s ghost:build', fatal: true },
	{ name: 'gscan', cmd: 'pnpm -s ghost:scan' },
	{ name: 'demo-host', cmd: 'pnpm -s demo-host:test' },
	{
		name: 'prettier',
		cmd: files.length ? ['npx', 'prettier', '--check', '--ignore-unknown', ...files] : null,
	},
	{
		name: 'eslint',
		cmd: lintable.length ? ['npx', 'eslint', '--no-warn-ignored', ...lintable] : null,
	},
	{ name: 'fixture', cmd: 'pnpm -s ghost:verify', needs: 2368 },
	{ name: 'smoke', cmd: 'pnpm -s ghost:smoke', needs: 2368 },
	{ name: 'audit', cmd: 'pnpm -s ghost:audit', needs: 2368 },
	{ name: 'day-one', cmd: 'pnpm -s day-one', needs: 2369 },
	{ name: 'demo', cmd: 'pnpm -s demo', needs: 2370 },
].filter((check) => !(STATIC && check.needs));

const listening = (port) =>
	new Promise((resolve) => {
		const socket = connect({ port, host: '127.0.0.1' });
		const settle = (up) => {
			socket.destroy();
			resolve(up);
		};
		socket.setTimeout(1000);
		socket.once('connect', () => settle(true));
		socket.once('error', () => settle(false));
		socket.once('timeout', () => settle(false));
	});

const ports = [...new Set(checks.map((check) => check.needs).filter(Boolean))];
const down = [];
for (const port of ports) {
	if (!(await listening(port))) {
		down.push(port);
	}
}

if (down.length) {
	console.error('gate: not started.\n');
	for (const port of down) {
		console.error(`  :${port}  ${INSTANCES[port].name} is not listening. Start it:`);
		console.error(`         ${INSTANCES[port].start}\n`);
	}
	process.exit(1);
}

const results = [];
for (const check of checks) {
	if (!check.cmd) {
		results.push({ ...check, status: 'PASS', note: 'no changed files of this kind' });
		console.log(`PASS  ${check.name.padEnd(9)} no changed files of this kind`);
		continue;
	}

	const started = Date.now();
	const run = Array.isArray(check.cmd)
		? spawnSync(check.cmd[0], check.cmd.slice(1), { encoding: 'utf8', maxBuffer: 1 << 28 })
		: spawnSync(check.cmd, { shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
	const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? `\n${run.error.message}` : ''}`;
	const log = join(LOGS, `${check.name}.log`);
	writeFileSync(log, output);

	const seconds = ((Date.now() - started) / 1000).toFixed(1);
	const status = run.status === 0 ? 'PASS' : 'FAIL';
	/* The verdict a check prints is on stdout; npm's config warnings land on stderr after it, and a
	 * silent pass (eslint) has no verdict at all. */
	const verdict = run.stdout?.trim() || (run.status === 0 ? 'ok' : output.trim());
	const last = verdict.split('\n').at(-1) ?? '';
	results.push({ ...check, status });
	console.log(`${status}  ${check.name.padEnd(9)} ${`${seconds}s`.padStart(7)}  ${last.slice(0, 110)}`);

	if (status === 'FAIL') {
		console.log(`      log: ${log}`);
		console.log(
			output
				.trim()
				.split('\n')
				.slice(-30)
				.map((line) => `      │ ${line}`)
				.join('\n'),
		);
		if (check.fatal) {
			console.log(`\ngate: stopped — ${check.name} failed and every later check depends on it.`);
			process.exit(1);
		}
	}
}

const failed = results.filter((result) => result.status === 'FAIL');
console.log(
	`\ngate${STATIC ? ' (static)' : ''}: ${results.length - failed.length}/${results.length} passed` +
		(failed.length ? ` — failed: ${failed.map((result) => result.name).join(', ')}` : ''),
);
process.exit(failed.length ? 1 : 0);

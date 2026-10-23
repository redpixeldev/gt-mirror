/*
 * Watch mode for the theme stylesheet.
 *
 * `pnpm ghost:css` is two steps — the Tailwind CLI, then the font-URL rewrite — and
 * Tailwind's own --watch only knows about the first. Handing `--watch` to the composed
 * script would pass the flag to the rewrite step instead, and a watcher that skipped the
 * rewrite would serve a stylesheet whose @font-face rules all 404: the theme would develop
 * in Georgia and nobody would trust the type until a one-shot build.
 *
 * So: spawn the CLI in watch mode writing to a scratch file outside the theme, and on every
 * write run the rewrite from that file into assets/built/screen.css, which it replaces in one
 * rename. Ghost never sees Tailwind's raw output, so no request can land between the two
 * steps and get a stylesheet with absolute font URLs (see rewrite-font-urls.mjs).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, watch } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { rewriteFontUrls } from './rewrite-font-urls.mjs';

/* Outside ghost/, so neither the theme zip nor Tailwind's own source scan ever sees it. */
const RAW = resolve('node_modules/.cache/mirror/screen.css');
mkdirSync(dirname(RAW), { recursive: true });

const tailwind = spawn('tailwindcss', ['-i', 'assets/css/screen.css', '-o', RAW, '--minify', '--watch'], {
	cwd: 'ghost',
	stdio: 'inherit',
});

tailwind.on('exit', (code) => process.exit(code ?? 0));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => tailwind.kill(signal));
}

let pending;

const publish = () => {
	clearTimeout(pending);
	pending = setTimeout(() => {
		try {
			const result = rewriteFontUrls({ from: RAW });
			console.log(`fonts: rewrote ${result.rewritten} URL(s) · ${(result.bytes / 1024).toFixed(1)} KB`);
		} catch (error) {
			console.error(`fonts: ${error.message}`);
		}
	}, 60);
};

/* The directory, not the file: Tailwind replaces its output by rename, and a watch on the file
 * follows the old inode and never fires again after the first build. Attached in this tick, so
 * before the CLI can have written anything. */
const watcher = watch(dirname(RAW), (event, name) => {
	if (name === basename(RAW)) {
		publish();
	}
});

process.on('exit', () => watcher.close());

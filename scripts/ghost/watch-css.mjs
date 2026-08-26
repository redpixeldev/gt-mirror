/*
 * Watch mode for the theme stylesheet.
 *
 * `pnpm ghost:css` is two steps — the Tailwind CLI, then the font-URL rewrite — and
 * Tailwind's own --watch only knows about the first. Handing `--watch` to the composed
 * script would pass the flag to the rewrite step instead, and a watcher that skipped the
 * rewrite would serve a stylesheet whose @font-face rules all 404: the theme would develop
 * in Georgia and nobody would trust the type until a one-shot build.
 *
 * So: spawn the CLI in watch mode and re-run the rewrite whenever it writes the output.
 * The rewrite is called non-strict here because our own write re-triggers the watcher and
 * the second pass legitimately finds nothing to do.
 */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { rewriteFontUrls, BUILT_CSS } from './rewrite-font-urls.mjs';

const tailwind = spawn(
	'tailwindcss',
	['-i', 'assets/css/screen.css', '-o', 'assets/built/screen.css', '--minify', '--watch'],
	{ cwd: 'ghost', stdio: 'inherit' },
);

tailwind.on('exit', (code) => process.exit(code ?? 0));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => tailwind.kill(signal));
}

let pending;
let watcher;

const attach = () => {
	try {
		watcher = watch(BUILT_CSS, () => {
			clearTimeout(pending);
			pending = setTimeout(() => {
				try {
					const result = rewriteFontUrls({ strict: false });
					if (result) {
						console.log(`fonts: rewrote ${result.rewritten} URL(s) · ${(result.bytes / 1024).toFixed(1)} KB`);
					}
				} catch (error) {
					console.error(`fonts: ${error.message}`);
				}
			}, 60);
		});
	} catch {
		// The CLI has not written the file yet — try again once it exists.
		setTimeout(attach, 250);
	}
};

attach();

process.on('exit', () => watcher?.close());

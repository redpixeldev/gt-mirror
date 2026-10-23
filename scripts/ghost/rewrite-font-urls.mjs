/*
 * Rewrite the @font-face URLs in the built theme stylesheet.
 *
 * src/styles/fonts.css is the single source of truth for MIRROR's two families, and it
 * spells its URLs `/fonts/…` — correct for Astro, where the files are served out of
 * public/. In the theme the same files live at ghost/assets/fonts/ and the stylesheet is
 * served from ghost/assets/built/, so the correct reference is `../fonts/…`.
 *
 * Relative, not absolute: a Ghost site can be mounted in a subdirectory, where the theme's
 * assets are under /<subdir>/assets/. `../fonts/` resolves correctly in both cases and
 * `/assets/fonts/` does not.
 *
 * This is not a formatting pass — a silent no-op here means every font 404s and the theme
 * renders in Georgia. So a one-shot build asserts, in both directions:
 *   - the stylesheet has font URLs, and none is left absolute;
 *   - every face the stylesheet asks for exists on disk;
 *   - every file on disk is asked for by the stylesheet (no dead payload in the zip).
 *
 * Finding the URLs already relative is not a failure: a one-shot `pnpm ghost:css` can find a file
 * the watcher has already rewritten. That case is still checked against the disk and only the
 * write is skipped. What fails is a stylesheet with no font URL in either form.
 *
 * THE SERVED FILE IS NEVER HALF-DONE. The watcher has Tailwind write elsewhere and passes that
 * file as `from`, and every write here is a rename over BUILT_CSS. Ghost therefore never serves a
 * stylesheet whose font URLs are still absolute. Before this, the watcher let Tailwind write
 * BUILT_CSS directly and rewrote it 60ms later; a page captured in that window rendered in
 * fallback fonts, and `ghost:score` failed it as unstable.
 */
import { readFileSync, renameSync, writeFileSync, readdirSync } from 'node:fs';

export const BUILT_CSS = 'ghost/assets/built/screen.css';
const FONT_DIR = 'ghost/assets/fonts';

// url(/fonts/x.woff2), url('/fonts/x.woff2'), url("/fonts/x.woff2") — Tailwind's minifier
// is free to drop the quotes, so all three forms have to be handled.
const ABSOLUTE = /url\((\s*['"]?)\/fonts\//g;
const RELATIVE = /url\(\s*['"]?\.\.\/fonts\/([^'")]+?)['"]?\s*\)/g;

/**
 * @param {{ from?: string }} [options] `from` is Tailwind's output: BUILT_CSS itself for a
 *   one-shot build, the watcher's scratch file in watch mode.
 * @returns {{ rewritten: number, faces: number, files: number, bytes: number }}
 *   `rewritten` is 0 when `from` was BUILT_CSS and already relative; then nothing was written.
 */
export function rewriteFontUrls({ from = BUILT_CSS } = {}) {
	const before = readFileSync(from, 'utf8');
	const rewritten = (before.match(ABSOLUTE) || []).length;
	const after = before.replace(ABSOLUTE, 'url($1../fonts/');

	if (!after.match(RELATIVE)) {
		throw new Error(
			`${from}: no /fonts/ URL found. Either fonts.css stopped being imported, or its URLs ` +
				`changed shape — this step would otherwise have shipped a stylesheet with no usable fonts.`,
		);
	}

	const leftover = after.match(/url\(\s*['"]?\//g);
	if (leftover) {
		throw new Error(`${from}: ${leftover.length} absolute asset URL(s) survived the rewrite.`);
	}

	const referenced = new Set([...after.matchAll(RELATIVE)].map((m) => m[1]));
	const onDisk = new Set(readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2')));

	const missing = [...referenced].filter((f) => !onDisk.has(f));
	if (missing.length) {
		throw new Error(`${FONT_DIR}: the stylesheet references ${missing.length} missing file(s): ${missing.join(', ')}`);
	}

	const orphaned = [...onDisk].filter((f) => !referenced.has(f));
	if (orphaned.length) {
		throw new Error(
			`${FONT_DIR}: ${orphaned.length} file(s) ship in the theme but no @font-face asks for them: ` +
				`${orphaned.join(', ')}. Delete them, or declare them in src/styles/fonts.css.`,
		);
	}

	if (rewritten > 0 || from !== BUILT_CSS) {
		const staged = `${BUILT_CSS}.${process.pid}.tmp`;
		writeFileSync(staged, after);
		renameSync(staged, BUILT_CSS);
	}

	return { rewritten, faces: referenced.size, files: onDisk.size, bytes: Buffer.byteLength(after) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const result = rewriteFontUrls();
	const action = result.rewritten
		? `rewrote ${result.rewritten} font URL(s) to ../fonts/`
		: 'font URLs already relative (the ghost:dev watcher got there first)';
	console.log(
		`${action} · ${result.faces} faces · ${result.files} files · ${(result.bytes / 1024).toFixed(1)} KB stylesheet`,
	);
}

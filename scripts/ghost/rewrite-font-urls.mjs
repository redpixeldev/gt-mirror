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
 *   - at least one URL was rewritten, and none is left absolute;
 *   - every face the stylesheet asks for exists on disk;
 *   - every file on disk is asked for by the stylesheet (no dead payload in the zip).
 *
 * Run directly for a build; import `rewriteFontUrls` from the watcher, which re-reads a
 * file it has already rewritten and must be allowed to find nothing to do.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

export const BUILT_CSS = 'ghost/assets/built/screen.css';
const FONT_DIR = 'ghost/assets/fonts';

// url(/fonts/x.woff2), url('/fonts/x.woff2'), url("/fonts/x.woff2") — Tailwind's minifier
// is free to drop the quotes, so all three forms have to be handled.
const ABSOLUTE = /url\((\s*['"]?)\/fonts\//g;
const RELATIVE = /url\(\s*['"]?\.\.\/fonts\/([^'")]+?)['"]?\s*\)/g;

/**
 * @param {{ strict?: boolean }} [options] `strict` fails a build that had nothing to
 *   rewrite; the watcher passes it false because its own output is already rewritten.
 * @returns {{ rewritten: number, faces: number, files: number, bytes: number } | null}
 *   null when the stylesheet was already relative and nothing needed doing.
 */
export function rewriteFontUrls({ strict = true } = {}) {
	const before = readFileSync(BUILT_CSS, 'utf8');
	const rewritten = (before.match(ABSOLUTE) || []).length;

	if (rewritten === 0) {
		if (!strict) {
			return null;
		}
		throw new Error(
			`${BUILT_CSS}: no /fonts/ URL found. Either fonts.css stopped being imported, or its URLs ` +
				`changed shape — this step would otherwise have shipped a stylesheet with no usable fonts.`,
		);
	}

	const after = before.replace(ABSOLUTE, 'url($1../fonts/');

	const leftover = after.match(/url\(\s*['"]?\//g);
	if (leftover) {
		throw new Error(`${BUILT_CSS}: ${leftover.length} absolute asset URL(s) survived the rewrite.`);
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

	writeFileSync(BUILT_CSS, after);

	return { rewritten, faces: referenced.size, files: onDisk.size, bytes: Buffer.byteLength(after) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const result = rewriteFontUrls();
	console.log(
		`rewrote ${result.rewritten} font URL(s) to ../fonts/ · ${result.faces} faces · ${result.files} files · ` +
			`${(result.bytes / 1024).toFixed(1)} KB stylesheet`,
	);
}

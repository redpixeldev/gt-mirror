/*
 * Vendor microlighter into ghost/assets/built/microlighter/.
 *
 * A Ghost theme is a zip with no install step, so every byte the browser fetches has to be inside
 * it. `ghost/assets/built/` is gitignored — it is generated — which makes this a build step rather
 * than a committed copy.
 *
 * WHY A COPY AND NOT A BUNDLE. `pnpm ghost:js` bundles the theme runtime with esbuild, and this
 * library cannot go through it: `dist/grammar-dependencies.js` loads grammars with
 * `import(`./grammars/${language}.js`)`, a template literal esbuild cannot resolve. Bundled, that
 * specifier survives into `built/main.js` and resolves against `built/`, so every grammar is a 404
 * — and the loader swallows it (`.catch(() => null)`), so the page renders unhighlighted with
 * nothing in the console. Copied, the specifier resolves beside the module that wrote it and each
 * grammar is fetched only by a page that uses its language.
 *
 * WHAT IS COPIED. The programmatic entry, its tokenizer, its loader, and the 37 grammars: 78 KB on
 * disk, of which a reader fetches ~14 KB plus one grammar (json is 397 bytes, javascript 3.8 KB).
 * Not copied: the auto-runner and the custom element, because default.hbs calls `highlightAll()`
 * itself with the theme's language aliases; and `themes/`, because MIRROR's Syntax palette is
 * written in assets/css/screen.css against the design's own tokens — see DECISIONS.md and
 * docs/adr/0001-mirror-authors-its-own-syntax-palette.md.
 */
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FROM = 'node_modules/microlighter/dist';
const TO = 'ghost/assets/built/microlighter';

/* The runtime the guarded module in default.hbs actually reaches. */
const FILES = ['index.js', 'highlight.js', 'grammar-dependencies.js'];
const DIRS = ['grammars'];

for (const name of [...FILES, ...DIRS]) {
	if (!statSync(join(FROM, name), { throwIfNoEntry: false })) {
		throw new Error(`microlighter is not installed as expected: ${join(FROM, name)} is missing. Run pnpm install.`);
	}
}

/* Removed first: a stale grammar left behind by an older version would still be served. */
rmSync(TO, { recursive: true, force: true });
mkdirSync(dirname(TO), { recursive: true });
mkdirSync(TO, { recursive: true });

for (const name of FILES) {
	cpSync(join(FROM, name), join(TO, name));
}
for (const name of DIRS) {
	cpSync(join(FROM, name), join(TO, name), { recursive: true });
}

const bytes = [...FILES.map((n) => statSync(join(TO, n)).size)].reduce((a, b) => a + b, 0);
const grammars = readdirSync(join(TO, 'grammars'));
const grammarBytes = grammars.reduce((a, n) => a + statSync(join(TO, 'grammars', n)).size, 0);

console.log(
	`microlighter: ${FILES.length} modules (${bytes} B) and ${grammars.length} grammars (${grammarBytes} B) → ${TO}`,
);

/*
 * Assert that ghost/locales/en.json and the {{t}} calls in the templates agree, in both
 * directions.
 *
 * Every literal UI string in this theme goes through {{t}} from the first partial written,
 * because retrofitting it means re-touching and re-scoring every partial. That convention is
 * only worth anything if it is checked: a missing key renders the English source string, so
 * the page looks right and the translation is silently dead, and an orphaned key looks like a
 * string that still exists.
 *
 * Both failures are invisible in a browser, which is why this is a build step.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const THEME = 'ghost';
const LOCALE = join(THEME, 'locales', 'en.json');

/** Every `{{t "…"}}` / `(t "…")` argument, including the first of a subexpression. */
const T_CALL = /\(?\bt\s+"((?:[^"\\]|\\.)*)"/g;

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			return entry === 'assets' || entry === 'locales' ? [] : walk(path);
		}
		return path.endsWith('.hbs') ? [path] : [];
	});
}

const templates = walk(THEME);
const used = new Map();

for (const path of templates) {
	const source = readFileSync(path, 'utf8');
	for (const [, key] of source.matchAll(T_CALL)) {
		if (!used.has(key)) {
			used.set(key, []);
		}
		used.get(key).push(path);
	}
}

const declared = JSON.parse(readFileSync(LOCALE, 'utf8'));

const missing = [...used.keys()].filter((k) => !(k in declared));
const orphaned = Object.keys(declared).filter((k) => !used.has(k));

const problems = [];
if (missing.length) {
	problems.push(
		`${LOCALE} is missing ${missing.length} key(s) used by templates:\n` +
			missing.map((k) => `  ${JSON.stringify(k)} — ${used.get(k).join(', ')}`).join('\n'),
	);
}
if (orphaned.length) {
	problems.push(
		`${LOCALE} declares ${orphaned.length} key(s) no template uses:\n` +
			orphaned.map((k) => `  ${JSON.stringify(k)}`).join('\n'),
	);
}

if (problems.length) {
	console.error(problems.join('\n\n'));
	process.exit(1);
}

console.log(`locales: ${used.size} key(s) across ${templates.length} template(s), en.json in sync`);

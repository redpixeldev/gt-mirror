/*
 * Prove a refactor left the rendered HTML unchanged.
 *
 *   node --env-file=.env scripts/ghost/snapshot.mjs capture <dir>   (pnpm ghost:snapshot <dir>)
 *   node scripts/ghost/snapshot.mjs diff <a> <b>                     (pnpm ghost:snapshot:diff <a> <b>)
 *
 * Capture before the change, capture after, diff the two directories. `diff` exits 1 when any page
 * differs or exists on one side only.
 *
 * TWO SETTINGS GROUPS, because a Layout is a setting rather than a URL: `default` forces the first
 * option of every Layout setting, `alternate` the second, so both drawings of every Layout-bearing
 * Surface are on disk. The Layout settings are the keys `surfaces.json` drives; their options come
 * from `ghost/package.json`. The publication's own values are put back in a `finally`.
 *
 * THE URL LIST IS DERIVED, not written here. `routes.json` (what smoke checks) supplies the
 * Surfaces; `surfaces.json` adds the literal paths it carries that routes.json cannot (the real
 * 404); the Feed — found by its `data-surface` marker — adds its page 2; and `fixture.json` adds one
 * Post for every Gate state (`visibility`) the list does not already reach.
 *
 * Each file is `<group>_<slugified path>.html`, HTTP status on line 1, body after. Capture is
 * signed out, which is the state every Gate renders its designed panel in.
 *
 * NOISE `diff` IGNORES, each one observed:
 *   - whitespace runs: Ghost compiles with preventIndent:true, so moving markup into a partial
 *     shifts its indentation and nothing else;
 *   - `article:modified_time` / `dateModified`: they bump whenever the record is saved, even when
 *     the save leaves its content as it was;
 *   - the `?v=` asset cache-buster: a hash of the asset file's content, so it moves whenever
 *     `assets/built/` is rebuilt, though no template changed.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [command, ...args] = process.argv.slice(2);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** `/tag/interviews/` → `tag-interviews`; `/` → `home`. */
const slugify = (path) => path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home';

/** The two settings groups: every Layout setting at its first option, and at its second. */
function groups() {
	const custom = readJson('ghost/package.json').config.custom;
	const keys = [...new Set(readJson('scripts/ghost/surfaces.json').flatMap((row) => Object.keys(row.settings ?? {})))];
	const pick = (index) => Object.fromEntries(keys.map((key) => [key, custom[key].options[index]]));
	return { default: pick(0), alternate: pick(1) };
}

function paths() {
	const routes = readJson('scripts/ghost/routes.json');
	const list = routes.map((route) => route.path);

	for (const row of readJson('scripts/ghost/surfaces.json')) {
		if (row.path?.startsWith('/')) {
			list.push(row.path);
		}
	}

	const feed = routes.find((route) => [route.expect].flat().includes('data-surface="feed"'));
	if (!feed) {
		throw new Error('routes.json has no data-surface="feed" row, so the Feed has no page 2 to capture');
	}
	list.push(`${feed.path}page/2/`);

	const posts = readJson('scripts/ghost/fixture.json').posts;
	const visibilityOf = new Map(posts.map((post) => [`/${post.slug}/`, post.visibility]));
	const reached = new Set(list.map((path) => visibilityOf.get(path)));
	for (const visibility of new Set(posts.map((post) => post.visibility))) {
		if (!reached.has(visibility)) {
			list.push(`/${posts.find((post) => post.visibility === visibility).slug}/`);
		}
	}

	return [...new Set(list)];
}

async function capture(dir) {
	// Imported here so `diff` runs without .env or a live Ghost.
	const { base, request } = await import('./admin.mjs');
	const { applyThemeSettings, restoreThemeSettings } = await import('./theme-settings.mjs');

	mkdirSync(dir, { recursive: true });
	const list = paths();
	try {
		for (const [group, settings] of Object.entries(groups())) {
			await applyThemeSettings(settings);
			for (const path of list) {
				const response = await request(`${base}${path}`, { redirect: 'manual' });
				const file = `${group}_${slugify(path)}.html`;
				writeFileSync(join(dir, file), `${response.status}\n${await response.text()}`);
				console.log(`${response.status}  ${file}`);
			}
		}
	} finally {
		const failed = await restoreThemeSettings();
		if (failed.length) {
			console.error(`COULD NOT RESTORE ${failed.join('; ')}`);
			process.exitCode = 1;
		}
	}
	console.log(`${list.length * 2} pages in ${dir}`);
}

const normalise = (html) =>
	html
		.replace(/(article:modified_time" content=")[^"]*/g, '$1')
		.replace(/("dateModified": ")[^"]*/g, '$1')
		.replace(/\?v=[\w-]+/g, '')
		.replace(/\s+/g, ' ');

function diff(a, b) {
	const names = [...new Set([...readdirSync(a), ...readdirSync(b)])].filter((name) => name.endsWith('.html')).sort();
	let same = 0;
	for (const name of names) {
		let left;
		let right;
		try {
			left = normalise(readFileSync(join(a, name), 'utf8'));
			right = normalise(readFileSync(join(b, name), 'utf8'));
		} catch {
			console.log(`MISSING  ${name}`);
			continue;
		}
		if (left === right) {
			same++;
			console.log(`same     ${name}`);
			continue;
		}
		let at = 0;
		while (left[at] === right[at]) {
			at++;
		}
		const from = Math.max(0, at - 40);
		console.log(`DIFF     ${name}\n  a: …${left.slice(from, from + 200)}\n  b: …${right.slice(from, from + 200)}`);
	}
	console.log(`${same}/${names.length} identical`);
	if (same !== names.length) {
		process.exitCode = 1;
	}
}

if (command === 'capture' && args.length === 1) {
	await capture(args[0]);
} else if (command === 'diff' && args.length === 2) {
	diff(...args);
} else {
	console.error('usage: snapshot.mjs capture <dir> | snapshot.mjs diff <a> <b>');
	process.exit(2);
}

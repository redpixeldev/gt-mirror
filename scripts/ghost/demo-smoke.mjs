/*
 * Walk the Demo site's Layout browser and prove every entry renders what its label promises.
 *
 *   node scripts/ghost/demo-smoke.mjs --base http://localhost:2370     (pnpm demo:smoke)
 *   node scripts/ghost/demo-smoke.mjs --base https://mirror.ghost.io   (the published Demo site)
 *
 * THE EXPECTATIONS ARE DERIVED, NOT WRITTEN. They come from scripts/ghost/demo-overlay.mjs — the
 * same list the menu, the routes file and the duplicate Pages were built from — so this run cannot
 * check a URL the menu does not carry, or miss one it does.
 *
 * Two halves. First the menu itself: the header the site actually serves must carry exactly the
 * entries the overlay defines, which catches a site imported from an older build. Then every
 * entry: the status, `data-surface`, and `data-layout` — the marker each Surface prints with the
 * Layout that rendered, decided by the same match that picked it. That last assertion is the one
 * this feature exists for: a default entry on a site whose setting was changed, or an override
 * template that ignored its pinned value, renders the wrong Layout at a 200 and passes everything
 * else. Gated Posts must show their Gate to a logged-out reader, the duplicate Pages must name the
 * page they copy as canonical, the error-page route must carry noindex, and the two records a
 * `data:` channel takes over must redirect to it.
 */
import { readFileSync } from 'node:fs';

import { demoOverlay } from './demo-overlay.mjs';

const flag = process.argv.indexOf('--base');
if (flag < 0 || !process.argv[flag + 1]) {
	console.error('usage: demo-smoke.mjs --base <site url>');
	process.exit(1);
}
const base = process.argv[flag + 1].replace(/\/$/, '');

const { expectations } = demoOverlay(
	JSON.parse(readFileSync('scripts/ghost/fixture.json', 'utf8')),
	readFileSync('docs/routes.example.yaml', 'utf8'),
);

const failures = [];
const report = (ok, what, detail = '') => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `  — ${detail}` : ''}`);
	if (!ok) failures.push(what);
};
const get = (path) => fetch(base + path, { redirect: 'manual' });
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = (text) =>
	text
		.replace(/&amp;/g, '&')
		.replace(/&#x27;|&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');

/* ── the menu ──────────────────────────────────────────────────────────────────────────── */

/*
 * The bar's panels, read as the reader gets them: each `nav-menu-*` list holds the children of one
 * group, label and href per link. The group comes from the trigger's own text, so a child filed
 * under the wrong parent fails here too.
 */
const home = await (await get('/')).text();
const served = new Set();
const groupRe = /aria-controls="nav-menu-[^"]+"[\s\S]*?>([^<]+)<span[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/g;
for (const [, group, list] of home.matchAll(groupRe)) {
	for (const [, href, label] of list.matchAll(/<a\s+href="([^"]+)"[\s\S]*?>([^<]+)<\/a>/g)) {
		served.add(`${decode(group.trim())} / ${decode(label.trim())} → ${href}`);
	}
}
const wanted = new Set(expectations.map((e) => `${e.label} → ${e.path}`));
const missing = [...wanted].filter((entry) => !served.has(entry));
const extra = [...served].filter((entry) => !wanted.has(entry));
report(
	missing.length === 0 && extra.length === 0,
	`menu carries the ${wanted.size} Layout browser entries`,
	[...missing.map((m) => `missing ${m}`), ...extra.map((x) => `unexpected ${x}`)].join('; '),
);

/* ── every entry ───────────────────────────────────────────────────────────────────────── */

for (const e of expectations) {
	const response = await get(e.path);
	const html = await response.text();
	const problems = [];

	if (response.status !== e.status) problems.push(`status ${response.status}, wanted ${e.status}`);
	if (!html.includes(`data-surface="${e.surface}"`)) problems.push(`no data-surface="${e.surface}"`);
	if (e.layout) {
		const marker = html.match(new RegExp(`data-surface="${escape(e.surface)}"\\s+data-layout="([^"]*)"`));
		if (!marker) problems.push('no data-layout beside data-surface');
		else if (marker[1] !== e.layout) problems.push(`rendered ${marker[1]}, label says ${e.layout}`);
	}
	if (e.surface === 'post') {
		const gate = html.match(/data-gate="([^"]*)"/)?.[1] ?? null;
		if (gate !== e.gate) problems.push(`Gate ${gate ?? 'absent'}, wanted ${e.gate ?? 'absent'}`);
	}
	if (e.canonical) {
		const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
		if (!canonical.endsWith(e.canonical)) problems.push(`canonical ${canonical || 'absent'}, wanted …${e.canonical}`);
	}
	if (e.noindex && !html.includes('<meta name="robots" content="noindex">')) problems.push('no robots noindex');

	report(problems.length === 0, `${e.label}  ${e.path}`, problems.join('; '));

	if (e.redirects) {
		const moved = await get(e.redirects);
		const location = moved.headers.get('location') ?? '';
		report(
			moved.status === 301 && location.endsWith(e.path),
			`${e.redirects} redirects to ${e.path}`,
			moved.status === 301 ? (location.endsWith(e.path) ? '' : `to ${location}`) : `status ${moved.status}`,
		);
	}
}

const checks = expectations.length + expectations.filter((e) => e.redirects).length + 1;
console.log(`\n${checks - failures.length}/${checks} checks ok against ${base}`);
process.exit(failures.length ? 1 : 0);

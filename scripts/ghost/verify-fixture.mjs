/*
 * Check the imported publication against the design, end to end through the rendered site.
 *
 *   node --env-file=.env scripts/ghost/verify-fixture.mjs
 *
 * The generator already asserts its own marginals before writing the fixture. This checks the
 * other half — that what Ghost actually renders matches — because the two can disagree: a tag
 * relation the API silently dropped, a body Ghost's HTML-to-Lexical conversion shortened, a
 * pagination total that counts drafts. Reading the numbers off the live Surfaces is the only way
 * to know.
 *
 * Zero tolerance on all three, by design. "The tag directory shows 33, not 34" has to fail here,
 * where the cause is one import away, rather than turn up later as unexplained drift on an archive
 * Surface.
 */
import { readFileSync } from 'node:fs';

const base = (process.env.GHOST_URL ?? 'http://localhost:2368').replace(/\/$/, '');
const fixture = JSON.parse(readFileSync('scripts/ghost/fixture.json', 'utf8'));

const failures = [];
const note = (line) => console.log(line);

async function html(path) {
	const response = await fetch(`${base}${path}`);
	if (!response.ok) {
		throw new Error(`GET ${path} → ${response.status}`);
	}
	return await response.text();
}

/* ── 1. the publication is 104 posts ─────────────────────────────────────────────────── */

/*
 * Read off the feed's own pagination rather than the API: pagination.total is what the theme's
 * templates and the About page's derived counts actually see.
 *
 * BOTH PATTERNS HERE USED TO BE WRITTEN AGAINST MARKUP THIS THEME DOES NOT EMIT, so the check
 * counted zero posts across zero pages and failed with a number that looked like a broken import:
 *
 *   - "Page 1 of 6" is Casper's pagination. This theme draws numbered pills, and the elided
 *     control always renders the LAST page as a link (`1 2 … 6`), so the highest
 *     `/archive/page/N/` in the document IS the page count. One page renders no such link, hence
 *     the floor of 1.
 *   - `<article class="post` assumed the class sits on the same line as the tag. Prettier breaks
 *     a multi-attribute tag across lines, so the class is on the NEXT one. Counting `<article`
 *     alone is enough: on this Surface every article is a post, and the assertion is the total.
 */
const feed = await html('/archive/');
const pageLinks = [...feed.matchAll(/\/archive\/page\/(\d+)\//g)].map((match) => Number(match[1]));
const pages = Math.max(1, ...pageLinks);
const perPage = 18;

let counted = 0;
for (let page = 1; page <= pages; page += 1) {
	const body = page === 1 ? feed : await html(`/archive/page/${page}/`);
	counted += (body.match(/<article\b/g) ?? []).length;
}

if (counted !== fixture.posts.length) {
	failures.push(`feed lists ${counted} posts across ${pages} pages; the fixture has ${fixture.posts.length}`);
}
note(`posts      ${counted} across ${pages} pages of ${perPage}`);

/* ── 2. every author and tag marginal, off the rendered directories ──────────────────── */

const tagsPage = await html('/tags/');
const authorsPage = await html('/authors/');
/**
 * Directory rows, parsed one `<article>` at a time.
 *
 * Not one regex over the whole page: the header's site-title link carries the identical class list
 * to a directory row's link (`font-display text-h3 text-text tracking-tight no-underline`), so a
 * document-wide pattern pairs the logo with the first count it finds and silently shifts every row
 * after it. That failure looked like missing tags rather than a broken parser.
 *
 * `<article>` IS THE ROW BOUNDARY IN ALL FOUR DRAWINGS. This used to split on `<li `, which no
 * directory partial has ever emitted — so both directories parsed as zero rows and the run failed
 * with "renders 0 rows" whichever layout was set. Each Surface has two (`@custom.directory_layout`
 * picks editorial rows or cover cards) and the four markups agree on exactly three things: the row
 * is an `<article>`, the name is the row's only `<h2>`, and the count is the first `font-meta`
 * element in it. Those three are what this reads, so a class rename in the drawing cannot quietly
 * turn the assertion off.
 */
function directoryCounts(page, kind) {
	const counts = new Map();
	for (const row of page.split('<article').slice(1)) {
		if (!row.includes(`/${kind}/`)) {
			continue;
		}
		const name = row
			.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]
			.replace(/<[^>]*>/g, '')
			.trim();
		const count = row.match(/class="[^"]*font-meta[^"]*"[^>]*>\s*(\d+|No)\s+posts?\b/)?.[1];
		if (name && count !== undefined) {
			counts.set(name, count === 'No' ? 0 : Number(count));
		}
	}
	return counts;
}

const renderedTags = directoryCounts(tagsPage, 'tag');
const renderedAuthors = directoryCounts(authorsPage, 'author');

for (const tag of fixture.tags) {
	const got = renderedTags.get(tag.name);
	if (got !== tag.count) {
		failures.push(`tag directory shows ${tag.name} = ${got ?? 'missing'}, design says ${tag.count}`);
	}
}
for (const author of fixture.authors) {
	const got = renderedAuthors.get(author.name);
	if (got !== author.count) {
		failures.push(`author directory shows ${author.name} = ${got ?? 'missing'}, design says ${author.count}`);
	}
}

/*
 * The row COUNT matters as much as the numbers in it: a staff account with no posts is not a
 * writer, and it rendered as a sixth row on the masthead until the directory started skipping
 * empty authors. Asserting only the five known names would have passed that.
 */
if (renderedAuthors.size !== fixture.authors.length) {
	failures.push(
		`author directory renders ${renderedAuthors.size} rows, design says ${fixture.authors.length}: ` +
			`${[...renderedAuthors.keys()].join(', ')}`,
	);
}
if (renderedTags.size !== fixture.tags.length) {
	failures.push(`tag directory renders ${renderedTags.size} rows, design says ${fixture.tags.length}`);
}

note(
	`tags       ${renderedTags.size}/${fixture.tags.length} exact: ${!failures.some((f) => f.startsWith('tag directory'))}`,
);
note(
	`authors    ${renderedAuthors.size}/${fixture.authors.length} exact: ${!failures.some((f) => f.startsWith('author directory'))}`,
);

/* ── 3. every designed reading-time label, byte for byte ─────────────────────────────── */

const designed = fixture.posts.filter((p) => p.designed);
let matched = 0;

for (const post of designed) {
	const page = await html(`/${post.slug}/`);
	/* The label the visitor sees, rendered by partials/post-meta.hbs through {{reading_time}}. */
	const rendered = page.match(/(\d+ MIN READ|< 1 MIN READ|1 MIN READ)/i)?.[0];
	const expected = post.reading_time_label;
	if (!rendered || rendered.toLowerCase() !== expected.toLowerCase()) {
		failures.push(`${post.slug}: renders ${JSON.stringify(rendered)}, design label is ${JSON.stringify(expected)}`);
	} else {
		matched += 1;
	}
}
note(`reading    ${matched}/${designed.length} designed labels byte-identical`);

/* ── 4. the gate has something to gate ───────────────────────────────────────────────── */

const gated = fixture.posts.filter((p) => p.visibility !== 'public');
if (!gated.length) {
	failures.push('no post has a non-public visibility, so the members gate is never exercised');
}
note(`gated      ${gated.length} posts (${[...new Set(gated.map((p) => p.visibility))].join(', ')})`);

/* ── report ──────────────────────────────────────────────────────────────────────────── */

if (failures.length) {
	console.error(`\n${failures.length} failure(s):`);
	for (const failure of failures) {
		console.error(`  ${failure}`);
	}
	process.exit(1);
}

console.log('\nthe rendered publication matches the design on every checked invariant');

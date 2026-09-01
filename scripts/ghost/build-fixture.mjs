/*
 * Build the demo publication fixture: 5 Authors, 14 Tags, 104 Posts, 8 standing Pages.
 *
 * The fixture is the artifact and the Admin API only applies it (scripts/ghost/import.mjs). That
 * ordering is deliberate: the gates and the buyer-facing demo content both depend on this data, so
 * reproducing it must not hinge on a network path and a key. Output is a pure function of src/data
 * plus a fixed seed — same inputs, byte-identical output, no network.
 *
 * Two things this script has to SOLVE rather than approximate, because a near miss surfaces at
 * gate time as "the directory says 33, not 34" with no traceable cause:
 *
 *   1. The counts are a joint assignment. 104 posts must satisfy five Author marginals
 *      (34/27/19/14/10, summing to exactly 104) and fourteen Tag marginals (summing 173) at the
 *      same time, with the designed posts' own author and tag already fixed. Every marginal is
 *      asserted exactly before anything is written. One post is not design content at all —
 *      SPECIMEN_POST, a hand-written syntax specimen — and it is deliberately kept OUT of this
 *      assignment: it inherits the last filler slot, with that slot's author and tags, rather
 *      than being given one. So it displaces a generated filler post and moves no number here.
 *
 *   2. Reading time runs backwards from the label. Ghost computes {{reading_time}} from word count
 *      and image count and stores nothing, so a designed post labelled "12 min read" needs a body
 *      of the exact length that produces 12. The constants come from the installed
 *      @tryghost/helpers (275 wpm; 12s for the first image, 11 for the second, floored at 3) and
 *      are recorded in DECISIONS.md.
 */
import { writeFileSync } from 'node:fs';
import { loadData } from './load-data.mjs';

const OUT = 'scripts/ghost/fixture.json';
const SEED = 20260826;
const TOTAL_POSTS = 104;

/* ── determinism ──────────────────────────────────────────────────────────────────────── */

/** mulberry32 — small, fast, and stable across Node versions, which Math.random is not. */
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const slugify = (s) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/* ── reading time, inverted ───────────────────────────────────────────────────────────── */

const WORDS_PER_MINUTE = 275;
const FIRST_IMAGE_SECONDS = 12;

/**
 * The word count whose reading time rounds to exactly `minutes`.
 *
 * Ghost: seconds = words / (275/60) + imageSeconds, then Math.round(seconds / 60). With one image
 * (the feature image) that is words/275 + 0.2 minutes, so aiming at the middle of the rounding
 * bucket means words = 275 × (minutes − 0.2). Exact, not ±1.
 */
function wordsForMinutes(minutes) {
	return Math.round(WORDS_PER_MINUTE * (minutes - FIRST_IMAGE_SECONDS / 60));
}

/** The same arithmetic Ghost does, so the generator can assert its own output. */
function minutesForWords(words, imageCount = 1) {
	let seconds = (words * 60) / WORDS_PER_MINUTE;
	for (let i = FIRST_IMAGE_SECONDS; i > FIRST_IMAGE_SECONDS - imageCount; i -= 1) {
		seconds += Math.max(i, 3);
	}
	return Math.round(seconds / 60);
}

/* ── prose with an exact word count ───────────────────────────────────────────────────── */

/*
 * Ghost counts words by matching runs of letters and digits AFTER stripping tags, so an apostrophe
 * or a hyphen splits one visible word into two counted ones. Every token below is a single
 * alphanumeric run, which is what lets the count be exact rather than approximate.
 */
const VOCAB = (
	'a about after against also always argument attention audience away back because before being ' +
	'between both business but came care catalogue century change choice circulation column come ' +
	'commission copy correction cost could craft daily decade decision design desk detail did ' +
	'different does draft each edit editor editorial else enough error essay every fact feed few ' +
	'field first form found from good grammar had half hand have house how idea independent ink ' +
	'instead into issue its just keep kind knew known language last late layout least less letter ' +
	'like line little long look made magazine make many margin masthead may measure media might ' +
	'model money month more most much must name never new news newsroom next not note now number ' +
	'often once only order other our out over own page paid paper part pass pay people perhaps ' +
	'photograph piece place plain point press price print process product publication publish put ' +
	'question quiet quite rate read reader reason record reduce report reporting rest revenue ' +
	'right room rule run said same say scale schedule second section seem sense sentence series ' +
	'set several shape she short should side simple since single site small some soon sort spend ' +
	'still story structure style subject such support sure take than that the their them then ' +
	'there these they thing think this those though thousand three through time title today told ' +
	'took trust turn two type under until upon use used very view voice want was way week weekly ' +
	'well went were what when where which while who whole why will with within without word work ' +
	'would write writer writing wrote year yet'
).split(' ');

const HEADINGS = [
	'What the numbers actually say',
	'A shorter way to run the desk',
	'The part nobody budgets for',
	'Where the argument breaks down',
	'What we changed, and why',
	'Reading it again a year later',
];

/**
 * Emit HTML whose counted word total is exactly `words`.
 *
 * Headings are included in the body because Ghost counts them too, and because the table of
 * contents the post Surface builds needs real h2s to find.
 *
 * `paywall` closes the opening paragraph with Ghost's `<!--members-only-->` marker, which its
 * HTML-to-Lexical converter turns into a paywall card on import. That is what gives a gated post
 * a free portion: without it Ghost blanks the whole body for a reader without access, and the
 * theme's Gate would have no teaser above it.
 *
 * After the FIRST paragraph, because that is what the design draws — its gated Post shows 423px
 * of teaser above the Gate, and one paragraph of this generator's prose is 392px. A marker at the
 * end of the opening section instead gives three paragraphs and 1,249px, which is a realistic
 * publication and the wrong drawing. It costs no words either way: Ghost's own word count strips
 * comments along with tags.
 */
function prose(words, random, { paywall = false } = {}) {
	if (words <= 0) {
		return '';
	}

	const blocks = [];
	let spent = 0;

	// Roughly one heading per 350 words, but never so many that a section has nothing under it.
	const headingCount = Math.max(0, Math.min(HEADINGS.length, Math.floor(words / 350)));
	const headingWords = [];
	for (let i = 0; i < headingCount; i += 1) {
		const heading = HEADINGS[Math.floor(random() * HEADINGS.length)];
		// count this heading's own words against the budget
		const count = heading.split(/[^a-zA-Z0-9]+/).filter(Boolean).length;
		headingWords.push({ heading, count });
		spent += count;
	}

	const bodyBudget = words - spent;
	const sections = headingCount + 1;
	const perSection = Math.floor(bodyBudget / sections);
	let remainder = bodyBudget - perSection * sections;

	const sentence = (n) => {
		const picked = [];
		for (let i = 0; i < n; i += 1) {
			picked.push(VOCAB[Math.floor(random() * VOCAB.length)]);
		}
		picked[0] = picked[0][0].toUpperCase() + picked[0].slice(1);
		return picked.join(' ') + '.';
	};

	const paragraph = (budget) => {
		const parts = [];
		let left = budget;
		while (left > 0) {
			const n = Math.min(left, 9 + Math.floor(random() * 14));
			parts.push(sentence(n));
			left -= n;
		}
		return `<p>${parts.join(' ')}</p>`;
	};

	for (let s = 0; s < sections; s += 1) {
		if (s > 0) {
			blocks.push(`<h2>${headingWords[s - 1].heading}</h2>`);
		}
		let budget = perSection + (remainder > 0 ? 1 : 0);
		if (remainder > 0) {
			remainder -= 1;
		}
		// two or three paragraphs per section, splitting the section's exact budget
		const paraCount = budget > 260 ? 3 : 2;
		const base = Math.floor(budget / paraCount);
		for (let p = 0; p < paraCount; p += 1) {
			const take = p === paraCount - 1 ? budget - base * (paraCount - 1) : base;
			if (take > 0) {
				blocks.push(paragraph(take));
			}
			if (paywall && s === 0 && p === 0) {
				blocks.push('<!--members-only-->');
			}
		}
	}

	return blocks.join('\n');
}

/** Count words exactly as Ghost's countWords does, so the generator can assert itself. */
function countWords(html) {
	const text = html.replace(/<("[^"]*"|'[^']*'|[^'">])+\/?>/g, ' ');
	const match = text.match(/[a-zA-ZÀ-ÿ0-9_\u0392-\u03c9\u0410-\u04F9]+/g);
	return match ? match.length : 0;
}

/*
 * THE SYNTAX SPECIMEN — the one post in this publication that is not transcribed design content.
 *
 * The theme's code-block highlighting needs something to render, and the design source draws
 * exactly one code card (a JSON correction record), which proves nothing about ten grammars, a
 * caption, an unlabelled block, or a language nobody ships a lexer for. This post is that proof.
 *
 * It lives here rather than in src/data because that data is transcribed design content whose
 * counts drive the Astro reference build's recorded pixel floors as well as Ghost's. It is also
 * not offered to the joint assignment: it INHERITS the last filler slot instead of competing for
 * one, which is what keeps it out of every number this file asserts. See the branch in the map.
 *
 * The body is verbatim and hand-written. Its &lt;/&gt; entities are the escaped form of the code's own
 * angle brackets, its $mode is shell text and its {{title}} is a Handlebars example — none of it
 * is markup this file may tidy, and none of it is interpolation.
 */
const SPECIMEN_POST = {
	title: 'Reading code at the measure',
	/*
	 * Its own date, and the only field of the inherited slot it overrides. It is outside the
	 * filler span on purpose — the oldest thing in the archive — which is safe precisely because
	 * it is never an input to the stride: the slot it takes over is still counted, and the span
	 * is still measured from the DESIGNED posts only.
	 */
	date: '2019-11-14',
	excerpt:
		"Thirteen code blocks, ten languages and one the highlighter has never heard of — the specimen the theme's syntax palette is measured against.",
	html: `<p>Every block below is the same Koenig code card. The only thing that differs is the language each one declares, and that is the one thing this theme reads: a block that names its language gets the strip and the palette, and a block that names nothing is left exactly as the design draws it.</p>
<p>Inline code is untouched — <code>--syntax-keyword</code> is set in the stylesheet, not by the highlighter.</p>
<h2>The design's own specimen</h2>
<p>JSON, because JSON is what the design source draws in the post this theme was measured against.</p>
<pre><code class="language-json">{
  "corrected_at": "2026-03-14",
  "field": "subhead",
  "was": "four newsrooms",
  "now": "three newsrooms"
}</code></pre>
<h2>Ten languages, on demand</h2>
<p>Each grammar is a separate module and only the ones this page uses are ever fetched.</p>
<pre><code class="language-javascript">const WORDS_PER_MINUTE = 275;

export function readingTime(html) {
	const text = html.replace(/&lt;[^&gt;]+&gt;/g, ' ');
	const words = text.match(/[a-z0-9]+/gi) ?? [];
	return Math.max(1, Math.round(words.length / WORDS_PER_MINUTE));
}</code></pre>
<pre><code class="language-typescript">type Mode = 'light' | 'dark';

/** The visitor's choice outranks the publication's default. */
export const nextMode = (mode: Mode): Mode =&gt; (mode === 'dark' ? 'light' : 'dark');</code></pre>
<pre><code class="language-css">.mirror-content pre {
	background-color: var(--color-code-bg);
	color: var(--color-code-fg);
	overflow-x: auto;
}

::highlight(keyword) {
	color: var(--syntax-keyword);
}</code></pre>
<pre><code class="language-hbs">{{#post}}
	&lt;h1&gt;{{title}}&lt;/h1&gt;
	&lt;div class="mirror-content"&gt;{{content}}&lt;/div&gt;
{{/post}}</code></pre>
<pre><code class="language-sh">#!/usr/bin/env bash
set -euo pipefail

for mode in light dark; do
	curl -sf "http://localhost:2368/?mode=$mode" &gt; "shot-$mode.html"
done</code></pre>
<pre><code class="language-python">def reading_time(words: int, images: int = 1) -&gt; int:
    seconds = words * 60 / 275
    for i in range(images):
        seconds += max(12 - i, 3)
    return round(seconds / 60)</code></pre>
<pre><code class="language-sql">select t.slug, count(pt.post_id) as posts
from tags as t
join posts_tags as pt on pt.tag_id = t.id
where t.visibility = 'public'
group by t.slug
order by posts desc
limit 14;</code></pre>
<pre><code class="language-yaml">collections:
  /archive/:
    permalink: /{slug}/
    template: index
    limit: 14
taxonomies:
  tag: /tag/{slug}/
  author: /author/{slug}/</code></pre>
<pre><code class="language-html">&lt;figure class="kg-card kg-code-card"&gt;
	&lt;pre&gt;&lt;code class="language-json"&gt;{ "ok": true }&lt;/code&gt;&lt;/pre&gt;
	&lt;figcaption&gt;A captioned code card.&lt;/figcaption&gt;
&lt;/figure&gt;</code></pre>
<pre><code class="language-diff">--- a/ghost/assets/css/screen.css
+++ b/ghost/assets/css/screen.css
@@ -327,7 +327,7 @@
 .mirror-content pre {
-	color: var(--color-code-fg);
+	color: var(--color-code-fg);
 }</code></pre>
<h2>A captioned card</h2>
<figure class="kg-card kg-code-card"><pre><code class="language-toml">[theme]
name = "mirror"
layouts = ["magazine cover", "editorial masthead"]

[theme.modes]
default = "light"</code></pre><figcaption>A captioned code card: the strip belongs above the code, inside the figure, never above the caption.</figcaption></figure>
<h2>The two blocks that stay plain</h2>
<p>A block that declares no language is the design's own drawing, and the theme leaves it alone — no strip, no palette, one colour.</p>
<pre><code>const words = 275 * (minutes - 0.2);</code></pre>
<p>A block that declares a language nobody ships a grammar for keeps its strip and loses only the colour. The highlighter fails quietly by design; this is what that looks like.</p>
<pre><code class="language-cobol">IDENTIFICATION DIVISION.
PROGRAM-ID. READING-TIME.
PROCEDURE DIVISION.
    DISPLAY "275 words per minute".
    STOP RUN.</code></pre>`,
};

/* ── the designed posts, reconciled ───────────────────────────────────────────────────── */

/*
 * The Astro build gives each template its own dataset on purpose, because the design sources
 * genuinely differ. Ghost renders one publication, so every Surface reads the same content and
 * those divergences have to die here. Precedence is by breadth: posts.ts is the shared set the
 * blog, tag and author templates all draw from, so it wins; then the archive; then the two
 * per-template archives; then the membership strip, which carries no dates at all.
 *
 * Every value this drops is reported and recorded in DECISIONS.md as a concession, so drift on the
 * archive Surfaces later has a written cause.
 */
const POOL_PRECEDENCE = ['posts', 'archive', 'authorArchive', 'tagArchive', 'locked', 'postPage'];

function reconcile(data) {
	/*
	 * Some pools leave a field implicit because the template around them supplies it: every row on
	 * the author archive is by that author, and every row on the tag archive carries that tag. A
	 * publication has no template to imply them, so they are filled in from the pool's own context
	 * here. Missing this is not a subtle bug — it presents as a designed post with no author.
	 */
	const pools = {
		posts: { records: data.posts.ALL_POSTS, implied: {} },
		archive: { records: data.archive.ARCHIVE_POSTS, implied: {} },
		authorArchive: { records: data.authorArchive.AUTHOR_POSTS, implied: { author: data.authorArchive.AUTHOR.name } },
		tagArchive: { records: data.tagArchive.TAG_POSTS, implied: { tag: data.tagArchive.TAG.name } },
		locked: { records: data.membership.LOCKED_POSTS, implied: {} },
		/* The post Surface's own detail page and its related strip — lowest precedence, so it
		 * changes no resolution, but its disagreements still get recorded. */
		postPage: { records: [data.post.POST, ...data.post.RELATED], implied: {} },
	};

	const byTitle = new Map();
	for (const pool of POOL_PRECEDENCE) {
		const { records, implied } = pools[pool];
		for (const raw of records) {
			if (!raw?.title) {
				continue;
			}
			const record = { ...implied, ...raw };
			if (!byTitle.has(record.title)) {
				byTitle.set(record.title, []);
			}
			byTitle.get(record.title).push({ pool, record });
		}
	}

	const FIELDS = ['tag', 'author', 'date', 'read', 'visibility', 'featured', 'img', 'alt', 'excerpt'];
	const posts = [];
	const concessions = [];
	const secondaries = [];

	for (const [title, entries] of byTitle) {
		const resolved = { title };
		for (const field of FIELDS) {
			const seen = [];
			for (const { pool, record } of entries) {
				if (record[field] !== undefined) {
					seen.push({ pool, value: record[field] });
				}
			}
			if (!seen.length) {
				continue;
			}
			resolved[field] = seen[0].value; // entries are already in precedence order

			/*
			 * A TAG IS THE ONE FIELD A POST CAN HOLD TWICE.
			 *
			 * Every other field here resolves to one value and the rest are dropped, because a post
			 * has one date, one photograph, one primary author. Tags are a set: a piece can be filed
			 * under Craft and still be one of the Interviews. So where two pools disagree about a
			 * post's tag, the loser becomes a SECONDARY tag rather than a concession — the higher
			 * pool still decides which tag is primary, and primary is what every card's eyebrow
			 * prints, but the tag archive that asserted membership gets to keep it.
			 *
			 * This is what makes /tag/interviews/ list the twelve posts tagArchive.ts draws instead
			 * of eleven of them plus whatever the marginals happened to spare.
			 */
			if (field === 'tag') {
				const extras = [...new Set(seen.map((entry) => entry.value))].filter((value) => value !== resolved.tag);
				if (extras.length) {
					resolved.extraTags = extras;
					secondaries.push({ title, primary: resolved.tag, extras });
				}
				continue;
			}
			const distinct = new Set(seen.map((s) => JSON.stringify(s.value)));
			if (distinct.size > 1) {
				concessions.push({
					title,
					field,
					kept: { pool: seen[0].pool, value: seen[0].value },
					dropped: seen.slice(1).filter((s) => JSON.stringify(s.value) !== JSON.stringify(seen[0].value)),
				});
			}
		}
		posts.push(resolved);
	}

	return { posts, concessions, secondaries };
}

/* ── the joint assignment ─────────────────────────────────────────────────────────────── */

/**
 * Fill filler posts so that every author marginal and every tag marginal is hit exactly.
 *
 * Assign from the largest remaining marginal first: that is what keeps the last few slots from
 * being forced into a tag that is already full.
 */
function assign({ designed, authors, tags }) {
	const authorNeed = new Map(authors.map((a) => [a.name, a.count]));
	const tagNeed = new Map(tags.map((t) => [t.name, t.count]));

	for (const post of designed) {
		if (!authorNeed.has(post.author)) {
			throw new Error(
				`Designed post ${JSON.stringify(post.title)} names an author who is not in the masthead: ${post.author}`,
			);
		}
		for (const tag of [post.tag, ...(post.extraTags ?? [])]) {
			if (!tagNeed.has(tag)) {
				throw new Error(`Designed post ${JSON.stringify(post.title)} names a tag that is not in the directory: ${tag}`);
			}
			tagNeed.set(tag, tagNeed.get(tag) - 1);
		}
		authorNeed.set(post.author, authorNeed.get(post.author) - 1);
	}

	for (const [name, left] of authorNeed) {
		if (left < 0) {
			throw new Error(`Designed posts already exceed ${name}'s marginal by ${-left}.`);
		}
	}
	for (const [name, left] of tagNeed) {
		if (left < 0) {
			throw new Error(`Designed posts already exceed tag "${name}"'s marginal by ${-left}.`);
		}
	}

	const fillerCount = TOTAL_POSTS - designed.length;
	const authorSlots = [...authorNeed].flatMap(([name, n]) => Array.from({ length: n }, () => name));
	if (authorSlots.length !== fillerCount) {
		throw new Error(`Author marginals leave ${authorSlots.length} slots for ${fillerCount} filler posts.`);
	}

	// primary tags for the filler: take from the largest remaining marginal first
	const primaries = [];
	for (let i = 0; i < fillerCount; i += 1) {
		const [name] = [...tagNeed].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
		primaries.push(name);
		tagNeed.set(name, tagNeed.get(name) - 1);
	}

	const filler = authorSlots.map((author, i) => ({ author, tag: primaries[i] }));

	// whatever is still owed becomes a secondary tag on a post that does not already carry it
	const all = [
		...designed.map((p) => ({ ...p, tags: [p.tag, ...(p.extraTags ?? [])] })),
		...filler.map((p) => ({ ...p, tags: [p.tag] })),
	];
	let owed = [...tagNeed].filter(([, n]) => n > 0);

	while (owed.length) {
		owed.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
		const [name] = owed[0];
		const candidate = all
			.map((post, index) => ({ post, index, size: post.tags.length }))
			.filter(({ post }) => !post.tags.includes(name))
			.sort((a, b) => a.size - b.size || a.index - b.index)[0];

		if (!candidate) {
			throw new Error(`No post can take another "${name}" tag; the marginals are unsatisfiable.`);
		}
		candidate.post.tags.push(name);
		tagNeed.set(name, tagNeed.get(name) - 1);
		owed = [...tagNeed].filter(([, n]) => n > 0);
	}

	return all;
}

/* ── build ────────────────────────────────────────────────────────────────────────────── */

const data = await loadData();
const random = rng(SEED);

const authors = data.authors.MASTHEAD.map((a) => ({
	name: a.name,
	slug: slugify(a.name),
	email: `${slugify(a.name)}@mirror.test`,
	bio: a.bio,
	location: a.location,
	website: `https://${a.website}`,
	twitter: a.social.replace(/^@/, ''),
	profile_image: a.portrait,
	count: a.count,
}));

const tags = data.tags.TAG_DIRECTORY.map((t) => ({
	name: t.name,
	slug: slugify(t.name),
	description: t.description,
	feature_image: t.img,
	count: t.count,
}));

const { posts: designed, concessions, secondaries } = reconcile(data);

/*
 * The design's own stats fix the publication's span: "Publishing since 2020" on the About page, and
 * the newest designed post is dated March 2026. Filler is spread across that window on a fixed
 * stride so the archive paginates through six years rather than clustering.
 */
const DESIGN_DATES = designed.map((p) => p.date).filter(Boolean);
const parseDate = (s) => new Date(`${s} 12:00:00 UTC`);
const oldestDesigned = new Date(Math.min(...DESIGN_DATES.map((d) => parseDate(d).getTime())));
const SPAN_START = Date.UTC(2020, 0, 9, 12, 0, 0);

const assigned = assign({ designed, authors, tags });
const fillerOnly = assigned.filter((p) => !p.title);

const stride = Math.floor((oldestDesigned.getTime() - SPAN_START) / Math.max(1, fillerOnly.length - 1));

const FILLER_TITLES = [
	'Notes on a smaller masthead',
	'The cost of a second read',
	'What a house style is for',
	'Subscriptions, six years in',
	'On keeping the archive open',
	'A schedule you can actually hold',
	'Against the launch',
	'Why the corrections page matters',
	'Paper, and what replaced it',
	'The interview nobody asked for',
	'Reading rates and what they hide',
	'How a page earns attention',
	'The margin is the message',
	'Commissioning without a budget',
	'One desk, five deadlines',
	'What we stopped measuring',
	'A shorter weekly letter',
	'The photograph does the work',
	'Pricing for a niche you can name',
	'Type, before layout',
];

let fillerIndex = 0;
const posts = assigned.map((post) => {
	if (post.title) {
		const minutes = Number.parseInt(String(post.read ?? '').match(/\d+/)?.[0] ?? '0', 10);
		if (!minutes) {
			throw new Error(`Designed post ${JSON.stringify(post.title)} has no parseable reading-time label: ${post.read}`);
		}
		const words = wordsForMinutes(minutes);
		const visibility = post.visibility ?? 'public';
		const html = prose(words, random, { paywall: visibility !== 'public' });
		const actual = countWords(html);
		if (actual !== words) {
			throw new Error(`${post.title}: generated ${actual} words, needed exactly ${words}`);
		}
		if (minutesForWords(actual) !== minutes) {
			throw new Error(`${post.title}: ${actual} words reads as ${minutesForWords(actual)} min, label says ${minutes}`);
		}
		return {
			designed: true,
			title: post.title,
			slug: slugify(post.title),
			custom_excerpt: post.excerpt ?? null,
			feature_image: post.img ?? null,
			feature_image_alt: post.alt ?? null,
			published_at: parseDate(post.date).toISOString(),
			visibility,
			featured: Boolean(post.featured),
			author: post.author,
			tags: post.tags,
			reading_time_label: post.read,
			expected_minutes: minutes,
			html,
		};
	}

	/*
	 * THE SPECIMEN INHERITS THIS SLOT — it does not get one of its own.
	 *
	 * The specimen is not from the design source, so it may not move a marginal, a filler date, or
	 * a scored capture. Offering it to assign() as a fixed post does all three: it takes a slot out
	 * of a tag's marginal, which re-runs the greedy filler-primary allocation; it lands in the
	 * middle of the secondary-tag loop's candidate list; and it drops the filler count, which is
	 * the stride denominator, so every filler date moves. Taking OVER a filler slot changes none of
	 * them: the slot was already counted, and this keeps its author and its full tag set verbatim.
	 *
	 * The author and the primary tag are therefore INHERITED, not editorial intent — whatever the
	 * assignment put in this slot is what the specimen is filed under.
	 *
	 * It draws nothing from random(), and it is the LAST filler, so the draws the generated post
	 * would have made here have no post after them to shift. That ordering is the whole reason
	 * this is safe: the same guard anywhere else in the sequence would rewrite every body below it.
	 */
	if (fillerIndex === fillerOnly.length - 1) {
		return {
			designed: false,
			title: SPECIMEN_POST.title,
			slug: slugify(SPECIMEN_POST.title),
			custom_excerpt: SPECIMEN_POST.excerpt,
			feature_image: null,
			feature_image_alt: null,
			published_at: parseDate(SPECIMEN_POST.date).toISOString(),
			visibility: 'public',
			featured: false,
			author: post.author,
			tags: post.tags,
			reading_time_label: null,
			/* Read forwards, from the words it already has, with no image: it has no feature image
			 * and no <img> in its body. */
			expected_minutes: minutesForWords(countWords(SPECIMEN_POST.html), 0),
			html: SPECIMEN_POST.html,
		};
	}

	const title = `${FILLER_TITLES[fillerIndex % FILLER_TITLES.length]}${
		fillerIndex >= FILLER_TITLES.length ? ` (${Math.floor(fillerIndex / FILLER_TITLES.length) + 1})` : ''
	}`;
	const minutes = 4 + Math.floor(random() * 11);
	const words = wordsForMinutes(minutes);
	const html = prose(words, random);
	const published = new Date(SPAN_START + stride * fillerIndex);
	const image = tags.find((t) => t.name === post.tag)?.feature_image ?? null;
	fillerIndex += 1;

	return {
		designed: false,
		title,
		slug: slugify(title),
		custom_excerpt: null,
		feature_image: image,
		feature_image_alt: null,
		published_at: published.toISOString(),
		visibility: 'public',
		featured: false,
		author: post.author,
		tags: post.tags,
		reading_time_label: null,
		expected_minutes: minutes,
		html,
	};
});

/* ── assert the marginals before writing anything ─────────────────────────────────────── */

const authorTally = new Map(authors.map((a) => [a.name, 0]));
const tagTally = new Map(tags.map((t) => [t.name, 0]));
for (const post of posts) {
	authorTally.set(post.author, authorTally.get(post.author) + 1);
	for (const tag of post.tags) {
		tagTally.set(tag, tagTally.get(tag) + 1);
	}
}

const failures = [];
if (posts.length !== TOTAL_POSTS) {
	failures.push(`${posts.length} posts, expected ${TOTAL_POSTS}`);
}
for (const author of authors) {
	if (authorTally.get(author.name) !== author.count) {
		failures.push(`${author.name}: ${authorTally.get(author.name)} posts, design says ${author.count}`);
	}
}
for (const tag of tags) {
	if (tagTally.get(tag.name) !== tag.count) {
		failures.push(`tag ${tag.name}: ${tagTally.get(tag.name)}, design says ${tag.count}`);
	}
}
if (new Set(posts.map((p) => p.slug)).size !== posts.length) {
	failures.push('duplicate post slugs');
}
if (failures.length) {
	throw new Error(`fixture would not match the design:\n  ${failures.join('\n  ')}`);
}

/* ── standing pages, site settings, tiers, recommendations ────────────────────────────── */

/*
 * `template` is deliberately null on every one of these.
 *
 * Ghost resolves a page in this order: page-{slug}.hbs, then a custom template the editor picked,
 * then page.hbs. These slugs exist precisely so the first step resolves, so the demo needs no
 * custom template — and `custom_template` is the wrong field to state it in anyway: it holds a
 * selected custom template's name (`custom-about`), never a filename. An earlier version wrote
 * `page-about.hbs` into it, which Ghost cannot match; the pages rendered correctly only because
 * slug resolution had already done the work.
 *
 * The custom-* aliases are the other half of the same decision and are selected in admin, not
 * seeded here.
 */

/*
 * MARKUP THAT HAS TO ARRIVE EXACTLY AS WRITTEN.
 *
 * `import.mjs` posts these bodies with `?source=html`, so Ghost converts them to Lexical on the
 * way in — and that converter has a parser per card type which DROPS what it cannot build rather
 * than falling back. Measured on the first import of the style guide: an audio card with no `src`,
 * a video card with no `src` and a gallery card all vanished, and a bare `<mark>` was stripped out
 * of its paragraph. What did survive whole: bookmark, button, callout, code, cta, file, header,
 * image and product.
 *
 * The same converter honours the editor's own html-card markers — that is how the ten-column table
 * on the style guide arrives verbatim — so anything the parsers refuse is wrapped in them below.
 * This is not a trick: an html card is what a buyer pasting markup gets, and for a Specimen the
 * point is the class names the theme's CSS is written against, which an html card preserves
 * exactly. Where a real editor node DOES survive, it is used, because that is the closer test.
 */
const htmlCard = (markup) => `<!--kg-card-begin: html-->\n${markup}\n<!--kg-card-end: html-->`;
const pages = [
	/*
	 * About is the one standing Page with a body rather than a sentence, so it is also the one
	 * that needs a custom excerpt: `{{excerpt}}` falls back to the body's opening, and this body
	 * opens on "Why this exists" rather than on what the publication is.
	 */
	{
		slug: 'about',
		title: 'A publication for people who make publications',
		template: null,
		excerpt:
			'Independent writing on media, craft, and the cost of attention — read in 74 countries, ' +
			'funded entirely by its members.',
		image: '/img/pexels-38048095.jpg',
		image_alt: 'Vintage roll-top writing desk with papers and office supplies',
		body: data.about.ABOUT_BODY,
	},
	{
		slug: 'membership',
		title: 'Pay five writers, read everything',
		template: null,
		excerpt:
			'No advertising, no sponsorship, no affiliate links. The Quarry is funded by the people who ' +
			'read it — and that is the whole business model.',
		body: data.membership.MEMBERSHIP_BODY,
	},
	/*
	 * The directory Pages carry the design's own title and lead sentence, because the theme reads
	 * both off the page record rather than writing them into a template: the h1 is `{{title}}` and
	 * the lead is `{{excerpt}}`, which with no custom excerpt set is the body's first 50 words.
	 * One sentence in, one sentence out, and no second copy of it in the fixture.
	 */
	{
		slug: 'tags',
		title: 'Every tag',
		template: null,
		body:
			`<p>Six years of writing, filed into ${data.tags.TAG_TOTAL} subjects. ` +
			`Each tag collects everything published under it.</p>`,
	},
	{
		slug: 'authors',
		title: 'Writers',
		template: null,
		body:
			`<p>${data.authors.AUTHOR_TOTAL} people write here. Between them they have filed ` +
			`${TOTAL_POSTS} pieces since ${new Date(SPAN_START).getUTCFullYear()}.</p>`,
	},
	{
		slug: 'recommendations',
		title: 'Recommendations',
		template: null,
		body:
			`<p>${data.recommendations.RECOMMENDATION_TOTAL} publications we actually read. No affiliate ` +
			`deals, no swaps — subscribe to any of them in one click.</p>`,
	},
	{ slug: 'sign-in', title: 'Sign in', template: null, body: '' },
	{ slug: 'sign-up', title: 'Subscribe', template: null, body: '' },
	/*
	 * THE DESIGN TOKENS SHEET — the design's own Specimen sheet, §07 only.
	 *
	 * `page-design-tokens.hbs` draws §01–06 out of the theme's own tokens and partials, because a
	 * Page body cannot express a swatch or a type scale. This body is the last section: every
	 * element and Platform card the drawing puts under "Rendered post content", in the drawing's
	 * order, and no element it does not — everything else lives on the style guide. That division is
	 * what makes this Surface scoreable against `01-styleguide-variantA-*.png`, and it is why the
	 * slug moved: /styleguide/ is now the Page that answers "what can my editor do", and this is the
	 * sheet the drawing draws.
	 *
	 * EVERY STRING BELOW IS THE DRAWING'S, VERBATIM, down to the em dashes and the "2×88px" in the
	 * wide caption. Not pedantry: identity is measured in 100px bands, and a sentence of a different
	 * length wraps onto a different number of lines, which moves every band under it out of
	 * register. Transcribed from .originals/MIRROR Styleguide A1.dc.html.
	 *
	 * Ghost converts this HTML to Lexical on import, so the cards arrive as real editor nodes. Two
	 * do not survive that trip intact and are stated through `htmlCard` rather than worked around:
	 * the pull quote loses `kg-blockquote-alt` and a `<cite>` is dropped (DECISIONS.md).
	 */
	{
		slug: 'design-tokens',
		/*
		 * The drawing's own masthead line, because `page-design-tokens.hbs` sets the h1 from
		 * `{{title}}` and the lede from `{{excerpt}}` — the pattern every standing Page here
		 * follows. The menu's label is separate (src/data/navigation.ts), so the nav still reads
		 * "Styleguide" while the sheet opens on the sentence the design opens on.
		 */
		title: 'Warm, serif-led, and unhurried.',
		template: null,
		excerpt:
			'A literary direction: Newsreader at display sizes with optical sizing, generous whitespace, ' +
			'warm stone neutrals, and a single burnt-amber accent. Radii stay soft, elevation stays low, ' +
			'meta is set in small caps. Built for essays and long interviews.',
		body: [
			'<h2>Heading two sets the chapter</h2>',
			'<p>Body copy is the product. Everything else in a publishing theme exists to get out of its way — which means the measure, the leading, and the space above a heading matter more than any flourish. This paragraph runs at <strong>19px</strong> with a <strong>1.72</strong> line height.</p>',
			'<p>Links inside prose stay in the accent colour with a 1px underline offset by 3px, so descenders stay legible. Inline <code>code</code> gets a tinted chip.</p>',
			'<h3>Heading three</h3>',
			'<p>Headings step down by a fixed ratio and inherit the display face, keeping the vertical rhythm intact even in a 4,000-word essay.</p>',
			'<h4>Heading four switches to the UI face</h4>',
			'<p>A deliberate break: at this size the grotesque reads as a label rather than a title.</p>',
			/* Flat, because the drawing's list is flat — its third item only NAMES nesting. */
			'<ul><li>Unordered lists keep the body measure</li><li>Markers sit in the muted tone</li><li>Nested items indent by one step</li></ul>',
			/* The `<cite>` and the pull quote's class are both dropped by the importer, so the two
			 * specimens the drawing pairs here are stated as the editor would emit them. */
			htmlCard(
				'<blockquote><p>A theme is a promise about how much you respect the reader’s attention.</p><cite>Blockquote · attribution</cite></blockquote>',
			),
			htmlCard(
				'<blockquote class="kg-blockquote-alt"><p>Pull quotes break the column and reset the reader’s pace.</p></blockquote>',
			),
			/*
			 * A BARE <pre>, because that is what Ghost emits for a code block with no caption. The
			 * `figure.kg-code-card` wrapper is the CAPTIONED form only — `codeblock-renderer.js`
			 * builds the figure inside `if (node.caption)` and returns the `pre` alone otherwise —
			 * and the drawing's specimen has no caption. The strip above the block is the theme's
			 * own, drawn by main.js from the language this block names.
			 */
			'<pre><code class="language-css">@theme {\n  --color-bg: var(--mirror-bg);\n  --color-surface: var(--mirror-surface);\n  --color-accent: var(--mirror-accent);\n}</code></pre>',
			/*
			 * THE SPECIMEN'S SHAPE IS PART OF THE SPECIMEN, and it was the largest single source of
			 * drift in the first scored run. The drawing draws the regular image as a 3:2 panel, the
			 * wide one as 21:9 and a gallery slide as 4:3; the images picked here were portraits, so
			 * the regular figure alone rendered 1,096px tall against the drawing's 411px and pushed
			 * the whole sheet 1,178px past the reference frame — everything below the first photo was
			 * scored against the wrong content. These are the landscape images in the fixture whose
			 * intrinsic ratios come closest: 3:2 for the measure, 16:9 for the wide step (nothing
			 * here is 21:9), 3:2 and 4:3 for the slides.
			 *
			 * Every `alt` below describes the photograph that is actually there. The wide card used
			 * to claim "a quarry face in low morning light" over a portrait of a woman, which is the
			 * one kind of alt text worse than none.
			 */
			'<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/img/pexels-7319071.jpg" class="kg-image" alt="A lamplit writing desk with a typewriter at the foot of a staircase"><figcaption>Caption sits left, one step down, muted.</figcaption></figure>',
			'<figure class="kg-card kg-image-card kg-width-wide kg-card-hascaption"><img src="/img/pexels-305814.jpg" class="kg-image" alt="The sloped glass roofline of a modern building above a paved plaza"><figcaption>Wide card — measure + 2×88px.</figcaption></figure>',
			/*
			 * `kg-bookmark-author` carries the PUBLISHER and `kg-bookmark-publisher` the author. That
			 * is not a typo here or there: bookmark-renderer.js sets them that way and says why in a
			 * comment — "the classes are reversed for theme backwards-compatibility" — and a Specimen
			 * that quietly corrects the platform tests a stylesheet against markup no reader will get.
			 */
			'<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://ghost.org/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Reading is a design problem</div><div class="kg-bookmark-description">A short study of measure, leading, and why most publishing themes get both wrong.</div><div class="kg-bookmark-metadata"><span class="kg-bookmark-author">thequarry.press</span><span class="kg-bookmark-publisher">Erin Laurier</span></div></div></a></figure>',
			htmlCard(
				'<figure class="kg-card kg-gallery-card kg-width-wide"><div class="kg-gallery-container">' +
					'<div class="kg-gallery-row">' +
					'<div class="kg-gallery-image"><img src="/img/pexels-27409011.jpg" alt="Open ledgers and hand-drawn plans on a draughtsman’s desk" width="1200" height="800"></div>' +
					'<div class="kg-gallery-image"><img src="/img/pexels-7610808.jpg" alt="A typewriter and blank pages under warm light in a green study" width="1200" height="800"></div>' +
					'</div><div class="kg-gallery-row">' +
					'<div class="kg-gallery-image"><img src="/img/pexels-7970681.jpg" alt="A bright desk with a typewriter, papers, glasses and a coffee cup" width="1200" height="800"></div>' +
					'<div class="kg-gallery-image"><img src="/img/pexels-33883996.jpg" alt="Rows of wooden desks with green banker’s lamps in a records office" width="1200" height="900"></div>' +
					'</div></div></figure>',
			),
			'<div class="kg-card kg-button-card kg-align-center"><a href="/membership/" class="kg-btn kg-btn-accent">Become a member</a></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-grey"><div class="kg-callout-emoji">💡</div><div class="kg-callout-text">Callout card — for editor’s notes, corrections, and disclosures. Four accent variants ship with the theme.</div></div>',
			/* The chevron is Ghost's own, path and aria-label included: `cards.min.js` is what opens
			 * the card, and `cards.min.css` styles `.kg-toggle-heading path`, so an empty button was
			 * a Specimen of a toggle nobody can see the state of. */
			'<div class="kg-card kg-toggle-card" data-kg-toggle-state="close"><div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">Toggle card — does the theme support memberships?</h4><button class="kg-toggle-card-icon" aria-label="Expand toggle to read content"><svg id="Regular" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path class="cls-1" d="M23.25,7.311,12.53,18.03a.749.749,0,0,1-1.06,0L.75,7.311"></path></svg></button></div><div class="kg-toggle-content"><p>Yes — free, paid, and comped tiers, with paywall gates, tier badges, and a members dashboard. Alpine drives the disclosure; <code>aria-expanded</code> and <code>aria-controls</code> stay bound to state.</p></div></div>',
			'<hr>',
			'<div class="kg-card kg-product-card"><div class="kg-product-card-container"><div class="kg-product-card-title-container"><h4 class="kg-product-card-title">MIRROR — Ghost theme</h4></div><div class="kg-product-card-description"><p>Two directions, dark mode, full card coverage, AA contrast throughout.</p></div><a href="/membership/" class="kg-product-card-button kg-product-card-btn-accent"><span>$149 · Buy</span></a></div></div>',
		].join('\n'),
	},
	/*
	 * THE STYLE GUIDE — every element and Platform card a Ghost editor can emit, in every variant.
	 *
	 * WHAT DECIDES WHAT IS ON THIS PAGE. Not the drawing. Ghost's own renderers do: the card set is
	 * `@tryghost/kg-default-nodes/build/esm/nodes` (nineteen directories), the variant classes are
	 * whatever `getCardClasses` in each renderer can push, and the CSS Ghost ships for them is the
	 * sixteen bundles in `core/frontend/public/cards.manifest.json`. Every class name below was read
	 * out of one of those two places rather than remembered — which is how three specimens on the
	 * design-tokens sheet turned out to be markup Ghost cannot emit (a `kg-code-card` figure with no
	 * caption, `kg-file-card-medium`, a `kg-v2` header carrying v1's `kg-size-small`).
	 *
	 * The h2 and h3 headings are load-bearing twice over: they are the labels a buyer reads, and
	 * they are what `postToc(3)` builds the rail from. So every heading here is a REAL heading node —
	 * Ghost's Lexical renderer slugifies each one into an id, and a heading inside an html card would
	 * be passed through without one and silently vanish from the contents list.
	 *
	 * WHY SOME SPECIMENS ARE html CARDS AND OTHERS ARE NOT. A real editor node is the closer test
	 * and is used wherever the importer builds one, which is most of them. The rest are the cards
	 * whose parsers DROP what they cannot rebuild — measured, not guessed: an audio or video card
	 * with no `src`, a gallery, a signup card, a bare `<mark>`, `kg-blockquote-alt`, a `<cite>`, the
	 * footnote classes — plus the variants the parser normalises away, which is any card whose look
	 * comes from fields the importer does not read (a header card's background image, a product
	 * rating, a CTA's sponsor label). An html card is what a buyer pasting markup gets, and for a
	 * Specimen the point is the class names the theme's CSS is written against.
	 *
	 * The players carry no `src` and the X embed is the blockquote WITHOUT `widgets.js`: what the
	 * theme's rules touch is the CHROME around a player and the pre-widget state of a tweet, and a
	 * real media file or a third-party script would put a request into every capture whose outcome
	 * nothing here depends on.
	 */
	{
		slug: 'styleguide',
		title: 'Style guide',
		template: null,
		excerpt:
			'Every element and card Ghost’s editor can emit, rendered in this theme — including the ones ' +
			'the design never drew, and the handful the theme deliberately leaves alone.',
		body: [
			'<p>Ghost’s editor can emit nineteen kinds of card, and a card is rarely one thing: a callout has nine colours, a header card four backgrounds, a sign-up card three layouts. Below is each of them, with its variants, in the order a reader meets them. Each section says what the element is and what this theme does about it — because for some of them the right answer is deliberately nothing, and a style guide that hides that is not one.</p>',

			/* ── 01 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Headings</h2>',
			'<p>Six levels, all reachable from the editor: type <code>#</code> through <code>######</code> in a markdown card, or pick H1–H6 from the contextual toolbar. The scale steps by a fixed ratio and inherits the display face down to h4, where it switches to the UI face one weight up — past that size a heading is a label, not a title.</p>',
			'<p>An h1 inside the body is not the page title. <code>page-styleguide.hbs</code> sets the title separately from <code>{{title}}</code>, so an editor’s h1 is a heading in the article and gets the article’s own scale.</p>',
			/*
			 * The specimens are their own labels rather than sitting under one, and that is not
			 * brevity: an h2 and an h3 here are REAL headings with real ids, so they enter the
			 * contents list on the right exactly as an author's would. A separate label above each
			 * would have put "Heading level two" in the rail pointing at a heading that says
			 * something else. This way the rail demonstrates the rule it is built from.
			 */
			'<h1>Heading level one</h1>',
			'<h2>Heading level two</h2>',
			'<h3>Heading level three</h3>',
			'<h4>Heading level four</h4>',
			'<h5>Heading level five</h5>',
			'<h6>Heading level six</h6>',

			/* ── 02 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Links</h2>',
			'<p>Links in prose take the publication’s accent with a 1px underline offset by 3px, so descenders stay legible: <a href="https://ghost.org/">an ordinary inline link</a>, and <a href="/archive/">one that points inside the publication</a>. A pasted address becomes a link on its own — <a href="https://ghost.org/docs/">https://ghost.org/docs/</a> — which is why descriptive link text is worth writing by hand.</p>',

			/* ── 03 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Text formatting</h2>',
			'<p>Everything the toolbar and the markdown renderer can do to a run of text inside a paragraph.</p>',
			'<h3>Emphasis</h3>',
			'<p>Text can be <strong>bold</strong>, <em>italic</em>, both <strong><em>at once</em></strong>, or <s>struck through</s>. Bold takes one weight up in the body face rather than the display face, which at reading size is the difference between emphasis and a heading in the wrong place.</p>',
			'<h3>Inline code</h3>',
			'<p>Backticks make <code>inline code</code>, which gets a tinted chip and the mono face at 0.92em — small enough not to open the line, large enough to read at reading distance. A whole line of it, <code>--mirror-accent: #b45309</code>, keeps the same measure.</p>',
			'<h3>Highlighting</h3>',
			'<p>Type <code>==text==</code> in a markdown card, or use the editor’s highlight button, and Ghost emits a bare <code>&lt;mark&gt;</code>. Nothing styled it: the frontend loads this theme’s stylesheet and <code>cards.min.css</code>, and the one <code>mark</code> rule Ghost owns is in <code>ghost.min.css</code>, a file it never serves to a reader.</p>',
			/* The importer strips a bare `<mark>` out of a text node; the editor's own highlight
			 * button emits exactly this, so the paragraph is stated as the editor would. */
			htmlCard(
				'<p>The fill is <mark>the publication’s accent</mark>, laid over the page at 22% — one percentage that reads the same in both Modes, where the browser’s default was <code>#ff0</code> on <code>#000</code>.</p>',
			),
			'<h3>Subscript and superscript</h3>',
			'<p><code>~sub~</code> and <code>^sup^</code> come from the same markdown renderer. The browser’s own default sizes them at 0.83em, which is large enough to open the line they sit in, so both are set smaller and lifted with <code>vertical-align</code> instead.</p>',
			'<p>Water is H<sub>2</sub>O, and this is the 3<sup>rd</sup> of the month.</p>',

			/* ── 04 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Lists</h2>',
			'<p>Both kinds keep the body measure, and their markers sit in the muted tone rather than the text tone: a marker is scaffolding, and at full contrast a long list reads as a column of dots.</p>',
			'<h3>Unordered</h3>',
			'<ul><li>Unordered lists keep the body measure</li><li>Markers sit in the muted tone</li><li>An item can run long enough to wrap, in which case the second line aligns with the first rather than with the marker</li></ul>',
			'<h3>Ordered</h3>',
			'<ol><li>Ordered lists number in the same muted tone</li><li>The number is the marker, not part of the text</li><li>Nested items indent by one step and start their own count</li></ol>',
			'<h3>Nested</h3>',
			'<ul><li>A list can hold a list<ul><li>The nested marker changes, which is the browser’s own behaviour and worth keeping</li><li>Two levels is the most an article should need</li></ul></li><li>And then continue at the first level</li></ul>',

			/* ── 05 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Dividers</h2>',
			'<p>Three dashes in a markdown card, or the divider card, produce an <code>&lt;hr&gt;</code>. It draws as a hairline in the border tone at the width of the measure — not a full-bleed rule, because the divider belongs to the column it divides.</p>',
			'<hr>',

			/* ── 06 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Quotes</h2>',
			'<p>Two shapes, and they mean different things. A blockquote is somebody else talking; a pull quote is the author raising their voice.</p>',
			'<h3>Blockquote</h3>',
			/* The `<cite>` is dropped by the importer, so the pair is stated as the editor emits it. */
			htmlCard(
				'<blockquote><p>A theme is a promise about how much you respect the reader’s attention.</p><cite>Blockquote · attribution</cite></blockquote>',
			),
			'<h3>Pull quote</h3>',
			'<p>The editor’s second quote style. Ghost stores it as an <code>aside</code> node and renders <code>&lt;blockquote class="kg-blockquote-alt"&gt;</code>, which the theme sets in the display face, centred, with no rail — the opposite treatment to the one above, so the two can never be mistaken for each other.</p>',
			htmlCard(
				'<blockquote class="kg-blockquote-alt"><p>Pull quotes break the column and reset the reader’s pace.</p></blockquote>',
			),

			/* ── 07 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Tables</h2>',
			'<p>Ghost emits a bare <code>&lt;table&gt;</code> — no wrapper, no class, nothing named <code>kg-table</code> anywhere in 6.60 — and a table stops shrinking at its min-content width, so a wide one used to push the whole page past the viewport. <code>assets/js/main.js</code> wraps each one in its own scroll container, so the columns stay reachable and the page keeps its measure.</p>',
			'<h3>Within the measure</h3>',
			'<table><thead><tr><th>Tier</th><th>Price</th><th>Archive</th><th>Interviews</th></tr></thead>' +
				'<tbody>' +
				'<tr><td>Free</td><td>$0</td><td>Partial</td><td>No</td></tr>' +
				'<tr><td>Member</td><td>$7</td><td>Full</td><td>Yes</td></tr>' +
				'<tr><td>Patron</td><td>$18</td><td>Full</td><td>Yes</td></tr>' +
				'</tbody></table>',
			'<h3>Wider than the measure</h3>',
			'<p>Ten columns, on purpose. The shell scrolls; the page does not.</p>',
			'<table><thead><tr><th>#</th><th>Tier</th><th>Price</th><th>Archive</th><th>Interviews</th><th>Field notes</th><th>Comments</th><th>Newsletter</th><th>Events</th><th>Backfile</th></tr></thead>' +
				'<tbody>' +
				'<tr><td>1</td><td>Free</td><td>$0</td><td>Partial</td><td>No</td><td>No</td><td>Read</td><td>Weekly</td><td>No</td><td>No</td></tr>' +
				'<tr><td>2</td><td>Member</td><td>$7</td><td>Full</td><td>Yes</td><td>Yes</td><td>Write</td><td>Weekly</td><td>Yes</td><td>Partial</td></tr>' +
				'<tr><td>3</td><td>Patron</td><td>$18</td><td>Full</td><td>Yes</td><td>Yes</td><td>Write</td><td>Weekly</td><td>Yes</td><td>Full</td></tr>' +
				'</tbody></table>',

			/* ── 08 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Code blocks</h2>',
			'<p>The code card takes an optional language and an optional caption, and Ghost emits a different element for each combination: with a caption it wraps the block in <code>figure.kg-code-card</code>, and without one it returns the bare <code>&lt;pre&gt;</code>. The theme wraps either in its own scroll shell and draws the language as a strip above the block, read from the <code>language-*</code> class rather than typed twice.</p>',
			'<h3>With a language</h3>',
			'<pre><code class="language-css">@theme {\n  --color-bg: var(--mirror-bg);\n  --color-surface: var(--mirror-surface);\n  --color-accent: var(--mirror-accent);\n}</code></pre>',
			'<h3>Without a language</h3>',
			'<p>No strip, because there is nothing true to put in it.</p>',
			'<pre><code>$ ghost start\n✔ Starting Ghost\n→ http://localhost:2368</code></pre>',
			'<h3>With a caption</h3>',
			'<figure class="kg-card kg-code-card"><pre><code class="language-javascript">export const measure = (text) =&gt; text.length / 68;</code></pre><figcaption>The captioned form is the only one that gets a <code>figure</code>.</figcaption></figure>',

			/* ── 09 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Buttons</h2>',
			'<p>The button card has one style on the frontend — <code>kg-btn kg-btn-accent</code>, filled with the publication’s accent — and two alignments. Its ink is Ghost’s <code>#fff</code> and stays Ghost’s: the accent is the buyer’s, and claiming the ink without the fill is what puts white text on a pale panel.</p>',
			'<h3>Left aligned</h3>',
			'<div class="kg-card kg-button-card kg-align-left"><a href="/membership/" class="kg-btn kg-btn-accent">Become a member</a></div>',
			'<h3>Centred</h3>',
			'<div class="kg-card kg-button-card kg-align-center"><a href="/membership/" class="kg-btn kg-btn-accent">Become a member</a></div>',

			/* ── 10 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Callouts</h2>',
			'<p>The design draws one callout: an accent rail instead of Ghost’s filled block. Ghost offers nine colours, and all nine of its tints are translucent — <code>#21ace81f</code> is blue at 12% — so they sit over the page in either Mode without a rule from the theme. What the theme adds is the rail, and the rail takes the author’s own colour: a blue panel with an amber rail is the theme arguing with the person who chose blue.</p>',
			'<div class="kg-card kg-callout-card kg-callout-card-grey"><div class="kg-callout-emoji">💡</div><div class="kg-callout-text">Grey is the editor’s default, and the design’s own tint.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-white"><div class="kg-callout-emoji">📄</div><div class="kg-callout-text">White is Ghost’s outline-only variant: transparent, with a hairline.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-blue"><div class="kg-callout-emoji">🔍</div><div class="kg-callout-text">Blue, for an aside the reader can skip.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-green"><div class="kg-callout-emoji">✅</div><div class="kg-callout-text">Green, for something confirmed.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-yellow"><div class="kg-callout-emoji">⚠️</div><div class="kg-callout-text">Yellow, for a caveat that changes what the paragraph above means.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-red"><div class="kg-callout-emoji">🚫</div><div class="kg-callout-text">Red, for a correction — the one callout a reader must not miss.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-pink"><div class="kg-callout-emoji">📌</div><div class="kg-callout-text">Pink, which Ghost offers and the design has no opinion about.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-purple"><div class="kg-callout-emoji">🎧</div><div class="kg-callout-text">Purple, the same.</div></div>',
			'<div class="kg-card kg-callout-card kg-callout-card-accent"><div class="kg-callout-emoji">🔥</div><div class="kg-callout-text">Accent is Ghost’s exception: it fills with the publication’s colour and sets its own ink in the same declaration, so the rail darkens the fill instead of repeating it.</div></div>',
			'<h3>Without an emoji</h3>',
			'<p>The emoji is optional in the editor, and when it is off Ghost omits the element rather than leaving it empty — so the text takes the whole card and the rail still says what kind of note it is.</p>',
			htmlCard(
				'<div class="kg-card kg-callout-card kg-callout-card-grey"><div class="kg-callout-text">No emoji: <code>calloutEmoji</code> is false, and <code>callout-renderer.js</code> never appends the div.</div></div>',
			),

			/* ── 11 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Toggles</h2>',
			'<p>A disclosure with a heading and a body. The card ships closed — <code>data-kg-toggle-state="close"</code> — and Ghost’s own <code>cards.min.js</code> is what opens it, so the theme claims the panel, the radius and the heading’s face and leaves the chevron and its animation alone. Owning half of a disclosure it does not drive is how a theme ends up with a card that animates the wrong way.</p>',
			'<div class="kg-card kg-toggle-card" data-kg-toggle-state="close"><div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">Does the theme support memberships?</h4><button class="kg-toggle-card-icon" aria-label="Expand toggle to read content"><svg id="Regular" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path class="cls-1" d="M23.25,7.311,12.53,18.03a.749.749,0,0,1-1.06,0L.75,7.311"></path></svg></button></div><div class="kg-toggle-content"><p>Yes — free, paid, and comped tiers, with paywall gates, tier badges, and a members dashboard.</p></div></div>',

			/* ── 12 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Bookmarks</h2>',
			'<p>A bookmark card is a scraped link: title, description, publisher, author, favicon and thumbnail, each of them present only if the scrape found it. The design draws this card, so it takes the design’s colour in both Modes — the page surface, a hairline, and the muted step for the metadata row.</p>',
			'<h3>With a thumbnail</h3>',
			'<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://ghost.org/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Reading is a design problem</div><div class="kg-bookmark-description">A short study of measure, leading, and why most publishing themes get both wrong.</div><div class="kg-bookmark-metadata"><span class="kg-bookmark-author">thequarry.press</span><span class="kg-bookmark-publisher">Erin Laurier</span></div></div><div class="kg-bookmark-thumbnail"><img src="/img/pexels-1425146.jpg" alt="" onerror="this.style.display = \'none\'"></div></a></figure>',
			'<h3>Without a thumbnail</h3>',
			'<p>Most links have no usable image, and Ghost omits the element entirely rather than leaving a grey box — so the content simply takes the full width.</p>',
			htmlCard(
				'<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://ghost.org/docs/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Ghost documentation</div><div class="kg-bookmark-description">No open-graph image, so no thumbnail element is emitted at all.</div><div class="kg-bookmark-metadata"><img class="kg-bookmark-icon" src="/img/icon-home.png" alt=""><span class="kg-bookmark-author">ghost.org</span></div></div></a></figure>',
			),
			'<h3>With a caption</h3>',
			'<p>A caption turns the card into a captioned figure, which is where <code>kg-card-hascaption</code> comes from.</p>',
			htmlCard(
				'<figure class="kg-card kg-bookmark-card kg-card-hascaption"><a class="kg-bookmark-container" href="https://ghost.org/"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Reading is a design problem</div><div class="kg-bookmark-description">The caption sits below the panel, in the same place a photograph’s does.</div><div class="kg-bookmark-metadata"><span class="kg-bookmark-author">thequarry.press</span></div></div></a><figcaption>Captions on cards use the figure’s own rule, not a card rule.</figcaption></figure>',
			),

			/* ── 13 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Images</h2>',
			'<p>Three widths, a caption, an optional link, and an alt text. The theme sets <code>max-width: 100%</code> rather than <code>width: 100%</code>: an editor can upload an image narrower than the measure, and stretching it to the column is the one thing a theme must not do to somebody’s photograph.</p>',
			'<h3>Regular</h3>',
			'<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/img/pexels-7319071.jpg" class="kg-image" alt="A lamplit writing desk with a typewriter at the foot of a staircase" loading="lazy" width="1200" height="800"><figcaption>Caption sits left, one step down, muted.</figcaption></figure>',
			'<h3>Wide</h3>',
			'<figure class="kg-card kg-image-card kg-width-wide kg-card-hascaption"><img src="/img/pexels-305814.jpg" class="kg-image" alt="The sloped glass roofline of a modern building above a paved plaza" loading="lazy" width="1200" height="675"><figcaption>Wide card — measure + 2×88px, and only once the viewport can absorb the overhang.</figcaption></figure>',
			'<h3>Full width</h3>',
			'<p>Ghost offers a third step that runs to the edge of the viewport. The design has no viewport-edge treatment at all, so the theme renders full at the wide step rather than inventing one.</p>',
			'<figure class="kg-card kg-image-card kg-width-full kg-card-hascaption"><img src="/img/pexels-2705436.jpg" class="kg-image" alt="A curved modernist office façade of glass and pale stone" loading="lazy" width="1200" height="806"><figcaption>Full width, drawn at the wide step.</figcaption></figure>',
			'<h3>Without a caption</h3>',
			'<p>No <code>figcaption</code>, and no <code>kg-card-hascaption</code> — which matters, because Ghost uses that class’s absence to close two adjacent uncaptioned images up into a series.</p>',
			'<figure class="kg-card kg-image-card"><img src="/img/pexels-27409011.jpg" class="kg-image" alt="Open ledgers and hand-drawn plans on a draughtsman’s desk" loading="lazy" width="1200" height="800"></figure>',
			'<h3>Linked</h3>',
			'<p>An image can carry a link, in which case Ghost wraps the <code>img</code> in an <code>a</code> inside the figure. The theme’s image rule matches <code>.kg-image</code> as well as <code>figure &gt; img</code> for exactly this reason: an image nested one level deeper must not lose its radius.</p>',
			htmlCard(
				'<figure class="kg-card kg-image-card kg-card-hascaption"><a href="/archive/"><img src="/img/pexels-7610808.jpg" class="kg-image" alt="A typewriter and blank pages under warm light in a green study" loading="lazy" width="1200" height="800"></a><figcaption>The whole photograph is the link.</figcaption></figure>',
			),

			/* ── 14 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Galleries</h2>',
			'<p>A gallery packs up to three images per row and is always wide — <code>gallery-renderer.js</code> hardcodes <code>kg-width-wide</code>, so there is no regular gallery to specimen. Ghost also rebalances the last row: four images become two and two rather than three and one.</p>',
			'<h3>Two per row</h3>',
			htmlCard(
				'<figure class="kg-card kg-gallery-card kg-width-wide"><div class="kg-gallery-container">' +
					'<div class="kg-gallery-row">' +
					'<div class="kg-gallery-image"><img src="/img/pexels-27409011.jpg" alt="Open ledgers and hand-drawn plans on a draughtsman’s desk" width="1200" height="800" loading="lazy"></div>' +
					'<div class="kg-gallery-image"><img src="/img/pexels-7610808.jpg" alt="A typewriter and blank pages under warm light in a green study" width="1200" height="800" loading="lazy"></div>' +
					'</div><div class="kg-gallery-row">' +
					'<div class="kg-gallery-image"><img src="/img/pexels-7970681.jpg" alt="A bright desk with a typewriter, papers, glasses and a coffee cup" width="1200" height="800" loading="lazy"></div>' +
					'<div class="kg-gallery-image"><img src="/img/pexels-33883996.jpg" alt="Rows of wooden desks with green banker’s lamps in a records office" width="1200" height="900" loading="lazy"></div>' +
					'</div></div></figure>',
			),
			'<h3>Three per row, with a caption</h3>',
			htmlCard(
				'<figure class="kg-card kg-gallery-card kg-width-wide kg-card-hascaption"><div class="kg-gallery-container">' +
					'<div class="kg-gallery-row">' +
					'<div class="kg-gallery-image"><img src="/img/pexels-1425146.jpg" alt="A vintage typewriter on a worn wooden desk" width="1200" height="798" loading="lazy"></div>' +
					'<div class="kg-gallery-image"><img src="/img/pexels-7319071.jpg" alt="A lamplit writing desk with a typewriter at the foot of a staircase" width="1200" height="800" loading="lazy"></div>' +
					'<div class="kg-gallery-image"><img src="/img/pexels-733872.jpg" alt="A woman in a tan coat looking towards the camera outdoors" width="1200" height="800" loading="lazy"></div>' +
					'</div></div><figcaption>Three across is the maximum; a fourth image opens a second row.</figcaption></figure>',
			),

			/* ── 15 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Audio</h2>',
			'<p>Ghost’s own player: thumbnail, title, seek, rate and volume. The design draws no player, so the theme claims nothing but the colour — Ghost hardcodes a white panel with <code>#222</code> ink, which in dark Mode was a white slab in the middle of a near-black page.</p>',
			/*
			 * THE CONTROL SET IS COMPLETE BECAUSE GHOST'S OWN SCRIPT REQUIRES IT TO BE, and getting
			 * that wrong took the whole page's card behaviour down.
			 *
			 * `cards.min.js` is one file of concatenated IIFEs, one per card type, and its audio
			 * chunk opens with eleven unguarded `querySelector` calls followed by `.addEventListener`
			 * on each. A player missing `kg-audio-pause-icon` throws `Cannot read properties of null`
			 * at the top level of the script — which aborts every chunk AFTER it in the same file.
			 * Measured here: the toggle card on this page would not open, and the reason was two
			 * buttons missing from an audio specimen four sections above it.
			 *
			 * So both players below carry every element `audio-renderer.js` emits, `kg-audio-hide`
			 * included. That is what the renderer writes for a real upload, and a Specimen that
			 * abbreviates the platform's markup does not test the platform.
			 */
			'<h3>With a thumbnail</h3>',
			htmlCard(
				'<div class="kg-card kg-audio-card">' +
					'<img src="/img/pexels-305814.jpg" alt="audio-thumbnail" class="kg-audio-thumbnail">' +
					'<div class="kg-audio-thumbnail placeholder kg-audio-hide"><svg width="24" height="24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.5 15.33a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM15 13.83a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Z"></path></svg></div>' +
					'<div class="kg-audio-player-container">' +
					'<audio src="/img/pexels-305814.jpg" preload="metadata"></audio>' +
					'<div class="kg-audio-title">Field recording — the quarry at dawn</div>' +
					'<div class="kg-audio-player">' +
					'<button class="kg-audio-play-icon" aria-label="Play audio">▶</button>' +
					'<button class="kg-audio-pause-icon kg-audio-hide" aria-label="Pause audio">❙❙</button>' +
					'<span class="kg-audio-current-time">0:00</span>' +
					'<div class="kg-audio-time">/<span class="kg-audio-duration">4:12</span></div>' +
					'<input type="range" class="kg-audio-seek-slider" max="100" value="0" aria-label="Seek">' +
					'<button class="kg-audio-playback-rate">1&#215;</button>' +
					'<button class="kg-audio-unmute-icon" aria-label="Unmute">🔊</button>' +
					'<button class="kg-audio-mute-icon kg-audio-hide" aria-label="Mute">🔇</button>' +
					'<input type="range" class="kg-audio-volume-slider" max="100" value="100" aria-label="Volume">' +
					'</div></div></div>',
			),
			'<h3>Without a thumbnail</h3>',
			'<p>Both thumbnail elements are always emitted and one of them carries <code>kg-audio-hide</code>. The placeholder fills with the publication’s accent and a white file icon — Ghost’s own pairing, left alone here for the same reason the button card’s ink is.</p>',
			htmlCard(
				'<div class="kg-card kg-audio-card">' +
					'<img src="" alt="audio-thumbnail" class="kg-audio-thumbnail kg-audio-hide">' +
					'<div class="kg-audio-thumbnail placeholder"><svg width="24" height="24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.5 15.33a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM15 13.83a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Z"></path></svg><svg width="24" height="24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.486 6.81A2.25 2.25 0 0 1 17.25 9v5.579a.75.75 0 0 1-1.5 0v-5.58a.75.75 0 0 0-.932-.727.755.755 0 0 1-.059.013l-4.465.744a.75.75 0 0 0-.544.72v6.33a.75.75 0 0 1-1.5 0v-6.33a2.25 2.25 0 0 1 1.763-2.194l4.473-.746Z"></path></svg></div>' +
					'<div class="kg-audio-player-container">' +
					'<audio src="/img/pexels-305814.jpg" preload="metadata"></audio>' +
					'<div class="kg-audio-title">An audio file with no cover art</div>' +
					'<div class="kg-audio-player">' +
					'<button class="kg-audio-play-icon" aria-label="Play audio">▶</button>' +
					'<button class="kg-audio-pause-icon kg-audio-hide" aria-label="Pause audio">❙❙</button>' +
					'<span class="kg-audio-current-time">0:00</span>' +
					'<div class="kg-audio-time">/<span class="kg-audio-duration">1:38</span></div>' +
					'<input type="range" class="kg-audio-seek-slider" max="100" value="0" aria-label="Seek">' +
					'<button class="kg-audio-playback-rate">1&#215;</button>' +
					'<button class="kg-audio-unmute-icon" aria-label="Unmute">🔊</button>' +
					'<button class="kg-audio-mute-icon kg-audio-hide" aria-label="Mute">🔇</button>' +
					'<input type="range" class="kg-audio-volume-slider" max="100" value="100" aria-label="Volume">' +
					'</div></div></div>',
			),

			/* ── 16 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Video</h2>',
			'<p>The same shape with its controls over the frame, and the one card where nothing is claimed at all: every white value in Ghost’s CSS sits inside a bar painted over <code>#00000080</code> on top of the video, so it is already right in both Modes. Video takes the three widths images do, and its control set is complete for the same reason the audio one is.</p>',
			htmlCard(
				'<figure class="kg-card kg-video-card kg-width-wide kg-card-hascaption">' +
					/* `padding-bottom` is not decoration and not a guess: cards.min.css sets
					 * `.kg-video-container { height: 0 }` and the EDITOR supplies the ratio inline,
					 * so without it the card collapsed to its caption alone — measured. 56.25% is
					 * 16:9, which is what Ghost writes for a 1280×720 clip. */
					'<div class="kg-video-container" style="padding-bottom: 56.25%">' +
					'<video poster="/img/pexels-91227.jpg" preload="metadata" playsinline></video>' +
					'<div class="kg-video-overlay"><button class="kg-video-large-play-icon" aria-label="Play video">▶</button></div>' +
					'<div class="kg-video-player-container"><div class="kg-video-player">' +
					'<button class="kg-video-play-icon" aria-label="Play video">▶</button>' +
					'<button class="kg-video-pause-icon kg-video-hide" aria-label="Pause video">❙❙</button>' +
					'<span class="kg-video-current-time">0:00</span>' +
					'<div class="kg-video-time">/<span class="kg-video-duration">0:05</span></div>' +
					'<input type="range" class="kg-video-seek-slider" max="100" value="0" aria-label="Seek">' +
					'<button class="kg-video-playback-rate" aria-label="Adjust playback speed">1&#215;</button>' +
					'<button class="kg-video-unmute-icon" aria-label="Unmute">🔊</button>' +
					'<button class="kg-video-mute-icon kg-video-hide" aria-label="Mute">🔇</button>' +
					'<input type="range" class="kg-video-volume-slider" max="100" value="100" aria-label="Volume">' +
					'</div></div></div>' +
					'<figcaption>The player’s controls sit on their own dark overlay, which is why the theme leaves their colour alone.</figcaption>' +
					'</figure>',
			),

			/* ── 17 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Files</h2>',
			'<p>A download: title, caption, filename, size and a circled arrow. Colour only again — the panel and its ink, not the geometry. Ghost’s CSS still carries <code>kg-file-card-small</code> and <code>-medium</code>, but <code>file-renderer.js</code> emits neither, so there is one shape to specimen and the size variants are dead classes.</p>',
			'<div class="kg-card kg-file-card">' +
				'<a class="kg-file-card-container" href="/img/pexels-38048095.jpg" title="Download" download>' +
				'<div class="kg-file-card-contents">' +
				'<div class="kg-file-card-title">The Quarry — annual field report</div>' +
				'<div class="kg-file-card-caption">Twelve months of numbers, and what they cost to gather.</div>' +
				'<div class="kg-file-card-metadata"><div class="kg-file-card-filename">field-report.pdf</div><div class="kg-file-card-filesize">101 KB</div></div>' +
				'</div><div class="kg-file-card-icon"><svg viewBox="0 0 24 24"><defs><style>.a{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;}</style></defs><title>download-circle</title><polyline class="a" points="8.25 14.25 12 18 15.75 14.25"></polyline><line class="a" x1="12" y1="6.75" x2="12" y2="18"></line><circle class="a" cx="12" cy="12" r="11.25"></circle></svg></div></a></div>',

			/* ── 18 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Products</h2>',
			'<p>A product card is a title, a description, an optional image, an optional five-star rating and an optional accent button. The design draws it, so it takes the design’s colour. The rating needs no rule of its own: Ghost draws all five stars with <code>fill: currentColor</code> at 15% and the filled ones at 100%, so claiming the container’s <code>color</code> carries them both.</p>',
			'<h3>Plain</h3>',
			'<div class="kg-card kg-product-card"><div class="kg-product-card-container"><div class="kg-product-card-title-container"><h4 class="kg-product-card-title">MIRROR — Ghost theme</h4></div><div class="kg-product-card-description"><p>Two directions, dark mode, full card coverage, AA contrast throughout.</p></div><a href="/membership/" class="kg-product-card-button kg-product-card-btn-accent"><span>$149 · Buy</span></a></div></div>',
			'<h3>With a rating and an image</h3>',
			htmlCard(
				'<div class="kg-card kg-product-card"><div class="kg-product-card-container">' +
					'<img src="/img/pexels-33883996.jpg" width="1200" height="900" class="kg-product-card-image" loading="lazy" />' +
					'<div class="kg-product-card-title-container"><h4 class="kg-product-card-title">The Quarry Reader — hardback</h4></div>' +
					'<div class="kg-product-card-rating">' +
					'<span class="kg-product-card-rating-active kg-product-card-rating-star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.729,1.2l3.346,6.629,6.44.638a.805.805,0,0,1,.5,1.374l-5.3,5.253,1.965,7.138a.813.813,0,0,1-1.151.935L12,19.934,5.48,23.163a.813.813,0,0,1-1.151-.935L6.294,15.09.99,9.837a.805.805,0,0,1,.5-1.374l6.44-.638L11.271,1.2A.819.819,0,0,1,12.729,1.2Z"/></svg></span>' +
					'<span class="kg-product-card-rating-active kg-product-card-rating-star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.729,1.2l3.346,6.629,6.44.638a.805.805,0,0,1,.5,1.374l-5.3,5.253,1.965,7.138a.813.813,0,0,1-1.151.935L12,19.934,5.48,23.163a.813.813,0,0,1-1.151-.935L6.294,15.09.99,9.837a.805.805,0,0,1,.5-1.374l6.44-.638L11.271,1.2A.819.819,0,0,1,12.729,1.2Z"/></svg></span>' +
					'<span class="kg-product-card-rating-active kg-product-card-rating-star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.729,1.2l3.346,6.629,6.44.638a.805.805,0,0,1,.5,1.374l-5.3,5.253,1.965,7.138a.813.813,0,0,1-1.151.935L12,19.934,5.48,23.163a.813.813,0,0,1-1.151-.935L6.294,15.09.99,9.837a.805.805,0,0,1,.5-1.374l6.44-.638L11.271,1.2A.819.819,0,0,1,12.729,1.2Z"/></svg></span>' +
					'<span class="kg-product-card-rating-active kg-product-card-rating-star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.729,1.2l3.346,6.629,6.44.638a.805.805,0,0,1,.5,1.374l-5.3,5.253,1.965,7.138a.813.813,0,0,1-1.151.935L12,19.934,5.48,23.163a.813.813,0,0,1-1.151-.935L6.294,15.09.99,9.837a.805.805,0,0,1,.5-1.374l6.44-.638L11.271,1.2A.819.819,0,0,1,12.729,1.2Z"/></svg></span>' +
					'<span class="kg-product-card-rating-star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.729,1.2l3.346,6.629,6.44.638a.805.805,0,0,1,.5,1.374l-5.3,5.253,1.965,7.138a.813.813,0,0,1-1.151.935L12,19.934,5.48,23.163a.813.813,0,0,1-1.151-.935L6.294,15.09.99,9.837a.805.805,0,0,1,.5-1.374l6.44-.638L11.271,1.2A.819.819,0,0,1,12.729,1.2Z"/></svg></span>' +
					'</div>' +
					'<div class="kg-product-card-description"><p>Four of five stars: the fifth is drawn at 15% of the same ink rather than omitted.</p></div>' +
					'<a href="/membership/" class="kg-product-card-button kg-product-card-btn-accent" target="_blank" rel="noopener noreferrer"><span>$34 · Buy</span></a>' +
					'</div></div>',
			),

			/* ── 19 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Header cards</h2>',
			'<p>A full-width band with a heading, a subheading and a button. This is the one card where a Mode has no say and the theme claims nothing: <code>header-renderer.js</code> writes the background and every ink INLINE, out of the author’s own editor fields, so the colours below are choices made in Ghost admin and not values a stylesheet could own. The v2 card takes four widths — regular, wide, full and split — and no size class; <code>kg-size-small</code> and <code>-large</code> belong to v1.</p>',
			'<h3>Colour background</h3>',
			'<div class="kg-card kg-header-card kg-v2 kg-width-full kg-content-wide" style="background-color: #1c1917" data-background-color="#1c1917">' +
				'<div class="kg-header-card-content"><div class="kg-header-card-text kg-align-center">' +
				'<h2 id="a-section-header" class="kg-header-card-heading" style="color: #FFFFFF" data-text-color="#FFFFFF">A section header</h2>' +
				'<p class="kg-header-card-subheading" style="color: #FFFFFF" data-text-color="#FFFFFF">Its colours are the author’s choice in the editor, not a Mode.</p>' +
				'<a class="kg-header-card-button" href="/membership/" data-button-color="#ffffff" data-button-text-color="#000000" style="background-color: #ffffff; color: #000000;">Explore</a>' +
				'</div></div></div>',
			'<h3>Accent background</h3>',
			'<p>Choosing "accent" swaps the inline colour for <code>kg-style-accent</code>, which is the one header background that follows the publication rather than the author.</p>',
			htmlCard(
				'<div class="kg-card kg-header-card kg-v2 kg-width-full kg-content-wide kg-style-accent" data-background-color="accent">' +
					'<div class="kg-header-card-content"><div class="kg-header-card-text kg-align-center">' +
					'<h2 class="kg-header-card-heading" style="color: #FFFFFF" data-text-color="#FFFFFF">Filed under the accent</h2>' +
					'<p class="kg-header-card-subheading" style="color: #FFFFFF" data-text-color="#FFFFFF">The only header background a buyer changes by changing their brand colour.</p>' +
					'</div></div></div>',
			),
			'<h3>Image background</h3>',
			'<p>An image background is a <code>picture</code> element absolutely positioned behind the text, which is why the ink is always set inline: the author is reading their own photograph, not a token.</p>',
			htmlCard(
				'<div class="kg-card kg-header-card kg-v2 kg-width-full kg-content-wide" data-background-color="#000000">' +
					'<picture><img class="kg-header-card-image" src="/img/pexels-2705436.jpg" loading="lazy" alt="" /></picture>' +
					'<div class="kg-header-card-content"><div class="kg-header-card-text kg-align-center">' +
					'<h2 class="kg-header-card-heading" style="color: #FFFFFF" data-text-color="#FFFFFF">Over a photograph</h2>' +
					'<p class="kg-header-card-subheading" style="color: #FFFFFF" data-text-color="#FFFFFF">The image is a real element behind the text, not a CSS background.</p>' +
					'<a class="kg-header-card-button" href="/archive/" data-button-color="#ffffff" data-button-text-color="#000000" style="background-color: #ffffff; color: #000000;">Read the archive</a>' +
					'</div></div></div>',
			),
			'<h3>Split layout</h3>',
			'<p>The split layout puts the image beside the text instead of behind it, and is always full width — <code>getCardClasses</code> pushes <code>kg-layout-split kg-width-full</code> together, so there is no narrow split to specimen.</p>',
			htmlCard(
				'<div class="kg-card kg-header-card kg-v2 kg-layout-split kg-width-full kg-content-wide" style="background-color: #292524" data-background-color="#292524">' +
					'<div class="kg-header-card-content">' +
					'<picture><img class="kg-header-card-image" src="/img/pexels-7970681.jpg" loading="lazy" alt="" /></picture>' +
					'<div class="kg-header-card-text">' +
					'<h2 class="kg-header-card-heading" style="color: #FFFFFF" data-text-color="#FFFFFF">Beside, not behind</h2>' +
					'<p class="kg-header-card-subheading" style="color: #FFFFFF" data-text-color="#FFFFFF">Add <code>kg-swapped</code> and the image moves to the other side.</p>' +
					'</div></div></div>',
			),

			/* ── 20 ─────────────────────────────────────────────────────────────────────── */
			'<h2>Sign-up cards</h2>',
			'<p>Portal’s form inside the article. Its field row needed both halves of the claim: Ghost sets the input’s background to <code>#fff</code> and leaves the text to inherit, so in dark Mode a visitor typed near-white on white. Ghost also renders this card with <code>display: none</code> and <code>data-lexical-signup-form</code>, and reveals it from its own script — which is why every specimen below is stated with that inline style removed.</p>',
			'<h3>Regular width</h3>',
			htmlCard(
				'<div class="kg-card kg-signup-card kg-width-regular" data-lexical-signup-form>' +
					'<div class="kg-signup-card-content"><div class="kg-signup-card-text kg-align-center">' +
					'<h2 class="kg-signup-card-heading">One considered essay, every Thursday</h2>' +
					'<p class="kg-signup-card-subheading">Free members get the archive. Paid members get the interviews.</p>' +
					'<form class="kg-signup-card-form" data-members-form="signup">' +
					'<div class="kg-signup-card-fields">' +
					'<input class="kg-signup-card-input" id="email" data-members-email="" type="email" required="true" placeholder="jamie@example.com" aria-label="Email address">' +
					'<button class="kg-signup-card-button kg-style-accent" type="submit"><span class="kg-signup-card-button-default">Subscribe</span></button>' +
					'</div>' +
					'<div class="kg-signup-card-success">Thanks! Now check your email to confirm.</div>' +
					'<div class="kg-signup-card-error" data-members-error></div>' +
					'</form>' +
					'<p class="kg-signup-card-disclaimer">No spam. Unsubscribe anytime.</p>' +
					'</div></div></div>',
			),
			'<h3>Accent background, full width</h3>',
			htmlCard(
				'<div class="kg-card kg-signup-card kg-width-full kg-content-wide kg-style-accent" data-lexical-signup-form>' +
					'<div class="kg-signup-card-content"><div class="kg-signup-card-text kg-align-center">' +
					'<h2 class="kg-signup-card-heading" style="color: #FFFFFF">Read the whole quarry</h2>' +
					'<p class="kg-signup-card-subheading" style="color: #FFFFFF">The accent variant is the publication’s colour, so it changes when the buyer’s does.</p>' +
					'<form class="kg-signup-card-form" data-members-form="signup">' +
					'<div class="kg-signup-card-fields">' +
					'<input class="kg-signup-card-input" id="email" data-members-email="" type="email" required="true" placeholder="jamie@example.com" aria-label="Email address">' +
					'<button class="kg-signup-card-button" type="submit" style="background-color: #ffffff; color: #1c1917;"><span class="kg-signup-card-button-default">Subscribe</span></button>' +
					'</div>' +
					'<div class="kg-signup-card-error" data-members-error></div>' +
					'</form>' +
					'</div></div></div>',
			),
			'<h3>The error state</h3>',
			'<p>Portal puts <code>error</code> on the form and writes the reason into <code>kg-signup-card-error</code>. Ghost’s own colour for that text is <code>#ff0000</code>; the theme replaces the field row’s border with its danger token so the failure reads as one thing rather than a red sentence under a normal-looking input.</p>',
			htmlCard(
				'<div class="kg-card kg-signup-card kg-width-regular" data-lexical-signup-form>' +
					'<div class="kg-signup-card-content"><div class="kg-signup-card-text kg-align-center">' +
					'<form class="kg-signup-card-form error" data-members-form="signup">' +
					'<div class="kg-signup-card-fields">' +
					'<input class="kg-signup-card-input" id="email" data-members-email="" type="email" value="jamie@example" aria-label="Email address">' +
					'<button class="kg-signup-card-button kg-style-accent" type="submit"><span class="kg-signup-card-button-default">Subscribe</span></button>' +
					'</div>' +
					'<div class="kg-signup-card-error" data-members-error>Please enter a valid email address.</div>' +
					'</form>' +
					'</div></div></div>',
			),

			/* ── 21 ────────────────────────────────────────────────────────────────────── */
			'<h2>Calls to action</h2>',
			'<p>The newest card here, and newer than the design. Ghost’s own colours are translucent greys over the page, so they survive both Modes untouched; nine background tints, two layouts, an optional image, an optional sponsor label and an optional pair of dividers.</p>',
			'<p>Its button is the one accent control Ghost gives no ink at all: the CSS sets a background and <code>calltoaction-renderer.js</code> writes <code>color</code> inline instead. The first of the three below carries that inline value the way the editor writes it; the other two are pasted markup without it, which used to render an accent label on an accent button and now falls back to the same white Ghost uses on every other accent control.</p>',
			'<h3>Minimal</h3>',
			'<div class="kg-card kg-cta-card kg-cta-bg-grey kg-cta-minimal kg-cta-link-accent" data-layout="minimal">' +
				'<div class="kg-cta-content"><div class="kg-cta-content-inner">' +
				'<div class="kg-cta-text"><p>The interviews are for members. The archive is for everyone.</p></div>' +
				'<a href="/membership/" class="kg-cta-button kg-style-accent">Become a member</a>' +
				'</div></div></div>',
			'<h3>Immersive</h3>',
			'<p>The immersive layout fills the panel and centres its contents; the minimal one keeps the text and the button on one line where there is room.</p>',
			htmlCard(
				'<div class="kg-card kg-cta-card kg-cta-bg-blue kg-cta-immersive kg-cta-link-accent kg-cta-centered" data-layout="immersive">' +
					'<div class="kg-cta-content"><div class="kg-cta-content-inner">' +
					'<div class="kg-cta-text"><p>Six years of interviews, indexed and searchable.</p></div>' +
					'<a href="/archive/" class="kg-cta-button kg-style-accent">Open the archive</a>' +
					'</div></div></div>',
			),
			'<h3>With a sponsor label and an image</h3>',
			htmlCard(
				'<div class="kg-card kg-cta-card kg-cta-bg-none kg-cta-minimal kg-cta-has-img kg-cta-link-accent" data-layout="minimal">' +
					'<div class="kg-cta-sponsor-label-wrapper"><div class="kg-cta-sponsor-label"><p>Sponsored by Verso Press</p></div></div>' +
					'<div class="kg-cta-content">' +
					'<div class="kg-cta-image-container"><a href="https://ghost.org/"><img src="/img/pexels-27409011.jpg" alt="CTA Image" data-image-dimensions="1200x800"></a></div>' +
					'<div class="kg-cta-content-inner">' +
					'<div class="kg-cta-text"><p>A sponsor label sits above the panel and takes its own dividers.</p></div>' +
					'<a href="https://ghost.org/" class="kg-cta-button kg-style-accent">See the books</a>' +
					'</div></div></div>',
			),

			/* ── 22 ────────────────────────────────────────────────────────────────────── */
			'<h2>Embeds</h2>',
			'<p>Embeds are the only card type Ghost ships <em>no</em> CSS for — <code>cards.manifest.json</code> has sixteen bundles and embed is not one of them — so the frame renders at whatever size the oEmbed provider returned. This theme sizes it to the measure and gives a video player a 16:9 ratio, matched on <code>allowfullscreen</code> so a social embed is not cropped into a video’s shape.</p>',
			'<h3>YouTube</h3>',
			'<figure class="kg-card kg-embed-card kg-card-hascaption"><iframe width="200" height="113" src="https://www.youtube.com/embed/wcFSb5EMiI0?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="An embedded video"></iframe><figcaption>YouTube returns <code>width="200"</code> in its own oEmbed html; the frame above is 100% wide at 16:9 because the theme says so.</figcaption></figure>',
			'<h3>X</h3>',
			'<figure class="kg-card kg-embed-card kg-card-hascaption"><blockquote class="twitter-tweet"><p lang="en" dir="ltr">A theme is a promise about how much you respect the reader’s attention.</p>— The Quarry (@thequarry) <a href="https://twitter.com/">March 25, 2024</a></blockquote><figcaption>An X embed before its widget runs — a state the article’s own quote rule used to paint as an accent-railed pull quote.</figcaption></figure>',
			'<h3>NFT</h3>',
			'<p>There is no NFT node in the Lexical editor, so a new post cannot contain one. <code>@tryghost/kg-default-cards</code> still renders it though, which is the path every <em>mobiledoc</em> post takes — a publication migrating onto this theme can arrive with years of them. Its three inks are <code>#222</code> and <code>#ababab</code> on a container with no background at all, so in dark Mode it was near-black text on a near-black page.</p>',
			htmlCard(
				'<figure class="kg-card kg-embed-card kg-nft-card">' +
					'<a class="kg-nft-card-container" href="https://opensea.io/">' +
					'<div class="kg-ntf-image-container"><img class="kg-nft-image" src="/img/pexels-415829.jpg"></div>' +
					'<div class="kg-nft-metadata">' +
					'<div class="kg-nft-header"><h4 class="kg-nft-title">A mobiledoc-era embed</h4></div>' +
					'<div class="kg-nft-creator">Created by <span class="kg-nft-creator-name">an older editor</span></div>' +
					'<p class="kg-nft-description">Claimed as an Extension: the platform’s geometry with this theme’s tokens dropped in.</p>' +
					'</div></a></figure>',
			),

			/* ── 23 ────────────────────────────────────────────────────────────────────── */
			'<h2>Footnotes</h2>',
			'<p>Footnotes come only from a markdown card — Lexical has no footnote card — and produce five classes Ghost styles none of: the reference, the separator, the section, the list and the way back.</p>',
			/* One html card for the whole group: the importer strips every class and id here — the
			 * reference's `footnote-ref`, the separator's `footnotes-sep`, the section itself — and
			 * the anchors are the half that has to keep working, not only the type. */
			htmlCard(
				'<p>A markdown card produces these: a reference,<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup> a separator, and a section at the foot of the page.<sup class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup></p>' +
					'<hr class="footnotes-sep">' +
					'<section class="footnotes"><ol class="footnotes-list">' +
					'<li id="fn1" class="footnote-item"><p>markdown-it-footnote ships inside Ghost’s own markdown renderer, so this markup is the platform’s. <a href="#fnref1" class="footnote-backref">↩︎</a></p></li>' +
					'<li id="fn2" class="footnote-item"><p>Lexical has no footnote card, which is why a buyer only meets these through a markdown card. <a href="#fnref2" class="footnote-backref">↩︎</a></p></li>' +
					'</ol></section>',
			),

			/* ── 24 ────────────────────────────────────────────────────────────────────── */
			'<h2>What this page cannot show</h2>',
			'<p>Four card types are missing on purpose, and each for a reason that is worth more than a specimen would be.</p>',
			'<ul>' +
				'<li>The <strong>collection card</strong> renders posts the platform picks at render time. A hand-written copy would specimen markup Ghost never emits, which is the opposite of what this page is for.</li>' +
				'<li>The <strong>transistor card</strong> is an iframe pointing at a podcast host. Its placeholder already draws with <code>color-mix(in srgb, currentColor …)</code>, so it needs nothing from the theme, and a real embed would put a third-party request into every screenshot.</li>' +
				'<li>The <strong>paywall card</strong> emits an HTML comment and nothing else — Ghost’s output serializer splits the post there before any template runs. Its visible half is the Gate, which is a state of a Post and belongs on a post rather than here.</li>' +
				'<li>The <strong>email</strong> and <strong>email CTA</strong> cards render only into a newsletter, and are deliberately dropped from the web version by the renderer itself.</li>' +
				'</ul>',
		].join('\n'),
	},
];

const fixture = {
	version: 2,
	seed: SEED,
	site: {
		title: data.navigation.SITE_TITLE,
		description: data.navigation.SITE_TAGLINE,
		/*
		 * The design's burnt amber, shipped as the demo site's accent VALUE rather than as a
		 * constant in the theme: the theme reads {{@site.accent_color}} so a buyer's own accent
		 * drives it. Taken from --mirror-accent in src/styles/main.css.
		 */
		accent_color: '#a8580c',
		logo: '/img/logo.png',
		icon: '/img/icon-home.png',
		/*
		 * Settings that change what a template renders or what a capture contains.
		 * portal_button false is not cosmetic: Ghost injects a floating button into <body> at
		 * runtime, and it lands in the bottom-right of every scored screenshot.
		 */
		portal_button: false,
		comments_enabled: 'all',
		recommendations_enabled: true,
		members_signup_access: 'all',
		/*
		 * WHICH PLANS PORTAL OFFERS. Ghost defaults this to `["free"]` and only widens it when
		 * Stripe is connected, so a publication that has written its tiers but not yet plugged in
		 * payments shows a signup modal with one option — while the theme's own Membership Surface
		 * lists all three. Naming the two paid cadences here is what makes Portal show the
		 * publication's real tiers, which is what the auth ticket asks of it. The API accepts the
		 * value without Stripe; what Stripe decides is whether a checkout can complete, not
		 * whether the plan exists.
		 */
		portal_plans: ['free', 'monthly', 'yearly'],
		locale: 'en',
		timezone: 'Etc/UTC',
		/*
		 * The design's own nav is a variant browser — eight menus of preview routes like
		 * /homepage-01 — which is a review affordance, not a publication's menu, and is not
		 * ported. This is the menu the Surfaces actually imply.
		 */
		navigation: [
			{ label: 'Archive', url: '/archive/' },
			{ label: 'Subjects', url: '/tags/' },
			{ label: 'Writers', url: '/authors/' },
			{ label: 'About', url: '/about/' },
			{ label: 'Membership', url: '/membership/' },
		],
		/*
		 * The feed is a menu item like any other — the theme hardcodes no links, so `/rss/` in the
		 * secondary menu is the whole of how the design's footer RSS link is reproduced, and it
		 * points at the feed Ghost serves rather than at a placeholder.
		 */
		secondary_navigation: [
			{ label: 'Recommendations', url: '/recommendations/' },
			{ label: 'Sign in', url: '/sign-in/' },
			{ label: 'RSS', url: '/rss/' },
		],
	},
	tiers: data.membership.TIERS.map((tier) => ({
		name: tier.name,
		description: tier.description,
		benefits: tier.benefits,
		/* Design prices are display strings ("$8"); Ghost stores integer minor units. */
		monthly_price: tier.monthly.price === '$0' ? null : Number(tier.monthly.price.replace(/[^0-9]/g, '')) * 100,
		yearly_price: tier.yearly.price === '$0' ? null : Number(tier.yearly.price.replace(/[^0-9]/g, '')) * 100,
		currency: 'usd',
		featured: Boolean(tier.featured),
	})),
	recommendations: data.recommendations.RECOMMENDATIONS.map((r) => ({
		title: r.title,
		url: `https://${r.url}`,
		description: r.description,
		featured_image: r.image,
		favicon: r.favicon,
		one_click_subscribe: Boolean(r.oneClick),
	})),
	authors,
	tags,
	posts,
	pages,
	concessions,
	secondaries,
};

writeFileSync(OUT, JSON.stringify(fixture, null, '\t') + '\n');

const designedCount = posts.filter((p) => p.designed).length;
console.log(
	`fixture: ${posts.length} posts (${designedCount} designed, ${posts.length - designedCount} filler), ` +
		`${authors.length} authors, ${tags.length} tags, ${pages.length} pages, ` +
		`${fixture.tiers.length} tiers, ${fixture.recommendations.length} recommendations`,
);
console.log(
	`         every author and tag marginal hit exactly; ${concessions.length} reconciliation concession(s), ` +
		`${secondaries.length} secondary tag assertion(s) kept`,
);
console.log(`         → ${OUT}`);

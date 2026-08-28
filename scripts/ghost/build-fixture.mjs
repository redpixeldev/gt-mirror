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
 *      asserted exactly before anything is written.
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
	 * The kitchen sink. Not a template — a page whose body exercises the Koenig card types the
	 * scoped .kg-* layer has to style, which is what the post ticket's gate reads: "the styleguide
	 * page renders every card styled with no unstyled .kg-* block". Ghost converts this HTML to
	 * Lexical on import, so the cards are real editor nodes rather than hand-written markup.
	 */
	{
		slug: 'styleguide',
		title: 'Styleguide',
		template: null,
		body: [
			'<h2>Headings and body</h2>',
			'<p>Body copy at the measure, so the type scale can be read against the design source.</p>',
			'<h3>A third-level heading</h3>',
			'<blockquote>A pull quote, which the design sets larger than the body and without quote marks.</blockquote>',
			'<ul><li>An unordered list item</li><li>And a second, to show the marker</li></ul>',
			'<ol><li>An ordered list item</li><li>And its sibling</li></ol>',
			'<hr>',
			'<pre><code>const words = 275 * (minutes - 0.2);</code></pre>',
			'<figure><img src="/img/pexels-38048095.jpg" alt="Vintage roll-top writing desk with papers and office supplies"><figcaption>A figure with a caption.</figcaption></figure>',
			'<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>inline code</code> and a <a href="https://ghost.org">link</a>.</p>',
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
		secondary_navigation: [
			{ label: 'Recommendations', url: '/recommendations/' },
			{ label: 'Sign in', url: '/sign-in/' },
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

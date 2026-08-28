/** Membership plans, comparison and FAQs, transcribed from `MIRROR Membership.dc.html`. */

export interface Tier {
	name: string;
	/** Price and supporting copy for each billing period. */
	monthly: { price: string; period: string; note: string; cta: string };
	yearly: { price: string; period: string; note: string; cta: string };
	description: string;
	benefits: string[];
	/** The Pro tier carries the accent panel and the "Most popular" chip. */
	featured: boolean;
}

export const TIERS: Tier[] = [
	{
		name: 'Free',
		monthly: { price: '$0', period: 'forever', note: 'No card required', cta: 'Join free' },
		yearly: { price: '$0', period: 'forever', note: 'No card required', cta: 'Join free' },
		description: 'The weekly essay and everything in the public archive.',
		benefits: ['Thursday essay by email', 'Full public archive', 'Comment on posts', 'Cancel by unsubscribing'],
		featured: false,
	},
	{
		name: 'Basic',
		monthly: {
			price: '$8',
			period: 'per month',
			note: 'Or $80 per year',
			cta: 'Choose Basic — $8/month',
		},
		yearly: {
			price: '$80',
			period: 'per year',
			note: 'Two months free · billed annually',
			cta: 'Choose Basic — $80/year',
		},
		description: 'The interviews and the members-only field notes.',
		benefits: ['Everything in Free', 'Long-form interviews', 'Members-only field notes', 'Ad-free forever'],
		featured: false,
	},
	{
		name: 'Pro',
		monthly: {
			price: '$20',
			period: 'per month',
			note: 'Or $200 per year',
			cta: 'Go Pro — $20/month',
		},
		yearly: {
			price: '$200',
			period: 'per year',
			note: 'Two months free · billed annually',
			cta: 'Go Pro — $200/year',
		},
		description: 'Everything we make, plus the parts that never go online.',
		benefits: [
			'Everything in Basic',
			'Full interview transcripts',
			'Annual field report, in print',
			'Early access, 48h before publication',
			'Quarterly call with the editors',
			'Two gift memberships a year',
			'Named in the annual report',
		],
		featured: true,
	},
];

export interface CompareRow {
	label: string;
	free: string;
	basic: string;
	pro: string;
}

/** `✓` and `—` are the source's own glyphs, kept verbatim. */
export const COMPARE: CompareRow[] = [
	{ label: 'Weekly Thursday essay', free: '✓', basic: '✓', pro: '✓' },
	{ label: 'Full post archive', free: '✓', basic: '✓', pro: '✓' },
	{ label: 'Comment on posts', free: '✓', basic: '✓', pro: '✓' },
	{ label: 'Long-form interviews', free: '—', basic: '✓', pro: '✓' },
	{ label: 'Members-only field notes', free: '—', basic: '✓', pro: '✓' },
	{ label: 'Full interview transcripts', free: '—', basic: '—', pro: '✓' },
	{ label: 'Annual field report, in print', free: '—', basic: '—', pro: '✓' },
	{ label: 'Early access, 48h before publication', free: '—', basic: '—', pro: '✓' },
	{ label: 'Quarterly call with the editors', free: '—', basic: '—', pro: '✓' },
	{ label: 'Two gift memberships a year', free: '—', basic: '—', pro: '✓' },
	{ label: 'Named in the annual report', free: '—', basic: '—', pro: '✓' },
];

export interface LockedPost {
	title: string;
	img: string;
	alt: string;
	tag: string;
	author: string;
	meta: string;
	tier: string;
}

/**
 * The paywalled teasers.
 *
 * The source labels these "Paid" and "Members"; this theme's wording is "Basic"
 * and "Pro", matching the tier chips everywhere else.
 */
export const LOCKED_POSTS: LockedPost[] = [
	{
		title: 'What editors owe their readers now',
		img: '/img/pexels-29833970.jpg',
		alt: 'Antique typewriter beside a brass lamp and ink pen',
		tag: 'Interviews',
		author: 'Marisol Ade',
		meta: '09 Mar 2026 · 12 min read',
		tier: 'Basic',
	},
	{
		title: 'The archive is the product',
		img: '/img/pexels-33883996.jpg',
		alt: 'Vintage office interior with typewriter and green desk lamps',
		tag: 'Field notes',
		author: 'Erin Laurier',
		meta: '28 Feb 2026 · 6 min read',
		tier: 'Pro',
	},
	{
		title: 'Pricing a niche you can name',
		img: '/img/pexels-305814.jpg',
		alt: 'Modern white concrete building with geometric facade',
		tag: 'Business',
		author: 'Iben Falk',
		meta: '30 Jan 2026 · 11 min read',
		tier: 'Basic',
	},
];

export interface Quote {
	text: string;
	who: string;
}

export const QUOTES: Quote[] = [
	{
		text: 'The only publication I read start to finish. It has changed how I run my own.',
		who: 'Paid member since 2022',
	},
	{
		text: 'I renewed before the trial ended. The interviews alone are worth the year.',
		who: 'Paid member since 2024',
	},
	{
		text: 'Cheaper than the conference I stopped going to, and considerably more useful.',
		who: 'Paid member since 2021',
	},
];

export interface Faq {
	question: string;
	answer: string;
}

export const FAQS: Faq[] = [
	{
		question: 'Can I switch between monthly and yearly?',
		answer:
			'Yes, at any time from your account page. Switching to yearly credits whatever is left of the current month against the annual price.',
	},
	{
		question: 'What happens if I cancel?',
		answer:
			'You keep access until the end of the period you paid for, then the account reverts to free membership. Nothing is deleted and you can resubscribe with the same email.',
	},
	{
		question: 'Is there a student or hardship rate?',
		answer:
			'Yes. Email the editors and say so — no documentation required, no questions asked. Roughly one in twelve members is on a reduced rate.',
	},
	{
		question: 'Do you offer group or newsroom subscriptions?',
		answer:
			"For teams of five or more, write to the editors and we'll set up a single invoice at a reduced per-seat rate.",
	},
	{
		question: 'Where does the money go?',
		answer:
			'Writer fees first, then hosting and email delivery. There is no office, no advertising spend, and no outside investment.',
	},
];

/**
 * The Membership page's body, as the HTML a Ghost editor would produce.
 *
 * DERIVED, NOT RE-TRANSCRIBED. Every row, quote and question above is the single source; this
 * export only arranges them the way an editor would have typed them. The three blocks are here
 * rather than in the theme because Ghost holds no field for any of them: the matrix is
 * benefit × tier and Ghost stores benefits per tier, a member quote is a testimonial with no
 * resource behind it, and a FAQ is Ghost's own toggle card.
 *
 * The `kg-` classes are load-bearing — `assets/css/screen.css` styles the table, and the toggle
 * card is the platform's accordion, kept out of `card_assets.exclude` for exactly this page.
 */
const compareTable = [
	'<table>',
	'<thead><tr><th>Benefit</th><th>Free</th><th>Basic</th><th>Pro</th></tr></thead>',
	'<tbody>',
	...COMPARE.map((row) => `<tr><td>${row.label}</td><td>${row.free}</td><td>${row.basic}</td><td>${row.pro}</td></tr>`),
	'</tbody>',
	'</table>',
].join('');

/*
 * The attribution rides inside the quote rather than in a `<cite>`: Ghost's HTML-to-Lexical
 * conversion keeps a blockquote and drops the cite element inside it, and losing the words is
 * worse than losing the meta type they were set in.
 */
const quoteBlocks = QUOTES.map((quote) => `<blockquote>${quote.text} — ${quote.who}</blockquote>`).join('\n');

const faqToggles = FAQS.map(
	(faq) =>
		'<div class="kg-card kg-toggle-card" data-kg-toggle-state="close">' +
		`<div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">${faq.question}</h4></div>` +
		`<div class="kg-toggle-content"><p>${faq.answer}</p></div>` +
		'</div>',
).join('\n');

export const MEMBERSHIP_BODY = [
	"<h2>What's included</h2>",
	compareTable,
	'<h2>From members</h2>',
	quoteBlocks,
	'<h2>Questions</h2>',
	faqToggles,
].join('\n');

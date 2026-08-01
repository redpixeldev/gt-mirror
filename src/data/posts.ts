/**
 * Demo content for the MIRROR theme, transcribed from the design source.
 * Shared across pages — the blog, tag and author templates draw from the same set.
 *
 * Images are the source's Pexels photos, downloaded to `public/img/` so the build
 * makes no third-party requests at runtime. The filename keeps the Pexels id so a
 * photo can always be traced back to the source.
 */

export type Visibility = 'public' | 'members' | 'paid';

export interface Post {
	title: string;
	excerpt: string;
	img: string;
	alt: string;
	tag: string;
	author: string;
	initials: string;
	date: string;
	read: string;
	visibility: Visibility;
	featured: boolean;
}

const img = (id: number) => `/img/pexels-${id}.jpg`;

export const POSTS: Post[] = [
	{
		title: 'The quiet economics of a one-person publication',
		excerpt:
			'Five years of a paid newsletter, and what it taught me about pricing, churn, and the cost of caring about design.',
		img: img(38048095),
		alt: 'Vintage roll-top writing desk with papers and office supplies',
		tag: 'Essays',
		author: 'Erin Laurier',
		initials: 'EL',
		date: '12 Mar 2026',
		read: '7 min read',
		visibility: 'public',
		featured: true,
	},
	{
		title: 'What editors owe their readers now',
		excerpt: 'Trust is the only moat left. A conversation about corrections, sourcing, and saying less.',
		img: img(29833970),
		alt: 'Antique typewriter beside a brass lamp and ink pen',
		tag: 'Interviews',
		author: 'Marisol Ade',
		initials: 'MA',
		date: '09 Mar 2026',
		read: '12 min read',
		visibility: 'paid',
		featured: true,
	},
	{
		title: 'Against the infinite feed',
		excerpt: 'Publishing on a schedule is a design decision, not a technical one.',
		img: img(2705436),
		alt: 'White concrete building facade with repeating windows',
		tag: 'Essays',
		author: 'Tomas Vrel',
		initials: 'TV',
		date: '05 Mar 2026',
		read: '9 min read',
		visibility: 'public',
		featured: true,
	},
	{
		title: 'The archive is the product',
		excerpt: 'Why back catalogues outperform launches, and how to structure one people actually browse.',
		img: img(33883996),
		alt: 'Vintage office interior with typewriter and green desk lamps',
		tag: 'Field notes',
		author: 'Erin Laurier',
		initials: 'EL',
		date: '28 Feb 2026',
		read: '6 min read',
		visibility: 'members',
		featured: true,
	},
	{
		title: 'A grammar for small newsrooms',
		excerpt: 'House style is a compression algorithm. Here is one that survived four writers.',
		img: img(7970681),
		alt: 'Home workspace with typewriter, books and warm lamp light',
		tag: 'Craft',
		author: 'Nadia Roth',
		initials: 'NR',
		date: '24 Feb 2026',
		read: '8 min read',
		visibility: 'public',
		featured: false,
	},
	{
		title: 'Interview: leaving the masthead',
		excerpt: 'After eleven years at a national desk, she went independent. The numbers surprised her.',
		img: img(9032693),
		alt: 'Writer seated at a desk making notes in a notebook',
		tag: 'Interviews',
		author: 'Marisol Ade',
		initials: 'MA',
		date: '20 Feb 2026',
		read: '15 min read',
		visibility: 'paid',
		featured: false,
	},
	{
		title: 'Type is the interface',
		excerpt: 'Publishers keep buying illustration budgets when the typography was the problem.',
		img: img(36181031),
		alt: 'Minimalist desk with lamp casting hard shadows',
		tag: 'Craft',
		author: 'Tomas Vrel',
		initials: 'TV',
		date: '17 Feb 2026',
		read: '5 min read',
		visibility: 'public',
		featured: false,
	},
	{
		title: 'Notes on a slower publishing calendar',
		excerpt: 'Twelve posts a year, each one edited three times. A year of results.',
		img: img(4641190),
		alt: 'Rustic study with open books, a map and candles',
		tag: 'Field notes',
		author: 'Nadia Roth',
		initials: 'NR',
		date: '13 Feb 2026',
		read: '6 min read',
		visibility: 'members',
		featured: false,
	},
	{
		title: 'The reader you never hear from',
		excerpt: 'Ninety-four percent never reply. Designing for them changes every decision.',
		img: img(7080687),
		alt: 'Overhead view of a writer taking notes with a feather pen',
		tag: 'Essays',
		author: 'Erin Laurier',
		initials: 'EL',
		date: '09 Feb 2026',
		read: '10 min read',
		visibility: 'public',
		featured: false,
	},
	{
		title: 'Concrete, cameras, and credibility',
		excerpt: 'Photography budgets are shrinking. Architecture stock is not the answer either.',
		img: img(28993989),
		alt: 'Minimalist concrete architectural space with tall walls',
		tag: 'Craft',
		author: 'Iben Falk',
		initials: 'IF',
		date: '04 Feb 2026',
		read: '7 min read',
		visibility: 'public',
		featured: false,
	},
	{
		title: 'Pricing a niche you can name',
		excerpt: 'The smallest viable audience, and what it will pay for specificity.',
		img: img(305814),
		alt: 'Modern white concrete building with geometric facade',
		tag: 'Business',
		author: 'Iben Falk',
		initials: 'IF',
		date: '30 Jan 2026',
		read: '11 min read',
		visibility: 'paid',
		featured: false,
	},
	{
		title: 'Letter from a shrinking city desk',
		excerpt: 'Local reporting is not dying evenly. A dispatch from three newsrooms that adapted.',
		img: img(11468500),
		alt: 'Stone apartment facade on a Parisian street',
		tag: 'Field notes',
		author: 'Marisol Ade',
		initials: 'MA',
		date: '26 Jan 2026',
		read: '9 min read',
		visibility: 'public',
		featured: false,
	},
];

/**
 * Membership tier labels shown on post cards.
 *
 * Deliberately not the design source's wording: the source ships "Members"/"Paid",
 * this theme uses "Pro"/"Basic".
 */
const TIER: Record<Visibility, string> = { public: '', members: 'Pro', paid: 'Basic' };

export interface DecoratedPost extends Post {
	/** "12 Mar 2026 · 7 min read" */
	meta: string;
	/** "Erin Laurier · 12 Mar 2026 · 7 min read" */
	metaFull: string;
	locked: boolean;
	tier: string;
	/** Zero-padded position, e.g. "01". */
	num: string;
}

export const decorate = (p: Post, i: number): DecoratedPost => ({
	...p,
	meta: `${p.date} · ${p.read}`,
	metaFull: `${p.author} · ${p.date} · ${p.read}`,
	locked: p.visibility !== 'public',
	tier: TIER[p.visibility],
	num: String(i + 1).padStart(2, '0'),
});

export const ALL_POSTS: DecoratedPost[] = POSTS.map(decorate);

export const TAGS = [
	{ name: 'Essays', count: 34 },
	{ name: 'Interviews', count: 21 },
	{ name: 'Craft', count: 18 },
	{ name: 'Field notes', count: 16 },
	{ name: 'Business', count: 9 },
	{ name: 'Media', count: 7 },
	{ name: 'Typography', count: 6 },
	{ name: 'Archive', count: 5 },
];

export const AUTHORS = [
	{ name: 'Erin Laurier', initials: 'EL', count: 34 },
	{ name: 'Marisol Ade', initials: 'MA', count: 27 },
	{ name: 'Tomas Vrel', initials: 'TV', count: 19 },
	{ name: 'Nadia Roth', initials: 'NR', count: 14 },
	{ name: 'Iben Falk', initials: 'IF', count: 10 },
];

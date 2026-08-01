/**
 * One author's archive, transcribed from `MIRROR Author.dc.html`.
 *
 * The name, count, location and links come from the masthead in `authors.ts` —
 * the source repeats them identically. Only the long-form bio and the first name
 * used by the newsletter heading are specific to this template.
 */
import { MASTHEAD } from './authors';
import { TIER_LABELS, type Visibility } from './posts';

const masthead = MASTHEAD.find((a) => a.name === 'Marisol Ade')!;

export const AUTHOR = {
	...masthead,
	first: 'Marisol',
	bio:
		'Interviews editor at The Quarry. Previously eleven years on a national culture desk, where she ' +
		'learned that the best questions are the ones you almost cut. She writes about how independent ' +
		'publications are built and paid for, and keeps a standing rule that no interview runs until the ' +
		'subject has seen the quotes attributed to them. Reports in Spanish and English, mostly from ' +
		'Mexico City, occasionally from wherever the story went instead.',
};

interface RawPost {
	title: string;
	excerpt: string;
	id: number;
	alt: string;
	tag: string;
	date: string;
	read: string;
	visibility: Visibility;
}

const RAW: RawPost[] = [
	{
		title: 'What editors owe their readers now',
		excerpt: 'Trust is the only moat left. A conversation about corrections, sourcing, and saying less.',
		id: 29833970,
		alt: 'Antique typewriter beside a brass lamp and ink pen',
		tag: 'Interviews',
		date: '09 Mar 2026',
		read: '12 min read',
		visibility: 'paid',
	},
	{
		title: 'Interview: leaving the masthead',
		excerpt: 'After eleven years at a national desk, she went independent. The numbers surprised her.',
		id: 9032693,
		alt: 'Writer seated at a desk making notes in a notebook',
		tag: 'Interviews',
		date: '20 Feb 2026',
		read: '15 min read',
		visibility: 'paid',
	},
	{
		title: 'Letter from a shrinking city desk',
		excerpt: 'Local reporting is not dying evenly. A dispatch from three newsrooms that adapted.',
		id: 11468500,
		alt: 'Stone apartment facade on a Parisian street',
		tag: 'Field notes',
		date: '26 Jan 2026',
		read: '9 min read',
		visibility: 'public',
	},
	{
		title: 'The interview nobody publishes',
		excerpt: 'Transcripts, trust, and the parts a subject asks you to cut.',
		id: 7610771,
		alt: 'Retro office scene with typewriter and rotary phone',
		tag: 'Interviews',
		date: '12 Jan 2026',
		read: '13 min read',
		visibility: 'paid',
	},
	{
		title: 'On refusing the interview',
		excerpt: 'When a subject declines, the story usually gets better. Three cases.',
		id: 7610808,
		alt: 'Vintage desk with typewriter, books and a retro lamp',
		tag: 'Craft',
		date: '06 Nov 2025',
		read: '8 min read',
		visibility: 'public',
	},
	{
		title: 'Questions I stopped asking',
		excerpt: 'Ten years of interview openers, ranked by how little they produced.',
		id: 7080687,
		alt: 'Overhead view of a writer taking notes with a feather pen',
		tag: 'Craft',
		date: '22 Oct 2025',
		read: '7 min read',
		visibility: 'public',
	},
	{
		title: "The fixer's ledger",
		excerpt: 'What reporting abroad actually costs, itemised across four assignments.',
		id: 33883996,
		alt: 'Vintage office interior with typewriter and green desk lamps',
		tag: 'Reporting',
		date: '08 Oct 2025',
		read: '11 min read',
		visibility: 'members',
	},
	{
		title: 'Two editors, one masthead',
		excerpt: 'How a co-editorship splits final say without splitting the publication.',
		id: 7319071,
		alt: 'Vintage workspace with wooden desk, typewriter and lamp',
		tag: 'Interviews',
		date: '24 Sep 2025',
		read: '11 min read',
		visibility: 'public',
	},
	{
		title: 'Recording everything',
		excerpt: 'A decade of taped interviews, and what the archive is good for.',
		id: 4641190,
		alt: 'Rustic study with open books, a map and candles',
		tag: 'Craft',
		date: '10 Sep 2025',
		read: '6 min read',
		visibility: 'public',
	},
	{
		title: 'The correction that doubled our conversions',
		excerpt: 'Publishing a mistake in full, and what happened to the paid tier that week.',
		id: 38048095,
		alt: 'Vintage roll-top writing desk with papers and office supplies',
		tag: 'Business',
		date: '27 Aug 2025',
		read: '9 min read',
		visibility: 'members',
	},
	{
		title: 'Reporting in a second language',
		excerpt: 'Nuance, idiom, and the risk of quoting someone accurately but wrongly.',
		id: 27409011,
		alt: 'Cozy study desk with an open book and papers',
		tag: 'Reporting',
		date: '13 Aug 2025',
		read: '10 min read',
		visibility: 'public',
	},
	{
		title: 'A week of no interviews',
		excerpt: 'What happens to a publication built on conversation when nobody replies.',
		id: 27872005,
		alt: 'Vintage wooden roll-top desk in a rustic interior',
		tag: 'Field notes',
		date: '30 Jul 2025',
		read: '5 min read',
		visibility: 'public',
	},
	{
		title: 'Editing a friend',
		excerpt: 'The conflict every small publication has and nobody writes a policy for.',
		id: 36181031,
		alt: 'Minimalist desk with lamp casting hard shadows',
		tag: 'Craft',
		date: '16 Jul 2025',
		read: '8 min read',
		visibility: 'public',
	},
	{
		title: 'Twenty years, four publications',
		excerpt: 'A career told through the mastheads he left and why.',
		id: 2705436,
		alt: 'White concrete building facade with repeating windows',
		tag: 'Interviews',
		date: '02 Jul 2025',
		read: '16 min read',
		visibility: 'paid',
	},
	{
		title: 'Off the record, on the page',
		excerpt: 'Three rules for background quotes that survived legal review.',
		id: 1425146,
		alt: 'Close-up of a vintage typewriter on a wooden desk',
		tag: 'Reporting',
		date: '18 Jun 2025',
		read: '7 min read',
		visibility: 'public',
	},
];

export interface AuthorPost extends Omit<RawPost, 'id'> {
	img: string;
	/** "09 Mar 2026 · 12 min read" */
	meta: string;
	locked: boolean;
	tier: string;
}

const decorate = ({ id, ...post }: RawPost): AuthorPost => ({
	...post,
	img: `/img/pexels-${id}.jpg`,
	meta: `${post.date} · ${post.read}`,
	locked: post.visibility !== 'public',
	tier: TIER_LABELS[post.visibility],
});

/** The source paginates at 12 and holds the remaining three for page two. */
export const PER_PAGE = 12;

export const AUTHOR_POSTS: AuthorPost[] = RAW.map(decorate);

export const AUTHOR_PAGE_ONE: AuthorPost[] = AUTHOR_POSTS.slice(0, PER_PAGE);

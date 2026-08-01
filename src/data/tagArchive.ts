/** A single tag's archive, transcribed from `MIRROR Tag Archive.dc.html`. */
import { TIER_LABELS, type Visibility } from './posts';

const img = (id: number) => `/img/pexels-${id}.jpg`;

export const TAG = {
	name: 'Interviews',
	singular: 'interview',
	description: "Editors, founders and reporters on the decisions they would make again — and the ones they wouldn't.",
	count: 21,
	range: '2025 — 2026',
	img: img(29833970),
	alt: 'Antique typewriter beside a brass lamp and ink pen',
};

export const TAG_COUNT_LABEL = `${TAG.count} posts`;

interface RawPost {
	title: string;
	excerpt: string;
	id: number;
	alt: string;
	author: string;
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
		author: 'Marisol Ade',
		date: '09 Mar 2026',
		read: '12 min read',
		visibility: 'paid',
	},
	{
		title: 'Interview: leaving the masthead',
		excerpt: 'After eleven years at a national desk, she went independent. The numbers surprised her.',
		id: 9032693,
		alt: 'Writer seated at a desk making notes in a notebook',
		author: 'Marisol Ade',
		date: '20 Feb 2026',
		read: '15 min read',
		visibility: 'paid',
	},
	{
		title: 'The interview nobody publishes',
		excerpt: 'Transcripts, trust, and the parts a subject asks you to cut.',
		id: 7610771,
		alt: 'Retro office scene with typewriter and rotary phone',
		author: 'Marisol Ade',
		date: '12 Jan 2026',
		read: '13 min read',
		visibility: 'paid',
	},
	{
		title: 'Two editors, one masthead',
		excerpt: 'How a co-editorship splits final say without splitting the publication.',
		id: 7319071,
		alt: 'Vintage workspace with wooden desk, typewriter and lamp',
		author: 'Erin Laurier',
		date: '18 Dec 2025',
		read: '11 min read',
		visibility: 'public',
	},
	{
		title: 'The reporter who stopped chasing scoops',
		excerpt: 'Six months of slow reporting, and what it did to her sourcing.',
		id: 7080687,
		alt: 'Overhead view of a writer taking notes with a feather pen',
		author: 'Nadia Roth',
		date: '04 Dec 2025',
		read: '9 min read',
		visibility: 'members',
	},
	{
		title: 'Building a desk of five',
		excerpt: 'Hiring, paying and keeping writers when there is no institution behind you.',
		id: 33883996,
		alt: 'Vintage office interior with typewriter and green desk lamps',
		author: 'Erin Laurier',
		date: '20 Nov 2025',
		read: '14 min read',
		visibility: 'public',
	},
	{
		title: 'On refusing the interview',
		excerpt: 'When a subject declines, the story usually gets better. Three cases.',
		id: 7610808,
		alt: 'Vintage desk with typewriter, books and a retro lamp',
		author: 'Marisol Ade',
		date: '06 Nov 2025',
		read: '8 min read',
		visibility: 'public',
	},
	{
		title: 'The photographer who quit stock',
		excerpt: 'Commissioning real photography on a newsletter budget.',
		id: 2705436,
		alt: 'White concrete building facade with repeating windows',
		author: 'Iben Falk',
		date: '23 Oct 2025',
		read: '10 min read',
		visibility: 'public',
	},
	{
		title: 'A designer inside a newsroom',
		excerpt: 'What changes when the person setting the type sits in edit meetings.',
		id: 36181031,
		alt: 'Minimalist desk with lamp casting hard shadows',
		author: 'Tomas Vrel',
		date: '09 Oct 2025',
		read: '12 min read',
		visibility: 'members',
	},
	{
		title: 'Twenty years, four publications',
		excerpt: 'A career told through the mastheads he left and why.',
		id: 4641190,
		alt: 'Rustic study with open books, a map and candles',
		author: 'Erin Laurier',
		date: '25 Sep 2025',
		read: '16 min read',
		visibility: 'paid',
	},
	{
		title: 'The archive keeper',
		excerpt: 'Someone has to decide what stays online. She has done it for a decade.',
		id: 27872005,
		alt: 'Vintage wooden roll-top desk in a rustic interior',
		author: 'Nadia Roth',
		date: '11 Sep 2025',
		read: '9 min read',
		visibility: 'public',
	},
	{
		title: 'Print, one issue a year',
		excerpt: 'The economics of an annual, from a founder who has printed four.',
		id: 27409011,
		alt: 'Cozy study desk with an open book and papers',
		author: 'Iben Falk',
		date: '28 Aug 2025',
		read: '11 min read',
		visibility: 'public',
	},
];

export interface TagArchivePost extends Omit<RawPost, 'id'> {
	img: string;
	/** "09 Mar 2026 · 12 min read" */
	meta: string;
	locked: boolean;
	tier: string;
}

export const TAG_POSTS: TagArchivePost[] = RAW.map(({ id, ...post }) => ({
	...post,
	img: img(id),
	meta: `${post.date} · ${post.read}`,
	locked: post.visibility !== 'public',
	tier: TIER_LABELS[post.visibility],
}));

export const OTHER_TAGS = [
	{ name: 'Essays', count: 34 },
	{ name: 'Craft', count: 18 },
	{ name: 'Field notes', count: 16 },
	{ name: 'Reporting', count: 13 },
	{ name: 'Newsletters', count: 12 },
	{ name: 'Design', count: 11 },
	{ name: 'Business', count: 9 },
	{ name: 'Photography', count: 8 },
];

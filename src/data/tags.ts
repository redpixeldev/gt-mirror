/**
 * The tag directory, transcribed from `MIRROR Tags.dc.html`.
 *
 * Every tag carries an image even though the A1 directory list does not show one —
 * the card and tile variants of this template do, and the data is the source's.
 */
const img = (id: number) => `/img/pexels-${id}.jpg`;

export interface TagEntry {
	name: string;
	count: number;
	description: string;
	img: string;
	alt: string;
}

const RAW: { name: string; count: number; description: string; id: number; alt: string }[] = [
	{
		name: 'Archive',
		count: 5,
		description: 'Pieces from the back catalogue, re-edited and re-dated.',
		id: 27872005,
		alt: 'Vintage wooden roll-top desk in a rustic interior',
	},
	{
		name: 'Books',
		count: 7,
		description: 'Reading notes on publishing, media history, and craft.',
		id: 27409011,
		alt: 'Cozy study desk with an open book and papers',
	},
	{
		name: 'Business',
		count: 9,
		description: 'Pricing, sponsorship, and the economics of small publications.',
		id: 305814,
		alt: 'Modern white concrete building with geometric facade',
	},
	{
		name: 'Craft',
		count: 18,
		description: 'House style, editing passes, and the mechanics of good sentences.',
		id: 7970681,
		alt: 'Home workspace with typewriter, books and warm lamp light',
	},
	{
		name: 'Design',
		count: 11,
		description: "Layout, hierarchy, and how a page earns a reader's attention.",
		id: 28993989,
		alt: 'Minimalist concrete architectural space with tall walls',
	},
	{
		name: 'Essays',
		count: 34,
		description: 'Long-form arguments about independent media and its incentives.',
		id: 38048095,
		alt: 'Vintage roll-top writing desk with papers and office supplies',
	},
	{
		name: 'Field notes',
		count: 16,
		description: 'Short dispatches from newsrooms, print revivals, and experiments.',
		id: 4641190,
		alt: 'Rustic study with open books, a map and candles',
	},
	{
		name: 'Interviews',
		count: 21,
		description: 'Editors and founders on the decisions they would make again.',
		id: 29833970,
		alt: 'Antique typewriter beside a brass lamp and ink pen',
	},
	{
		name: 'Media',
		count: 7,
		description: 'The industry beat: consolidation, platforms, and what shifts.',
		id: 11468500,
		alt: 'Stone apartment facade on a Parisian street',
	},
	{
		name: 'Membership',
		count: 6,
		description: 'Tiers, churn, and building a paid audience that stays.',
		id: 32526792,
		alt: 'Study desk with open books, tablet and a warm lamp',
	},
	{
		name: 'Newsletters',
		count: 12,
		description: 'Sending, scheduling, and writing for the inbox specifically.',
		id: 7610808,
		alt: 'Vintage desk with typewriter, books and a retro lamp',
	},
	{
		name: 'Photography',
		count: 8,
		description: 'Commissioning, licensing, and using images with intent.',
		id: 2705436,
		alt: 'White concrete building facade with repeating windows',
	},
	{
		name: 'Reporting',
		count: 13,
		description: 'Sourcing, corrections, and the discipline behind a claim.',
		id: 7610771,
		alt: 'Retro office scene with typewriter and rotary phone',
	},
	{
		name: 'Typography',
		count: 6,
		description: 'Type scales, measure, and reading at length on screens.',
		id: 1425146,
		alt: 'Close-up of a vintage typewriter on a wooden desk',
	},
];

export interface DirectoryTag extends TagEntry {
	/** "34 posts" — singularised for a tag with one entry, as in the source. */
	countLabel: string;
}

export const TAG_DIRECTORY: DirectoryTag[] = RAW.map(({ id, ...tag }) => ({
	...tag,
	img: img(id),
	countLabel: `${tag.count} ${tag.count === 1 ? 'post' : 'posts'}`,
}));

export const TAG_TOTAL = TAG_DIRECTORY.length;

/**
 * The masthead, transcribed from `MIRROR Authors.dc.html`.
 *
 * Richer than the `AUTHORS` strip in `posts.ts` — the author templates need a bio,
 * a location and links — but the names and post counts are the same five people.
 */
export interface Author {
	name: string;
	initials: string;
	count: number;
	/** "34 posts" */
	countLabel: string;
	location: string;
	bio: string;
	website: string;
	social: string;
	/** Title of the author's most recent post. */
	latest: string;
	portrait: string;
}

const img = (id: number) => `/img/pexels-${id}.jpg`;

const RAW: (Omit<Author, 'countLabel' | 'portrait'> & { portraitId: number })[] = [
	{
		name: 'Erin Laurier',
		initials: 'EL',
		count: 34,
		location: 'Lisbon, PT',
		bio: 'Founding editor. Writes about independent media, typography, and the business of attention.',
		website: 'erinlaurier.com',
		social: '@erinlaurier',
		latest: 'The quiet economics of a one-person publication',
		portraitId: 774909,
	},
	{
		name: 'Marisol Ade',
		initials: 'MA',
		count: 27,
		location: 'Mexico City, MX',
		bio: 'Interviews editor. Previously eleven years on a national culture desk.',
		website: 'marisolade.net',
		social: '@marisolade',
		latest: 'What editors owe their readers now',
		portraitId: 415829,
	},
	{
		name: 'Tomas Vrel',
		initials: 'TV',
		count: 19,
		location: 'Prague, CZ',
		bio: 'Design and typography. Sets the type, then argues about it in edit meetings.',
		website: 'vrel.studio',
		social: '@tomasvrel',
		latest: 'Type is the interface',
		portraitId: 220453,
	},
	{
		name: 'Nadia Roth',
		initials: 'NR',
		count: 14,
		location: 'Glasgow, UK',
		bio: 'Craft and process. Keeps the house style guide and enforces the three-pass edit.',
		website: 'nadiaroth.co',
		social: '@nadiaroth',
		latest: 'A grammar for small newsrooms',
		portraitId: 733872,
	},
	{
		name: 'Iben Falk',
		initials: 'IF',
		count: 10,
		location: 'Copenhagen, DK',
		bio: 'Business and photography. Commissions the pictures and models the pricing.',
		website: 'ibenfalk.dk',
		social: '@ibenfalk',
		latest: 'Pricing a niche you can name',
		portraitId: 91227,
	},
];

export const MASTHEAD: Author[] = RAW.map(({ portraitId, ...author }) => ({
	...author,
	countLabel: `${author.count} posts`,
	portrait: img(portraitId),
}));

export const AUTHOR_TOTAL = MASTHEAD.length;

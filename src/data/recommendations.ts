/**
 * Recommended publications, transcribed from `MIRROR Recommendations.dc.html`.
 *
 * Each entry carries both a wide image and a favicon; the A1 list shows only the
 * favicon, the card variants of this template use both.
 */
const img = (id: number) => `/img/pexels-${id}.jpg`;

export interface Recommendation {
	title: string;
	url: string;
	description: string;
	image: string;
	favicon: string;
	alt: string;
	/** Ghost one-click subscribe is available for this publication. */
	oneClick: boolean;
}

const RAW: (Omit<Recommendation, 'image' | 'favicon'> & { imageId: number; faviconId: number })[] = [
	{
		title: 'The Marginal Press',
		url: 'marginalpress.com',
		description: 'A weekly letter on book publishing economics, written by a former acquisitions editor.',
		imageId: 27409011,
		faviconId: 1425146,
		alt: 'Cozy study desk with an open book and papers',
		oneClick: true,
	},
	{
		title: 'Column Inches',
		url: 'columninches.co',
		description: 'Reporting on local news deserts across Europe, with a monthly data drop.',
		imageId: 11468500,
		faviconId: 7610771,
		alt: 'Stone apartment facade on a Parisian street',
		oneClick: true,
	},
	{
		title: 'Set Solid',
		url: 'setsolid.type',
		description: 'Typography criticism for people who set text for a living. Long, specific, occasionally furious.',
		imageId: 1425146,
		faviconId: 36181031,
		alt: 'Close-up of a vintage typewriter on a wooden desk',
		oneClick: true,
	},
	{
		title: 'The Quiet Desk',
		url: 'quietdesk.email',
		description: 'One essay a month on working alone, from a writer eight years into it.',
		imageId: 7970681,
		faviconId: 4641190,
		alt: 'Home workspace with typewriter, books and warm lamp light',
		oneClick: false,
	},
	{
		title: 'Paper Route',
		url: 'paperroute.news',
		description: 'Distribution, delivery and the unglamorous logistics of getting print into hands.',
		imageId: 33883996,
		faviconId: 27872005,
		alt: 'Vintage office interior with typewriter and green desk lamps',
		oneClick: true,
	},
	{
		title: 'Small Circulation',
		url: 'smallcirculation.org',
		description: 'Case studies of publications under 5,000 subscribers that pay their writers properly.',
		imageId: 38048095,
		faviconId: 7319071,
		alt: 'Vintage roll-top writing desk with papers and office supplies',
		oneClick: true,
	},
	{
		title: 'Frame & Field',
		url: 'frameandfield.photo',
		description: 'Commissioning notes and rate cards from working editorial photographers.',
		imageId: 2705436,
		faviconId: 28993989,
		alt: 'White concrete building facade with repeating windows',
		oneClick: false,
	},
	{
		title: 'The Correction',
		url: 'thecorrection.press',
		description: 'A newsletter entirely about media errors, retractions, and how publications handle them.',
		imageId: 7610808,
		faviconId: 7080687,
		alt: 'Vintage desk with typewriter, books and a retro lamp',
		oneClick: true,
	},
	{
		title: 'Second Read',
		url: 'secondread.club',
		description: 'Re-reads of essays that were published too early to get the attention they deserved.',
		imageId: 35039743,
		faviconId: 32526792,
		alt: 'Feather quill pen resting on a vintage wooden desk',
		oneClick: true,
	},
];

export const RECOMMENDATIONS: Recommendation[] = RAW.map(({ imageId, faviconId, ...rec }) => ({
	...rec,
	image: img(imageId),
	favicon: img(faviconId),
}));

export const RECOMMENDATION_TOTAL = RECOMMENDATIONS.length;

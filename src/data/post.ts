/** Single-post demo content, transcribed from `MIRROR Post.dc.html`. */

const img = (id: number) => `/img/pexels-${id}.jpg`;

export const POST = {
	title: 'What editors owe their readers now',
	excerpt:
		'Trust is the only moat left. Four independent publications on corrections, sourcing, and the discipline of saying less.',
	tag: 'Interviews',
	author: 'Marisol Ade',
	initials: 'MA',
	date: '09 Mar 2026',
	read: '12 min read',
	minutes: '12 minutes',
	meta: '09 Mar 2026 · 12 min read',
	img: img(29833970),
	alt: 'Antique typewriter beside a brass lamp and ink pen',
	caption: 'The interview was conducted over three weeks in four cities.',
	inline1: img(36181031),
	inline2: img(28993989),
};

export const POST_TAGS = ['Interviews', 'Craft', 'Media'];

const SECTIONS = [
	{ id: 'sec-1', label: 'The audience stopped being a number' },
	{ id: 'sec-2', label: 'What a slower calendar buys you' },
	{ id: 'sec-3', label: 'The correction policy as a product' },
	{ id: 'sec-4', label: 'What I would steal' },
];

export const TOC = SECTIONS.map((s, i) => ({
	...s,
	href: `#${s.id}`,
	num: String(i + 1).padStart(2, '0'),
}));

export const RELATED = [
	{
		title: 'The archive is the product',
		tag: 'Field notes',
		meta: '28 Feb 2026 · 6 min read',
		img: img(33883996),
		alt: 'Vintage office interior with typewriter and green desk lamps',
	},
	{
		title: 'A grammar for small newsrooms',
		tag: 'Craft',
		meta: '24 Feb 2026 · 8 min read',
		img: img(7970681),
		alt: 'Home workspace with typewriter, books and warm lamp light',
	},
	{
		title: 'Against the infinite feed',
		tag: 'Essays',
		meta: '05 Mar 2026 · 9 min read',
		img: img(2705436),
		alt: 'White concrete building facade with repeating windows',
	},
];

export const ADJACENT = {
	prev: { title: 'The archive is the product', meta: '28 Feb 2026 · 6 min read' },
	next: { title: 'A grammar for small newsrooms', meta: '24 Feb 2026 · 8 min read' },
};

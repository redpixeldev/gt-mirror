/**
 * The site's own chrome: primary nav and footer columns.
 *
 * One canonical set, owned here rather than repeated on every page — a page says
 * which item is current and nothing else. Rebranding the theme is an edit to this
 * file, not to twenty templates.
 *
 * Links point at the built routes. Where several variants of a template exist the
 * A1 one is canonical, since that is the layout a fresh install would ship.
 */

/** Identifies the current section; `NavKey` keeps the pages honest at build time. */
export type NavKey = 'home' | 'archive' | 'tags' | 'authors' | 'about' | 'recommendations' | 'membership' | 'other';

export interface NavChild {
	/** The layout's descriptor, as each footer's variant rule names it. */
	label: string;
	href: string;
}

export interface NavItem {
	key: NavKey;
	label: string;
	/** Omitted on `other`, which groups pages without a section of its own. */
	href?: string;
	children: NavChild[];
}

/**
 * The variant browser.
 *
 * Every layout in the theme hangs off its section here, so all 27 routes are one
 * hover away while the variants are being reviewed. A shipping theme would swap
 * this for a flat nav — see the note in `Header.astro`.
 */
export const NAV: NavItem[] = [
	{
		key: 'home',
		label: 'Home',
		href: '/homepage-01',
		children: [
			{ label: 'Magazine cover', href: '/homepage-01' },
			{ label: 'Editorial masthead', href: '/homepage-02' },
		],
	},
	{
		key: 'archive',
		label: 'Blog',
		href: '/blog-01',
		children: [
			{ label: 'Two-column list', href: '/blog-01' },
			{ label: 'Three-column grid', href: '/blog-02' },
			{ label: 'Centered classic', href: '/post-01' },
			{ label: 'Centered classic · paywalled', href: '/post-01-paywalled' },
			{ label: 'Title page + rail', href: '/post-02' },
			{ label: 'Title page + rail · paywalled', href: '/post-02-paywalled' },
		],
	},
	{
		key: 'tags',
		label: 'Tags',
		href: '/tags-01',
		children: [
			{ label: 'Directory list', href: '/tags-01' },
			{ label: 'Tag cards', href: '/tags-02' },
			{ label: 'Lead + list', href: '/tags-single-01' },
			{ label: 'Card grid', href: '/tags-single-02' },
		],
	},
	{
		key: 'authors',
		label: 'Authors',
		href: '/authors-01',
		children: [
			{ label: 'Editorial rows', href: '/authors-01' },
			{ label: 'Cover cards', href: '/authors-02' },
			{ label: 'Centered header', href: '/author-single-01' },
			{ label: 'Sticky rail', href: '/author-single-02' },
		],
	},
	{
		key: 'about',
		label: 'About',
		href: '/about-01',
		children: [
			{ label: 'Centered statement', href: '/about-01' },
			{ label: 'Split hero', href: '/about-02' },
		],
	},
	{
		key: 'recommendations',
		label: 'Recommendations',
		href: '/recommendations-01',
		children: [
			{ label: 'Editorial list', href: '/recommendations-01' },
			{ label: 'Image cards', href: '/recommendations-02' },
		],
	},
	{
		key: 'membership',
		label: 'Membership',
		href: '/membership-01',
		children: [
			{ label: 'Centered cards', href: '/membership-01' },
			{ label: 'Editorial split', href: '/membership-02' },
		],
	},
	{
		key: 'other',
		label: 'Other',
		children: [
			{ label: '404 · centered', href: '/404' },
			{ label: '404 · editorial split', href: '/404-02' },
			{ label: 'Sign in', href: '/sign-in' },
			{ label: 'Sign up', href: '/sign-up' },
			{ label: 'Styleguide', href: '/styleguide' },
		],
	},
];

/** The header's call to action. */
export const SUBSCRIBE_HREF = '/sign-up';

export interface FooterLink {
	label: string;
	href: string;
}

export interface FooterColumn {
	title: string;
	ariaLabel: string;
	links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
	{
		title: 'Sections',
		ariaLabel: 'Sections',
		links: [
			{ label: 'Blog', href: '/blog-01' },
			{ label: 'Tags', href: '/tags-01' },
			// The Interviews tag archive — the source's own example of a single tag.
			{ label: 'Interviews', href: '/tags-single-01' },
		],
	},
	{
		title: 'More',
		ariaLabel: 'More',
		links: [
			{ label: 'Authors', href: '/authors-01' },
			{ label: 'Membership', href: '/membership-01' },
			// Ghost serves /rss/ at runtime; this static build has no feed to link.
			{ label: 'RSS', href: '#' },
		],
	},
];

export const SITE_TITLE = 'Mirror';
export const SITE_TAGLINE = 'Independent writing on media, craft, and the cost of attention.';

/**
 * Where content links point.
 *
 * The theme ships several layouts per template; these name the canonical one, so
 * a post card links to a real post rather than a placeholder anchor. Changing a
 * destination is an edit here, not across twenty components.
 */
export const ROUTES = {
	home: '/homepage-01',
	blog: '/blog-01',
	post: '/post-01',
	postPaywalled: '/post-01-paywalled',
	tags: '/tags-01',
	tag: '/tags-single-01',
	authors: '/authors-01',
	author: '/author-single-01',
	about: '/about-01',
	membership: '/membership-01',
	recommendations: '/recommendations-01',
	signIn: '/sign-in',
	signUp: '/sign-up',
} as const;

/** Members-only posts lead to the paywalled layout, so the tier chips mean something. */
export const postHref = (locked?: boolean): string => (locked ? ROUTES.postPaywalled : ROUTES.post);

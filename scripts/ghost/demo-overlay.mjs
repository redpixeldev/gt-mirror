/*
 * The Layout browser: what the Demo site adds to the publication so a buyer can reach every
 * Layout of every Surface from the header (ADR 0006).
 *
 * ONE LIST, FOUR OUTPUTS. Each entry below is one menu item, and it carries everything about that
 * item: where it points, which Surface and Layout it must render there, and what has to exist for
 * that URL to render it — a route, a duplicate Page, or a Post with a Layout override. The menu,
 * the routes file, the extra records and the smoke run's expectations are all derived from it, so
 * none of them can name a URL the others do not know about.
 *
 * DEFAULT LAYOUTS LINK TO THE REAL URL, ALTERNATES THROUGH AN OVERRIDE. The Demo site runs the
 * theme's defaults, so `/`, `/archive/` and `/about/` already show Magazine cover, List and
 * Centered statement; only the other Layout needs something added. If somebody changes a setting
 * on the Demo site, the default entries would show the wrong Layout — which is exactly what
 * demo-smoke.mjs asserts against.
 *
 * THIS IS DEMO DATA, NOT THE SCORED PUBLICATION. build-demo-zip.mjs applies it; fixture.json and
 * the install every Floor is measured on never see it.
 *
 * Grouped by the setting a buyer changes, not by Surface, because `feed_layout` governs the Feed,
 * the tag archive and the author page together: a menu grouped by Surface would advertise a choice
 * the buyer cannot make. Labels are the admin option names. Parents are `#` headings — none of the
 * six groups has a page of its own to land on.
 */

/* The records that lose their own URL to a `data:` channel. Not the least-linked ones: a Grid of
 * five posts is an Underset, and "Archive" names a Surface. Twelve posts fill four rows of three. */
const GRID_TAG = 'newsletters';
const GRID_AUTHOR = 'iben-falk';

/* A URL no record will ever own, so the real 404 is what answers it. */
const MISSING = '/this-page-does-not-exist/';

/**
 * The first two posts of each visibility, in fixture order: the first keeps the setting's Centered
 * classic, the second gets the Title page override. Picked from the fixture rather than named, so a
 * regenerated fixture cannot leave the menu pointing at a slug that no longer exists.
 */
function pickPosts(fixture) {
	const picked = {};
	for (const visibility of ['public', 'members', 'paid']) {
		const posts = fixture.posts.filter((post) => post.visibility === visibility);
		if (posts.length < 2) {
			throw new Error(`the Layout browser needs two ${visibility} posts; the fixture has ${posts.length}`);
		}
		picked[visibility] = posts.slice(0, 2).map((post) => post.slug);
	}
	return picked;
}

/** Every menu group and its items. `gate` is the `data-gate` a logged-out reader must meet. */
function groups(fixture) {
	const posts = pickPosts(fixture);
	const post = (visibility, index, layout) => ({
		label: `${layout} · ${visibility}`,
		path: `/${posts[visibility][index]}/`,
		surface: 'post',
		layout,
		gate: visibility === 'public' ? null : visibility,
		...(index === 1 ? { post: { slug: posts[visibility][index], template: 'custom-post-title-page' } } : {}),
	});
	const copy = (from, slug, template) => ({ page: { from, slug, template } });

	return [
		{
			group: 'Homepage',
			items: [
				{ label: 'Magazine cover', path: '/', surface: 'home', layout: 'Magazine cover' },
				{
					label: 'Editorial masthead',
					path: '/homepage-editorial-masthead/',
					surface: 'home',
					layout: 'Editorial masthead',
					route: { template: 'layout-home-editorial-masthead' },
				},
			],
		},
		{
			group: 'Feed',
			items: [
				{ label: 'Archive · List', path: '/archive/', surface: 'feed', layout: 'List' },
				{
					label: 'Archive · Grid',
					path: '/archive-grid/',
					surface: 'feed',
					layout: 'Grid',
					route: { controller: 'channel', template: 'layout-feed-grid' },
				},
				{ label: 'Tag archive · List', path: '/tag/essays/', surface: 'tag', layout: 'List' },
				{
					label: 'Tag archive · Grid',
					path: '/tag-grid/',
					surface: 'tag',
					layout: 'Grid',
					route: {
						controller: 'channel',
						filter: `tag:${GRID_TAG}`,
						data: `tag.${GRID_TAG}`,
						template: 'layout-tag-grid',
					},
					redirects: `/tag/${GRID_TAG}/`,
				},
				{ label: 'Writer · List', path: '/author/erin-laurier/', surface: 'author', layout: 'List' },
				{
					label: 'Writer · Grid',
					path: '/author-grid/',
					surface: 'author',
					layout: 'Grid',
					route: {
						controller: 'channel',
						filter: `author:${GRID_AUTHOR}`,
						data: `author.${GRID_AUTHOR}`,
						template: 'layout-author-grid',
					},
					redirects: `/author/${GRID_AUTHOR}/`,
				},
			],
		},
		{
			group: 'Directories',
			items: [
				{ label: 'Subjects · Editorial rows', path: '/tags/', surface: 'page-tags', layout: 'Editorial rows' },
				{
					label: 'Subjects · Cover cards',
					path: '/tags-cover-cards/',
					surface: 'page-tags',
					layout: 'Cover cards',
					...copy('tags', 'tags-cover-cards', 'custom-tags-cover-cards'),
				},
				{ label: 'Writers · Editorial rows', path: '/authors/', surface: 'page-authors', layout: 'Editorial rows' },
				{
					label: 'Writers · Cover cards',
					path: '/authors-cover-cards/',
					surface: 'page-authors',
					layout: 'Cover cards',
					...copy('authors', 'authors-cover-cards', 'custom-authors-cover-cards'),
				},
				/* One entry: the Recommendations Directory follows the setting alone (ADR 0006). */
				{
					label: 'Recommendations',
					path: '/recommendations/',
					surface: 'page-recommendations',
					layout: 'Editorial rows',
				},
			],
		},
		{
			group: 'Pages',
			items: [
				{ label: 'About · Centered statement', path: '/about/', surface: 'page-about', layout: 'Centered statement' },
				{
					label: 'About · Split hero',
					path: '/about-split-hero/',
					surface: 'page-about',
					layout: 'Split hero',
					...copy('about', 'about-split-hero', 'custom-about-split-hero'),
				},
				{
					label: 'Membership · Centered statement',
					path: '/membership/',
					surface: 'page-membership',
					layout: 'Centered statement',
				},
				{
					label: 'Membership · Split hero',
					path: '/membership-split-hero/',
					surface: 'page-membership',
					layout: 'Split hero',
					...copy('membership', 'membership-split-hero', 'custom-membership-split-hero'),
				},
				{
					label: '404 · Centered statement',
					path: MISSING,
					status: 404,
					surface: 'error-404',
					layout: 'Centered statement',
				},
				{
					label: '404 · Split hero',
					path: '/404-split-hero/',
					surface: 'error-404',
					layout: 'Split hero',
					noindex: true,
					route: { template: 'layout-error-split-hero' },
				},
			],
		},
		{
			group: 'Posts',
			items: [
				post('public', 0, 'Centered classic'),
				post('members', 0, 'Centered classic'),
				post('paid', 0, 'Centered classic'),
				post('public', 1, 'Title page'),
				post('members', 1, 'Title page'),
				post('paid', 1, 'Title page'),
			],
		},
		{
			group: 'Others',
			items: [
				{ label: 'Sign in', path: '/sign-in/', surface: 'sign-in' },
				{ label: 'Sign up', path: '/sign-up/', surface: 'sign-up' },
				{ label: 'Style guide', path: '/styleguide/', surface: 'page-styleguide' },
			],
		},
	];
}

/** The menu, in the path-label convention chrome/nav-tree.hbs reads: each parent, then its children. */
function navigation(menu) {
	return menu.flatMap(({ group, items }) => [
		{ label: group, url: '#' },
		...items.map((item) => ({ label: `${group} / ${item.label}`, url: item.path })),
	]);
}

/** The Layout routes, spliced into the documented routes file under its `routes:` key. */
function routesYaml(menu, example) {
	const lines = menu
		.flatMap(({ items }) => items)
		.filter((item) => item.route)
		.flatMap(({ path, route }) => [
			`  ${path}:`,
			...Object.entries(route).map(([key, value]) => `    ${key}: ${value}`),
		]);
	if (!/^routes:\n/m.test(example)) {
		throw new Error('docs/routes.example.yaml has no top-level `routes:` key to add the Layout routes under');
	}
	const header =
		'# GENERATED by scripts/ghost/build-demo-zip.mjs for the Demo site — docs/routes.example.yaml\n' +
		'# plus the routes behind the Layout browser (scripts/ghost/demo-overlay.mjs). Do not edit.\n#\n';
	return header + example.replace(/^routes:\n/m, `routes:\n${lines.join('\n')}\n`);
}

/**
 * Apply the Layout browser to a fixture. Returns the Demo site's publication, its routes file, and
 * the expectations demo-smoke.mjs walks — one per menu item.
 */
export function demoOverlay(fixture, example) {
	const menu = groups(fixture);
	const items = menu.flatMap(({ group, items }) => items.map((item) => ({ ...item, group })));

	const pages = items
		.filter((item) => item.page)
		.map(({ page }) => {
			const source = fixture.pages.find((candidate) => candidate.slug === page.from);
			if (!source) {
				throw new Error(`the Layout browser copies the page /${page.from}/, which the fixture does not have`);
			}
			/* The copy says which page it duplicates, so search engines fold the two together. */
			return { ...source, slug: page.slug, template: page.template, canonical_url: `/${page.from}/` };
		});

	const templates = new Map(items.filter((item) => item.post).map(({ post }) => [post.slug, post.template]));
	const posts = fixture.posts.map((post) =>
		templates.has(post.slug) ? { ...post, template: templates.get(post.slug) } : post,
	);

	return {
		fixture: {
			...fixture,
			site: { ...fixture.site, navigation: navigation(menu) },
			posts,
			pages: [...fixture.pages, ...pages],
		},
		routes: routesYaml(menu, example),
		expectations: items.map((item) => ({
			label: `${item.group} / ${item.label}`,
			path: item.path,
			status: item.status ?? 200,
			surface: item.surface,
			layout: item.layout ?? null,
			gate: item.gate ?? null,
			noindex: Boolean(item.noindex),
			canonical: item.page ? `/${item.page.from}/` : null,
			redirects: item.redirects ?? null,
		})),
	};
}

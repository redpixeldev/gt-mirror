/*
 * Build the demo publication fixture.
 *
 * The fixture is the artifact, and the Admin API only applies it (scripts/ghost/import.mjs).
 * That ordering is deliberate: the gates and the buyer-facing demo content both depend on this
 * data, so reproducing it must not hinge on a network path and a key. The output is a pure
 * function of src/data plus a fixed seed — same inputs, byte-identical output, no network.
 *
 * Today it emits the standing pages, which is what the route map needs: the slugs
 * page-{slug}.hbs keys off have to exist before anyone can claim those Surfaces resolve to
 * their own templates. Authors, tags and the 104 posts join it in the demo-publication ticket,
 * read out of src/data rather than re-transcribed.
 */
import { writeFileSync } from 'node:fs';

const OUT = 'scripts/ghost/fixture.json';

/*
 * The slugs the templates key off. A buyer who wants different slugs picks the matching
 * custom-{name} template from the page settings menu instead — these are a demo convenience,
 * not a requirement of the theme, which is the whole point of shipping both.
 *
 * `body` is HTML because Ghost converts HTML to Lexical on the way in (POST ?source=html);
 * authoring Lexical by hand here would pin the fixture to an editor format that changes.
 */
const pages = [
	{
		slug: 'about',
		title: 'About',
		template: 'page-about.hbs',
		body: '<p>MIRROR is a publication about the things that outlast their news cycle.</p>',
	},
	{
		slug: 'membership',
		title: 'Membership',
		template: 'page-membership.hbs',
		body: '<p>Free members get the archive. Paid members get the interviews.</p>',
	},
	{
		slug: 'tags',
		title: 'Subjects',
		template: 'page-tags.hbs',
		body: '<p>Everything we publish, filed by subject.</p>',
	},
	{
		slug: 'authors',
		title: 'Writers',
		template: 'page-authors.hbs',
		body: '<p>The people behind the publication.</p>',
	},
	{
		slug: 'recommendations',
		title: 'Recommendations',
		template: 'page-recommendations.hbs',
		body: '<p>Publications we read every week.</p>',
	},
	{
		slug: 'sign-in',
		title: 'Sign in',
		template: 'page-sign-in.hbs',
		body: '',
	},
	{
		slug: 'sign-up',
		title: 'Subscribe',
		template: 'page-sign-up.hbs',
		body: '',
	},
];

const fixture = {
	/*
	 * Bumped whenever the shape changes, so import.mjs can refuse a fixture it does not
	 * understand rather than half-applying it.
	 */
	version: 1,
	pages,
};

writeFileSync(OUT, JSON.stringify(fixture, null, '\t') + '\n');

console.log(`fixture: ${pages.length} page(s) → ${OUT}`);

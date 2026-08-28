/** About page figures, transcribed from `MIRROR About.dc.html`. */
export interface Stat {
	label: string;
	value: string;
}

export const STATS: Stat[] = [
	{ label: 'Posts published', value: '104' },
	{ label: 'Writers', value: '5' },
	{ label: 'Subjects', value: '14' },
	{ label: 'Publishing since', value: '2020' },
];

export const CONTACT_EMAIL = 'editors@thequarry.press';

/**
 * The About page's editorial body, as the HTML a Ghost editor would produce.
 *
 * THIS PROSE EXISTS TWICE ON PURPOSE. The Astro build writes it as components with a utility
 * class on every element (`src/components/about/AboutBody.astro` and `ContactSection.astro`);
 * Ghost stores a page body as editor HTML and the theme styles it through the scoped
 * `.mirror-content` layer. There is no single representation that serves both, so the words are
 * transcribed once more here — beside the figures they belong with, rather than inside the
 * fixture builder, so `src/data` stays the only place the demo publication is written down.
 *
 * The two Koenig cards keep their `kg-` classes: `assets/css/screen.css` draws the design's own
 * pull quote and callout off exactly those hooks.
 */
export const ABOUT_BODY = [
	'<h2>Why this exists</h2>',
	'<p>The Quarry started in 2020 as a set of notes between four editors who had all just been made redundant in the same quarter. The notes were about process — how many edits a piece should get, what a correction ought to cost, whether anybody was reading past the fold. They were not meant to be published.</p>',
	'<p>Six years later they are the entire publication. We write for the people who run small publications: the founders, the editors, the one-person newsletters that pay a mortgage. Everything here is reported from inside that work rather than about it from a distance.</p>',
	'<h3>What we publish</h3>',
	'<p>Four beats, in rough order of volume: essays on independent media, interviews with editors and founders, field notes from publications trying something specific, and craft pieces on the mechanics of editing and type.</p>',
	'<ul>',
	'<li><strong>Essays</strong> — arguments about how the industry works and who it works for.</li>',
	'<li><strong>Interviews</strong> — long, edited transcripts. The subject sees their quotes before we run.</li>',
	'<li><strong>Field notes</strong> — short dispatches, usually with numbers attached.</li>',
	'<li><strong>Craft</strong> — house style, editing passes, typography, the unglamorous half.</li>',
	'</ul>',
	'<blockquote class="kg-blockquote-alt">If a piece would be better as an email to one person, we send the email instead.</blockquote>',
	'<h3>Editorial standards</h3>',
	'<p>Every piece gets three passes — structure, argument, line — and no piece ships on its first. Corrections run at the top of the affected post, dated, with the original wording intact. We do not take sponsored posts, affiliate links, or paid placements in the recommendations list.</p>',
	'<div class="kg-card kg-callout-card kg-callout-card-grey"><div class="kg-callout-emoji">💡</div><div class="kg-callout-text">Some of the publications we cover have been clients of our writers. Where that is true, it is disclosed in the piece.</div></div>',
	"<h3>How it's funded</h3>",
	'<p>Members, entirely. Free members get the weekly essay and the full archive. Paid members get the interviews, the annual field report, and the knowledge that five writers are paid a rate they agreed to rather than accepted.</p>',
	'<h2>Get in touch</h2>',
	`<p>Pitches, corrections and complaints all go to the same address, and all get read: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We answer pitches within two weeks or not at all — if you haven't heard, it's a no.</p>`,
].join('\n');

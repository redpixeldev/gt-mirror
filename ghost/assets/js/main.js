/*
 * MIRROR — theme runtime.
 *
 * Alpine is bundled from npm rather than pulled off a CDN: a Ghost theme has to work
 * on a publication behind a strict CSP, and a third-party script tag is the one thing
 * a buyer cannot fix from the settings menu.
 *
 * The store listener is registered before Alpine.start() on purpose — that ordering is
 * what the Astro build achieved by inlining the listener ahead of the deferred CDN
 * script, and getting it wrong leaves every x-data on the page unresolved.
 */
import Alpine from 'alpinejs';

const STORAGE_KEY = 'mirror-mode';

document.addEventListener('alpine:init', () => {
	/*
	 * Appearance. The pre-paint script in default.hbs has already put the right class
	 * on <html>; this store only reads it back, so the two can never disagree on first
	 * paint. It owns every later change.
	 */
	Alpine.store('mode', {
		dark: document.documentElement.classList.contains('dark'),

		toggle() {
			this.dark = !this.dark;
			document.documentElement.classList.toggle('dark', this.dark);
			try {
				localStorage.setItem(STORAGE_KEY, this.dark ? 'dark' : 'light');
			} catch {
				/* private mode — the choice holds for this page view only */
			}
		},
	});

	/*
	 * The chrome's collapsed menu. One component on the <header>, so the burger, the bar and
	 * the overlay all read the same open state.
	 *
	 * The overlay starts under the bar, and the bar's height depends on which shape the
	 * Surface asked for — the reading bar is shorter than the listing bar — so it is measured
	 * rather than assumed: on boot, on every open, and on a resize while it is open, because
	 * the bar wraps and a rotation mid-open would otherwise leave a strip of the page showing
	 * above the panel.
	 *
	 * The scroll lock is a class, not a style: the width at which the menu exists at all is a
	 * theme token (--breakpoint-nav), and duplicating that number here would be a second
	 * source of truth that drifts. assets/css/screen.css owns what .menu-open means.
	 *
	 * <main> goes inert while the panel is open. The panel covers it completely, so without
	 * that a Tab past the last control walks into content nobody can see.
	 */
	Alpine.data('siteMenu', () => ({
		menuOpen: false,
		barH: 0,

		init() {
			this.measure();
		},

		measure() {
			this.barH = this.$refs.bar?.offsetHeight ?? 0;
		},

		resized() {
			if (this.menuOpen) this.measure();
		},

		toggle() {
			this.menuOpen ? this.close() : this.open();
		},

		open() {
			this.measure();
			this.menuOpen = true;
			document.body.classList.add('menu-open');
			document.getElementById('main')?.setAttribute('inert', '');
		},

		close() {
			if (!this.menuOpen) return;
			this.menuOpen = false;
			document.body.classList.remove('menu-open');
			document.getElementById('main')?.removeAttribute('inert');
			/* Whatever the visitor closed with, the burger is where they were. */
			this.$refs.burger?.focus();
		},
	}));

	/*
	 * The Post Surface's table of contents.
	 *
	 * Built from the rendered article, because there is nothing else to build it from: Ghost has
	 * no contents helper and a template cannot see inside {{content}}. Both shapes of the list
	 * (the A1 disclosure, the A2 rail) mount this same component, and only one of them exists on
	 * any page.
	 *
	 * DEPTH IS AN ARGUMENT, AND THE DEFAULT IS THE DESIGN'S. A Post lists h2 only, because the
	 * drawing's own contents list does: it names the four chapter headings and skips the h3 under
	 * one of them, and a list that mirrors every level of a long essay stops being navigation. That
	 * is a drawn Surface and it is scored, so the default cannot change. The style guide is not
	 * drawn and is twenty-three sections of which most have variants, so it mounts `postToc(3)` and
	 * gets the second level nested under the first. One component, one rule, stated per Surface.
	 *
	 * The ids are Ghost's — its renderer slugifies every heading and suffixes collisions — and a
	 * heading without one is skipped rather than given a generated anchor: an id this script
	 * invents would not survive the reader sharing the link with anyone whose page rendered a
	 * different body.
	 *
	 * `active` is which section the reader has reached, by the same rule the design source used:
	 * the last heading whose top has passed 160px. The scroll handler coalesces into one frame,
	 * but the first pass runs directly — a headless renderer taking a screenshot never fires
	 * requestAnimationFrame, and the list would ship with nothing marked.
	 */
	Alpine.data('postToc', (depth = 2) => ({
		items: [],
		active: '',

		init() {
			/*
			 * DIRECT CHILDREN ONLY. A card can contain a heading with an id of its own — the header
			 * card's h2 gets one from `slugify(nodeData.header)`, and a sign-up card's does too — and
			 * a descendant selector puts "A section header" in the contents list as though it were a
			 * chapter of the article. Ghost's content is a flat sequence of elements, so the
			 * article's own headings are exactly the ones at depth 1.
			 */
			const level = depth > 2 ? ':is(h2, h3)' : 'h2';
			const selector = `.mirror-content > ${level}[id]`;
			const flat = [];
			let n = 0;

			/* A child needs a parent to nest under. An h3 that arrives before any h2 — an author
			 * can write one, and the second level of a page that never opened a first is exactly
			 * the case a silent `undefined.children.push` would swallow — is promoted and numbered
			 * rather than dropped. */
			for (const heading of document.querySelectorAll(selector)) {
				const item = { id: heading.id, label: heading.textContent.trim(), children: [] };
				const parent = this.items[this.items.length - 1];

				if (heading.tagName === 'H3' && parent) {
					parent.children.push(item);
				} else {
					n += 1;
					item.num = String(n).padStart(2, '0');
					this.items.push(item);
				}
				flat.push(item);
			}

			if (!this.items.length) return;

			let frame = 0;
			const sync = () => {
				frame = 0;
				let reached = '';
				/* Every heading in the list, not only the numbered ones: the reader is inside the
				 * subsection they can see, and marking its parent instead would put the highlight
				 * on a heading that has already scrolled away. */
				for (const item of flat) {
					const heading = document.getElementById(item.id);
					if (heading && heading.getBoundingClientRect().top <= 160) reached = item.id;
				}
				this.active = reached;
			};

			const onScroll = () => {
				if (!frame) frame = requestAnimationFrame(sync);
			};

			addEventListener('scroll', onScroll, { passive: true });
			addEventListener('resize', onScroll);
			sync();
		},
	}));

	/*
	 * Copy link. The clipboard is the one share action that needs script, and it can fail for a
	 * reason the visitor cannot fix: navigator.clipboard is undefined on an insecure origin, and
	 * the permission can be refused. Either way the label must not claim a copy that did not
	 * happen, so `copied` is only set after the write resolves.
	 *
	 * The address comes from the template, not from `location.href`. A reader can be on the post
	 * at a URL that is not the post's: `?mode=dark` is a hook this theme honours before first
	 * paint, so copying the current URL would hand the recipient a link that overrides their own
	 * appearance — and any tracking query string would travel with it. This is the same
	 * {{url absolute="true"}} the Email and Bluesky links carry.
	 */
	Alpine.data('postShare', (url) => ({
		copied: false,
		timer: 0,

		async copy() {
			try {
				await navigator.clipboard.writeText(url);
			} catch {
				return;
			}
			this.copied = true;
			clearTimeout(this.timer);
			this.timer = setTimeout(() => (this.copied = false), 2000);
		},
	}));
});

/*
 * Focus, after Ghost's search closes.
 *
 * The theme hands search to the platform — the ⌕ button and the panel's search control carry
 * `data-ghost-search` and sodo-search does the rest — but the platform does not put focus back.
 * Measured on sodo-search 1.8: opening moves focus onto its iframe, and closing empties
 * #sodo-search-root and leaves focus on <body>, so the next Tab restarts at the top of the
 * document. That is a dead end the theme's own control created, so the theme closes it.
 *
 * The trigger is remembered on the way in, in the capture phase so it is recorded before
 * sodo's own handler runs, and ⌘K remembers whatever had focus instead. Restoring is gated on
 * the element still being visible: search opened from the collapsed panel returns into the
 * panel, which is still open, and a trigger that has since been hidden gets no focus at all
 * rather than a silent one.
 */
const SEARCH_ROOT = 'sodo-search-root';
let searchTrigger = null;

document.addEventListener(
	'click',
	(event) => {
		const trigger = event.target.closest?.('[data-ghost-search]');
		if (trigger) searchTrigger = trigger;
	},
	true,
);

document.addEventListener(
	'keydown',
	(event) => {
		if (event.key === 'k' && (event.metaKey || event.ctrlKey)) searchTrigger = document.activeElement;
	},
	true,
);

function watchSearchRoot(root) {
	new MutationObserver(() => {
		if (root.childElementCount > 0 || !searchTrigger) return;
		const trigger = searchTrigger;
		searchTrigger = null;
		if (trigger.isConnected && trigger.offsetParent !== null) trigger.focus();
	}).observe(root, { childList: true });
}

/* sodo-search is deferred, so its root usually arrives after this script has run. */
const searchRoot = document.getElementById(SEARCH_ROOT);
if (searchRoot) {
	watchSearchRoot(searchRoot);
} else {
	const pending = new MutationObserver(() => {
		const late = document.getElementById(SEARCH_ROOT);
		if (!late) return;
		pending.disconnect();
		watchSearchRoot(late);
	});
	pending.observe(document.body, { childList: true });
}

/*
 * The address in "we sent a link to …", on the two auth Surfaces.
 *
 * Portal reports the OUTCOME of a members submit — `loading`, then `success` or `error` on the
 * form — and never the input, so the success panel has no way to name the address the reader
 * typed. This copies it across at submit time, which is the only moment it is still on screen.
 *
 * Everything about the panel already reads correctly without this: the markup ships the words
 * "the address you entered", and this replaces them with the address itself. An enhancement over
 * a sentence that is true either way, not a dependency.
 *
 * Captured on the document rather than bound per form: a `submit` listener added here cannot be
 * detached by Portal the way its own is, and the two Surfaces have exactly one form each.
 */
document.addEventListener(
	'submit',
	(event) => {
		const form = event.target;
		if (!form.matches?.('[data-members-form]')) return;

		const email = form.querySelector('[data-members-email]')?.value?.trim();
		const slot = form.parentElement?.querySelector('[data-members-sent-to]');
		if (email && slot) slot.textContent = email;
	},
	true,
);

/*
 * The featured strip's prev/next controls.
 *
 * The track is a native scroll-snap container, so the strip is already scrollable, keyboard
 * reachable and swipeable with nothing loaded — these two buttons only give a pointer visitor
 * the affordance the design draws. Nothing here measures or positions a card: the step is one
 * card plus its gap, read off the DOM at click time rather than cached, so a re-flow after the
 * webfonts settle needs no re-measure hook (which is the one thing Swiper needed a
 * `document.fonts.ready` callback for in the reference build).
 *
 * `scrollBy` with a `behavior` the visitor chose: `auto` under prefers-reduced-motion is the
 * platform's own instant jump, which is the whole of what honouring it means here.
 */
document.addEventListener('click', (event) => {
	const button = event.target.closest?.('[data-featured-prev], [data-featured-next]');
	if (!button) return;

	const track = button.closest('section')?.querySelector('[data-featured]');
	const card = track?.firstElementChild;
	if (!card) return;

	/* The gap is on the track, so the step is the card's own width plus the space after it. */
	const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
	const step = card.getBoundingClientRect().width + gap;
	const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

	track.scrollBy({ left: button.hasAttribute('data-featured-prev') ? -step : step, behavior });
});

/*
 * …and hiding them when there is nothing to scroll.
 *
 * The design draws both buttons unconditionally, against a publication with six featured posts in
 * a track that always overflows. A publication that has flagged two has a track that fits, and two
 * buttons that scroll nothing are chrome for content that is not there — the shape
 * docs/adr/0003 says to omit.
 *
 * Measured, not counted. A post-count test is wrong at both ends: three cards fit at 1568px and
 * two overflow a phone, so the question is the track's own geometry and `scrollWidth` is the only
 * thing that answers it. `hidden` rather than a class, so the pair leaves the accessibility tree
 * with it.
 *
 * Re-run on resize and after the webfonts settle, because both change the cards' widths — a
 * ResizeObserver on the track catches the first and `document.fonts.ready` the second. The 1px
 * allowance absorbs sub-pixel track widths, which otherwise report a 0.4px overflow at some
 * viewport widths and show a pair of buttons that cannot move.
 */
const syncFeaturedControls = () => {
	for (const track of document.querySelectorAll('[data-featured]')) {
		const controls = track.closest('section')?.querySelector('[data-featured-controls]');
		if (controls) controls.hidden = track.scrollWidth <= track.clientWidth + 1;
	}
};

for (const track of document.querySelectorAll('[data-featured]')) {
	new ResizeObserver(syncFeaturedControls).observe(track);
}

document.fonts?.ready.then(syncFeaturedControls);
syncFeaturedControls();

/*
 * The code block's language strip.
 *
 * The design draws a header above the code naming its language, with the word `copy` on the right.
 * Ghost emits `<pre><code class="language-json">`, so the language is in the document whenever the
 * author named one — this reads it and wraps the block in the shell assets/css/screen.css styles.
 * A block that names NO language is left alone: that is the Concession the stylesheet records, and
 * it is what keeps the design's own specimen, which names nothing, exactly as it was measured.
 *
 * The two labels come from the <template> in default.hbs rather than from here, because a string a
 * visitor reads has to pass through {{t}} — the same rule partials/post/share.hbs follows. And
 * because the strip is built by script, a visitor with scripting off gets no strip rather than a
 * dead one, which is what `x-cloak` buys that partial the long way round.
 *
 * This runs before the highlighter (that module is `type="module"`, so it is deferred past this
 * file), which is the order the shell wants: microlighter registers ranges over the text nodes
 * inside <code>, and moving the <pre> afterwards would leave them anchored to the same nodes but
 * force a second style resolution for nothing.
 */
const CODE_SHELL = 'mirror-code';
const LANGUAGE_PREFIX = 'language-';

const template = document.getElementById('mirror-code-strip');

for (const code of template
	? document.querySelectorAll(`.mirror-content pre > code[class*="${LANGUAGE_PREFIX}"]`)
	: []) {
	const language = [...code.classList].find((name) => name.startsWith(LANGUAGE_PREFIX))?.slice(LANGUAGE_PREFIX.length);
	const pre = code.parentElement;
	if (!language || pre.parentElement?.classList.contains(CODE_SHELL)) continue;

	const shell = document.createElement('div');
	shell.className = CODE_SHELL;
	pre.replaceWith(shell);
	shell.append(template.content.cloneNode(true), pre);
	shell.querySelector('.mirror-code-lang').textContent = language;

	/* The design's specimen is focusable: it is a scroll container, and a scroll container a
	 * keyboard cannot reach is a cropped page. src/components/cards/CodeCard.astro does the same. */
	pre.tabIndex = 0;
}

/*
 * A TABLE'S SCROLL SHELL, the same move one paragraph up.
 *
 * Ghost emits a bare <table> — no `kg-table` class exists anywhere in 6.60 — and a table stops
 * shrinking at its min-content width, so a wide one in a Post pushes the page past the viewport
 * and takes its last column off the edge. `partials/pages/membership.hbs` fixes that for the
 * benefit matrix by scrolling the whole content div, which a Post cannot do: `bleed-wide` breaks
 * the measure on purpose there, and an ancestor with `overflow-x` would clip it.
 *
 * So the shell goes around the table alone. No <template> and no strings: unlike the code strip
 * this element carries nothing a visitor reads, so it needs no {{t}} and can be built here. A
 * visitor with scripting off keeps today's behaviour, which is the platform's.
 */
const TABLE_SHELL = 'mirror-table';

for (const table of document.querySelectorAll('.mirror-content table')) {
	/*
	 * A Surface that has already declared its own scroll container keeps it: Membership scrolls the
	 * whole matrix block (`data-scroll-intent` in partials/pages/membership.hbs) because the
	 * cropped column there is the tier being sold. Nesting a second scroll box inside it would put
	 * two scrollbars around one table and move a scored Surface for nothing.
	 */
	if (table.closest('[data-scroll-intent]') || table.parentElement?.classList.contains(TABLE_SHELL)) continue;

	const shell = document.createElement('div');
	shell.className = TABLE_SHELL;
	/* The audit's own convention: anything that scrolls on purpose says why, so an exception cannot
	 * quietly become the rule (scripts/verify/probe-audit.js). Same wording as membership.hbs. */
	shell.dataset.scrollIntent = 'a wide table, reachable instead of cropped';
	table.replaceWith(shell);
	shell.append(table);

	/* A scroll container a keyboard cannot reach is a cropped page — the reason the <pre> above
	 * takes a tabIndex, and the reason membership.hbs leaves block padding for the focus ring. */
	shell.tabIndex = 0;
}

/*
 * Copy, from the strip.
 *
 * `textContent` is the whole of it because the highlighter paints with the CSS Custom Highlight
 * API and adds no markup — the code in the DOM is the code the author wrote, so what is copied is
 * what is shown. The label is only swapped after the write resolves, for the reason postShare
 * states: navigator.clipboard is undefined on an insecure origin and the permission can be
 * refused, and a label that claims a copy that did not happen is worse than no label.
 */
const copyTimers = new Map();

document.addEventListener('click', async (event) => {
	const button = event.target.closest?.('.mirror-code-copy');
	const code = button?.closest(`.${CODE_SHELL}`)?.querySelector('pre > code');
	if (!code) return;

	try {
		await navigator.clipboard.writeText(code.textContent);
	} catch {
		return;
	}

	button.textContent = button.dataset.copied;
	clearTimeout(copyTimers.get(button));
	copyTimers.set(
		button,
		setTimeout(() => (button.textContent = button.dataset.copy), 2000),
	);
});

window.Alpine = Alpine;
Alpine.start();

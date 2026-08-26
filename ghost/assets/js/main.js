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

window.Alpine = Alpine;
Alpine.start();

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

const STORAGE_KEY = 'mirror-theme';

document.addEventListener('alpine:init', () => {
	/*
	 * Appearance. The pre-paint script in default.hbs has already put the right class
	 * on <html>; this store only reads it back, so the two can never disagree on first
	 * paint. It owns every later change.
	 */
	Alpine.store('theme', {
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

		get label() {
			return this.dark ? 'Dark' : 'Light';
		},
	});
});

window.Alpine = Alpine;
Alpine.start();

import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	compressHTML: false,

	server: {
		port: 4380,
	},

	// The homepage lives at /homepage-01, so the bare domain needs somewhere to go.
	// Under `output: 'static'` Astro emits this as an index.html carrying a meta
	// refresh and a canonical link — no page file, no SSR.
	redirects: {
		'/': '/homepage-01',
	},

	// No `fonts` block: MIRROR's two families ship with the repo as woff2 in
	// `public/fonts/`, declared by hand in `src/styles/fonts.css`. Nothing is
	// fetched from Google at build time. See DECISIONS.md for the trade-off.

	build: {
		assets: 'assets',
		format: 'file',
	},

	vite: {
		plugins: [tailwindcss()],
		// The verification harness writes captures and staged originals inside the
		// project. Without these exclusions every screenshot lands in the watcher,
		// which reloads the page mid-capture and eventually wedges the dev server
		// in a reload loop.
		server: {
			watch: {
				ignored: ['**/.shots/**', '**/.originals/**', '**/panel-*.png'],
			},
		},
		build: {
			assetsInlineLimit: 0,
			rollupOptions: {
				output: {
					entryFileNames: 'assets/main.js',
					assetFileNames: 'assets/main[extname]',
				},
			},
		},
	},

	output: 'static',
});

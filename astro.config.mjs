import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	compressHTML: false,

	server: {
		port: 4380,
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

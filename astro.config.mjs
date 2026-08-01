import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	compressHTML: false,

	server: {
		port: 4380,
	},

	// MIRROR ships exactly two families. Newsreader is a variable font: the weight
	// range plus the explicit `opsz` axis are what keep optical sizing alive — without
	// the axis request Google ships an instance pinned to its default optical size,
	// which renders ~5% wider than the source and throws every line break off.
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Newsreader',
			cssVariable: '--font-newsreader',
			weights: ['300 600'],
			styles: ['normal', 'italic'],
			fallbacks: ['Georgia', 'serif'],
			options: {
				experimental: {
					variableAxis: { opsz: [['6', '72']] },
				},
			},
		},
		{
			provider: fontProviders.google(),
			name: 'Archivo',
			cssVariable: '--font-archivo',
			weights: [400, 500, 600, 700],
			styles: ['normal'],
			fallbacks: ['system-ui', 'sans-serif'],
		},
	],

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

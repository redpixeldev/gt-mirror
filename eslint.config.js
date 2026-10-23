import { join } from 'node:path';
import tailwind from 'eslint-plugin-tailwindcss';
import eslintPluginAstro from 'eslint-plugin-astro';
import tsParser from '@typescript-eslint/parser';

export default [
	{
		// Build output, captures and vendored copies. dist/mirror/ carries the theme's own
		// package.json, which made the Tailwind plugin look for its CSS config under it and crash.
		ignores: [
			'dist/',
			'public/',
			'ghost/assets/built/',
			'.astro/',
			'.shots/',
			'.originals/',
			'.profiles/',
			'.venv/',
			'.claude/',
			'demo-host/current/',
			'demo-host/content/',
		],
	},
	tailwind.configs.recommended,
	...eslintPluginAstro.configs.recommended,
	{
		// `.astro` frontmatter is handled by the Astro plugin; standalone .ts modules
		// (src/data/*) need the TypeScript parser or `type`/`interface` fail to parse.
		files: ['**/*.ts'],
		languageOptions: { parser: tsParser },
	},
	{
		settings: {
			tailwindcss: {
				// Tailwind v4 is CSS-first: point the plugin at the @theme entry
				// (v4 default is src/style.css, which this project does not use). Absolute,
				// because the plugin resolves a relative path against the nearest package.json,
				// and ghost/ has one of its own.
				cssConfigPath: join(import.meta.dirname, 'src/styles/main.css'),
			},
		},
	},
];

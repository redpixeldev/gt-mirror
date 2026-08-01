import tailwind from 'eslint-plugin-tailwindcss';
import eslintPluginAstro from 'eslint-plugin-astro';
import tsParser from '@typescript-eslint/parser';

export default [
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
				// (v4 default is src/style.css, which this project does not use).
				cssConfigPath: 'src/styles/main.css',
			},
		},
	},
];

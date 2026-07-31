import tailwind from 'eslint-plugin-tailwindcss';
import eslintPluginAstro from 'eslint-plugin-astro';

export default [
	tailwind.configs.recommended,
	...eslintPluginAstro.configs.recommended,
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

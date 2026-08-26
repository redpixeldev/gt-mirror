/*
 * Load src/data/*.ts into a Node process.
 *
 * The design's demo content has exactly one source of truth and it is src/data. Re-transcribing
 * any of it into a fixture would create a second, and the two would drift the first time someone
 * fixed a typo in one of them.
 *
 * Node can strip types now, but it cannot resolve the extensionless sibling imports TypeScript
 * uses (`archive.ts` imports './posts'), so a plain dynamic import fails on the first module that
 * has one. esbuild — already a dependency, because it bundles the theme's JS — resolves them, so
 * the modules are bundled in memory and imported from a data: URL. No temp file to clean up, no
 * loader hook, no network, and the same bytes every run.
 */
import * as esbuild from 'esbuild';

const MODULES = [
	'about',
	'archive',
	'authorArchive',
	'authors',
	'membership',
	'navigation',
	'post',
	'posts',
	'recommendations',
	'tagArchive',
	'tags',
];

/** @returns {Promise<Record<string, Record<string, unknown>>>} module name → its exports */
export async function loadData() {
	const contents = MODULES.map((name) => `export * as ${name} from './src/data/${name}';`).join('\n');

	const result = await esbuild.build({
		stdin: { contents, resolveDir: process.cwd(), sourcefile: 'data-entry.ts', loader: 'ts' },
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'node',
		target: 'node22',
		logLevel: 'silent',
	});

	const base64 = Buffer.from(result.outputFiles[0].text).toString('base64');
	return await import(`data:text/javascript;base64,${base64}`);
}

/*
 * Apply docs/routes.example.yaml to the running Ghost, and prove it took.
 *
 *   node --env-file=.env scripts/ghost/upload-routes.mjs
 *   node --env-file=.env scripts/ghost/upload-routes.mjs --bare   # remove it again
 *
 * routes.yaml is site configuration, not theme code, so it cannot ship inside the zip and a
 * buyer uploads it by hand under Settings → Labs → Routes. That is fine for a buyer and wrong
 * for this repo: which Surface owns which URL is the difference between the capture set finding
 * the Feed and finding the homepage, and re-pasting a file into an admin screen after every
 * change is exactly the step that silently drifts from the file in git.
 *
 * Ghost validates the YAML on upload and answers 422 with the offending path when it will not
 * take it, so a bad file fails here rather than turning every later capture into a 404. The
 * upload also restarts Ghost's URL service, which is asynchronous: this script waits for the
 * routes to actually resolve rather than for the request to return.
 *
 * `--bare` uploads Ghost's own default routes instead, which is how the bare-install behaviour
 * is checked — every template has to render correctly in both configurations.
 *
 * `--routes <file>` uploads another file — the Demo site's generated
 * `dist/mirror-demo-routes.yaml`, which is this one plus the Layout browser's routes. It keeps
 * `/` and `/archive/`, so the same expectations prove it landed.
 */
import { readFileSync } from 'node:fs';

import { base, ownerSession, request } from './admin.mjs';

const DEFAULT_ROUTES = 'docs/routes.example.yaml';

/* Ghost's own default: `/` is the posts collection and there is nothing else. */
const BARE = `routes:\n\ncollections:\n  /:\n    permalink: /{slug}/\n    template: index\n\ntaxonomies:\n  tag: /tag/{slug}/\n  author: /author/{slug}/\n`;

const argv = process.argv.slice(2);
const fileFlag = argv.indexOf('--routes');
if (fileFlag >= 0 && !argv[fileFlag + 1]) {
	console.error('--routes needs a path');
	process.exit(1);
}
for (const [index, arg] of argv.entries()) {
	const isPath = fileFlag >= 0 && index === fileFlag + 1;
	if (arg !== '--bare' && arg !== '--small' && arg !== '--routes' && !isPath) {
		console.error(`unknown argument: ${arg}`);
		process.exit(1);
	}
}
const bare = argv.includes('--bare');
const ROUTES = fileFlag >= 0 ? argv[fileFlag + 1] : DEFAULT_ROUTES;

const yaml = bare ? BARE : readFileSync(ROUTES, 'utf8');

/*
 * What the upload has to produce. A 200 from the upload endpoint only says the YAML parsed;
 * these URLs are the claim the file actually makes, and until they answer with the right Surface
 * marker on the page the configuration has not landed.
 *
 * `/archive/page/2/` IS THE CHANNEL'S OWN CLAIM — that /archive/ paginates independently of the
 * collection at `/`, which is the whole reason it is a `controller: channel` rather than a
 * `route:`. It is also the one expectation that depends on the PUBLICATION rather than on the
 * file: a Day-one publication of seven posts has no second page of anything, and asserting one
 * would fail this script for the publication being small. `--small` drops it, and drops nothing
 * else — the channel still has to exist and still has to render the Feed.
 */
const small = argv.includes('--small');
const expected = bare
	? [{ path: '/', surface: 'home' }]
	: [
			{ path: '/', surface: 'home' },
			{ path: '/archive/', surface: 'feed' },
			...(small ? [] : [{ path: '/archive/page/2/', surface: 'feed' }]),
		];

async function upload() {
	const auth = await ownerSession();
	const form = new FormData();
	form.append('routes', new Blob([yaml], { type: 'application/x-yaml' }), 'routes.yaml');

	const response = await request(`${base}/ghost/api/admin/settings/routes/yaml/`, {
		method: 'POST',
		headers: auth,
		body: form,
	});

	if (!response.ok) {
		const body = await response.text();
		let message = body;
		try {
			message = JSON.parse(body)
				.errors?.map((e) => [e.message, e.context].filter(Boolean).join(' — '))
				.join('; ');
		} catch {
			/* not JSON — the raw body is the best report available */
		}
		throw new Error(`routes upload failed (${response.status}): ${message}`);
	}
}

/** True once every expected URL answers 200 with its Surface marker on the page. */
async function resolved() {
	for (const { path, surface } of expected) {
		const response = await request(`${base}${path}`, { redirect: 'manual' });
		if (response.status !== 200) {
			return `${path} answered ${response.status}`;
		}
		const body = await response.text();
		if (!body.includes(`data-surface="${surface}"`)) {
			return `${path} rendered without data-surface="${surface}"`;
		}
	}
	return null;
}

await upload();

/* The URL service restarts asynchronously, so the routes are live a moment after the 200. */
let problem = 'not checked';
for (let attempt = 0; attempt < 30; attempt += 1) {
	problem = await resolved();
	if (!problem) break;
	await new Promise((resolve) => setTimeout(resolve, 500));
}

if (problem) {
	console.error(`routes uploaded but did not resolve: ${problem}`);
	process.exit(1);
}

console.log(
	`routes: ${bare ? "Ghost's defaults" : ROUTES} applied — ${expected.map((e) => `${e.path} → ${e.surface}`).join(', ')}`,
);

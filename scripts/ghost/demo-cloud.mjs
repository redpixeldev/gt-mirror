/*
 * Seed the Demo site on Laravel Cloud from the repo, and prove it.
 *
 *   node --env-file=.env scripts/ghost/demo-cloud.mjs --base https://mirror-demo-main-xxxx.laravel.cloud --environment env-…
 *   (pnpm demo:cloud --base … --environment …; the ID is in `cloud environment:list <app> --json`)
 *
 * The Cloud Demo site is derived state (docs/adr/0007): nothing on it is migrated, all of it is
 * rebuilt from demo-overlay.mjs and the fixture. This is the same pipeline as `pnpm demo`, pointed
 * at Cloud, plus the two steps a fresh Ghost needs before an import can run at all — an owner, and
 * MIRROR as the active theme (build.mjs bakes the theme in; Ghost boots on Source).
 *
 * ITS OWN OWNER CREDENTIALS. DEMO_CLOUD_ADMIN_EMAIL / DEMO_CLOUD_ADMIN_PASSWORD, not the local
 * harness's GHOST_ADMIN_*: this owner is on the public internet, and the Cloud config turns staff
 * device verification off so a script can sign in, which leaves the password as the only factor.
 *
 * ITS OWN SESSION AND IMAGE MAP, because both are per install (`admin.mjs`, `import.mjs`). Re-running
 * is safe — the import is idempotent and the map stops the photographs being uploaded twice.
 *
 * THE IMAGE SIZES ARE MADE ON CLOUD. The bucket cannot resize, so demo-host/presize.mjs uploads every
 * size Ghost can link to. It runs on the environment through `cloud command:run`, where the bucket
 * credentials and Ghost's own transform already are, after the import has uploaded the photographs
 * and before the smoke run looks at the pages.
 *
 * Cloud's edge caches pages for an hour (ghost-config.mjs). A first seed has nothing cached; after
 * a re-seed, purge the edge cache or redeploy before trusting what a browser shows.
 */
import { execFileSync } from 'node:child_process';

const arg = (name) => {
	const at = process.argv.indexOf(name);
	return at < 0 ? null : process.argv[at + 1];
};
const base = arg('--base')?.replace(/\/$/, '');
const environment = arg('--environment');
if (!base || !environment) {
	throw new Error('usage: demo-cloud.mjs --base <Cloud site url> --environment <Cloud environment ID>');
}

const email = process.env.DEMO_CLOUD_ADMIN_EMAIL;
const password = process.env.DEMO_CLOUD_ADMIN_PASSWORD;
if (!email || !password) {
	throw new Error('DEMO_CLOUD_ADMIN_EMAIL and DEMO_CLOUD_ADMIN_PASSWORD are required in .env');
}

process.env.GHOST_URL = base;
process.env.GHOST_SESSION_FILE = '.ghost-session-cloud.json';
process.env.GHOST_IMAGE_MAP = 'scripts/ghost/uploaded-images-cloud.json';
process.env.GHOST_ADMIN_EMAIL = email;
process.env.GHOST_ADMIN_PASSWORD = password;

/* Imported after the environment is set: admin.mjs reads GHOST_URL once, at load. */
const { api } = await import('./admin.mjs');

const setupUrl = `${base}/ghost/api/admin/authentication/setup/`;
const headers = { 'Content-Type': 'application/json', 'Accept-Version': 'v6.0', Origin: base };
/* The first request to an instance that scaled to zero; Cloud may answer it before Ghost can. */
const probe = await fetch(setupUrl, { headers });
if (!probe.ok) {
	throw new Error(`setup status → ${probe.status} ${(await probe.text()).slice(0, 200)}; is Ghost up yet?`);
}
const status = await probe.json();
if (!status.setup?.[0]?.status) {
	const response = await fetch(setupUrl, {
		method: 'POST',
		headers,
		body: JSON.stringify({ setup: [{ name: 'MIRROR', email, password, blogTitle: 'MIRROR' }] }),
	});
	if (!response.ok) {
		throw new Error(`owner setup → ${response.status} ${(await response.text()).slice(0, 200)}`);
	}
	console.log(`owner   ${email} created`);
}

await api('PUT', '/themes/mirror/activate/');
console.log('theme   mirror active');

const run = (...args) => execFileSync(args[0], args.slice(1), { stdio: 'inherit', env: process.env });
run('pnpm', '-s', 'ghost:demo');
run('node', 'scripts/ghost/import.mjs', '--fixture', 'dist/mirror-demo-fixture.json', '--prune');
run('node', 'scripts/ghost/upload-routes.mjs', '--routes', 'dist/mirror-demo-routes.yaml');
run('cloud', 'command:run', environment, '--cmd', 'node presize.mjs', '-n');
run('node', 'scripts/ghost/demo-smoke.mjs', '--base', base);

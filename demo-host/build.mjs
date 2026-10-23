/*
 * Assemble a runnable Ghost for a Laravel Cloud deploy.
 *
 * Runs as Cloud's build command from demo-host/. Cloud deploys only this directory but builds with
 * the whole repository checked out, so the theme is built at the root and copied in here.
 *
 * GHOST IS EXTRACTED, NOT INSTALLED AS A DEPENDENCY. The published `ghost` package is a pnpm root
 * project whose own dependencies point at `file:components/*.tgz` inside it; npm resolves those
 * against the depending project and fails. So this does what Ghost-CLI does: unpack the exact
 * version and install its production dependencies inside it, with its own lockfile and its own
 * pinned pnpm. pnpm switches itself to whatever `packageManager` a project names (Ghost pins 11.x,
 * this repo 10.x), so it is called directly — under corepack it refuses to switch. Cloud's build
 * command installs it first: `npm install -g pnpm && npm run build`.
 *
 * THE VERSION IS EXACT and equals the local harness's (`~/ghost-mirror/current`), bumped in the
 * same commit, so the Demo site runs the Ghost the gate scored (docs/adr/0007).
 *
 * THE THEME IS THE ONLY CONTENT BAKED. Uploads, routes.yaml and redirects live in the bucket
 * (ghost-config.mjs), but Ghost has no remote store for themes, and Cloud's disk is wiped on every
 * deploy, reboot and wake: a theme uploaded through Ghost Admin lasts until the next one. Ghost's
 * own bundled content (Casper, Source, the empty data/ and settings/ folders) goes in first, the way
 * Ghost-CLI lays out a fresh install, so a first boot finds the default theme it starts on.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const GHOST_VERSION = '6.60.0';

const here = import.meta.dirname;
const root = join(here, '..');
/* `current/`, not any name: Ghost finds its own package.json through a `current` directory under
 * the working directory (@tryghost/root-utils getProcessRoot), which is Ghost-CLI's layout. */
const ghost = join(here, 'current');
const content = join(here, 'content');

const run = (cwd, cmd, ...args) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

rmSync(ghost, { recursive: true, force: true });
mkdirSync(ghost);
const tarball = execFileSync('npm', ['pack', `ghost@${GHOST_VERSION}`, '--silent', '--pack-destination', here], {
	cwd: here,
	encoding: 'utf8',
}).trim();
run(here, 'tar', '-xzf', tarball, '-C', ghost, '--strip-components=1');
rmSync(join(here, tarball));
run(ghost, 'pnpm', 'install', '--prod', '--frozen-lockfile');

run(root, 'pnpm', 'install', '--frozen-lockfile');
run(root, 'pnpm', 'ghost:build');
run(root, 'pnpm', 'ghost:stage');

rmSync(content, { recursive: true, force: true });
cpSync(join(ghost, 'content'), content, { recursive: true });
cpSync(join(root, 'dist/mirror'), join(content, 'themes/mirror'), { recursive: true });

console.log(`ghost ${GHOST_VERSION} → ${ghost}\ncontent → ${content} (theme: dist/mirror)`);

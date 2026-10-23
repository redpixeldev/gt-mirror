/*
 * Stage the theme for zipping or deploying: ghost/ → dist/mirror/, minus what a theme must not ship.
 *
 *   node scripts/ghost/stage.mjs   (pnpm ghost:stage)
 *
 * In Node rather than `rsync -a --exclude …`, because Laravel Cloud's build image has no rsync and
 * the Demo site's build (demo-host/build.mjs) stages the theme there. `ghost:zip` uses the same
 * script, so the zip and the Demo site cannot ship different files.
 *
 * Left out: the CSS and JS sources (`assets/css/`, `assets/js/` — `assets/built/` is what the
 * templates load) and macOS's `.DS_Store` files.
 */
import { cpSync, rmSync } from 'node:fs';
import { basename, relative } from 'node:path';

const SOURCE = 'ghost';
const TARGET = 'dist/mirror';
const EXCLUDED = new Set(['assets/css', 'assets/js']);

rmSync(TARGET, { recursive: true, force: true });
cpSync(SOURCE, TARGET, {
	recursive: true,
	filter: (path) => basename(path) !== '.DS_Store' && !EXCLUDED.has(relative(SOURCE, path)),
});

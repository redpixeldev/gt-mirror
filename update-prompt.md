# Update prompt: modernize an `astro-tailwindcss-starter` project

Paste this to Claude Code (or another coding agent) inside an **older** project that
matches the `ccdead3` structure of `astro-starter` (see "Assumed starting state"
below). It updates all dependencies to the latest versions, adopts the Astro Fonts
API and an ESLint toolchain, and fixes the Cloudflare Pages deployment — applying
the same set of changes that landed on `astro-starter`'s `main`.

Work in **bisectable commits** (one per phase). After each phase, run its
verification gate and do not proceed until it is green. You ARE authorized to run
`pnpm install` and `pnpm build` in this task (verification depends on it), even if
the project's `CLAUDE.md` says not to build by default.

Use the `find-docs` skill (or `ctx7` CLI) to confirm breaking changes for whatever
the *current latest* major is at the time you run this — new majors may have shipped
since this prompt was written. Do not rely on memory for any framework's breaking
changes; verify against current docs.

---

## Assumed starting state (`ccdead3`)

If the project differs materially from this, stop and report the differences before
changing anything.

- **Astro v5** static site, Tailwind CSS v4 (CSS-first, no `tailwind.config.js`),
  Alpine.js from CDN.
- `package.json`: everything under `dependencies` (no `devDependencies`). Includes
  `@astrojs/cloudflare ^12`, `astro ^5`, `typescript ^5`, `tailwindcss` and
  `@tailwindcss/postcss` **pinned without a caret** (e.g. `4.1.18`), plus
  `@tailwindcss/forms`, `@tailwindcss/typography`, `prettier`,
  `prettier-plugin-astro`, `prettier-plugin-tailwindcss`, `sharp`, `wrangler`.
- `astro.config.mjs`: `output: 'static'`, `adapter: cloudflare()`, and a
  `vite.build.rollupOptions.output` block forcing un-hashed `assets/main.js` /
  `assets/main[extname]`.
- **Runtime Google Fonts** — `Layout.astro` has `<link rel="preconnect"
  href="https://fonts.googleapis.com">` etc. and a Google Fonts stylesheet; there
  is **no** Fonts API usage.
- **No `eslint.config.js`** and no ESLint packages declared.
- `postcss.config.cjs` registers `@tailwindcss/postcss`.
- Cloudflare deploy via `wrangler.jsonc` + `public/.assetsignore`.

---

## Guardrails

- **Branch first** if on the default branch.
- **Verify before destroying.** Do not remove the Cloudflare adapter until you have
  confirmed (Phase 4) the project is static-only and deployed to Cloudflare Pages.
- **One concern per commit.** If a phase's verification fails, fix it within that
  phase before committing.
- The **Pages "Build output directory" dashboard setting cannot be changed from
  code** — surface it as a manual follow-up, do not pretend to fix it in the repo.

---

## Phase 0 — Recon (no changes)

1. Read `package.json`, `astro.config.mjs`, `tsconfig.json`, `eslint.config.*` (if
   any), `postcss.config.cjs`, `src/layouts/Layout.astro`, `src/styles/main.css`,
   `wrangler.jsonc`, `.gitignore`.
2. Determine: the Tailwind CSS **entry file** (e.g. `src/styles/main.css` — the one
   with `@import 'tailwindcss'`); the **font family + weights + styles** actually
   used (from the runtime Google Fonts `<link>` and/or `fonts.css`); whether any
   **SSR / on-demand** features are used (server endpoints, `output: 'server'` /
   `'hybrid'`, `Astro.request`-driven logic, middleware). Record these — later
   phases need them.
3. Run `pnpm outdated` to see the gap. Note which jumps are majors.

---

## Phase 1 — Safe bumps, devDependencies split, ESLint toolchain

Commit: `chore: bump safe deps, split devDependencies, add eslint toolchain`

1. Bump all **non-major** deps to latest (prettier, prettier plugins, wrangler,
   sharp, `@tailwindcss/forms`, `@tailwindcss/typography`). Move the pinned
   `tailwindcss` / `@tailwindcss/postcss` to the latest in-major version; you may
   use a caret range.
2. **Split** build/lint/format tooling into `devDependencies` (prettier + plugins,
   typescript, wrangler, sharp, eslint + plugins). Keep `astro`, the adapter, and
   the `@tailwindcss/*` runtime/utility packages in `dependencies`.
3. **Add the ESLint toolchain** as `devDependencies` and create `eslint.config.js`.
   Resolve *current latest* for each, and mind the peers — `eslint-plugin-astro`
   requires `@typescript-eslint/parser`, `eslint-plugin-jsx-a11y`, and a recent
   `eslint` (it floored ESLint at `>=10` at time of writing). Use the **v4 line of
   `eslint-plugin-tailwindcss`** (Tailwind v4 support). Its flat config API:

   ```js
   import tailwind from 'eslint-plugin-tailwindcss';
   import eslintPluginAstro from 'eslint-plugin-astro';

   export default [
   	tailwind.configs.recommended,            // v4: a single flat-config object (push, don't spread)
   	...eslintPluginAstro.configs.recommended,
   	{
   		settings: {
   			tailwindcss: {
   				// v4 default is src/style.css; point it at THIS project's entry:
   				cssConfigPath: 'src/styles/main.css',
   			},
   		},
   	},
   ];
   ```

   Notes: v4 renamed the old `callees` setting to `functions`; the default `functions`
   list already covers `clsx`/`classNames`/`tv`/`twMerge`, so you usually don't need
   to set it. If the project had a v3 config using `tailwind.configs['flat/recommended']`
   (spread), that key no longer exists in v4.
4. `pnpm install`.

**Gate:** `npx eslint .` exits 0 (peer-warning noise from jsx-a11y wanting an older
ESLint is acceptable as long as eslint actually runs). `pnpm build` succeeds and
emits the un-hashed single `assets/main.css` (establish this **green baseline before
the majors** so any later break is attributable). Commit.

---

## Phase 2 — Astro major upgrade + adopt the Fonts API

Commit: `feat: upgrade Astro + adopt the self-hosted Fonts API`

1. Check the Astro upgrade guide(s) for every major between the current and latest
   version via `find-docs`. For a project like this the realistic blast radius is
   small (no content collections, no view transitions, no experimental flags) — but
   verify, don't assume.
2. Bump `astro` to latest. Also bump `@astrojs/cloudflare` to the version whose peer
   range matches the new Astro (do **not** leave the adapter behind on an
   incompatible major — Phase 4 may remove it entirely, but it must install cleanly
   here first).
3. **Adopt the Fonts API**, replacing runtime Google Fonts. In `astro.config.mjs`
   add a top-level `fonts` array (it graduated from `experimental.fonts` to stable
   top-level `fonts` in Astro 6 — if latest is Astro 6+, use top-level `fonts`;
   the `FontFamily` shape and `fontProviders.google()` are unchanged). Match the
   family/weights/styles you recorded in Phase 0. Example:

   ```js
   import { defineConfig, fontProviders } from 'astro/config';

   export default defineConfig({
   	fonts: [
   		{
   			provider: fontProviders.google(),
   			name: 'Inter',
   			cssVariable: '--font-inter',
   			weights: [400, 500, 600, 700],
   			styles: ['normal'],
   		},
   	],
   	// ...rest unchanged
   });
   ```

   In `Layout.astro`: remove the Google Fonts `<link>` preconnect/stylesheet tags and
   render `<Font cssVariable="--font-inter" preload={[{ weight: '400' }]} />`
   (import `Font` from `astro:assets`) in `<head>`. Wire the CSS tokens in the
   Tailwind `@theme` (e.g. `--font-heading` / `--font-body`) to `var(--font-inter)`
   if they aren't already.

**Gate:** `pnpm build` succeeds; the built `dist` (path depends on adapter —
see Phase 4) contains `assets/main.css` as a single un-hashed file, pages keep flat
`index.html` naming, and the `@font-face` for the family is emitted (fonts copied
into the build). Commit.

---

## Phase 3 — TypeScript major upgrade

Commit: `chore: upgrade TypeScript`

1. Bump `typescript` to latest. Check the TS upgrade notes via `find-docs`.
2. Fix deprecations the new major introduces. The known one from TS 6: **`baseUrl`
   is deprecated (TS5101)**. Remove `baseUrl` from `tsconfig.json`; then the
   non-relative `paths` targets error (**TS5090**) — prefix each target with `./`
   (e.g. `"@components/*": ["./src/components/*"]`). Path aliases resolve relative
   to the `tsconfig.json` location without `baseUrl`.
3. Expect a benign "unsupported TypeScript version" notice from `typescript-eslint` /
   Astro tooling when TS is newer than they officially support — a warning, not a
   failure.

**Gate:** `npx tsc --noEmit` exits 0; `npx eslint .` exits 0; `pnpm build` succeeds.
Commit.

---

## Phase 4 — Deployment: verify static-on-Pages, then go adapter-free

Commit: `fix: drop Cloudflare adapter for flat static Pages deploy`

**Verify first.** Confirm ALL of: `output: 'static'`; no SSR/on-demand features
(from Phase 0); deployment target is **Cloudflare Pages** (git-integrated). If the
project uses SSR or deploys to Workers, **do not remove the adapter** — instead keep
it and set the Pages "Build output directory" to `dist/client` (adapter v14+ splits
output into `dist/client` + `dist/server`); then skip the rest of this phase.

For a confirmed static-on-Pages project, remove the adapter (a static site doesn't
need it; the adapter is what nests output under `dist/client` and breaks Pages):

1. In `astro.config.mjs`: remove the `@astrojs/cloudflare` import and the
   `adapter: cloudflare()` line. Keep `output: 'static'` and the `vite` block.
2. **Switch Tailwind to the Vite plugin** (the recommended Astro + Tailwind v4
   integration; it also fixes a `[postcss] ENOENT ... open '.../tailwindcss'`
   error that the PostCSS plugin throws in Astro's static build):
   - `pnpm add -D @tailwindcss/vite@<latest matching tailwindcss>`
   - In `astro.config.mjs`, `import tailwindcss from '@tailwindcss/vite'` and add
     `tailwindcss()` to `vite.plugins`.
   - Delete `postcss.config.cjs`. Remove `@tailwindcss/postcss` from `package.json`.
3. Remove `@astrojs/cloudflare` from `package.json`. Delete `public/.assetsignore`
   (it only existed to exclude the adapter's `_worker.js`).
4. Add `.wrangler/` to `.gitignore` if present.
5. `pnpm install`.

**Gate:** `pnpm build` produces a **flat `dist/`** — `dist/index.html`,
`dist/assets/main.css`, and any `dist/img/...` at the root (no `client/` wrapper).
`npx tsc --noEmit` and `npx eslint .` exit 0. Commit.

---

## Phase 5 — Final verification

- `pnpm outdated` shows nothing left (or only intentional holds).
- Clean run: `rm -rf dist && pnpm build` ✓, `npx tsc --noEmit` ✓, `npx eslint .` ✓.
- Confirm the flat `dist/` topology and that `dist/assets/main.css` is non-trivial
  (real Tailwind output, e.g. tens of KB), proving the Vite plugin compiled CSS.

---

## Manual follow-ups (report these to the human — you cannot do them)

1. **Cloudflare Pages → project → Settings → Build → "Build output directory" must
   be `dist`** (adapter-free flat build). If it was previously `dist/client`, change
   it back and redeploy.
2. **Push** the branch / open a PR; the Pages build is git-triggered.
3. **Validate the live deploy** — the build/lint/types are verified locally, but the
   actual Cloudflare serving can only be confirmed after a real deploy. Check that
   `/`, `/assets/main.css`, and any images return 200.

---

## Known pitfalls (quick reference)

- **ESLint may be entirely undeclared** in older projects — `npx eslint .` would
  fetch plugins ad-hoc or fail. Declaring them is setup, not a version bump.
- **`eslint-plugin-tailwindcss` v3 doesn't support Tailwind v4** (it reads a
  `tailwind.config.js`). Use v4 and set `cssConfigPath` to the real CSS entry, or
  class validation silently misbehaves.
- **TS `baseUrl` removal cascades**: dropping it forces relative `paths` targets
  (`./src/...`). Only `tsc` flags this — the build can mask it via Vite aliases.
- **Cloudflare adapter v14 splits output into `dist/client`**, which a Pages project
  set to serve `dist` will nest under `/client/` (assets 404). The dashboard "Build
  output directory" setting does **not** override this in the adapter's wrangler-
  redirect deploy flow — removing the adapter (for static sites) is the reliable fix.
- **`@import 'tailwindcss'` fails under the PostCSS plugin in Astro static builds**
  once the adapter is gone — switch to `@tailwindcss/vite`.
- **Don't trust "build succeeded" as "deploy works."** Inspect the `dist` topology
  and validate the live URL after deploy.

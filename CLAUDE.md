# CLAUDE.md

This repo holds the **MIRROR** magazine theme twice. `src/` is an Astro + Tailwind v4 **reference build** of Variant A ("Editorial"), measured against the design sources in `~/Downloads/Mirror Ghost Theme/MIRROR *.dc.html` (ignore every Variant B value there). `ghost/` is the **Ghost theme** ported from it, and it is where most work happens. Read `CONTEXT.md` (the glossary) before naming anything.

## Where things are

- **Ghost theme work** → `ghost/README.md#development`: build/watch commands, the three local Ghosts (:2368 scored install, :2369 Day-one publication, :2370 Demo site) and how to start them (node@22 from `~/ghost-mirror`).
- **Ghost platform behaviour** (helpers, template resolution, Handlebars frames, `{{#get}}`) → `docs/ghost-platform.md`. Look there before reading Ghost's source.
- **Why the theme is the way it is** → `docs/adr/` for decisions, `DECISIONS.md` for the running log (large; grep it, don't read it whole).
- **Proving a refactor didn't change the render** → `pnpm ghost:snapshot <dir>` before and after, then `pnpm ghost:snapshot:diff <a> <b>`.
- **Done** = `pnpm gate` passes. It runs every check and fails up front if a Ghost isn't running. `pnpm gate:static` is the subset the pre-commit hook and CI run.
- **Review** applies `CODING_STANDARDS.md`.

## Reference build (`src/`)

- `pnpm dev` serves it on :4380. Run `pnpm build` (the Cloudflare Pages build) only when asked. The theme's `ghost:*` builds are part of normal work.
- The build output is fixed on purpose: no adapter, flat `dist/`, un-hashed `assets/main.js` / `assets/main.css` (`astro.config.mjs`). Cloudflare Pages serves `dist`. Anything that references those filenames breaks if this changes.
- Tailwind v4 is configured in CSS only, in `src/styles/main.css`, which is also the theme stylesheet's source of truth. Raw colours appear only in its `:root` / `.dark` blocks. `dark:` keys off a `.dark` class. Tailwind is wired through `@tailwindcss/vite`, not PostCSS.
- Fonts are self-hosted woff2 files in `public/fonts/`, declared by hand in `src/styles/fonts.css`. There are exactly two families:
  - **Newsreader**: keep the variable font, with the `wght` and `opsz` axes and the declared weights `300 600`. A static instance renders about 5% wider and breaks every line break.
  - **Archivo**: static instances.
  - Don't add IBM Plex, even though the design references it.

## Conventions

- Commit prefixes: `fix:` `feat:` `style:` `docs:` `refactor:`.
- Never run Prettier on `.hbs`; `.prettierignore` excludes them, so don't pass them explicitly.
- Issues live in **tally** (`tally` CLI), project `gt-mirror`, not GitHub Issues: `docs/agents/issue-tracker.md`. The triage tags are listed in `docs/agents/triage-labels.md`.

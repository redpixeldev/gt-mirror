# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo builds the **MIRROR Ghost theme, Variant A ("Editorial")** as a static Astro site, one page at a time from the design sources in `~/Downloads/Mirror Ghost Theme/MIRROR *.dc.html`. Ignore every Variant B config value in those sources. See `README.md` for how the tokens, fonts, and card components fit together.

`fonts.css` remains a commented-out template (the Fonts API is used instead).

## Commands

```bash
pnpm install      # Install dependencies (Node 24, see .nvmrc)
pnpm dev          # Start dev server at localhost:4380 (server.port in astro.config.mjs)
pnpm build        # Build production site to ./dist/
pnpm preview      # Preview production build locally
npx eslint .      # Lint (no script defined; astro + tailwindcss plugins)
```

Do not run build commands unless explicitly asked.

**Deployment**: Cloudflare Pages (project `astro-starter-9rz`, git-integrated). This is a pure static build with **no Astro adapter** — `pnpm build` emits a flat `dist/` (`index.html`, `assets/`, `img/` at the root), so the Pages **"Build output directory" must be `dist`**. (History: the Cloudflare adapter was used briefly; adapter v14 split output into `dist/client/`, which nested the site under `/client/` on Pages and 404'd assets. Dropping the adapter restored the flat layout — re-add `@astrojs/cloudflare` only if you need SSR/on-demand rendering, and then set the output directory to `dist/client`.)

## Architecture

Astro v7 static site with Tailwind CSS v4 and Alpine.js (loaded from CDN in `Layout.astro`) for client-side interactivity.

```
src/
├── components/     # Reusable Astro components (Header, Footer — currently stubs)
├── layouts/        # Layout.astro — base HTML template, imports main.css + Alpine
├── pages/          # File-based routing (index.astro)
└── styles/
    ├── main.css    # Tailwind entry: @theme vars, @utility + @plugin directives
    └── fonts.css   # @font-face template (add files to public/fonts/)
public/
└── img/            # Static images
```

### Build output (the non-obvious part)

`astro.config.mjs` overrides Astro's defaults to emit flat, predictably-named assets:
- `output: 'static'`, **no adapter** → a flat `dist/` with `index.html`, `assets/`, and `img/` at the root (what Cloudflare Pages serves directly).
- `build.format: 'file'` → pages emit as `page.html` rather than `page/index.html`.
- `entryFileNames: 'assets/main.js'` and `assetFileNames: 'assets/main[extname]'` → all JS/CSS bundle into single un-hashed files at fixed paths. **No cache-busting** — downstream references can rely on `assets/main.js` / `assets/main.css`.
- `compressHTML: false` and `assetsInlineLimit: 0` → HTML left unminified, no asset inlining.

Changing these affects anything that references assets by exact filename — change deliberately.

## Tailwind CSS v4 (CSS-first config)

No `tailwind.config.js`. Everything lives in `src/styles/main.css`:
- `@theme { }` — static tokens: font families (`--font-*: initial` clears Tailwind's defaults first), the MIRROR type scale, tracking, radii, `--measure`, `--wide-out`. Tailwind's built-in font-size line-height pairings are cleared here so leading is always explicit.
- `@theme inline { }` — colour and shadow tokens mapped onto the `--mirror-*` variables defined in `:root`/`.dark`. `inline` is what lets one class on `<html>` repaint the page; those two blocks are the only place raw colour values live.
- `@custom-variant dark` — the `dark:` variant keys off a `.dark` class, not `prefers-color-scheme`.
- `@plugin "@tailwindcss/forms"` uses `strategy: class` so its base reset does not fight the theme's own input styling.
- `@utility name { }` — custom utilities: `container`, `btn`, `btn-primary`.
- `@plugin "..."` — registers `@tailwindcss/typography` and `@tailwindcss/forms`.
- Tailwind is wired via the **Vite plugin** `@tailwindcss/vite` (in `astro.config.mjs` under `vite.plugins`), not the PostCSS plugin — there is no `postcss.config.cjs`. The Vite plugin is the recommended Astro + Tailwind v4 integration and avoids the `@import 'tailwindcss'` resolution failure the PostCSS plugin hits in Astro's static build.
- `[x-cloak]` is hidden in the base layer for Alpine.js.

## Fonts

Uses Astro's **experimental Fonts API** (gated behind `experimental.fonts` in `astro.config.mjs` on Astro 5.x — it graduates to a stable top-level `fonts` config in Astro 6; revisit on upgrade). Fonts are fetched from Google and **self-hosted at build** — no runtime third-party request.

- **Families**: exactly two. **Newsreader** (`--font-newsreader`) — variable, weights `'300 600'`, roman + italic, with the `opsz` axis requested via `options.experimental.variableAxis`; dropping that axis makes Google serve a fixed-optical-size instance that renders ~5% wider than the design source. **Archivo** (`--font-archivo`) — weights `[400, 500, 600, 700]`, `normal` only.
- **Wiring**: `--font-display`/`--font-body` resolve to `var(--font-newsreader)`, `--font-ui`/`--font-meta` to `var(--font-archivo)`, and `--font-mono` is a system stack. Repoint a token to change a role without touching the Astro config. Do **not** add IBM Plex Sans/Mono, even though the design source references them.
- **Render**: a `<Font cssVariable="…" preload={[{ weight: '400' }]} />` per family in `Layout.astro`'s `<head>` emits the `@font-face` styles + a preload hint.
- **Fallbacks**: Astro auto-generates a metric-matched `sans-serif` fallback (optimizedFallbacks on by default) to minimize layout shift.
- `fonts.css` remains an escape hatch for manual `@font-face` (local fonts in `public/fonts/`); it is independent of the Fonts API.

## Code Style

- **Package manager**: pnpm (`packageManager` pinned in package.json)
- **Formatting**: Prettier with `prettier-plugin-astro` + `prettier-plugin-tailwindcss`
- **Indentation**: tabs (2-space width) · **Quotes**: single · one attribute per line · 120-char width
- **TypeScript**: strict mode; path aliases `@components/*`, `@layouts/*`
- ESLint flat config (`eslint.config.js`) recognizes `clsx`, `twMerge`, `tv`, `classNames` as class-name callees

**Commit prefixes**: `fix:` · `feat:` · `style:` · `docs:` · `refactor:`

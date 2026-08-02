# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo builds the **MIRROR Ghost theme, Variant A ("Editorial")** as a static Astro site, one page at a time from the design sources in `~/Downloads/Mirror Ghost Theme/MIRROR *.dc.html`. Ignore every Variant B config value in those sources. See `README.md` for how the tokens, fonts, and card components fit together.

`fonts.css` holds the real `@font-face` rules — fonts are self-hosted from `public/fonts/`.

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
    └── fonts.css   # @font-face for the self-hosted families in public/fonts/
public/
├── fonts/          # Newsreader (variable) + Archivo (static) woff2, committed
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

Fonts are **committed to the repo** as woff2 in `public/fonts/` and declared by hand in `src/styles/fonts.css`. There is no `fonts` block in `astro.config.mjs` and nothing is fetched from Google at build time. (This replaced Astro's Fonts API — see DECISIONS.md.)

- **Families**: exactly two. **Newsreader** (`--font-newsreader`) — the **variable** font, roman + italic, both `wght` and `opsz` axes intact, split into Google's `latin` / `latin-ext` / `vietnamese` subsets with `unicode-range`. Declared `font-weight: 300 600`, which is what the design was built against; the binaries themselves carry `200 800`, so widening that range will change how `font-bold` renders. Never swap in a fixed-optical-size static instance — it renders ~5% wider than the design source and throws every line break off. **Archivo** (`--font-archivo`) — per-weight static instances, 100–900, roman + italic, full charset (not subset).
- **Wiring**: the two family tokens are declared in `main.css`'s `@theme`; `--font-display`/`--font-body` resolve to `var(--font-newsreader)`, `--font-ui`/`--font-meta` to `var(--font-archivo)`, and `--font-mono` is a system stack. Repoint a token to change a role without touching `fonts.css`. Do **not** add IBM Plex Sans/Mono, even though the design source references them.
- **Render**: `fonts.css` is `@import`ed into `main.css` at `layer(base)`. `Layout.astro`'s `<head>` carries two hand-written `<link rel="preload" … crossorigin>` hints for the latin faces — `crossorigin` is mandatory or the file is fetched twice.
- **Fallbacks**: plain `Georgia, serif` / `system-ui, sans-serif`. The metric-matched fallbacks Astro used to generate are gone; `font-display: swap` means a small reflow on first paint.
- **Adding or replacing a file**: drop the woff2 in `public/fonts/` and add its `@font-face` — filenames in `fonts.css` and files on disk are expected to match 1:1 with no orphans either way.

## Code Style

- **Package manager**: pnpm (`packageManager` pinned in package.json)
- **Formatting**: Prettier with `prettier-plugin-astro` + `prettier-plugin-tailwindcss`
- **Indentation**: tabs (2-space width) · **Quotes**: single · one attribute per line · 120-char width
- **TypeScript**: strict mode; path aliases `@components/*`, `@layouts/*`
- ESLint flat config (`eslint.config.js`) recognizes `clsx`, `twMerge`, `tv`, `classNames` as class-name callees

**Commit prefixes**: `fix:` · `feat:` · `style:` · `docs:` · `refactor:`

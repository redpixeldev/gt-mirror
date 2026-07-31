# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a **starter scaffold**, not a finished site. `Header.astro`/`Footer.astro` are placeholder stubs, `fonts.css` is a commented-out template, and `--color-brand-primary` in `main.css` is intentionally blank — fill these in per project.

## Commands

```bash
pnpm install      # Install dependencies (Node 24, see .nvmrc)
pnpm dev          # Start dev server at localhost:4321
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
- `@theme { }` — theme tokens (`--font-heading`, `--font-body`, `--color-brand-primary`). `--font-*: initial` clears Tailwind's default font scale. `--font-heading`/`--font-body` both point at `var(--font-inter)` (see Fonts below).
- `@utility name { }` — custom utilities: `container`, `btn`, `btn-primary`.
- `@plugin "..."` — registers `@tailwindcss/typography` and `@tailwindcss/forms`.
- Tailwind is wired via the **Vite plugin** `@tailwindcss/vite` (in `astro.config.mjs` under `vite.plugins`), not the PostCSS plugin — there is no `postcss.config.cjs`. The Vite plugin is the recommended Astro + Tailwind v4 integration and avoids the `@import 'tailwindcss'` resolution failure the PostCSS plugin hits in Astro's static build.
- `[x-cloak]` is hidden in the base layer for Alpine.js.

## Fonts

Uses Astro's **experimental Fonts API** (gated behind `experimental.fonts` in `astro.config.mjs` on Astro 5.x — it graduates to a stable top-level `fonts` config in Astro 6; revisit on upgrade). Fonts are fetched from Google and **self-hosted at build** — no runtime third-party request.

- **Default family**: Inter, weights `[400, 500, 600, 700]`, `normal` style only. Astro registers it as the `--font-inter` CSS variable.
- **Wiring**: `--font-heading`/`--font-body` in `main.css` resolve to `var(--font-inter)`. Repoint a token to use a different family for that role without touching the Astro config. To add a family, add an entry to `experimental.fonts` and a matching `<Font />` in `Layout.astro`.
- **Render**: `<Font cssVariable="--font-inter" preload={[{ weight: '400' }]} />` in `Layout.astro`'s `<head>` emits the `@font-face` styles + a preload hint for the 400 weight.
- **Fallbacks**: Astro auto-generates a metric-matched `sans-serif` fallback (optimizedFallbacks on by default) to minimize layout shift.
- `fonts.css` remains an escape hatch for manual `@font-face` (local fonts in `public/fonts/`); it is independent of the Fonts API.

## Code Style

- **Package manager**: pnpm (`packageManager` pinned in package.json)
- **Formatting**: Prettier with `prettier-plugin-astro` + `prettier-plugin-tailwindcss`
- **Indentation**: tabs (2-space width) · **Quotes**: single · one attribute per line · 120-char width
- **TypeScript**: strict mode; path aliases `@components/*`, `@layouts/*`
- ESLint flat config (`eslint.config.js`) recognizes `clsx`, `twMerge`, `tv`, `classNames` as class-name callees

**Commit prefixes**: `fix:` · `feat:` · `style:` · `docs:` · `refactor:`

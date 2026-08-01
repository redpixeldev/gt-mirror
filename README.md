# MIRROR — Ghost theme (Astro build)

A static Astro rebuild of the MIRROR Ghost theme, **Variant A ("Editorial")**: Newsreader at display and
body sizes with optical sizing, Archivo for UI/meta, warm stone neutrals and a single burnt-amber accent.

Pages are built one at a time from the design source in `MIRROR *.dc.html`. Shipped so far:

| Route                 | Layout                  | Source file                      |
| :-------------------- | :---------------------- | :------------------------------- |
| `/homepage-01`        | A1 · magazine cover     | `MIRROR Homepage.dc.html`        |
| `/homepage-02`        | A2 · editorial masthead | `MIRROR Homepage.dc.html`        |
| `/blog-01`            | A1 · two-column list    | `MIRROR Blog.dc.html`            |
| `/blog-02`            | A2 · three-column grid  | `MIRROR Blog.dc.html`            |
| `/post-01`            | A1 · centered classic   | `MIRROR Post.dc.html`            |
| `/post-01-paywalled`  | A1, members-only state  | `MIRROR Post.dc.html`            |
| `/post-02`            | A2 · title page + rail  | `MIRROR Post.dc.html`            |
| `/post-02-paywalled`  | A2, members-only state  | `MIRROR Post.dc.html`            |
| `/tags-01`            | A1 · directory list     | `MIRROR Tags.dc.html`            |
| `/tags-02`            | A2 · tag cards          | `MIRROR Tags.dc.html`            |
| `/tags-single-01`     | A1 · lead + list        | `MIRROR Tag Archive.dc.html`     |
| `/tags-single-02`     | A2 · card grid          | `MIRROR Tag Archive.dc.html`     |
| `/authors-01`         | A1 · editorial rows     | `MIRROR Authors.dc.html`         |
| `/authors-02`         | A2 · cover cards        | `MIRROR Authors.dc.html`         |
| `/author-single-01`   | A1 · centered header    | `MIRROR Author.dc.html`          |
| `/author-single-02`   | A2 · sticky rail        | `MIRROR Author.dc.html`          |
| `/recommendations-01` | A1 · editorial list     | `MIRROR Recommendations.dc.html` |
| `/recommendations-02` | A2 · image cards        | `MIRROR Recommendations.dc.html` |
| `/about-01`           | A1 · centered statement | `MIRROR About.dc.html`           |
| `/about-02`           | A2 · split hero         | `MIRROR About.dc.html`           |
| `/membership-01`      | A1 · centered cards     | `MIRROR Membership.dc.html`      |
| `/membership-02`      | A2 · editorial split    | `MIRROR Membership.dc.html`      |
| `/sign-in`            | A · four form states    | `MIRROR Sign In.dc.html`         |
| `/404`                | A1 · centered           | `MIRROR 404.dc.html`             |
| `/404-02`             | A2 · editorial split    | `MIRROR 404.dc.html`             |
| `/styleguide`         | —                       | `MIRROR Styleguide.dc.html`      |

There is deliberately no `index.astro` yet, so `/` has no page of its own — Astro's special
`404.astro` answers it, and every other unmatched path, with the themed not-found page. Astro
reserves that filename for one page, so the second 404 variant lives at `/404-02`; swapping which
variant is the live not-found page is a matter of moving the body between the two files.

Demo content lives in `src/data/`: `posts.ts` holds the homepage's 12 posts plus the shared
`Post` type, tags and authors; `archive.ts` holds the blog's 18; `post.ts`, `tags.ts`, `tagArchive.ts`, `authors.ts`, `authorArchive.ts` `recommendations.ts`, `about.ts` and `membership.ts` hold the
single-post, tag-directory, single-tag-archive, masthead, single-author, recommendations and About content. They are separate on purpose —
the blog source ships six extra posts and tags two shared ones differently, and deriving one
list from the other would bury that. Post photos are the source's Pexels images, downloaded to
`public/img/` and named by their Pexels id — nothing is fetched from a third party at runtime.

## Requirements

- **Node 24** (`.nvmrc`) — `nvm use`
- **pnpm 10** (pinned in `package.json` → `packageManager`). The `pnpm-workspace.yaml` in this repo uses
  pnpm 10 syntax, so pnpm 9 fails with `packages field missing or empty`. If your global pnpm is older,
  run commands through `npx pnpm@10.25.0 …` or `corepack enable`.

## Commands

Run from the repo root:

| Command                                       | Action                                                                                |
| :-------------------------------------------- | :------------------------------------------------------------------------------------ |
| `pnpm install`                                | Install dependencies                                                                  |
| `pnpm dev`                                    | Dev server on **http://localhost:4380** (`pnpm develop` and `pnpm start` are aliases) |
| `pnpm build`                                  | Build the production site to `./dist/`                                                |
| `pnpm preview`                                | Serve the production build locally                                                    |
| `npx eslint .`                                | Lint                                                                                  |
| `npx prettier --write "src/**/*.{astro,css}"` | Format                                                                                |

The port is set in `astro.config.mjs` (`server.port`), so it applies to `dev` and `preview` alike.

Astro 7 runs the dev server as a background daemon: `astro dev status`, `astro dev logs` and
`astro dev stop` manage an already-running instance (a second `pnpm dev` will report the existing one
rather than starting a new server).

**Restart the dev server after adding a page.** Tailwind's Vite plugin does not always pick up a
brand-new file, so utilities that only that page uses (an arbitrary value like
`text-[clamp(36px,4.6vw,60px)]`, say) silently fail to generate and the element falls back to
inherited styling. `pnpm build` scans from scratch, so this is a dev-only trap.

The first `pnpm dev`/`pnpm build` after a clean checkout downloads the fonts from Google and caches
them, so it needs network access once. After that the build is fully offline and self-hosted.

## How the theme is put together

### Design tokens (`src/styles/main.css`)

Variant A's palette is transcribed once into `:root` (light) and `.dark` (dark) as `--mirror-*`
variables — the only place raw colour values appear. Tailwind's `@theme inline` maps those onto
`--color-*` tokens, so `bg-surface`, `text-muted`, `border-border` and friends repaint the whole page
when the `.dark` class flips. Type scale, tracking, radii, shadows, `--measure` and `--wide-out` are
tokens in the same file. Markup never hardcodes a hex value.

Two Tailwind defaults are deliberately overridden to match the source: Preflight's `line-height: 1.5`
on `html` is reset to `normal`, and the built-in font-size utilities have their paired line-heights
cleared — the design declares leading explicitly wherever it wants one.

`html` deliberately does **not** carry Tailwind's `antialiased` utility. Forcing
`-webkit-font-smoothing: antialiased` thins every stem on macOS — measurably so: it cost about 15% of
the ink in a Newsreader headline and roughly a point of pixel-identity on every page. The source
leaves smoothing at the browser default, so this build does too.

### Fonts

Exactly two families, registered through Astro's Fonts API and **self-hosted at build time** (no runtime
Google request):

- **Newsreader** — display + body, variable, weights `300–600`, roman + italic. The `opsz` axis is
  requested explicitly in `astro.config.mjs`; without it Google serves an instance pinned to its default
  optical size that renders ~5% wider than the source and breaks every line.
- **Archivo** — UI, meta, buttons, labels; weights 400/500/600/700.

Mono is a **system stack** (`--font-mono`: `ui-monospace, 'SF Mono', Menlo, monospace`). IBM Plex Mono is
referenced by the design source but intentionally not loaded. Because monospace faces differ a lot in
natural line box (IBM Plex Mono ≈1.31em, SF Mono ≈1.15em), `--leading-mono` pins mono leading so the
vertical rhythm holds whichever monospace font the visitor's OS supplies. Inline `<code>` is exempt — it
inherits the leading of the prose around it, as in the source.

### Dark mode

Light is the default. A `.dark` class on `<html>` is resolved before first paint by an inline script in
`Layout.astro` (stored preference wins, otherwise `prefers-color-scheme`), and the Alpine `theme` store
owns the toggle and its `localStorage` mirror.

### Auth pages

`/sign-in` renders all four form states — default, loading, success, error — as real markup, shown with
Alpine `x-show`. A `FormStateSwitch` control (fixed, bottom-left) flips between them, and
`?state=loading|success|error` opens the page in one directly, which is what the screenshots use. Both
are demo affordances: drop `FormStateSwitch` and the query parsing when wiring the form to Ghost, and
the `data-members-form` / `data-members-email` attributes are already in place for it.

### Interactivity

Alpine.js from CDN (`Layout.astro`) drives the theme toggle and the toggle/disclosure card. Swiper 11 is
an npm dependency, imported and bundled by the carousels (styleguide gallery card, homepage Featured
strip). The source's `prefers-reduced-motion` handling is preserved, including zero-duration Swiper
transitions. Both carousels call `swiper.update()` on `document.fonts.ready` — Swiper caches its width
at init, and the column can narrow once the webfonts land.

## Components

```
src/components/
├── Header.astro          # site nav — variant="site" | "demo" (styleguide specimen)
├── Footer.astro          # site footer, prop-driven columns
├── FooterSlim.astro      # single-row footer for short pages (404, sign-in)
├── NotFoundShell.astro   # full-height column shell shared by the 404 variants
├── ThemeToggle.astro     # fixed light/dark switch
├── Placeholder.astro     # CSS striped placeholder (no image files)
├── cards/                # Ghost Koenig cards, one file each
│   ├── PostCard · AuthorCard · PaginationNav · NewsletterCard
│   ├── PullQuoteCard · CodeCard · ImageCard · BookmarkCard · GalleryCard
│   └── ButtonCard · CalloutCard · ToggleCard · ProductCard
├── blog/                 # archive masthead, tag/sort bar, list row, empty state
├── post/                 # post hero, TOC, body, paywall gate, bio/adjacent, related
├── tags/                 # tag directory (row list A1, card grid A2) and the
│                         #   single-tag archive — header, lead, rows, other tags
├── PostListRow.astro     # compact archive row (tag + author archives)
├── PostGridCard.astro    # 4:3 archive card (tag + author archives)
├── PageIntro.astro       # eyebrow + title + lead (masthead, recommendations)
├── CenteredIntro.astro   # centred hero (about, membership)
├── authors/              # masthead rows/cards, single-author header + rail
├── recommendations/      # recommended-publication row (A1) and card (A2)
├── about/                # split hero, stats grid, editorial body, masthead, contact
├── membership/           # pricing tiers, comparison table, locked posts, quotes, FAQ
├── auth/                 # slim header, centred card shell, sign-in form, state switch
├── home/                 # homepage sections and their post-card variants
└── styleguide/           # one component per numbered styleguide section
```

`post/PostTemplate.astro` holds the whole post; all four post routes are thin wrappers over it.
`layout` picks the head and reading column — `a1` is the centered classic (cover photo, inline
table of contents), `a2` is the title page with a sticky 232px rail. `paywalled` swaps the
article body for the members-only gate and drops the section navigation, which is what the
source does; in a real Ghost theme that switch is made server-side from the reader's access
level. The two layouts also differ in their prev/next links: A1 shows each neighbour's title
and date, A2 shows only the direction (`detail` on `PostEndBlocks`).

The blog's tag filter and sort are real: one Alpine scope on `<main>` holds `tag`/`oldest`, and
both layouts (`/blog-01` list, `/blog-02` grid) read the same scope — only the posts section
differs between them. Rows filter with `x-show`; sorting re-appends the nodes in the new order
(each carries a `data-order`) rather than reordering them in CSS, so the DOM sequence a screen
reader follows always matches what is on screen. Filtering to a tag with no posts reveals the
source's empty state.

The page shell width is a variable, not a prop chain: `container` reads
`--container-max` (1240px by default), and `Layout`'s `contentWidth` prop overrides it —
that is how the homepage runs at 1320px while the header, sections and footer follow
without knowing anything about it.

**Swiper gotcha:** `swiper/css` ships outside any cascade layer, so its `.swiper { padding: 0 }`
beats Tailwind utilities on the carousel element. Put spacing on a wrapper around
`.swiper`, never on `.swiper` itself.

`cards/` maps 1:1 to Ghost's editor card set — this is the markup destined for the Ghost theme, so keep
each card self-contained and prop-driven. Later pages reuse these components via props rather than
copying markup.

## Deployment

Cloudflare Pages, static output, **no adapter** — `pnpm build` emits a flat `dist/` (one `.html` per
page plus `assets/` and `img/` at the root), so the Pages "Build output directory" must be `dist`.
Deploys are run manually; see `wrangler.jsonc` for the project name.

Note that with no `index.astro` the build produces no `dist/index.html`, so a deployed site would 404
at `/`. Add a root page before deploying.

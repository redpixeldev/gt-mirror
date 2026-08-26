# Port plan: MIRROR (Astro) → a real Ghost theme

This repo builds MIRROR **Variant A** as a static Astro site, pixel-scored against the design
source. This plan turns that markup into a shippable Ghost theme in `ghost/`, without giving up
the measurement discipline the Astro build was made with.

Work in **bisectable commits** — one per phase. Each phase has a verification gate; do not start
the next phase until the gate is green. You ARE authorised to run `pnpm install`, the theme build
scripts and the verification harness in this task, even though `CLAUDE.md` says not to build by
default.

Verify every Handlebars helper and config key against current Ghost docs before using it (the
`find-docs` / context7 route). Do not rely on memory for helper signatures.

---

## Decisions locked before writing any code

|   # | Decision                                                                                | Consequence                                                                                             |
| --: | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
|   1 | **Theme lives in `ghost/` in this repo; the Astro build stays**                         | Astro remains the pixel reference; tokens and fonts have one source of truth                            |
|   2 | **Both A1 and A2 layouts ship, switched by `config.custom` selects**                    | ~2× partials; the whole design investment becomes a configurable product                                |
|   3 | **`"engines": { "ghost": ">=5.75.0" }`**, developed against the newest Ghost locally    | Native `{{recommendations}}` and modern tier helpers usable unconditionally                             |
|   4 | **Koenig structure is the contract**                                                    | The card layer becomes CSS on `.kg-*`; the gallery carousel and the code-card chrome are given up       |
|   5 | **Generated seed script creates the full 104-post publication**                         | Every derived count on About / tags / authors matches the design                                        |
|   6 | **Works bare, better with `routes.yaml`**                                               | Templates degrade gracefully with no site config; an optional shipped `routes.yaml` unlocks `/archive/` |
|   7 | **Theme owns the auth pages and every newsletter form; Portal owns checkout**           | `[data-members-form]` everywhere, `data-portal` for paid plans                                          |
|   8 | **Sodo Search; the inline header panel is dropped**                                     | The existing `[data-ghost-search]` hook is the whole integration                                        |
|   9 | **`@custom` appearance default + visitor toggle; accent from `{{@site.accent_color}}`** | Burnt amber ships as the demo site's accent value, not as a constant                                    |
|  10 | **Same acceptance bar as Astro: pixel scores vs the staged design originals**           | `scripts/verify/` is reused unchanged; regressions are numbers                                          |

---

## Assumed starting state

- Astro v7 static build, 27 routes, 13 templates × 2 layouts (`*-01` = A1, `*-02` = A2).
- Tailwind CSS v4, CSS-first: all tokens in `src/styles/main.css` (`@theme`, `@theme inline`,
  `--mirror-*` in `:root` / `.dark`), `@font-face` in `src/styles/fonts.css`.
- 24 woff2 files (1.1 MB) in `public/fonts/`; 25 Pexels JPEGs (4.5 MB) in `public/img/`.
- Demo content hardcoded in `src/data/*.ts`; site chrome in `src/data/navigation.ts`.
- Alpine from CDN, Swiper 11 bundled by npm, search index compiled from `src/data/search.ts`.
- `scripts/verify/` — `prep_originals.py`, `shoot.py`, `score.py`, `smoke.py`, JSON configs.
  Ports recorded in DECISIONS.md: **4393** Astro dev, **4394** staged originals.
- Current bar: 54 route×mode rows in `after-scores.json`, mean pixel identity **97.5 %**,
  worst **90.2 %**.
- `Ghost-CLI 1.28.6` installed; nvm has Node 20/22/24; `.nvmrc` pins 24; no Docker.

If the repo differs materially from this, stop and report before changing anything.

---

## Guardrails

- **Branch first.** `feat/ghost-theme`.
- **Never edit `src/` to suit Ghost.** The Astro build is the reference; it does not move. The one
  permitted exception is factoring `src/styles/main.css` so the Ghost entry can `@import` it.
- **One source of truth per fact.** Tokens: `src/styles/main.css`. Demo content: `src/data/*.ts`.
  If Ghost needs a value, it comes from Ghost's own data or from a seed generated out of `src/data`.
- **No `pnpm build` of the theme into git.** `ghost/assets/built/` is generated and gitignored;
  the zip is a release artifact.
- **Do not exclude `toggle` from `card_assets`** — the toggle card's JS is Ghost's, and the
  Alpine implementation is not being ported.
- **`routes.yaml` cannot ship inside a theme zip.** It is site config. Any template that needs it
  must still render correctly without it.
- Ask before deleting anything under `src/` or `scripts/verify/`.

---

## Target structure

```
ghost/
├── package.json                  # name, engines, config.{posts_per_page,image_sizes,card_assets,custom}
├── default.hbs                   # <head>, accent var, appearance pre-paint script, ghost_head/foot
├── home.hbs                      # / page 1 — A1 magazine cover | A2 editorial masthead
├── index.hbs                     # paginated feed — A1 two-column list | A2 three-column grid
├── post.hbs                      # A1 centered classic | A2 title page + rail; {{#unless access}} gate
├── page.hbs                      # generic Ghost page
├── page-tags.hbs                 # tag directory — A1 rows | A2 cards
├── page-authors.hbs              # masthead — A1 editorial rows | A2 cover cards
├── page-about.hbs
├── page-membership.hbs
├── page-recommendations.hbs
├── page-sign-in.hbs              # NOT page-signin.hbs — /signin/ is a reserved Ghost route
├── page-sign-up.hbs
├── tag.hbs                       # single tag archive — A1 lead + list | A2 card grid
├── author.hbs                    # single author — A1 centered header | A2 sticky rail
├── error.hbs
├── error-404.hbs                 # A1 centered | A2 editorial split
├── partials/
│   ├── header.hbs · header-compact.hbs · nav.hbs · logo.hbs · theme-toggle.hbs
│   ├── footer.hbs · footer-slim.hbs
│   ├── pagination.hbs            # overrides {{pagination}}
│   ├── recommendations.hbs       # overrides the {{recommendations}} default template
│   ├── newsletter.hbs            # inline [data-members-form]
│   ├── home/{a1,a2}.hbs · home/{lead,featured,latest,writers}.hbs
│   ├── cards/{post-card,grid-card,list-row,compact-card,numbered-row}.hbs
│   ├── post/{hero,title-page,toc,paywall,share,rail,related,end-blocks}.hbs
│   ├── blog/{filter-bar,empty-state}.hbs
│   ├── tags/{directory-row,tag-card,lead}.hbs
│   ├── authors/{row,cover-card,profile-header,rail}.hbs
│   ├── membership/{tiers,comparison,faq,quotes,locked-posts}.hbs
│   ├── about/{split-hero,stats,masthead,contact}.hbs
│   └── auth/{shell,sign-in-form,sign-up-form,upgrade}.hbs
├── assets/
│   ├── css/screen.css            # entry: @import shared tokens + @source hbs + .kg-* layer
│   ├── js/main.js                # Alpine, Swiper (featured carousel), theme store, TOC spy
│   ├── fonts/*.woff2             # copied from public/fonts (24 files, 1.1 MB)
│   ├── built/{screen.css,main.js}   # generated, gitignored
│   └── screenshot-desktop.jpg · screenshot-mobile.jpg
├── routes.yaml                   # optional site config, documented — not loaded from the theme
└── README.md                     # buyer-facing install + settings guide
```

Theme zip stays ~1.5 MB: fonts travel with the theme, the 4.5 MB of Pexels JPEGs do not — the seed
script uploads those into Ghost's content directory.

---

## Surface map

| Astro route(s)                               | Ghost template                                              | Variant switch             |
| :------------------------------------------- | :---------------------------------------------------------- | :------------------------- |
| `/homepage-01`, `/homepage-02`               | `home.hbs`                                                  | `@custom.homepage_layout`  |
| `/blog-01`, `/blog-02`                       | `index.hbs` (and `/archive/` with `routes.yaml`)            | `@custom.feed_layout`      |
| `/post-01`, `/post-02`                       | `post.hbs`                                                  | `@custom.post_layout`      |
| `/post-01-paywalled`, `/post-02-paywalled`   | `post.hbs` + `{{#unless access}}`                           | none — server-side         |
| `/tags-01`, `/tags-02`                       | `page-tags.hbs`                                             | `@custom.directory_layout` |
| `/tags-single-01`, `/tags-single-02`         | `tag.hbs`                                                   | `@custom.feed_layout`      |
| `/authors-01`, `/authors-02`                 | `page-authors.hbs`                                          | `@custom.directory_layout` |
| `/author-single-01`, `/author-single-02`     | `author.hbs`                                                | `@custom.feed_layout`      |
| `/recommendations-01`, `/recommendations-02` | `page-recommendations.hbs` + `partials/recommendations.hbs` | `@custom.directory_layout` |
| `/about-01`, `/about-02`                     | `page-about.hbs`                                            | `@custom.page_hero`        |
| `/membership-01`, `/membership-02`           | `page-membership.hbs`                                       | `@custom.page_hero`        |
| `/sign-in`, `/sign-up`                       | `page-sign-in.hbs`, `page-sign-up.hbs`                      | none                       |
| `/404`, `/404-02`                            | `error-404.hbs`                                             | `@custom.page_hero`        |
| `/styleguide`                                | **not a template** — a Koenig-authored kitchen-sink page    | —                          |

`27 routes → 15 templates + 9 custom settings.`

---

## Custom settings (9 of the 20 allowed)

```json
"config": {
  "posts_per_page": 18,
  "image_sizes": {
    "xs": { "width": 100 },
    "s":  { "width": 300 },
    "m":  { "width": 600 },
    "l":  { "width": 1000 },
    "xl": { "width": 1600 },
    "xxl":{ "width": 2400 }
  },
  "card_assets": { "exclude": ["bookmark", "product", "button", "callout"] },
  "custom": {
    "homepage_layout":     { "type": "select", "options": ["Magazine cover", "Editorial masthead"], "default": "Magazine cover", "group": "homepage" },
    "feed_layout":         { "type": "select", "options": ["Two-column list", "Three-column grid"], "default": "Two-column list", "description": "Layout for the post feed, tag archives and author archives" },
    "post_layout":        { "type": "select", "options": ["Centered classic", "Title page with rail"], "default": "Centered classic", "group": "post" },
    "directory_layout":   { "type": "select", "options": ["Editorial rows", "Cover cards"], "default": "Editorial rows", "description": "Layout for the tag, author and recommendation directories" },
    "page_hero":          { "type": "select", "options": ["Centered statement", "Split hero"], "default": "Centered statement" },
    "default_appearance": { "type": "select", "options": ["Light", "Dark", "System"], "default": "Light" },
    "featured_tier":      { "type": "text", "default": "Pro", "description": "Tier name that carries the accent panel and \"Most popular\" chip" },
    "newsletter_title":   { "type": "text", "default": "One considered essay, every Thursday", "group": "post" },
    "newsletter_text":    { "type": "text", "default": "Free members get the archive. Paid members get the interviews." }
  }
}
```

`card_assets` excludes only cards whose default CSS is fully replaced by the theme's `.kg-*` layer;
`toggle` and `gallery` keep Ghost's assets because their behaviour is Ghost's JS.

`posts_per_page: 18` matches the archive length in the design (`src/data/archive.ts` holds 18);
with 104 seeded posts that is 6 pages, enough to exercise pagination properly.

---

## Data map

Native, no work beyond the helper call:

| Astro field                                      | Ghost source                                                                                                               |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------- |
| `title`, `excerpt`, `img`/`alt`, `date`          | `{{title}}`, `{{excerpt}}`, `{{img_url feature_image size="m"}}` / `{{feature_image_alt}}`, `{{date format="D MMM YYYY"}}` |
| `read` (`"7 min read"`)                          | `{{reading_time}}` — computed from word count + images                                                                     |
| `tag` (single)                                   | `{{primary_tag.name}}` / `{{primary_tag.url}}`                                                                             |
| `visibility` (`public`/`members`/`paid`)         | `{{#has visibility="paid"}}`, and `access` for the gate                                                                    |
| `featured`                                       | `{{#get "posts" filter="featured:true"}}`                                                                                  |
| `TagEntry.count`                                 | `{{count.posts}}` — requires `include="count.posts"` on `{{#get "tags"}}`                                                  |
| `TagEntry.img`, `.description`                   | tag `feature_image`, `description`                                                                                         |
| `Author.bio`, `.location`, `.website`, `.social` | `{{bio}}`, `{{location}}`, `{{website}}`, `{{twitter}}`                                                                    |
| `Author.count`                                   | `{{count.posts}}` on `{{#get "authors"}}`                                                                                  |
| `Author.latest`                                  | `{{#get "posts" filter="authors:{{slug}}" limit="1"}}`                                                                     |
| `Tier.*`                                         | `{{#get "tiers" include="monthly_price,yearly_price,benefits"}}`                                                           |
| `Recommendation.*`                               | `{{recommendations}}` + `partials/recommendations.hbs` (`rec.title/url/description/favicon/featured_image`)                |
| `STATS` posts/writers/subjects                   | `{{#get "posts" limit="1" as                                                                                               | p pages | }}{{pages.total}}`, same for `"authors"`/`"tags"` |
| `STATS` "Publishing since"                       | `{{#get "posts" order="published_at asc" limit="1"}}{{date published_at format="YYYY"}}`                                   |

Gaps, with their resolutions:

| Astro field                                                               | Problem                                                                                  | Resolution                                                                                                                                                                          |
| :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initials` (`"EL"`)                                                       | Ghost has no string-slicing helper; two-letter monograms are not derivable in Handlebars | Seed every demo author with a `profile_image` so the fallback is cosmetic; fallback renders a **single**-letter monogram by clipping `{{name}}` to `1ch`. Recorded as a concession. |
| `Author.role` (`"Founding editor"`)                                       | Not a Ghost author field                                                                 | Masthead shows `{{location}}` + `{{count.posts}}`; the role list on About becomes Koenig page content                                                                               |
| `Tier.featured`                                                           | Ghost tiers have no "most popular" flag                                                  | `{{#match name @custom.featured_tier}}`                                                                                                                                             |
| FAQ accordion, comparison table, member quotes, contact email, About body | Bespoke Astro components with hardcoded copy                                             | Koenig page content (`toggle`, `table`, `blockquote` cards) styled by the `.kg-*` layer                                                                                             |
| Membership "locked posts" strip                                           | —                                                                                        | `{{#get "posts" filter="visibility:-public" limit="3"}}`                                                                                                                            |
| `PostToc` / `PostTocSpy`                                                  | Astro builds the TOC from data; Ghost only has rendered `{{content}}`                    | Derive in `main.js` from `h2`/`h3` in the content root, then the existing scroll-spy logic ports unchanged                                                                          |
| `SEARCH_INDEX`                                                            | —                                                                                        | Deleted. Sodo Search binds `[data-ghost-search]`                                                                                                                                    |
| `NAV`, `SITE_TITLE`, footer columns                                       | —                                                                                        | `{{navigation}}`, `{{navigation type="secondary"}}`, `{{@site.title}}`, `{{@site.description}}`; the nav dropdown variant-browser is dropped                                        |

---

## Phase 0 — Recon and a local Ghost (no theme code)

Commit: `chore: local ghost install for theme development`

1. `nvm use 24`; `ghost install local -d ~/ghost-mirror` (SQLite, no Docker). Record the installed
   Ghost version — it must satisfy `>=5.75.0`.
2. `npm i -g gscan`.
3. `mkdir -p ghost` and symlink it in: `ln -s "$PWD/ghost" ~/ghost-mirror/content/themes/mirror`.
4. Choose and record the third verification port. Ghost's default is **2368**; DECISIONS.md already
   owns 4393 (Astro dev) and 4394 (staged originals). Add the Ghost port to that section.
5. Confirm the design originals still stage: `pnpm verify:prep`, serve on 4394.
6. Verify against current docs, and write the answers into this plan before Phase 1:
   `{{#get}}` block-param pagination, `page-{slug}.hbs` resolution order, `access` in post context,
   `data-portal` attribute form, whether `/signin/` and `/signup/` are reserved routes.

**Gate:** Ghost admin answers on its port, `gscan --version` runs, `.originals` serves, and
`ghost/` is visible in Ghost admin's theme list (it will fail validation — that is expected).

---

## Phase 1 — Theme skeleton and the asset pipeline

Commit: `feat: ghost theme skeleton with shared-token asset pipeline`

1. `ghost/package.json` — name `mirror`, `engines.ghost >=5.75.0`, the full `config` block above.
2. Minimum valid template set so the theme activates: `default.hbs`, `index.hbs`, `post.hbs`,
   `page.hbs`, `error.hbs`. Real markup comes later; these carry `{{ghost_head}}`, `{{ghost_foot}}`,
   `{{body_class}}`, `{{asset}}` links, `{{#foreach posts}}`, `{{content}}`.
3. Factor `src/styles/main.css` only as far as needed so it can be imported without Astro-specific
   assumptions. Create `ghost/assets/css/screen.css`:

   ```css
   @import '../../../src/styles/main.css';
   @source '../../**/*.hbs';
   /* .kg-* card layer lands here in Phase 5 */
   ```

4. Copy `public/fonts/*.woff2` → `ghost/assets/fonts/`. Fix the `@font-face` URLs for the built
   CSS location (`../fonts/…` relative to `assets/built/screen.css`). Fonts in CSS cannot use
   `{{asset}}`; relative paths are correct and cache-busting comes from the stylesheet's own hash.
5. `ghost/assets/js/main.js` — import Alpine and Swiper from npm (self-hosted, **no CDN**), port the
   pre-paint theme resolver and the Alpine `theme` store out of `Layout.astro`.
6. Root `package.json` scripts:

   ```json
   "ghost:css":  "tailwindcss -i ghost/assets/css/screen.css -o ghost/assets/built/screen.css --minify",
   "ghost:js":   "esbuild ghost/assets/js/main.js --bundle --minify --outfile=ghost/assets/built/main.js",
   "ghost:dev":  "concurrently \"pnpm ghost:css --watch\" \"pnpm ghost:js --watch\"",
   "ghost:build":"pnpm ghost:css && pnpm ghost:js",
   "ghost:scan": "gscan ghost/",
   "ghost:zip":  "pnpm ghost:build && pnpm ghost:scan && zip -r dist/mirror.zip ghost -x '*.DS_Store' -x 'ghost/assets/css/*' -x 'ghost/assets/js/*'"
   ```

7. `.gitignore`: `ghost/assets/built/`, `dist/mirror.zip`, `.shots/`.

**Gate:** `pnpm ghost:build` emits a non-trivial `screen.css` (tens of KB — proof Tailwind scanned
the `.hbs` files) and `main.js`; `pnpm ghost:scan` reports **0 errors**; the theme activates in Ghost
admin; the front page renders with MIRROR fonts and token colours in both light and dark.

---

## Phase 2 — Seed the demo publication

Commit: `feat: ghost demo content seed generated from src/data`

1. `scripts/ghost/seed.mjs` — reads `src/data/*.ts` (import directly with a TS loader, or via a tiny
   build step; do **not** re-transcribe the data) and drives the Admin API:
   - 5 staff users from `authors.ts`, each with `bio`, `location`, `website`, `twitter` and a
     `profile_image` uploaded from `public/img/`.
   - 14 tags from `tags.ts` with `description` and `feature_image`.
   - 104 posts: the ~35 designed posts get their real titles/excerpts/images/dates/tags/authors and
     bodies long enough to reproduce the design's reading times; the remaining ~69 are generated
     filler whose only job is to make each author's and tag's `count.posts` match the design
     (authors `34/27/19/14/10`, tags summing 173).
   - Bodies posted as `POST /posts/?source=html` so Ghost converts HTML → Lexical.
   - `visibility` set from each post's `Visibility`, so `{{#unless access}}` has something to gate.
   - Pages created with the exact slugs the templates key off: `tags`, `authors`, `about`,
     `membership`, `recommendations`, `sign-in`, `sign-up`, `styleguide`.
   - Site settings: title, description, accent colour (the design's amber), logo/icon, navigation
     from `navigation.ts`, three tiers matching `membership.ts`, recommendations from
     `recommendations.ts`.
2. Idempotent: re-running updates rather than duplicating. Keep the Admin API key out of git
   (`.env`, gitignored).
3. Write the resulting Ghost export JSON to `scripts/ghost/fixture.json` so a fresh install can be
   restored without API access — this doubles as the buyer-facing demo content.

**Gate:** `{{pagination.total}}` on the feed reads **104**; each author page shows its designed post
count; each tag in the directory shows its designed count; the 35 designed posts' `{{reading_time}}`
is within ±1 minute of the design labels; every seeded page URL answers 200 via
`smoke.py --base http://localhost:2368`.

---

## Phase 3 — Chrome: `default.hbs`, header, footer

Commit: `feat: ghost site chrome — head, header, footer, appearance`

1. `default.hbs`: `<head>` with `{{meta_title}}`, `{{ghost_head}}`, `{{asset "built/screen.css"}}`,
   the two font preloads (keep `crossorigin`), the accent binding and the pre-paint appearance
   script:

   ```handlebars
   <style>
   	:root { --mirror-accent:{{@site.accent_color}}}
   </style>
   <script>/* @custom.default_appearance seeds it; localStorage wins */</script>
   ```

2. `partials/header.hbs` (+ compact variant) — `{{navigation}}`, `partials/logo.hbs` from
   `@site.logo` with the dark-ink asset swapped by the `.dark` class, `partials/theme-toggle.hbs`,
   and the search button keeping `data-ghost-search`. Bar order stays **search · mode · subscribe**.
   The nav-dropdown variant browser is not ported.
3. `partials/footer.hbs` + `footer-slim.hbs` — columns from `{{navigation type="secondary"}}`,
   wordmark and © from `{{@site.title}}`.
4. Drop `HeaderSearch`'s index and panel; keep only what Sodo needs.

**Gate:** `pnpm ghost:scan` still 0 errors; the header and footer of one route score within
**0.5** of the corresponding Astro row in `after-scores.json`, light and dark, using
`score.py --skip-header` to isolate body from chrome; the toggle survives a reload; no
flash-of-light on a dark-default load.

---

## Phase 4 — Feeds: `home.hbs` and `index.hbs`

Commit: `feat: ghost home and feed templates, both layouts`

1. `home.hbs` dispatches on `@custom.homepage_layout` to `partials/home/a1.hbs` / `a2.hbs`.
   The design's slices become `{{#get}}` blocks: lead, featured strip (`filter="featured:true"`),
   big + three mediums + seven grid cards. Exclude already-shown posts with `filter="id:-{{id}}"`
   chains so no post appears twice.
2. `index.hbs` dispatches on `@custom.feed_layout` (two-column list / three-column grid) and uses
   native `{{pagination}}` overridden by `partials/pagination.hbs` — placed directly below the list
   and above the newsletter block, as in the Astro build.
3. `partials/newsletter.hbs` — inline `[data-members-form]` with `[data-members-error]`; states
   styled off `.loading` / `.success` / `.error`. Copy from `@custom.newsletter_title` /
   `newsletter_text`.
4. Featured carousel keeps Swiper (template markup, not Koenig), including the
   `prefers-reduced-motion` handling and the `document.fonts.ready` → `swiper.update()` call.
5. The blog tag-filter/sort bar: port the Alpine scope; the `?tag=` demo hook is not ported.

**Gate:** four combinations (2 layouts × light/dark) scored for home, four for the feed; no row
below its `floor` in `baseline-scores.json`; pagination walks to page 6 and back; a real signup
through the newsletter form creates a member in the local Ghost.

---

## Phase 5 — `post.hbs` and the `.kg-*` card layer

Commit: `feat: ghost post template and koenig card styling`

1. `post.hbs` dispatches on `@custom.post_layout`: A1 centered classic with inline TOC, A2 title
   page with the sticky 232 px rail.
2. Paywall: `{{content}}` then `{{#unless access}}{{> "post/paywall"}}{{/unless}}`; the gate drops
   the section navigation exactly as the Astro `paywalled` variant does. The two `*-paywalled`
   routes disappear.
3. Prev/next via `{{#prev_post}}` / `{{#next_post}}` — A1 shows title + date, A2 direction only.
   Related reading via `{{#get "posts" filter="primary_tag:{{primary_tag.slug}}+id:-{{id}}"}}`.
4. TOC built in `main.js` from the content root's `h2`/`h3`; port the existing scroll-spy.
5. **The card layer.** Rewrite `src/components/cards/*.astro` as CSS on Ghost's real classes in
   `ghost/assets/css/screen.css`: `.kg-callout-card` / `.kg-callout-emoji` / `.kg-callout-text`,
   `.kg-bookmark-card`, `.kg-button-card` + `.kg-btn`, `.kg-product-card`, `.kg-toggle-card`
   (`[data-kg-toggle-state]`, Ghost's JS), `.kg-gallery-card` (grid), `blockquote.kg-blockquote-alt`
   for the pull quote, `.kg-signup-card`, `pre code[class*="language-"]`, `figure.kg-image-card`
   with `.kg-width-wide` / `.kg-width-full` mapped onto `--wide-out`.
6. Concessions to record in DECISIONS.md: the gallery card is a grid, not a Swiper carousel; the
   code card has no language/action chrome, because Koenig emits no node to hang either on.

**Gate:** post A1/A2 × light/dark scored, plus both paywalled states; the Koenig styleguide page
renders every card styled with no unstyled `.kg-*` block; `gscan` 0 errors; TOC highlights the right
heading while scrolling both layouts.

---

## Phase 6 — Archives and directories

Commit: `feat: ghost tag, author and directory templates`

1. `tag.hbs` — A1 lead article + list, A2 card grid; header from `{{#tag}}` (`name`, `description`,
   `feature_image`, `count.posts`); "other tags" strip via `{{#get "tags" limit="8"}}`.
2. `author.hbs` — A1 centered header, A2 sticky rail; both feeds obey `@custom.feed_layout`.
3. `page-tags.hbs` / `page-authors.hbs` — `{{#get "tags" include="count.posts" limit="all"}}` and
   the equivalent for authors, dispatching on `@custom.directory_layout`.
4. `page-recommendations.hbs` + `partials/recommendations.hbs` overriding the default template;
   wrap in `{{#match @site.recommendations_enabled}}` so the page degrades when the feature is off.

**Gate:** eight combinations scored (tag, author × 2 layouts × 2 modes) plus the three directories;
`{{count.posts}}` matches the design on every tag and author; an author with no posts and a tag with
no posts both render the empty state rather than breaking.

---

## Phase 7 — Pages, members and errors

Commit: `feat: ghost about, membership, auth and error templates`

1. `page-about.hbs` — `@custom.page_hero` picks centered statement vs split hero; stats derived from
   `{{#get}}` block-param totals; body and contact block from `{{content}}`.
2. `page-membership.hbs` — tiers from `{{#get "tiers" include="monthly_price,yearly_price,benefits"}}`
   with `data-portal="signup/{{id}}/monthly|yearly"`; "Most popular" from
   `{{#match name @custom.featured_tier}}`; comparison table and FAQ from `{{content}}`; locked posts
   from `{{#get "posts" filter="visibility:-public" limit="3"}}`.
3. `page-sign-in.hbs` / `page-sign-up.hbs` — the designed cards on `[data-members-form]`; the four
   states become `form.loading`, `form.success`, `form.error` selectors plus `[data-members-error]`.
   `FormStateSwitch` and `?state=` are not ported; a `dev`-only class toggle is enough for
   screenshots.
4. `error-404.hbs` (A1/A2 via `@custom.page_hero`) and a generic `error.hbs`.

**Gate:** every page scored light and dark; a real magic-link sign-in and a real free signup both
complete against the local Ghost; the error states render with Ghost's own message text; visiting a
missing URL renders the themed 404.

---

## Phase 8 — Settings matrix, `routes.yaml`, bare-install behaviour

Commit: `feat: ghost custom settings, optional routes.yaml, graceful defaults`

1. Wire every `@custom` value through its templates; confirm each select flips the whole surface.
2. Ship `ghost/routes.yaml` (documented in `ghost/README.md`, **not** in the zip's active path):

   ```yaml
   routes:
     /: home
   collections:
     /archive/:
       permalink: /{slug}/
       template: index
   ```

3. Prove the bare install: fresh Ghost, theme uploaded, **no** pages created and **no**
   `routes.yaml`. Nothing may 500; `/` must render the magazine cover; missing pages simply have no
   URL.
4. Prove the configured install: pages present, `routes.yaml` uploaded — `/archive/` paginates and
   `/` keeps the cover.

**Gate:** `smoke.py` green in both configurations; all 2⁵ layout-select combinations render without
a Handlebars error (script the sweep against the Admin API's settings endpoint); `gscan` 0 errors and
0 warnings.

---

## Phase 9 — Release

Commit: `feat: ghost theme release artifacts and measured scores`

1. `assets/screenshot-desktop.jpg` (1200×800) and `screenshot-mobile.jpg` (600×1200) captured with
   `shoot.py`.
2. `ghost/README.md` — install, required pages and their slugs, optional `routes.yaml`, every custom
   setting, the demo-content fixture.
3. Full score run over all 15 templates × layouts × modes; write the table into DECISIONS.md beside
   the Astro numbers, with the concessions (gallery grid, code chrome, single-letter monogram, Sodo
   overlay, dropped nav variant browser) recorded as deliberate.
4. `pnpm ghost:zip` → `dist/mirror.zip`; `gscan -z dist/mirror.zip` clean; upload to a clean Ghost
   and activate.

**Gate:** `gscan -z` 0 errors 0 warnings; the zip activates on a fresh Ghost with no manual fixes;
mean pixel identity within **1 point** of the Astro build's 97.5 %, with no template below 90 %.

---

## Known pitfalls

- **`/signin/` and `/signup/` are Ghost's own Portal routes.** Use page slugs `sign-in` / `sign-up`
  and templates `page-sign-in.hbs` / `page-sign-up.hbs`.
- **Collections must be unique.** A post cannot live in two collections, so there is no way to have
  both `/` and `/archive/` own the same posts — that is exactly why `/` is a `route:` and
  `/archive/` the collection.
- **`routes.yaml` never ships in a theme.** Any template that assumes it will break on install.
- **`{{#get}}` blocks repeat posts.** The homepage slices must exclude earlier picks with
  `filter="id:-{{id}}"`, or the lead story appears three times.
- **`{{count.posts}}` needs `include="count.posts"`.** Without it the count silently renders empty.
- **Tailwind v4 will not see new `.hbs` files** without the `@source` glob, and the same
  brand-new-file trap the Astro build has applies: restart the watcher after adding a template.
- **Do not exclude `toggle` or `gallery` from `card_assets`** — their JS is Ghost's.
- **`{{reading_time}}` is computed.** Seeded bodies must be the right length or the design's
  "12 min read" becomes "3 min read".
- **`@site.accent_color` can fail AA** against the stone neutrals. Ship amber as the demo value and
  say so in `ghost/README.md`; do not add surface-colour settings.
- **Sodo Search double-binding.** With the inline panel gone, nothing else may bind
  `[data-ghost-search]`.
- **Headless Chrome will not open a window under ~500 px** — narrow widths must go through a probe
  page, never a direct capture (the Astro build's `probe-mobile.html` is the pattern; it is a demo
  affordance and is not ported).
- **`gscan` warnings are release blockers**, not advisories: the Ghost marketplace rejects them.

---

## Manual follow-ups (cannot be done from the repo)

1. Create the eight demo pages with their exact slugs, or run the seed script with an Admin API key.
2. Upload `routes.yaml` in Ghost admin → Settings → Labs, if the `/archive/` split is wanted.
3. Configure Stripe on the demo site so the tier `data-portal` links can be clicked through.
4. Enable Recommendations in Ghost admin and add the five publications (or let the seed do it).
5. Decide whether the theme is listed on the Ghost marketplace — that adds their own review checklist
   on top of `gscan`.
6. Optional: `locales/en.json` + `{{t}}` for translation support, if the theme is sold
   internationally.

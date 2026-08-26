# Port plan: MIRROR (Astro) → a real Ghost theme

This repo builds MIRROR **Variant A** as a static Astro site, pixel-scored against the design
source. This plan turns that markup into a shippable Ghost theme in `ghost/`, without giving up
the measurement discipline the Astro build was made with.

Work in **bisectable commits** — one per phase. Each phase has a verification gate; do not start
the next phase until the gate is green. You ARE authorised to run `pnpm install`, the theme build
scripts and the verification harness in this task, even though `CLAUDE.md` says not to build by
default.

Verify every Handlebars helper and config key against current Ghost docs before using it (the
`find-docs` / context7 route). Do not rely on memory for helper signatures. Where this plan cites
Ghost behaviour it names the source file — `ghost/core/core/frontend/...` paths are in the
`TryGhost/Ghost` monorepo, verified against **6.61.0**; theme patterns are cited from
**Source 1.7.2** (`TryGhost/source`), Ghost's own reference theme.

---

## Decisions locked before writing any code

|   # | Decision                                                                                                            | Consequence                                                                                                                                                                                                                                                                                                                                       |
| --: | :------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   1 | **Theme lives in `ghost/` in this repo; the Astro build stays**                                                      | Astro remains the pixel reference; tokens and fonts have one source of truth                                                                                                                                                                                                                                                                       |
|   2 | **Both A1 and A2 layouts ship, switched by `config.custom` selects**                                                 | ~2× partials; the whole design investment becomes a configurable product                                                                                                                                                                                                                                                                           |
|   3 | **`"engines": { "ghost": ">=6.0.0", "node": ">=22.12.0" }`**, developed against 6.61                                 | Every helper used is verified on the runtime that is declared. Ghost 5 and 6 diverge on query limits (`limit="all"` uncapped on 5, capped at 100 on 6 — `core/shared/max-limit-cap.js`), so `>=5.75.0` would assert untested behaviour. Widening to `>=5.75.0` is allowed **only** if Phase 9 adds a second local Ghost 5 install and re-smokes it |
|   4 | **Koenig structure is the contract**                                                                                 | The card layer becomes CSS on `.kg-*`, scoped so it wins regardless of `card_assets`; the gallery carousel and the code-card chrome are given up                                                                                                                                                                                                    |
|   5 | **Generated fixture creates the full 104-post publication; the Admin API only applies it**                            | Every derived count on About / tags / authors matches the design, deterministically and offline                                                                                                                                                                                                                                                    |
|   6 | **Works bare, better with `routes.yaml`**                                                                            | Templates degrade gracefully with no site config; a documented `docs/routes.example.yaml` unlocks `/archive/`                                                                                                                                                                                                                                       |
|   7 | **Theme owns the auth pages and every newsletter form; Portal owns checkout; every members surface is state-aware**    | `[data-members-form]` + `[data-members-email]` everywhere, `data-portal` for paid plans, and no members markup renders unguarded: `@site.members_enabled`, `@site.members_invite_only`, `@site.paid_members_enabled` and `@member` gate all of it                                                                                                    |
|   8 | **Sodo Search; the inline header panel is dropped**                                                                  | The existing `[data-ghost-search]` hook is the whole integration                                                                                                                                                                                                                                                                                   |
|   9 | **`@custom` appearance default + visitor toggle; accent from `{{@site.accent_color}}`**                               | Burnt amber ships as the demo site's accent value, not as a constant                                                                                                                                                                                                                                                                               |
|  10 | **Two-axis acceptance: parity vs the Astro build, identity vs the staged originals**                                  | `scripts/verify/` is reused unchanged. **Parity** (Ghost vs Astro — same design, same content after Phase 2) isolates port defects and targets ≥99. **Identity** (Ghost vs design originals) is the absolute bar, read against the matching Astro row. One number cannot separate "the rail is 8px off" from "the date string differs"; two can    |
|  11 | **Every page layout ships twice: `page-{slug}.hbs` and `custom-{name}.hbs`**                                          | The five designed page layouts stop being hostage to five hardcoded slugs — a buyer applies any of them to any page from the settings menu                                                                                                                                                                                                          |
|  12 | **`locales/en.json` + `{{t}}` from the first partial written**                                                        | Source wraps every UI string; retrofitting means re-touching and re-scoring ~45 partials                                                                                                                                                                                                                                                            |
|  13 | **Native `{{comments}}` ships**                                                                                      | The design source has no comments section, but a Ghost theme without them reads unfinished. One helper call; one recorded concession (colour scheme is fixed at render time)                                                                                                                                                                        |
|  14 | **Swiper is dropped; the featured strip is CSS scroll-snap**                                                          | After decision 4 gives up the gallery carousel, Swiper's only consumer is one strip using only its `A11y` module. Native snap is keyboard/touch-accessible, needs no `fonts.ready` re-measure, and removes a dependency                                                                                                                             |

---

## Assumed starting state

Every figure below was measured in this repo, not assumed.

- Astro v7 static build, **27** routes in `src/pages/`, 13 templates × 2 layouts (`*-01` = A1,
  `*-02` = A2), plus `sign-in`, `sign-up`, `styleguide`.
- Tailwind CSS v4, CSS-first: all tokens in `src/styles/main.css` (`@theme`, `@theme inline`,
  `--mirror-*` in `:root` / `.dark`, `@custom-variant dark`), `@font-face` in `src/styles/fonts.css`.
- **24** woff2 files (**1.07 MB**) in `public/fonts/` — 18 Archivo statics + 6 Newsreader variable;
  **25** Pexels JPEGs (of 28 files, **4.61 MB** total) in `public/img/`.
- Demo content hardcoded in `src/data/*.ts`; site chrome in `src/data/navigation.ts`. Verified
  design invariants the seed must reproduce: **5** authors with counts **34/27/19/14/10** (summing
  to exactly 104, matching `about.ts`'s `STATS` `Posts published: 104`); **14** tags summing
  **173** (≈1.66 tags/post); `archive.ts` holds **18** entries; reading-time labels span
  **5–16 min**.
- Alpine from CDN (`Layout.astro` → `cdn.jsdelivr.net/npm/alpinejs@3.x.x`), Swiper 11 bundled by
  npm (consumers: `home/FeaturedCarousel.astro`, `cards/GalleryCard.astro` — both replaced), search
  index compiled from `src/data/search.ts`.
- `scripts/verify/` — `prep_originals.py`, `shoot.py`, `score.py`, `smoke.py`, JSON configs.
- **The port record is inconsistent and gets reconciled in Phase 0.** `astro.config.mjs` sets
  `server.port: 4380` and `CLAUDE.md` documents 4380, but `DECISIONS.md` records "4393 dev, 4394
  staged originals". Treat `astro.config.mjs` as truth.
- **No `verify:*` npm scripts exist yet.** Root `package.json` has only the Astro scripts, and
  `scripts/verify/jobs.json` does not exist (only `baseline-jobs.json`,
  `baseline-orig-jobs.json`). The harness is invoked by hand today.
- **`score.py` has no `--skip-header`.** Its real flags: `build original --height --band --tol
  --align --worst --panel Y0:Y1:NAME --out-dir --label`.
- Current bar: 54 route×mode rows in `after-scores.json`, mean pixel identity **97.47 %**, worst
  **90.16 %**.
- **Two Node versions are in play.** Astro and the verify harness run on Node 24 (`.nvmrc`). Ghost
  6 declares `engines.node ^22.23.1` and `engines.cli ^1.29.1` (`ghost/core/package.json`,
  6.61.0), so the local Ghost runs on Node 22 with an upgraded CLI. The installed `Ghost-CLI
  1.28.6` is **below** Ghost 6's floor. Never run `ghost` commands under Node 24.
- Tailwind v4's `tailwindcss` package ships **no CLI binary** (no `bin` field); the CLI is the
  separate `@tailwindcss/cli`. `esbuild` and `concurrently` are not installed either.

If the repo differs materially from this, stop and report before changing anything.

---

## Guardrails

- **Branch first.** `feat/ghost-theme`.
- **Never edit `src/` to suit Ghost.** The Astro build is the reference; it does not move. The one
  permitted exception is factoring `src/styles/main.css` so the Ghost entry can `@import` it.
- **One source of truth per fact.** Tokens: `src/styles/main.css`. Demo content: `src/data/*.ts`.
  If Ghost needs a value, it comes from Ghost's own data or from a fixture generated out of
  `src/data`.
- **No `pnpm build` of the theme into git.** `ghost/assets/built/` is generated and gitignored;
  the zip is a release artifact.
- **Card styling must not depend on `card_assets`.** Ghost emits `cards.min.css` from
  `{{ghost_head}}`, which sits *below* the theme stylesheet, so at equal specificity Ghost wins.
  Every `.kg-*` rule is scoped under the content container. `card_assets` exclusion is a payload
  optimisation, never a correctness mechanism.
- **Do not exclude `toggle` or `gallery` from `card_assets`** — their JS is Ghost's, and
  `exclude` drops a card's CSS **and** JS together (`card-assets.js` resolves one config for both).
- **`routes.yaml` cannot ship inside a theme zip.** It is site config, so it lives at
  `docs/routes.example.yaml`, outside `ghost/`, where the staging step cannot pick it up. Any
  template that needs it must still render correctly without it.
- **Every literal UI string goes through `{{t}}`** from the first partial written.
- Ask before deleting anything under `src/` or `scripts/verify/`.

---

## Target structure

```
ghost/
├── package.json                  # name, version, description, license, author, keywords, demo,
│                                 #   engines.{ghost,node}, config.{posts_per_page,image_sizes,
│                                 #   card_assets,custom}, gpm.categories
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
├── page-sign-in.hbs              # NOT page-signin.hbs — see "Open questions", settled in Phase 0
├── page-sign-up.hbs
├── custom-about.hbs              # same partial as page-about.hbs, selectable on any page from the
├── custom-membership.hbs         #   settings menu. Ghost resolves page-{slug} → selected custom
├── custom-directory.hbs          #   template → page.hbs, so the demo slugs keep working while the
├── custom-wide.hbs               #   layouts stop being hostage to five hardcoded slugs
├── tag.hbs                       # single tag archive — A1 lead + list | A2 card grid
├── author.hbs                    # single author — A1 centered header | A2 sticky rail
├── error.hbs
├── error-404.hbs                 # A1 centered | A2 editorial split
├── locales/en.json               # every UI string in the theme
├── partials/
│   ├── header.hbs · header-compact.hbs · nav.hbs · logo.hbs · theme-toggle.hbs
│   ├── footer.hbs · footer-slim.hbs
│   ├── img.hbs                   # the ONLY place an <img> is written — srcset/webp/sizes/lazy
│   ├── pagination.hbs            # overrides {{pagination}}
│   ├── recommendations.hbs       # overrides the {{recommendations}} default template
│   ├── newsletter.hbs            # inline [data-members-form], takes email_field_id
│   ├── pages/{about,membership,directory,wide}.hbs   # shared by page-* and custom-*
│   ├── home/{a1,a2}.hbs · home/{lead,featured,latest,writers}.hbs
│   ├── cards/{post-card,grid-card,list-row,compact-card,numbered-row}.hbs
│   ├── post/{hero,title-page,toc,paywall,share,rail,related,end-blocks,comments}.hbs
│   ├── blog/{filter-bar,empty-state}.hbs
│   ├── tags/{directory-row,tag-card,lead}.hbs
│   ├── authors/{row,cover-card,profile-header,rail}.hbs
│   ├── membership/{tiers,comparison,faq,quotes,locked-posts}.hbs
│   ├── about/{split-hero,stats,masthead,contact}.hbs
│   └── auth/{shell,sign-in-form,sign-up-form,upgrade}.hbs
├── assets/
│   ├── css/screen.css            # entry: @import shared tokens + @source hbs + scoped .kg-* layer
│   ├── js/main.js                # Alpine, theme store, TOC spy, monograms, snap-scroller controls
│   ├── fonts/*.woff2             # copied from public/fonts (audit before release — see Phase 9)
│   ├── built/{screen.css,main.js}   # generated, gitignored
│   └── screenshot-desktop.jpg · screenshot-mobile.jpg
└── README.md                     # buyer-facing install + settings guide

docs/routes.example.yaml          # OUTSIDE ghost/ — site config, cannot be shipped by accident
scripts/ghost/                    # build-fixture.mjs, import.mjs, fixture.json, jobs.json, routes.json
```

Each `page-{slug}.hbs` is two lines — `{{!< default}}` plus one `{{> "pages/about"}}` — and the
matching `custom-{name}.hbs` includes the same partial. No markup is duplicated.

Theme zip stays ~1.5 MB: fonts travel with the theme, the 4.61 MB of Pexels JPEGs do not — the
import step uploads those into Ghost's content directory.

---

## Surface map

| Astro route(s)                               | Ghost template                                              | Variant switch             |
| :------------------------------------------- | :---------------------------------------------------------- | :------------------------- |
| `/homepage-01`, `/homepage-02`               | `home.hbs`                                                  | `@custom.homepage_layout`  |
| `/blog-01`, `/blog-02`                       | `index.hbs` (and `/archive/` with `routes.yaml`)            | `@custom.feed_layout`      |
| `/post-01`, `/post-02`                       | `post.hbs`                                                  | `@custom.post_layout`      |
| `/post-01-paywalled`, `/post-02-paywalled`   | `post.hbs` + `{{#unless access}}`                           | none — server-side         |
| `/tags-01`, `/tags-02`                       | `page-tags.hbs` + `custom-directory.hbs`                    | `@custom.directory_layout` |
| `/tags-single-01`, `/tags-single-02`         | `tag.hbs`                                                   | `@custom.feed_layout`      |
| `/authors-01`, `/authors-02`                 | `page-authors.hbs` + `custom-directory.hbs`                 | `@custom.directory_layout` |
| `/author-single-01`, `/author-single-02`     | `author.hbs`                                                | `@custom.feed_layout`      |
| `/recommendations-01`, `/recommendations-02` | `page-recommendations.hbs` + `partials/recommendations.hbs` | `@custom.directory_layout` |
| `/about-01`, `/about-02`                     | `page-about.hbs` + `custom-about.hbs`                       | `@custom.page_hero`        |
| `/membership-01`, `/membership-02`           | `page-membership.hbs` + `custom-membership.hbs`              | `@custom.page_hero`        |
| `/sign-in`, `/sign-up`                       | `page-sign-in.hbs`, `page-sign-up.hbs`                      | none                       |
| `/404`, `/404-02`                            | `error-404.hbs`                                             | `@custom.page_hero`        |
| `/styleguide`                                | **not a template** — a Koenig-authored kitchen-sink page    | —                          |

`27 routes → 15 templates + 4 custom-template aliases + 10 custom settings.`

No template branches on more than one select. That independence is what Phase 8's gate exploits.

---

## Custom settings (10 of the 20 allowed)

```json
"config": {
  "posts_per_page": 18,
  "image_sizes": {
    "xs": { "width": 160 },
    "s":  { "width": 320 },
    "m":  { "width": 600 },
    "l":  { "width": 960 },
    "xl": { "width": 1200 },
    "xxl":{ "width": 2000 }
  },
  "card_assets": { "exclude": ["bookmark", "product", "button", "callout"] },
  "custom": {
    "homepage_layout":     { "type": "select", "options": ["Magazine cover", "Editorial masthead"], "default": "Magazine cover", "group": "homepage" },
    "feed_layout":         { "type": "select", "options": ["Two-column list", "Three-column grid"], "default": "Two-column list", "description": "Layout for the post feed, tag archives and author archives" },
    "post_layout":        { "type": "select", "options": ["Centered classic", "Title page with rail"], "default": "Centered classic", "group": "post" },
    "directory_layout":   { "type": "select", "options": ["Editorial rows", "Cover cards"], "default": "Editorial rows", "description": "Layout for the tag, author and recommendation directories" },
    "page_hero":          { "type": "select", "options": ["Centered statement", "Split hero"], "default": "Centered statement" },
    "default_appearance": { "type": "select", "options": ["Light", "Dark", "System"], "default": "Light" },
    "show_comments":      { "type": "boolean", "default": true, "group": "post", "description": "Ghost's native comments, below the article" },
    "featured_tier":      { "type": "text", "default": "Pro", "description": "Tier name that carries the accent panel and \"Most popular\" chip" },
    "newsletter_title":   { "type": "text", "default": "One considered essay, every Thursday", "group": "post" },
    "newsletter_text":    { "type": "text", "default": "Free members get the archive. Paid members get the interviews." }
  }
}
```

The image ladder matches Source's (160/320/600/960/1200/2000) rather than inventing one: every
declared size is a stored derivative per uploaded image, an `xs` of 100 is too small for any real
slot, and an `xxl` of 2400 regenerates a derivative nothing requests.

`card_assets` excludes only cards whose default CSS is fully replaced by the theme's `.kg-*` layer;
`toggle` and `gallery` keep Ghost's assets because their behaviour is Ghost's JS. `exclude` drops a
card's **CSS and JS together**, and it is matched by name against a per-Ghost-version manifest —
so exclusion is payload, not correctness (see Phase 5).

`posts_per_page: 18` matches the archive length in the design (`src/data/archive.ts` holds 18);
with 104 seeded posts that is 6 pages, enough to exercise pagination properly. It also drives
`/tag/*/` and `/author/*/` pagination.

Where Source uses it, `visibility` narrows a setting to the layouts it applies to — e.g.
`"visibility": "post_layout:[Title page with rail]"`. Add it to any setting that becomes inert
under some other select rather than showing a buyer a control that does nothing.

---

## Data map

Native, no work beyond the helper call:

| Astro field                                      | Ghost source                                                                                                                                               |
| :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `excerpt`, `date`                       | `{{title}}`, `{{excerpt}}`, `{{date format="D MMM YYYY"}}`                                                                                                  |
| `img` / `alt`                                    | `{{> "img" src=feature_image alt=feature_image_alt sizes="…" lazy=true}}` — never a bare `{{img_url}}` (see below)                                          |
| `read` (`"7 min read"`)                          | `{{reading_time seconds=(t "< 1 min read") minute=(t "1 min read") minutes=(t "% min read")}}` — computed from word count + images, never stored             |
| `tag` (single)                                   | `{{primary_tag.name}}` / `{{primary_tag.url}}`                                                                                                              |
| `visibility` (`public`/`members`/`paid`)         | `{{#has visibility="paid"}}`, and `access` for the gate                                                                                                     |
| `featured`                                       | `{{#get "posts" filter="featured:true"}}`                                                                                                                   |
| `TagEntry.count`                                 | `{{count.posts}}` — requires `include="count.posts"` on `{{#get "tags"}}`                                                                                    |
| `TagEntry.img`, `.description`                   | tag `feature_image`, `description`                                                                                                                           |
| `Author.bio`, `.location`, `.website`, `.social` | `{{bio}}`, `{{location}}`, `{{website}}`, `{{twitter}}`                                                                                                     |
| `Author.count`                                   | `{{count.posts}}` on `{{#get "authors"}}`                                                                                                                   |
| `Author.latest`                                  | `{{#get "posts" filter="authors:{{slug}}" limit="1"}}`                                                                                                     |
| `Tier.*`                                         | `{{#get "tiers" include="monthly_price,yearly_price,benefits" limit="100"}}`; prices are in the currency's smallest unit, so they go through `{{price monthly_price currency=currency locale=@site.locale}}` — `{{monthly_price}}` alone renders `1200` |
| `Recommendation.*`                               | `{{recommendations}}` + `partials/recommendations.hbs` (`rec.title/url/description/favicon/featured_image`)                                                 |
| `STATS` posts/writers/subjects                   | `{{#get "posts" limit="1" as \|p pages\|}}{{pages.total}}`, same for `"authors"` / `"tags"`                                                                  |
| `STATS` "Publishing since"                       | `{{#get "posts" order="published_at asc" limit="1"}}{{date published_at format="YYYY"}}`                                                                    |

**Every feature image goes through `partials/img.hbs`**, taking `src`, `alt`, `sizes`, `lazy`,
`w`, `h` as partial arguments — the pattern Source uses in `partials/post-card.hbs`:

```handlebars
<img
  srcset="{{img_url src size="xs" format="webp"}} 160w, {{img_url src size="s" format="webp"}} 320w,
          {{img_url src size="m" format="webp"}} 600w, {{img_url src size="l" format="webp"}} 960w,
          {{img_url src size="xl" format="webp"}} 1200w, {{img_url src size="xxl" format="webp"}} 2000w"
  sizes="{{sizes}}" src="{{img_url src size="l"}}" alt="{{alt}}"
  width="{{w}}" height="{{h}}"{{#if lazy}} loading="lazy" decoding="async"{{/if}}>
```

`sizes` is per slot, not global: the A1 lead passes `100vw`, grid cards
`(min-width: 1024px) 33vw, 100vw`, list rows `160px`. Only above-the-fold images omit `lazy`.
`width`/`height` are mandatory — without them every lazy card contributes CLS the Astro reference
does not have. A single `size="m"` everywhere would simultaneously upscale the 1568px hero and
overserve the 320px cards; that one omission costs both fidelity and bytes.

Gaps, with their resolutions:

| Astro field                                                               | Problem                                                                                  | Resolution                                                                                                                                                                                                                                                             |
| :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initials` (`"EL"`)                                                       | Ghost has no string-slicing helper, so the monogram is not derivable in Handlebars       | Seed every demo author with a `profile_image` so the fallback is rare. Render `<span data-monogram="{{name}}">` with a single clipped letter as the no-JS fallback; `main.js` replaces it with the real two-letter monogram (first letter of first and last word). Progressive enhancement, **not** a concession — `EL`/`MA` render as designed |
| `Author.role` (`"Founding editor"`)                                       | Not a Ghost author field, and Ghost has no arbitrary author metadata                     | Masthead shows `{{location}}` + `{{count.posts}}`; the role list on About becomes Koenig page content. Recorded as a concession                                                                                                                                          |
| `Tier.featured`                                                           | Ghost tiers have no "most popular" flag                                                  | `{{#match name @custom.featured_tier}}`                                                                                                                                                                                                                                 |
| FAQ accordion, comparison table, member quotes, contact email, About body | Bespoke Astro components with hardcoded copy                                             | Koenig page content (`toggle`, `table`, `blockquote` cards) styled by the scoped `.kg-*` layer                                                                                                                                                                           |
| Membership "locked posts" strip                                           | —                                                                                        | `{{#get "posts" filter="visibility:-public" limit="3"}}`                                                                                                                                                                                                                |
| `PostToc` / `PostTocSpy`                                                  | Astro builds the TOC from data; Ghost only has rendered `{{content}}`                    | Derive in `main.js` from `h2`/`h3` in the content root, assigning slugified `id`s where Koenig has not, then the existing scroll-spy logic ports unchanged                                                                                                               |
| `SEARCH_INDEX`                                                            | —                                                                                        | Deleted. Sodo Search binds `[data-ghost-search]`                                                                                                                                                                                                                        |
| `NAV`, `SITE_TITLE`, footer columns                                       | —                                                                                        | `{{navigation}}`, `{{navigation type="secondary"}}`, `{{@site.title}}`, `{{@site.description}}`; the nav dropdown variant-browser is dropped                                                                                                                            |

Site state the templates must read (all verified present in `core/shared/settings-cache/public.js`):
`@site.members_enabled`, `members_invite_only`, `members_signup_access`, `paid_members_enabled`,
`comments_enabled`, `recommendations_enabled`, `donations_enabled`, `portal_button`, `locale`,
`accent_color`. Plus two computed in `update-global-template-options.js` and not in that file:
`@site.signup_url` (resolves to `#/portal`, or a Feedly RSS URL when signup access is `none`) and
`@site.comments_enabled` as a boolean (`comments_enabled !== 'off'`), with the raw tri-state on
`@site.comments_access`.

---

## Phase 0 — Recon and a local Ghost (no theme code)

Commit: `chore: local ghost install for theme development`

1. `npm i -g ghost-cli@latest` — the installed 1.28.6 is below Ghost 6's `engines.cli ^1.29.1`.
   Then `nvm use 22 && ghost install local -d ~/ghost-mirror` (SQLite, no Docker). Ghost 6 declares
   `engines.node ^22.23.1`; Node 24 is out of range. Record the exact Ghost **and** Node versions
   in DECISIONS.md.
2. `npm i -g gscan` — match or exceed the 6.4.2 that Ghost 6.61 bundles.
3. `mkdir -p ghost` and symlink it in: `ln -s "$PWD/ghost" ~/ghost-mirror/content/themes/mirror`.
4. **Reconcile the ports.** `astro.config.mjs` says 4380; DECISIONS.md says 4393/4394. Correct
   DECISIONS.md to the real Astro port, pick a free port for the staged originals, and add Ghost's
   (2368 by default) to the same section.
5. Add the harness scripts the later gates assume — they do not exist yet:

   ```json
   "verify:smoke":  "python3 scripts/verify/smoke.py --base http://localhost:4380 --routes scripts/verify/routes.json",
   "verify:prep":   "python3 scripts/verify/prep_originals.py --config scripts/verify/prep.json --clean",
   "verify:shots":  "python3 scripts/verify/shoot.py --jobs scripts/verify/baseline-jobs.json --out-dir .shots",
   "ghost:smoke":   "python3 scripts/verify/smoke.py --base http://localhost:2368 --routes scripts/ghost/routes.json",
   "ghost:shots":   "python3 scripts/verify/shoot.py --jobs scripts/ghost/jobs.json --out-dir .shots/ghost"
   ```

   Then confirm the design originals still stage: `pnpm verify:prep`, serve them, spot-check one.
6. **Read the reading-time constants out of the installed package**, don't assume 275 wpm:
   `{{reading_time}}` delegates to `@tryghost/helpers`' `readingTime`. Record the words-per-minute
   figure and the per-image cost in DECISIONS.md — Phase 2's generator solves word counts backwards
   from them.
7. **Settle the two open questions empirically** (see "Open questions" below): create a page with
   slug `signin`, `curl -I` it, delete it; and count the custom-settings cap by pushing a throwaway
   21st setting past `gscan`.
8. Verify against current docs, and write the answers into this plan before Phase 1:
   `{{#get}}` block-param pagination, `page-{slug}.hbs` vs `custom-*.hbs` resolution order,
   `access` in post context, `data-portal` attribute grammar, `data-members-form` values.

**Gate:** Ghost admin answers on its port under Node 22, `gscan --version` ≥ 6.4.2, `.originals`
serves, the reconciled ports are in DECISIONS.md, `pnpm verify:prep` runs from an npm script, and
`ghost/` is visible in Ghost admin's theme list (it will fail validation — that is expected).

---

## Phase 1 — Theme skeleton and the asset pipeline

Commit: `feat: ghost theme skeleton with shared-token asset pipeline`

0. `pnpm add -D @tailwindcss/cli esbuild concurrently`. Tailwind v4's `tailwindcss` package ships
   no CLI binary; `esbuild` and `concurrently` are not installed. Without this step three of the
   four build scripts below are `command not found`.
1. `ghost/package.json` — name `mirror`, `version`, `description`, `license`, `author`, `demo`,
   `keywords: ["ghost","theme","ghost-theme"]`, `gpm.categories`,
   `engines: { "ghost": ">=6.0.0", "node": ">=22.12.0" }`, and the full `config` block above.
   Match Source's manifest shape — the fields beyond name/engines/config are what a marketplace
   review asks for.
2. Minimum valid template set so the theme activates: `default.hbs`, `index.hbs`, `post.hbs`,
   `page.hbs`, `error.hbs`. Real markup comes later; these carry `{{ghost_head}}`, `{{ghost_foot}}`,
   `{{body_class}}`, `{{asset}}` links, `{{#foreach posts}}`, `{{content}}`.
3. Factor `src/styles/main.css` only as far as needed so it can be imported without Astro-specific
   assumptions — note it carries `@plugin '@tailwindcss/typography'` and a
   `@plugin '@tailwindcss/forms' { strategy: class }` block, which must resolve from the repo root,
   so the CSS entry stays inside this repo and never moves into the zip. Create
   `ghost/assets/css/screen.css`:

   ```css
   @import '../../../src/styles/main.css';
   @source '../../**/*.hbs';
   /* scoped .kg-* card layer lands here in Phase 5 */
   ```

4. Copy `public/fonts/*.woff2` → `ghost/assets/fonts/`. Fix the `@font-face` URLs for the built
   CSS location (`../fonts/…` relative to `assets/built/screen.css`). Fonts in CSS cannot use
   `{{asset}}`; relative paths are correct and cache-busting comes from the stylesheet's own hash.
5. `ghost/assets/js/main.js` — import Alpine from npm (self-hosted, **no CDN**), port the pre-paint
   theme resolver and the Alpine `theme` store out of `Layout.astro`. **Keep the
   `?mode=light|dark` hook.** It is marked DEMO-ONLY in `Layout.astro`, but it is how the harness
   addresses a colour mode by URL — drop it and the 27 dark rows in the score table have no capture
   method. Four lines; documented in `ghost/README.md` as a support/debug affordance; localStorage
   still wins for real visitors. Swiper is **not** imported (decision 14).
6. Root `package.json` scripts:

   ```json
   "ghost:css":  "tailwindcss -i ghost/assets/css/screen.css -o ghost/assets/built/screen.css --minify",
   "ghost:js":   "esbuild ghost/assets/js/main.js --bundle --minify --outfile=ghost/assets/built/main.js",
   "ghost:dev":  "concurrently \"pnpm ghost:css --watch\" \"pnpm ghost:js --watch\"",
   "ghost:build":"pnpm ghost:css && pnpm ghost:js",
   "ghost:scan": "gscan --fatal --verbose ghost/",
   "ghost:stage":"rm -rf dist/mirror && mkdir -p dist/mirror && rsync -a --exclude '.DS_Store' --exclude 'assets/css/' --exclude 'assets/js/' ghost/ dist/mirror/",
   "ghost:zip":  "pnpm ghost:build && pnpm ghost:scan && pnpm ghost:stage && (cd dist && zip -rq mirror.zip mirror) && gscan --fatal -z dist/mirror.zip"
   ```

   Stage then zip: `zip -r dist/mirror.zip ghost` roots the archive at `ghost/`, and Ghost names the
   installed theme after the zip's root directory. Staging also keeps sources out by construction
   rather than by a growing `-x` list. `--fatal` is Source's own CI flag — warnings fail the build.
7. `.gitignore`: `ghost/assets/built/`, `dist/`, `.shots/`.

**Gate:** `pnpm ghost:build` emits a non-trivial `screen.css` (tens of KB — proof Tailwind scanned
the `.hbs` files) and `main.js`; `pnpm ghost:scan` reports **0 errors, 0 warnings** (`--fatal`);
the theme activates in Ghost admin; the front page renders with MIRROR fonts and token colours in
both light and dark, and `?mode=dark` forces dark on a fresh profile.

---

## Phase 2 — Seed the demo publication

Commit: `feat: ghost demo content fixture generated from src/data`

1. `scripts/ghost/build-fixture.mjs` — reads `src/data/*.ts` (import directly with a TS loader; do
   **not** re-transcribe the data) and emits a deterministic `scripts/ghost/fixture.json`. It is a
   pure function of `src/data` plus a fixed seed: same inputs, byte-identical output, no network.
   `scripts/ghost/import.mjs` then applies it via the Admin API (or Ghost's own importer on a fresh
   install). Fixture first, API second — the committed fixture is what the gates and the
   buyer-facing demo content both depend on, so reproducibility does not hinge on a key and a
   network path.
2. What the fixture contains:
   - 5 staff users from `authors.ts`, each with `bio`, `location`, `website`, `twitter` and a
     `profile_image` uploaded from `public/img/`.
   - 14 tags from `tags.ts` with `description` and `feature_image`.
   - 104 posts: the ~35 designed posts get their real titles/excerpts/images/dates/tags/authors;
     the remainder is generated filler.
   - Bodies posted as `POST /posts/?source=html` so Ghost converts HTML → Lexical.
   - `visibility` set from each post's `Visibility`, so `{{#unless access}}` has something to gate.
   - Pages with the exact slugs the templates key off: `tags`, `authors`, `about`, `membership`,
     `recommendations`, `sign-in`, `sign-up`, `styleguide`.
   - Site settings: title, description, accent colour (the design's amber), logo/icon, navigation
     from `navigation.ts`, three tiers matching `membership.ts`, recommendations from
     `recommendations.ts`.
   - Settings that change what templates render or what the harness captures:
     **`portal_button: false`** (the floating button otherwise lands in every screenshot),
     `comments_enabled`, `recommendations_enabled`, `members_signup_access`, locale, timezone.
     Record them in `ghost/README.md` as the demo-site configuration.
3. Two things the generator must **solve**, not approximate:
   - **The counts are a joint assignment.** 104 posts must satisfy 5 author marginals
     (`34/27/19/14/10`, summing to exactly 104) and 14 tag marginals (summing 173, ≈1.66 tags/post)
     simultaneously. Assign greedily from the largest remaining marginal, then `assert` every
     marginal is hit exactly before writing the fixture. "Filler whose job is to make counts match"
     is the requirement, not the method — a near-miss surfaces at gate time as "the tag directory
     shows 33, not 34" with no traceable cause.
   - **Reading time runs backwards from the label.** `{{reading_time}}` is computed by
     `@tryghost/helpers` from word count and image count; Ghost stores nothing. Using the constants
     recorded in Phase 0, generate each designed post's body to the exact word count its design
     label implies (labels span 5–16 min). This is what makes the gate exact instead of ±1, and it
     keeps a text-length difference out of Phase 9's pixel scores.
4. `import.mjs` is idempotent — keyed on slug, updates rather than duplicates. The Admin API key
   stays out of git (`.env`, gitignored).

**Gate:** `pnpm ghost:smoke` green; `{{pagination.total}}` on the feed reads **104**; every author
and tag count matches its designed marginal **exactly** (0 tolerance — the generator asserts it,
the gate confirms it end to end); every designed post's `{{reading_time}}` string is byte-identical
to its design label (0 tolerance, not ±1); re-running `import.mjs` changes nothing
(fixture → import → export → diff is empty).

---

## Phase 3 — Chrome: `default.hbs`, header, footer

Commit: `feat: ghost site chrome — head, header, footer, appearance, i18n`

0. **`locales/en.json` and the `{{t}}` convention, before any markup is written.** Every literal UI
   string goes through `{{t}}`; `<html lang="{{@site.locale}}">`;
   `{{meta_title page=(t " (Page %)")}}`; and even Ghost-generated labels are wrapped —
   `{{reading_time seconds=(t "< 1 min read") minute=(t "1 min read") minutes=(t "% min read")}}`.
   Source does this throughout. Retrofitting means re-touching and re-scoring ~45 partials.
1. `default.hbs`: `<head>` with `{{meta_title}}`, `{{ghost_head}}`, `{{asset "built/screen.css"}}`,
   a `<link rel="preload">` for the stylesheet and script, the two font preloads (keep
   `crossorigin`), the accent binding and the pre-paint appearance script:

   ```handlebars
   <style>
   	:root { --mirror-accent:{{@site.accent_color}}}
   </style>
   <script>/* @custom.default_appearance seeds it; localStorage wins; ?mode= forces it */</script>
   ```

   Do not hand-roll meta/OG/JSON-LD — `{{ghost_head}}` owns all of it, and duplicates are a gscan
   finding.
2. `partials/header.hbs` (+ compact variant) — `{{navigation}}`, `partials/logo.hbs` from
   `@site.logo` with the dark-ink asset swapped by the `.dark` class, `partials/theme-toggle.hbs`,
   and the search button keeping `data-ghost-search`. Bar order stays **search · mode · subscribe**.
   The nav-dropdown variant browser is not ported.
   The subscribe slot is state-driven, following Source's `partials/components/navigation.hbs`:
   `{{#if @site.members_enabled}}{{#unless @member}}` → Sign in + Subscribe
   (`href="{{@site.signup_url}}" data-portal="signup"`, Sign-in only when
   `@site.members_invite_only`), `{{else}}` → Account (`data-portal="account"`). With members off
   the slot collapses and the bar re-balances rather than leaving a hole. Use `@site.signup_url`
   rather than a hardcoded `#/portal` — Ghost resolves it to a Feedly RSS URL when
   `members_signup_access` is `none`.
3. `partials/footer.hbs` + `footer-slim.hbs` — columns from `{{navigation type="secondary"}}`,
   wordmark and © from `{{@site.title}}`, plus an RSS link.
4. Drop `HeaderSearch`'s index and panel; keep only what Sodo needs.
5. **Make the page capturable.** Ghost injects its own UI into `<body>` at runtime: Portal's
   floating button, Sodo's overlay, and the announcement bar (`document.body.prepend` — it
   displaces everything below it). Seed `portal_button: false`, leave the announcement empty, and
   add a prep variant that neutralises the Portal button root, the Sodo overlay root and
   `[data-aborted-get-helper]`. Do this before scoring anything, or every Ghost row carries a
   constant bottom-right diff and the numbers are not comparable to the Astro rows.

**Gate:** `pnpm ghost:scan` still clean; the header and footer of one route score within **0.5** of
the corresponding Astro row in `after-scores.json`, light and dark. `score.py` has no
`--skip-header`; isolate chrome from body with the flags it does have —
`--panel 0:180:header --panel -420:-1:footer` for the chrome bands and `--height` to clip the body
— and report the named panels. The toggle survives a reload; no flash-of-light on a dark-default
load; every visible string resolves through `en.json`.

---

## Phase 4 — Feeds: `home.hbs` and `index.hbs`

Commit: `feat: ghost home and feed templates, both layouts`

1. `home.hbs` dispatches on `@custom.homepage_layout` to `partials/home/a1.hbs` / `a2.hbs`, passing
   the layout in as a partial argument rather than reading `@custom` inside every partial (Source's
   pattern: `{{> "components/navigation" navigationLayout=@custom.navigation_layout}}`).
   **Two queries, not six.** One ordered query supplies every editorial slot, and `{{#foreach}}`'s
   `from`/`to` params slice it:

   ```handlebars
   {{#get "posts" limit="12" include="authors,tags" as |feed|}}
     {{#foreach feed limit="1"}}{{> "home/lead"}}{{/foreach}}
     {{#foreach feed from="2" to="4"}}{{> "cards/post-card"}}{{/foreach}}
     {{#foreach feed from="5" to="12" columns="4"}}{{> "cards/grid-card"}}{{/foreach}}
   {{/get}}
   {{#get "posts" filter="featured:true" limit="6"}}{{> "home/featured"}}{{/get}}
   ```

   Slicing removes the duplicate-post problem by construction — positions cannot collide — and
   avoids the trap in `get.js`: `optimiseFilterCacheability` bails out unless the filter contains
   **exactly one** `id:-` term, so a chain of exclusions turns every slice into an uncacheable,
   per-visitor query on the most-requested URL on the site. `columns` on the grid slice gives
   `@rowStart`/`@rowEnd` for free. Give every `{{#get}}` an `{{else}}` branch.
   Two overlaps remain and are correct, matching the Astro design: a featured post can also appear
   in the feed, and page 1's editorial picks reappear on `/page/2/`.
2. `index.hbs` dispatches on `@custom.feed_layout` (two-column list / three-column grid) and uses
   native `{{pagination}}` overridden by `partials/pagination.hbs` — placed directly below the list
   and above the newsletter block, as in the Astro build.
3. `partials/newsletter.hbs` — wrapped in `{{#if @site.members_enabled}}{{#unless @member}}` so it
   disappears for existing members and members-off sites (Source's `cta.hbs` does exactly this).
   Inline `[data-members-form]` with `input[data-members-email]` and `p[data-members-error]`;
   states styled off `.loading` / `.success` / `.error`. **`[data-members-email]` is not optional**
   — without it Ghost's members JS finds no address and the submit silently no-ops. Copy from
   `@custom.newsletter_title` / `newsletter_text`. The partial takes an `email_field_id` argument:
   the form renders more than once per page in two layouts, and duplicate `id`s break label
   association and autofill.
4. Featured carousel **drops Swiper** for CSS scroll-snap (`scroll-snap-type: x mandatory` on the
   track, `scroll-snap-align: start` on the cards) with the existing prev/next buttons calling
   `scrollBy({ left: cardWidth, behavior })`. Swiper's only remaining consumer after decision 4 is
   this strip, and its only used module is `A11y`; native snap is keyboard- and touch-accessible
   for free, needs no `document.fonts.ready` re-measure (nothing caches a width), and honours
   `prefers-reduced-motion` by switching `behavior` to `auto`.
5. The blog tag-filter/sort bar: port the Alpine scope; the `?tag=` demo hook is not ported.

**Gate:** four combinations (2 layouts × light/dark) scored for home, four for the feed; no row
below its `floor` in `baseline-scores.json`; the home page issues **2** `{{#get}}` queries, not 6
(check the Ghost log with `optimization:getHelper:notify:threshold` set low); pagination walks to
page 6 and back; a real signup through the newsletter form creates a member in the local Ghost.

---

## Phase 5 — `post.hbs` and the `.kg-*` card layer

Commit: `feat: ghost post template and koenig card styling`

1. `post.hbs` dispatches on `@custom.post_layout`: A1 centered classic with inline TOC, A2 title
   page with the sticky 232 px rail.
2. Paywall: `{{content}}` then `{{#unless access}}{{> "post/paywall"}}{{/unless}}`; the gate drops
   the section navigation exactly as the Astro `paywalled` variant does. The CTA inside the gate is
   member-aware — anonymous gets sign-up, a free member gets upgrade
   (`data-portal="signup/<tier>/monthly"`), a paid member never sees the gate. The two
   `*-paywalled` routes disappear.
3. Prev/next via `{{#prev_post}}` / `{{#next_post}}` — A1 shows title + date, A2 direction only.
   Related reading via `{{#get "posts" filter="primary_tag:{{primary_tag.slug}}+id:-{{id}}"}}`,
   with an `{{else}}` branch: a post whose primary tag has no siblings otherwise renders a heading
   over nothing.
4. Comments below the end blocks, in `partials/post/comments.hbs`:
   `{{#if @custom.show_comments}}{{#if @site.comments_enabled}}{{comments mode=… title=(t "Responses")}}{{/if}}{{/if}}`,
   styled to the design's type scale via the helper's accent/saturation params. `comments.js`
   self-gates on post context, `comments_enabled` and member `access`, so the helper is safe to
   place unconditionally — the `{{#if}}`s only drop the section heading too. Pass `mode` from
   `@custom.default_appearance` when it is Light or Dark, `auto` for System.
5. TOC built in `main.js` from the content root's `h2`/`h3`, assigning slugified `id`s where Koenig
   has not; port the existing scroll-spy.
6. **The card layer.** Rewrite `src/components/cards/*.astro` as CSS on Ghost's real classes in
   `ghost/assets/css/screen.css`, **every rule scoped under the content container**
   (`.mirror-content .kg-callout-card`, not `.kg-callout-card`). This is not style: Ghost emits
   `cards.min.css` from `{{ghost_head}}`, which sits below the theme stylesheet, so at equal
   specificity Ghost wins. Scoping gives 0,2,0 against Ghost's 0,1,0 and makes the layer correct
   whether or not a card is excluded — including `toggle` and `gallery`, which are never excluded.
   Classes to cover: `.kg-callout-card` / `.kg-callout-emoji` / `.kg-callout-text`,
   `.kg-bookmark-card`, `.kg-button-card` + `.kg-btn`, `.kg-product-card`, `.kg-toggle-card`
   (`[data-kg-toggle-state]`, Ghost's JS), `.kg-gallery-card` (grid),
   `blockquote.kg-blockquote-alt` for the pull quote, `.kg-signup-card`,
   `pre code[class*="language-"]`, `figure.kg-image-card` with `.kg-width-wide` / `.kg-width-full`
   mapped onto `--wide-out`.
7. Concessions to record in DECISIONS.md: the gallery card is a grid, not a carousel; the code card
   has no language/action chrome, because Koenig emits no node to hang either on; and the comments
   iframe's colour scheme is fixed at render time, so under the "System" appearance setting it
   follows the OS rather than the visitor's in-page toggle.

**Gate:** post A1/A2 × light/dark scored, plus both paywalled states; the Koenig styleguide page
renders every card styled with no unstyled `.kg-*` block; **the same page renders identically with
`card_assets: true`**, proving the layer wins on specificity rather than on absence; `gscan` clean;
TOC highlights the right heading while scrolling both layouts; comments load and the count renders.

---

## Phase 6 — Archives and directories

Commit: `feat: ghost tag, author and directory templates`

1. `tag.hbs` — A1 lead article + list, A2 card grid; header from `{{#tag}}` (`name`, `description`,
   `feature_image`, `count.posts`); "other tags" strip via `{{#get "tags" limit="8"}}`.
2. `author.hbs` — A1 centered header, A2 sticky rail; both feeds obey `@custom.feed_layout`.
3. `page-tags.hbs` / `page-authors.hbs` —
   `{{#get "tags" include="count.posts" limit="100" order="count.posts desc" as |tags|}}` and the
   equivalent for authors, dispatching on `@custom.directory_layout`. **`limit="all"` is capped to
   100** by `applyLimitCap` in Ghost 6, so the cap is declared explicitly and the directories order
   by count, which makes any truncation drop the emptiest tags rather than an arbitrary slice. Emit
   a next-page link from `{{#if pagination.next}}` where `routes.yaml` provides one; otherwise note
   the cap in `ghost/README.md`.
4. `page-recommendations.hbs` + `partials/recommendations.hbs` overriding the default template;
   wrap in `{{#if @site.recommendations_enabled}}` so the page degrades when the feature is off.
   Use `{{#if}}`, not `{{#match}}` — `{{#match}}` is a comparison helper
   (`{{#match a "!=" b}}`, `{{#match posts.length ">=" 7}}`). The helper itself returns nothing when
   the setting is off (`helpers/recommendations.js`), so the guard's only job is suppressing the
   section heading — say so in a comment, or someone will "simplify" it away.

**Gate:** eight combinations scored (tag, author × 2 layouts × 2 modes) plus the three directories;
`{{count.posts}}` matches the design on every tag and author; an author with no posts and a tag with
no posts both render the empty state rather than breaking; a site with 150 tags renders the
directory with a next-page link rather than silently losing 50.

---

## Phase 7 — Pages, members and errors

Commit: `feat: ghost about, membership, auth and error templates`

1. `page-about.hbs` (+ `custom-about.hbs`) — `@custom.page_hero` picks centered statement vs split
   hero; stats derived from `{{#get}}` block-param totals; body and contact block from
   `{{content}}`.
2. `page-membership.hbs` (+ `custom-membership.hbs`) — tiers from
   `{{#get "tiers" include="monthly_price,yearly_price,benefits" limit="100"}}`, prices through
   `{{price monthly_price currency=currency locale=@site.locale}}`, each price guarded by
   `{{#if monthly_price}}`, and the whole section by `{{#if @site.paid_members_enabled}}` so a
   free-only site does not render an empty pricing grid;
   `data-portal="signup/{{id}}/monthly|yearly"`; "Most popular" from
   `{{#match name @custom.featured_tier}}`; comparison table and FAQ from `{{content}}`; locked
   posts from `{{#get "posts" filter="visibility:-public" limit="3"}}`.
3. `page-sign-in.hbs` / `page-sign-up.hbs` — the designed cards, with `data-members-form` carrying
   the flow: `="signin"` on sign-in, `="signup"` on sign-up, bare (subscribe) on the inline
   newsletter blocks. Every form needs `input[data-members-email]`. The four states become
   `form.loading`, `form.success`, `form.error` selectors plus `[data-members-error]`.
   `FormStateSwitch` and `?state=` are not ported; a `dev`-only class toggle is enough for
   screenshots.
4. `error-404.hbs` (A1/A2 via `@custom.page_hero`) and a generic `error.hbs`.
5. **Member-state pass.** Walk every template with four site shapes and confirm no dead control and
   no orphaned heading in any of them: members off; invite-only; free signup with no Stripe
   (`paid_members_enabled: false`); Stripe live. Then walk the three member shapes: anonymous, free
   member, paid member.

**Gate:** every page scored light and dark; a real magic-link sign-in and a real free signup both
complete against the local Ghost; the error states render with Ghost's own message text; visiting a
missing URL renders the themed 404. Plus the 4×3 state matrix: `pnpm ghost:smoke` green in all four
site shapes, and no route shows a control that cannot act in any of the three member shapes.

---

## Phase 8 — Settings matrix, `routes.yaml`, bare-install behaviour

Commit: `feat: ghost custom settings, optional routes.yaml, graceful defaults`

1. Wire every `@custom` value through its templates; confirm each select flips the whole surface.
   Add `visibility` to any setting that is inert under another select's value.
2. Ship `docs/routes.example.yaml`, documented in `ghost/README.md`. It lives outside `ghost/` so
   the staging step cannot pick it up — a path is a stronger guarantee than an exclude rule:

   ```yaml
   routes:
     /: home
   collections:
     /archive/:
       permalink: /{slug}/
       template: index
   ```

   Note the consequence for `home.hbs`: as a `route:` it gets **no** posts collection and no
   pagination, which is why every editorial slot is a `{{#get}}`. Bare (no `routes.yaml`), `/` is
   the collection, `home.hbs` renders page 1 and `index.hbs` renders `/page/2/` onwards.
3. Prove the bare install: fresh Ghost, theme uploaded, **no** pages created and **no**
   `routes.yaml`. Nothing may 500; `/` must render the magazine cover; missing pages simply have no
   URL, and the four `custom-*` templates cover a buyer who names pages differently.
4. Prove the configured install: pages present, `routes.yaml` uploaded — `/archive/` paginates and
   `/` keeps the cover.

**Gate:** `pnpm ghost:smoke` green in both configurations; **12** configurations render without a
Handlebars error — each of the 5 layout selects at each of its 2 values (10), plus all-A and all-B —
scripted against the Admin API's `custom_theme_settings` endpoint. The full 2⁵ sweep buys nothing:
no template branches on more than one select (see the surface map), so 20 of the 32 combinations
exercise no distinct path. If a template ever reads two selects, restore the sweep for that pair
only. `gscan --fatal` clean.

---

## Phase 9 — Release

Commit: `feat: ghost theme release artifacts and measured scores`

1. `assets/screenshot-desktop.jpg` (1200×800) and `screenshot-mobile.jpg` (600×1200) captured with
   `shoot.py`.
2. `ghost/README.md` — install, required pages and their slugs (and the `custom-*` alternative),
   optional `routes.yaml`, every custom setting, the demo-content fixture, the accent-contrast
   caveat, and the `?mode=` debug hook.
3. Full score run over all 15 templates × layouts × modes, on **both axes**, into
   `scripts/ghost/ghost-scores.json` with a `parity` and an `identity` column per row plus each
   row's `diag`, so irreducible capture noise is visible. Write the table into DECISIONS.md beside
   the Astro numbers, with the concessions (gallery grid, code chrome, comments colour scheme, Sodo
   overlay, dropped nav variant browser, author role) recorded as deliberate. The two-letter
   monogram is no longer a concession.
4. **Budget check** on the seeded local Ghost, three routes (home, post, feed), mobile and desktop:
   `built/screen.css` ≤ 60 KB br, `built/main.js` ≤ 25 KB br, ≤ 4 fonts on the critical path, LCP
   element is the hero image (not a webfont), CLS 0 (every `<img>` carries width/height), `axe` 0
   violations. Audit the 18 Archivo statics against actual usage first — a weight nothing
   references is pure payload in every buyer's theme directory. Record the numbers in DECISIONS.md
   next to the pixel scores.
5. `pnpm ghost:zip` → `dist/mirror.zip` (root directory `mirror/`); `gscan --fatal -z` clean;
   upload to a clean Ghost and activate.

**Gate:** `gscan --fatal -z` clean; the zip activates on a fresh Ghost with no manual fixes;
**parity** mean ≥ 99.0 with no row below 97 — anything lower is a port defect and gets fixed, not
annotated; **identity** mean within **1 point** of the Astro build's 97.47 %, with no template
below 90 %. Any identity row that fails while its parity row passes is content-derived: name the
content difference in DECISIONS.md or fix the fixture. Budget check green.

---

## Known pitfalls

- **Ghost 6 needs Node 22 and Ghost-CLI ≥ 1.29.1.** `ghost/core/package.json` declares
  `engines.node ^22.23.1`, `engines.cli ^1.29.1`. The repo's `.nvmrc` pins 24 for Astro. Two
  toolchains, two Node versions.
- **`limit="all"` no longer means all.** Ghost 6 caps every `{{#get}}` limit at 100
  (`core/shared/max-limit-cap.js`), and does so silently. Anything that must be exhaustive pages.
- **`filter="id:-…"` chains defeat Ghost's query cache.** `get.js`'s
  `optimiseFilterCacheability` only handles a single `id:-` term; two or more fall through to the
  unoptimised, per-visitor path. Slice one query with `{{#foreach from= to=}}` instead of excluding
  your way down the page.
- **`{{#get}}` can be aborted server-side.** Where `optimization:getHelper:timeout:threshold` is
  configured (Ghost Pro sets it), a slow query returns empty and Ghost prepends
  `<span data-aborted-get-helper>Could not load content</span>`. Style that span and give every
  `{{#get}}` an `{{else}}`, or a slow homepage renders as a hole.
- **Ghost's card CSS loads after the theme's.** `cards.min.css` comes out of `{{ghost_head}}`,
  below the theme stylesheet, so at equal specificity Ghost wins. Scope the `.kg-*` layer; never
  rely on `card_assets` for correctness.
- **`card_assets` exclude drops CSS *and* JS,** and matches names against a per-version manifest.
  Do not exclude `toggle` or `gallery` — their behaviour is Ghost's JS.
- **Ghost injects UI into `<body>`.** Portal's floating button, Sodo's overlay and the announcement
  bar are appended/prepended at runtime; the announcement bar shifts the whole page down. Every
  scored capture is taken with `portal_button: false` and no announcement.
- **`{{asset}}` adds a `?v=` hash.** Diffing rendered HTML between runs shows asset-URL churn after
  every CSS edit; diff the DOM, not the markup.
- **Tier prices are integers in the currency's smallest unit.** `{{monthly_price}}` renders `1200`.
  Use `{{price monthly_price currency=currency locale=@site.locale}}`.
- **`[data-members-form]` without `[data-members-email]` submits nothing.** Silent no-op, complete-
  looking markup.
- **`{{count.posts}}` needs `include="count.posts"`.** Without it the count silently renders empty.
- **Collections must be unique.** A post cannot live in two collections, so there is no way to have
  both `/` and `/archive/` own the same posts — that is exactly why `/` is a `route:` and
  `/archive/` the collection. A `route:` home has no posts context and no pagination.
- **`routes.yaml` never ships in a theme.** It lives at `docs/routes.example.yaml`.
- **Tailwind v4 has no `tailwindcss` binary** — that is `@tailwindcss/cli`. And Tailwind will not
  see new `.hbs` files without the `@source` glob; the same brand-new-file trap the Astro build has
  applies, so restart the watcher after adding a template.
- **`{{reading_time}}` is computed**, never stored. Seeded bodies must be the right length or the
  design's "12 min read" becomes "3 min read". Read the constants from `@tryghost/helpers`.
- **`@site.accent_color` can fail AA** against the stone neutrals. Ship amber as the demo value and
  say so in `ghost/README.md`; do not add surface-colour settings.
- **The comments iframe's colour scheme is baked at render time.** `{{comments}}` writes
  `color-scheme` once, so under "System" it follows the OS, not the in-page toggle.
- **Sodo Search double-binding.** With the inline panel gone, nothing else may bind
  `[data-ghost-search]`.
- **Headless Chrome will not open a window under ~500 px** — narrow widths must go through a probe
  page, never a direct capture (the Astro build's `probe-mobile.html` is the pattern; it is a demo
  affordance and is not ported).
- **`gscan` warnings are release blockers**, not advisories: `--fatal` is Source's own CI flag and
  the Ghost marketplace rejects warnings.

---

## Open questions — settle in Phase 0, then delete from this list

1. **Are `/signin/` and `/signup/` actually reserved?** This plan keeps page slugs `sign-in` /
   `sign-up` because that is the conservative choice, but no reserved-route list was found in
   Ghost's source or docs — Portal's routes are hash-based (`#/portal/signin`), and the docs only
   say page URLs are fixed at `/:slug/` and that *custom routes* can collide with page slugs.
   Settle it: create a page with slug `signin` on the local Ghost, `curl -I` it, delete it. Then
   either keep the pitfall with evidence or strike it as folklore.
2. **Is the custom-settings cap really 20?** Not found in Ghost source or gscan. The plan uses 10.
   Push a throwaway 21st setting past `gscan --fatal` and record the real answer.

---

## Manual follow-ups (cannot be done from the repo)

1. Create the eight demo pages with their exact slugs, or run `import.mjs` with an Admin API key.
   Buyers who want different slugs pick the matching `custom-*` template from the page settings
   menu instead — the slugs are a demo convenience, not a requirement.
2. Upload `docs/routes.example.yaml` in Ghost admin → Settings → Labs, if the `/archive/` split is
   wanted.
3. Configure Stripe on the demo site so the tier `data-portal` links can be clicked through.
4. Enable Recommendations in Ghost admin and add the five publications (or let the import do it).
5. Enable comments in Ghost admin (`all` or `paid`) — the theme renders them, the setting gates them.
6. Decide whether the theme is listed on the Ghost marketplace — that adds their own review
   checklist on top of `gscan`.
7. Optional: add `locales/de.json` etc. The `{{t}}` wiring and `en.json` ship from Phase 3.

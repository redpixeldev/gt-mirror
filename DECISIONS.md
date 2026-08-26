# Decisions

Why this theme is built the way it is. Each entry records something that was **not**
obvious from the design source and would otherwise be re-derived — or reverted by
accident — on the next pass or the next theme.

Grouped by area. "Measured" means the figure came from a DOM measurement or a pixel
diff against the rendered original, not from an estimate.

---

## Type and rendering

**Request the `opsz` axis explicitly when loading a variable font.**
`astro.config.mjs` asks for Newsreader with `options.experimental.variableAxis`. Without
it Google serves an instance pinned to its default optical size, which renders about 5%
wider and breaks every line. Measured: the same string is 594.12px in both builds once
the axis is requested.

**Preflight's `line-height: 1.5` is reset to `normal` on `html`, and the built-in
font-size/line-height pairings are cleared.**
The design source never sets a page line-height; leaving Preflight's would inflate every
UI and meta element that has no explicit leading. Affected 123 elements before the fix.

**Never apply Tailwind's `antialiased` utility.**
It forces `-webkit-font-smoothing: antialiased`, which thins every stem on macOS. The
source leaves smoothing at the browser default. Measured: it cost ~15% of the ink in a
Newsreader headline (37.79 vs 43.41) and roughly a point of pixel identity on _every_
page. Removing it lifted the whole build — `/post-01` 98.53% → 99.74%, `/styleguide`
98.64% → 99.52%.

**Mono leading is pinned with `--leading-mono: 1.31`, and the rule sets `--tw-leading`
as well as `line-height`.**
Only needed because mono is a system stack (see below). Chrome quantises `normal`
per size for IBM Plex Mono — 12.5 / 14 / 14.5 / 15 / 16 / 16.5 / 17px at 10–13px — so no
single constant is exact; 1.31 is the best fit across the sizes this theme uses.
Setting only `line-height` is not enough: size utilities compile to
`line-height: var(--tw-leading, …)` in the utilities layer and beat a base-layer rule.

> **If a theme actually loads its mono face, drop this pin entirely** — it exists to
> normalise a substitute, and would fight a real font.

**Glyphs the UI font lacks (← → ▾) are pinned to `system-ui, sans-serif`.**
Archivo has no arrows, so the source falls through to `system-ui`. Our chain reaches
Astro's metric-matched Arial fallback first, which changes both the advance width
(80.56 → 81.91px on a "Visit →" button) and the line box (37.5 vs 38.5px on pagination).
Pinning restores the source's own metrics exactly.

---

## Fonts

**Exactly two families, self-hosted through the Astro Fonts API.**
Newsreader (display + body, variable 300–600, roman + italic) and Archivo (UI + meta,
400/500/600/700). No runtime request to Google.

**IBM Plex Sans and IBM Plex Mono are deliberately not loaded**, though the source
references them; `--font-mono` is a system stack. This is the single largest source of
residual pixel drift in this theme — see the noise floor below.

---

## Content and data

**Tier chips read "Basic" and "Pro".** The source ships "Paid" and "Members". Changed at
the client's request; `TIER_LABELS` in `data/posts.ts` is the only place it lives.

**Each template keeps its own data file** — `posts.ts`, `archive.ts`, `tagArchive.ts`,
`authorArchive.ts` — rather than deriving one from another. The sources genuinely differ:
the blog ships six posts the homepage does not, and tags one shared post differently.
Deriving would bury that.

**Body copy still says "The Quarry" although the chrome says "Mirror".**
Prose transcribed from the design source is demo content; the site name, logo, titles and
© line are chrome. Renaming the copy would drift those pages from their originals for no
gain.

---

## Navigation and links

**One canonical `NAV` in `data/navigation.ts`; pages pass `current` and nothing else.**
The source ships a different nav per template. Unifying costs a little fidelity in the
header band — measured 0.03–0.05 points per page, confined to the header — and buys a
theme that behaves like a real site. `NavKey` is a union type, so a typo is a build error.

**Content links point at real routes, and post links follow membership state.**
`postHref(locked)` sends public posts to `/post-01` and members-only posts to
`/post-01-paywalled`, so the tier chips mean something. Tag chips → `/tags-single-01`,
bylines → `/author-single-01`.

**These stay inert on purpose:** pagination (there is no page two), the recommendation
links (`#recs` — third-party publications with fictional domains), footer RSS (`#` —
Ghost serves `/rss/` at runtime), and Privacy/Terms.

**The nav dropdowns are a preview aid, not the shipping nav.**
`NavDropdown` turns `NAV` into a variant browser so all 27 routes are one hover away
during review. A shipping theme deletes the `NavDropdown` call and renders the same
labels as plain links. Same for `FormStateSwitch` and the `?state=` query on the auth
pages.

---

## Components

**Presentational components are shared; domain components are not.**
`PostListRow`, `PostGridCard`, `PageIntro` and `CenteredIntro` are used by several
templates through props. Cards that genuinely differ per template (home, blog, tags,
authors) stay separate — matching the repo's existing pattern rather than growing one
component with a dozen flags.

**`Header` has three variants** — `site` (page header), `demo` (the styleguide specimen)
and `auth` (sign-in/up). The auth pages have no footer at all; their `<main>` flexes to
fill the viewport, which is what centres the card.

### Preflight traps that have bitten this build

- `a { text-decoration: inherit }` — links the source leaves underlined come out plain.
  Affects the author "Latest —" link and the About contact email; both carry an explicit
  `underline`.
- List markers are stripped — the About page's beats list needs `list-disc pl-6` back.
- `margin: 0` on everything breaks a native `<dialog>`'s own centring; it needs `m-auto`.

---

## Interactivity

**Alpine stores** hold what more than one component reads: `theme` (dark class +
localStorage) and `nav` (which menu is open — one at a time, with a 200ms grace period so
a diagonal move to a lower item doesn't lose it).

**Every state is server-rendered and toggled with `x-show`.** The auth forms' four
states, the FAQ answers and the search results are real markup, so they are searchable
and survive with JavaScript off. Closed items carry `x-cloak` so nothing flashes open.

**`$root`, not `$el`, inside an `Alpine.data()` method.** `$el` resolves to whichever
element the expression is running on — the input, or the close button — while `$root` is
the component's own element. This silently broke focus return in the header search.

**Search** is an inline header field over an index built at compile time from every demo
post (`data/search.ts`, 35 entries). The button carries `data-ghost-search` and
`openSearch()` bails if `#sodo-search` exists, so Ghost's own search takes over on a real
install without the two fighting.

---

## Verification

**Compare rendered-to-rendered.** The reference PNGs are a sanity check, not the target:
score the build against the _original HTML rendered through the same pipeline_, with the
design tool's chrome bar hidden by injected CSS and `px()` rewritten to local images.
Scoring the original against the PNGs gives the noise floor for the run.

**Accepted noise floor, ≈1–1.5%.** Three causes, all understood, none worth chasing:

| cause                                             | typical size                          |
| :------------------------------------------------ | :------------------------------------ |
| mono substitution (system stack vs IBM Plex Mono) | 0.25px per chip, 0.09px per 11px line |
| photo resampling at a sub-pixel offset            | up to 9% of a detailed image's pixels |
| glyph antialiasing on serif text                  | 3–5% of a text-dense band             |

Investigate a page only if it falls below ~98.5%.

**Two traps in the headless harness:**

- `ui-monospace` resolves to a different face in headless Chrome than in a real browser,
  so mono-heavy pages drift there in the _opposite_ direction from reality. Trust the DOM
  measurements taken in a real browser.
- `requestAnimationFrame` callbacks do not fire in the automated tab. Never build
  behaviour on rAF, and never verify with it.

**A 200 response is not proof a page rendered.** Three separate incidents shipped an
empty body behind a 200 — a component prop that was destructured but never defined, and
twice a missing import. Assert a byte floor and a clean dev log, not just the status.

**Restart the dev server after adding a page.** Tailwind's Vite plugin does not always
rescan a brand-new file, so arbitrary values silently fail to generate. `pnpm build`
scans from scratch, so this is a dev-only trap.

## Fonts are committed, not fetched

The Fonts API was doing its job — Google-hosted files, downloaded at build, served
from our own origin. It was swapped for woff2 committed under `public/fonts/` so the
faces live with the repo and the build has no network dependency at all.

**Newsreader had to stay variable.** The obvious version of this change — drop in the
per-weight static files Google's download button hands you — is wrong. Those instances
are pinned to a single optical size (`Newsreader 9pt`), and the whole reason the old
config requested the `opsz` axis was that a pinned instance renders ~5% wider than the
design source. The files here are the variable font pulled from the `css2` endpoint with
`opsz` requested, roman **and** italic, carrying `wght 200–800` and `opsz 6–72`. Italic
is not optional: eleven components set `italic` on `font-body`/`font-display`
(standfirsts, author bios, member quotes, 404-02), and a synthesized oblique on a serif
is visibly wrong.

`font-weight: 300 600` is declared even though the binaries go to 800 — that is the
range the Fonts API declared, so `font-bold` clamps to 600 exactly as it did before.
Widening it is a visual change, not a cleanup.

Newsreader keeps Google's `latin` / `latin-ext` / `vietnamese` split with `unicode-range`,
so a reader who never hits those glyphs never downloads those files. Archivo is
per-weight static — the design only uses 400/500/600/700, and there is no optical-size
axis to lose.

**What was given up:** Astro's metric-matched fallback faces. `font-display: swap` now
falls back to plain Georgia / system-ui, so first paint reflows slightly. Worth it for a
build with no font fetch; add `size-adjust`/`ascent-override` faces if CLS shows up.

**Two things that bite here:** `<link rel="preload" as="font">` without `crossorigin`
downloads the file twice. And a `@font-face` pointing at a missing file fails silently —
the page just renders in the fallback. Check filenames in `fonts.css` against
`public/fonts/` both directions; today it is 24 and 24.

## Retrofit to the house rules (2026-08)

This theme was built before the `build-theme-markup` skill existed, so it never had a
measured baseline and it missed four of the house rules. Both were fixed in one pass.
Route paths were deliberately left alone.

### The baseline it never had

All 27 routes were captured at 1568px in both modes and scored three ways per
`verification.md` — against the reference PNG (the gate), against the design source
rendered through the same pipeline (the diagnostic), and the source against the PNG
(the ceiling).

**The markup was already at the ceiling everywhere.** On 52 of 54 captures the build
lands within 0.5 of what the original itself scores against its own PNG; on 8 it beats
the original. Nothing in the pixel column needed work, and the low absolute numbers are
the renderer gap, not defects:

- `/post-01` scores 90.6 — and its noise floor is 90.67. The build is 0.06 off a
  ceiling that no markup can pass.
- `/recommendations-02` 96.3 against a 96.39 floor; `/post-01-paywalled` 96.05 against
  96.14. Same story.
- `/about-02` is the one anomaly, and it runs the other way: build-vs-PNG 97.73 against
  a floor of 93.84. The _staged original_ disagrees with the PNG in the hero band
  (bands y=200–500, 38% of band width) because its hero image does not stage. The build
  matches the reference better than the source does. Left alone.

Diagnostic residuals sit at 99.1–99.7 on most pages, with six at 98.4–98.7
(`recommendations-02`, `blog-02`, `tags-single-02`, `homepage-01`, `tags-02`,
`author-single-02`). In every one of those six the build scores _higher_ against the
PNG than the original does, so closing the residual would move away from the reference.
Not chased.

### What the retrofit changed

**Six breakpoint tokens.** `--breakpoint-xs: 380px`, `--breakpoint-stack: 768px`,
`--breakpoint-nav: 1200px` added to `@theme` alongside Tailwind's defaults. No reference
PNG is narrower than 1568px, so everything gated on these is unmeasured against the
design and is judged by the overflow audit instead.

**The mode toggle moved into the header.** It existed, but as a `fixed top-5 right-5`
button imported separately into all 27 pages — 22 copies of the same floating control,
overlapping page content. It now renders once inside `Header.astro` in the contract's
bar order (search · mode · subscribe), on every variant including `auth`. The 22
per-page imports are gone; `styleguide.astro` keeps its own because it renders the
boxed `demo` specimen rather than a real site header.

**Nav collapse below 1200px.** Hamburger plus a full-width, full-viewport-height overlay
starting beneath the bar, carrying what the bar drops: the search field, the whole nav
flat, and Subscribe. The bar's height is measured on open rather than assumed, because
the post template passes a shorter `compact` bar.

**`headerSearch` moved to `Layout.astro`.** It was registered from an `is:inline` script
inside `HeaderSearch.astro`, which the compact post header does not render — so the
compact header would have carried `x-data="headerSearch"` with nothing registered.
Registration now lives with the other Alpine stores in the Layout, which every page has.

**Auth states** already shipped all four with a switcher. Unchanged.

**`/` redirects to `/homepage-01`.** The bare domain used to 404.

**Vite watcher exclusions** for `.shots/`, `.originals/` and `panel-*.png`. Without them
every capture lands in the watcher, which reloads the page mid-shot and eventually wedges
the dev server in a reload loop.

### What the retrofit cost

Re-scored against the same PNGs: **mean −0.10**, and 50 of 54 captures moved by 0.00.
The whole cost lands on the four auth captures, at **−1.38** each — those pages are
500–928px tall, so the header is a far larger share of the frame, and the toggle is a
new element in a bar that previously held only a wordmark and a back-link. That is the
known price of the rule that every variant ships a mode toggle; the auth pages still
land ~1.4 below their own noise floor, which is where they were before.

### The responsive audit

`public/probe-mobile.html` runs 27 routes × 12 widths = **324 checks** in iframes
(headless Chrome will not open a window under ~500px, so narrow widths cannot be
captured directly — a "375px" screenshot is a 500px layout, cropped).

First run: **45 failures**. Final: **0**.

- **26 were one utility.** Every `SCROLLHIDE` hit was `div.strip.overflow-x-auto` — the
  tag strip, on six templates at every width below 1200. The strip hides its own
  scrollbar by design, so anything past the right edge reads as absent rather than as
  scrollable. `@utility strip` now wraps below `--breakpoint-nav` instead of scrolling.
- **Five were the bare-`1fr` trap.** `grid-cols-[300px_1fr]` and friends: `1fr` is
  `minmax(auto,1fr)`, whose floor is the column's min-content width, so a long headline
  pushes the row wider than the page instead of wrapping. Fixed in `ArchiveListItem`,
  `PostListRow`, `MediumPostCard`, `NumberedPostRow`, `AuthorRow` and
  `TypeScaleSection`, and each of those rows now collapses to one column below `stack`
  or `xs`.
- **Two fixed sidebars never collapsed.** `grid-cols-[232px_minmax(0,1fr)]` in
  `PostTemplate` and `[280px_minmax(0,1fr)]` in `author-single-02` overflowed a phone by
  140–210px. Both collapse below `stack`.
- **The membership comparison table cropped the Pro column** — the rightmost tier, the
  one being sold, was what fell off the edge. Below `stack` it renders as a list of
  benefit cards with each tier labelled.

Note what the audit is blind to: it catches overflow, not cramping. A layout can pass
all 324 checks and still be unreadable.

### Verification ports

**4393** dev, **4394** staged originals. `scripts/verify/` holds the harness, copied in
rather than written per theme; `baseline-jobs.json`, `baseline-index.json`,
`baseline-scores.json` and `after-scores.json` are the run's inputs and results.

`routes.json`'s `expect` strings are asserted against the rendered body — six of them
were wrong on first write (guessed copy that the pages do not contain) and were replaced
with strings read out of the live pages. An `expect` that never matches is a silently
inert assertion.

### Scores after the retrofit

Build vs reference PNG, with the noise floor each page is measured against. `gap` is
build minus floor — at or above 0.00 means the build matches the reference at least as
well as the design source itself does.

| route                 | mode  | vs PNG | floor |   gap |
| :-------------------- | :---- | -----: | ----: | ----: |
| `/404`                | dark  |  98.74 | 98.97 | -0.23 |
| `/404`                | light |  98.72 | 98.96 | -0.24 |
| `/404-02`             | dark  |  98.53 | 98.77 | -0.24 |
| `/404-02`             | light |  98.51 | 98.73 | -0.22 |
| `/about-01`           | dark  |  97.99 | 98.12 | -0.13 |
| `/about-01`           | light |  97.90 | 98.02 | -0.12 |
| `/about-02`           | dark  |  97.82 | 94.06 | +3.76 |
| `/about-02`           | light |  97.73 | 93.84 | +3.89 |
| `/author-single-01`   | dark  |  98.11 | 98.22 | -0.11 |
| `/author-single-01`   | light |  98.06 | 98.16 | -0.10 |
| `/author-single-02`   | dark  |  97.24 | 97.36 | -0.12 |
| `/author-single-02`   | light |  97.15 | 97.27 | -0.12 |
| `/authors-01`         | dark  |  98.21 | 98.36 | -0.15 |
| `/authors-01`         | light |  98.16 | 98.30 | -0.14 |
| `/authors-02`         | dark  |  97.77 | 98.06 | -0.29 |
| `/authors-02`         | light |  97.69 | 97.96 | -0.27 |
| `/blog-01`            | dark  |  98.13 | 98.02 | +0.11 |
| `/blog-01`            | light |  98.09 | 97.98 | +0.11 |
| `/blog-02`            | dark  |  97.10 | 96.70 | +0.40 |
| `/blog-02`            | light |  97.02 | 96.62 | +0.40 |
| `/homepage-01`        | dark  |  97.10 | 96.61 | +0.49 |
| `/homepage-01`        | light |  97.09 | 96.59 | +0.50 |
| `/homepage-02`        | dark  |  98.21 | 98.36 | -0.15 |
| `/homepage-02`        | light |  98.16 | 98.31 | -0.15 |
| `/membership-01`      | dark  |  97.76 | 98.05 | -0.29 |
| `/membership-01`      | light |  97.67 | 97.95 | -0.28 |
| `/membership-02`      | dark  |  97.78 | 98.05 | -0.27 |
| `/membership-02`      | light |  97.68 | 97.94 | -0.26 |
| `/post-01`            | dark  |  90.16 | 90.22 | -0.06 |
| `/post-01`            | light |  90.61 | 90.67 | -0.06 |
| `/post-01-paywalled`  | dark  |  96.01 | 96.10 | -0.09 |
| `/post-01-paywalled`  | light |  96.05 | 96.14 | -0.09 |
| `/post-02`            | dark  |  97.62 | 97.78 | -0.16 |
| `/post-02`            | light |  97.54 | 97.69 | -0.15 |
| `/post-02-paywalled`  | dark  |  97.40 | 97.53 | -0.13 |
| `/post-02-paywalled`  | light |  97.34 | 97.46 | -0.12 |
| `/recommendations-01` | dark  |  98.25 | 98.42 | -0.17 |
| `/recommendations-01` | light |  98.15 | 98.38 | -0.23 |
| `/recommendations-02` | dark  |  96.39 | 96.48 | -0.09 |
| `/recommendations-02` | light |  96.30 | 96.39 | -0.09 |
| `/sign-in`            | dark  |  97.31 | 99.09 | -1.78 |
| `/sign-in`            | light |  97.68 | 99.07 | -1.39 |
| `/sign-up`            | dark  |  97.20 | 99.01 | -1.81 |
| `/sign-up`            | light |  97.56 | 98.99 | -1.43 |
| `/styleguide`         | dark  |  98.44 | 98.61 | -0.17 |
| `/styleguide`         | light |  98.36 | 98.54 | -0.18 |
| `/tags-01`            | dark  |  98.65 | 98.81 | -0.16 |
| `/tags-01`            | light |  98.60 | 98.76 | -0.16 |
| `/tags-02`            | dark  |  98.19 | 97.89 | +0.30 |
| `/tags-02`            | light |  98.14 | 97.83 | +0.31 |
| `/tags-single-01`     | dark  |  98.31 | 98.42 | -0.11 |
| `/tags-single-01`     | light |  98.25 | 98.37 | -0.12 |
| `/tags-single-02`     | dark  |  97.28 | 97.25 | +0.03 |
| `/tags-single-02`     | light |  97.22 | 97.18 | +0.04 |

## Tag pills: colour from `aria-pressed`, and a strip that wraps

Two defects with one root and one shared consequence, both reported off the blog archive.

**The active pill lost its fill.** The pills were coloured with `x-bind:class`, toggling
`bg-text text-surface border-text` against `bg-transparent border-border text-text`.
That cannot work: Alpine adds the classes its expression names but never removes the
ones already sitting in the `class` attribute, so an active tag pill carried both
`bg-transparent` and `bg-text` and CSS source order — not the binding — picked the
winner. `bg-transparent` won, so a selected tag rendered as a hairline outline instead
of the filled pill every reference PNG shows. The All pill had the same collision on one
property only (static `text-muted` against bound `text-surface`), so it kept its fill but
its label stayed grey.

Colour now comes from the `tag-pill` utility keyed off `[aria-pressed='true']`, an
attribute the buttons already carried for assistive tech. Alpine flips the attribute and
owns no colour. The conflict is gone by construction, and the strip renders correctly
with JavaScript off — the server marks All as pressed, which is the state the PNGs show.

Measured: **0.00 change** on all 16 captures of the eight pages carrying a strip. The
reference PNGs only ever show the default state, where the sole difference is the All
label's colour against its dark fill — a few hundred pixels inside one 100px band on a
7,000px page. The fix is real but lives in the interactive states no PNG covers, which
is worth remembering: a page can sit at its noise floor and still be visibly wrong once
someone clicks.

**The focus ring was cropped.** The strips were `overflow-x-auto` with 2px of padding,
against a 2px focus outline drawn at a 2px offset. An overflow container clips whatever
its children paint outside their box, so the ring came out sliced on all four sides. The
strips no longer scroll at any width — `@utility strip` sets `flex-wrap: wrap` outright,
which also retires the `SCROLLHIDE` failures the responsive audit raised on six
templates. At 1568px, the width every PNG was rendered at, the pills fit on one line
either way, so the measured layout is unchanged. `public/probe-focus.html` walks each
pill's ancestors on the five routes that carry a strip and reports clipping containers:
currently 0.

The theme's global `:focus-visible` rule (2px accent outline, 2px offset) was already
correct and is unchanged — nothing about the ring needed restyling, only room to draw in.

## Pagination sits below the article grid, not at the foot of the page

Both reference PNGs put the homepage pagination at the very bottom — after the newsletter
banner and the writers strip, immediately above the footer. Moving it directly under the
article grid is therefore a **deliberate divergence from the design source**, made on the
client's instruction.

It also makes the homepages consistent with the archive templates, which already placed
it this way: `/blog-01` and `/blog-02` render pagination straight after the list or grid
and before the newsletter. The homepages were the only two pages that did not.

On `/homepage-02` the control sits _inside_ the 1120px article column rather than at page
width, so it lines up with the grid it belongs to — the same treatment `/blog-01` gives
it.

**Measured cost: −0.45 to −0.54** across the four homepage captures.

| route          | mode  | before | after | floor |
| :------------- | :---- | -----: | ----: | ----: |
| `/homepage-01` | light |  97.09 | 96.64 | 96.59 |
| `/homepage-01` | dark  |  97.10 | 96.62 | 96.61 |
| `/homepage-02` | light |  98.16 | 97.66 | 98.31 |
| `/homepage-02` | dark  |  98.21 | 97.67 | 98.36 |

`/homepage-01` still clears its noise floor. `/homepage-02` now sits ~0.68 below the floor,
where it was 0.15 below before — that gap is the divergence itself, not a defect, and it
will not close while the control stays here.

Worth recording for future estimates: displacing roughly 490px of a 3,873px page was
expected to cost several points, on the reasoning that a ~92px shift exceeds the scorer's
±40px per-band realignment window. It cost half a point. The bands either side of the move
are large flat regions — newsletter panel, writers strip — that still match within the
luminance tolerance once shifted, so the alignment cliff is much softer than the ±40px
figure alone suggests. Do not estimate this class of change; measure it.

## "Browse by tag" stacks its label below 768px

`TagStrip` has always had a `stacked` layout — the tag archive uses it — but the two
homepage strips ran `inline`, with the label holding a column to the left of the pills at
every width. On a phone that left the pills about 240px to work with: a strip that takes
two rows on a desktop turned into six or seven, one or two pills per row, while a
three-word label sat in otherwise empty space beside it.

Both inline layouts now adopt the stacked treatment below `--breakpoint-stack`. The label
is short and the space it holds is worth more to the pills than to itself; nothing else
about either layout changes.

Measured: **0.00** on all six affected captures (`/homepage-01`, `/homepage-02`,
`/tags-single-01`, both modes). Every reference PNG is 1568px wide, so the change sits
entirely below the measured range — which is the normal state of affairs for anything
gated on these breakpoints, and the reason the responsive audit exists at all. It stayed
at 324 checks, 0 failures.

## Sticky rails stop being sticky once the grid stacks

`PostRail` (`/post-02`, `/post-02-paywalled`) and `AuthorRail` (`/author-single-02`) are
`sticky top-[120px]` so they hold position beside the article on a wide screen. Collapsing
those two grids to one column below `--breakpoint-stack` — done in the retrofit above —
left the `sticky` in place, and a sticky child of a single-column flow pins itself while
the rest of the column scrolls underneath it. The article ran straight through the table
of contents and the share buttons; the author bio ran through the portrait.

**This was introduced by the retrofit**, and the responsive audit passed it: 324 green
checks with the defect live on three routes. Nothing was wider than anything, so no
overflow rule could see it — the exact blind spot recorded above as "the audit catches
overflow, not cramping".

Both rails are now `max-stack:static`. `top` has no effect on a static box, so the offset
needs no separate guard.

The audit gained a rule rather than just a fix. `STUCK` flags any element computing to
`position: sticky` whose parent grid has resolved to a single track at that width — which
is precisely the condition that makes stickiness meaningless and harmful. Run against the
broken state it reported 9 failures: three routes × the three widths below `stack`, and
nothing else. Against the fixed state, 0. The audit is now 324 checks over five rules.

Measured cost at 1568px: **0.00** on all six captures. `max-stack` never applies at the
width the PNGs were rendered at.

## Two audit rules had never fired

Reported as "the recommendations page is broken on mobile". It was — the row grid
`[44px minmax(0,1fr) auto]` never collapsed, so at 380px the description column was
**50px wide**, one word per line, while the Subscribe and Visit buttons held 180px beside
it. But the audit had been reporting 0 failures on that page throughout.

`getClientRects()` returns one rect **per line box only for inline elements**. For a
block-level `<p>` or `<h2>` it returns exactly one, always. Both the narrow-prose rule and
the heading-wrap rule gated on `getClientRects().length >= 3` as a stand-in for "at least
three lines", so neither could ever fire. They were added as a _tightening_ in the
previous session, to clear 138 false positives — which they did, by disabling themselves.
Every "324 checks, 0 failures" reported between then and now was three rules, not five.

Line count is now `round(height / line-height)`, with a fallback through `font-size × 1.2`
for `line-height: normal`.

A second bug surfaced with them. `minProse` was `W >= 768 ? 250 : 0.6 * (docW - 64)`,
which demands **422px** at 767px — a stricter bar than the 250px it asks one pixel later.
The constraint got harsher as the screen got wider, and flagged every legitimate
two-column tablet layout. It is now `min(250, 0.6 * (docW - 64))`: 250px is the floor for
a comfortable measure, scaled down only where the viewport cannot give that much.

With the rules working, the audit found **8 real defects** across five components. All are
the same failure — a fixed or `auto` track holding its width while the text column
absorbs every pixel of the shortfall:

| component           | at     | measure | fix                                                          |
| :------------------ | :----- | ------: | :----------------------------------------------------------- |
| `RecommendationRow` | 380px  |    50px | collapse below `stack`                                       |
| `MemberQuoteRows`   | 380px  |    52px | collapse below `stack`                                       |
| `PostListRow`       | 380px  |   176px | `max-xs` → `max-stack`                                       |
| `BookmarkCard`      | 320px  |    99px | stack the 140px decorative panel below `stack`               |
| `MemberQuotes`      | 1023px |   250px | auto-fit minimum 280px → 340px, so it drops to two up sooner |

`MediumPostCard` was not flagged but has `PostListRow`'s exact shape and was moved to
`max-stack` with it — its demo excerpt is simply short enough to stay under the character
threshold. The rule is about the layout, not about this copy.

`max-xs` was the wrong breakpoint in the first place: `xs` is 380px, so `max-xs` stops
applying **at** 380 — the width the audit tests and the width the column is still 176px.

Measured at 1568px across all 54 captures: **53 unchanged, one moved −0.02**
(`/recommendations-02` light, which renders none of the changed components — measurement
noise, not an effect). This also qualifies the determinism note above: consecutive
captures in one run are pixel-identical, but across runs there is sub-0.05 drift.

The audit is now 324 checks over five working rules, at 0 failures. That number means
something it did not mean before.

## The Ghost port: toolchain, ports, and what Phase 0 measured (2026-08)

The theme lives in `ghost/` beside the Astro build. The Astro build does not move — it is the
evidence the port is scored against, so `src/` is read-only to the port. `ghost/` is symlinked
into the local install at `~/ghost-mirror/content/themes/mirror`.

**Two Node versions, on purpose.** Astro and the verify harness run on Node 24 (`.nvmrc`).
Ghost 6 declares `engines.node ^22.23.1` and `engines.cli ^1.29.1`, so the local Ghost runs on
**Node 22.23.2** with **Ghost-CLI 1.32.2**; the Homebrew CLI on this machine was 1.28.6, below
Ghost 6's floor, and neither installed Node 22 (22.14.0, 22.17.0) satisfied `^22.23.1`. Never run
`ghost` under Node 24. Measured against **Ghost 6.60.0** and **gscan 6.4.2** — the plan was
written against 6.61.0, and the installed release is what the numbers below describe.

**Ports, reconciled — and the first attempt at this got it wrong.** An earlier version of this
entry said the previously-recorded "4393 dev, 4394 staged originals" was "never true of this repo",
on the strength of `astro.config.mjs` alone. It was true: `scripts/verify/baseline-jobs.json` and
`baseline-orig-jobs.json` are 54 committed capture jobs each, pointing at **4393** and **4394**. The
capture harness was evidently driven against a static/preview server on 4393, not the dev server.
Three ports, three different jobs:

| what                      | port | source of truth                                    |
| :------------------------ | ---: | :------------------------------------------------- |
| Astro dev server          | 4380 | `server.port`, `astro.config.mjs`                  |
| Astro origin for captures | 4393 | `scripts/verify/baseline-jobs.json` (54 jobs)      |
| staged design originals   | 4394 | `scripts/verify/baseline-orig-jobs.json` (54 jobs) |
| local Ghost               | 2368 | Ghost default, `~/ghost-mirror`                    |

`pnpm verify:serve` serves the originals on 4394 so the committed jobs work unmodified. Repointing
108 job entries to a port I had picked would have been the wrong way round.

**`{{reading_time}}` constants**, read out of the installed `@tryghost/helpers@1.1.106`
(`lib/utils/reading-minutes.js`), not from memory: **275 words per minute**, and image time added
as **12 s for the first image, 11 s for the second, decreasing by one, floored at 3 s**, then
`Math.round(seconds / 60)`. A `feature_image` counts as one image, so it costs a designed post
12 s before a single word is counted. `reading_time` short-circuits the calculation when the API
supplies it, but it is a serializer-computed field and not writable, so a fixture's only lever on
the rendered label is word count — which is why the generator has to solve word counts backwards
from the design's labels rather than approximate them.

### Both open questions settled empirically — do not re-litigate

**`signin` and `signup` are not reserved slugs.** The pitfall was folklore. Ghost's only protected
slugs are `ghost`, `rss` and `amp` (`core/shared/config/overrides.json`). Pages created with slugs
`signin`, `signup` and `sign-in` all kept the requested slug and served 200. The theme keeps
`sign-in` / `sign-up` because they read better, not because it must.

**The custom-settings cap is exactly 20.** gscan 6.4.2 passes a theme with 20 entries under
`config.custom` and fails 21 with `property "config.custom" contains too many settings`. Measured,
not inferred.

### gscan enforces that a declared setting is a used setting

A setting declared in `config.custom` but never read from a template is a gscan **error**, named
per setting. So the plan's instruction to write the whole ten-setting config block in Phase 1 is
wrong on contact: a setting ships with the template that consumes it, never before. The skeleton
declares exactly one, `default_appearance`, because `default.hbs` reads it.

The same scan produced the opposite lesson about cards: `card_assets.exclude` is what makes gscan
_demand_ the theme style that card. Declaring the plan's exclude list against a theme with no
`.kg-*` layer turned 2 errors into 13 and 3 warnings into 30, and would have shipped four card
types unstyled. `card_assets` is `true` until the layer exists.

### Divergences the platform forced on the skeleton

**The two font preloads are not ported.** `{{asset}}` unconditionally appends `?v=<content hash>`
(`core/frontend/meta/asset-url.js`), so a preload `href` can never match the bare `url()` a static
stylesheet requests, and the browser fetches every preloaded face twice. Ghost's own Source theme
buys the match by re-declaring its `@font-face` rules inside a template partial — for MIRROR that
would fork 24 declarations away from `src/styles/fonts.css` and give the fonts two sources of
truth. Measured on the running install: three faces on the critical path, each fetched exactly
once, no request to Google. The stylesheet and script preloads are kept.

**`.kg-width-full` reuses the wide bleed.** `ImageCard.astro` honours `wide` (`--wide-out`, 88 px
each side, above 64rem) and renders `full` as a regular image, so the design source defines no
viewport-edge treatment to port. Ghost ships no CSS for either class whatever `card_assets` says,
and gscan errors on their absence, so both map to `bleed-wide`. A concession, and the first entry
in the `.kg-*` layer.

**Ghost's font settings are honoured through a fallback.** `--gh-font-heading` / `--gh-font-body`
are read in `ghost/assets/css/screen.css` as `var(--gh-font-heading, var(--font-newsreader))` and
friends — the idiom Source uses. With no font chosen the variables are undefined and every role
resolves to the family the design was built against, so the pixel reference does not move; a buyer
who picks a font gets the control gscan says they should have.

### The identity axis, unblocked

`scripts/verify/prep.json` shipped pointing `source` at `/Users/danielaguillen/Downloads/Mirror
Ghost Theme` — another machine's home directory — so for a while the identity axis could not run
here at all and this section recorded it as a blocker. The sources are on this machine, at
`~/Downloads/GHOST THEME MARKUP/`, which holds three things the port needs:

| path                  | what                                                                              |
| :-------------------- | :-------------------------------------------------------------------------------- |
| `Mirror Ghost Theme/` | the **14** `MIRROR *.dc.html` design sources, plus `support.js` and `uploads/`    |
| `MIRROR VARIATION A/` | **64** reference PNGs, named template × layout × mode (`02-homepage-A1-dark.png`) |
| `QUARRY VARIATION B/` | Variant B — ignored, per `CLAUDE.md`                                              |

`prep.json` now points at the first of those with a `~`, which `prep_originals.py` expands, so the
config stays portable rather than encoding one machine's home again. `pnpm verify:prep` stages **56
files** — 14 templates × 2 layouts × 2 modes — and `pnpm verify:serve` serves them on 4381.
Spot-checked in a real browser: the A1 light homepage renders at 7522 px with 16 images and **zero**
broken ones, so the Pexels-to-local rewrite rules still match the sources; A2 dark renders at
7125 px.

**The harness needs a venv.** This machine's `python3` is Homebrew's, which refuses a system-wide
install under PEP 668, so `pillow` and `numpy` live in a gitignored `.venv` created by
`pnpm verify:venv`, and every harness script invokes `.venv/bin/python3` rather than `python3`.
Using `--break-system-packages` on someone's interpreter to run a repo's test tooling is not a
trade this repo should make.

**Two things the plan got wrong about the harness, corrected here.** `score.py` **does** have
`--skip-header` (optional px, default 100) and also a `--crop-original` the plan never mentions —
the plan states it has neither and Phase 3's gate was written around their absence, so that gate can
be simpler than it says. The full flag set is `--height --skip-header --band --tol --align --worst
--panel --out-dir --label --crop-original`.

**The reference build renamed the publication.** The design sources say **"The Quarry"**; the Astro
build's `src/data/navigation.ts` says `SITE_TITLE = 'Mirror'`, and the fixture follows the reference
build because `src/data` is the source of truth for Demo content. So the wordmark differs from the
design on every Surface, in the Astro rows as much as the Ghost ones. That is exactly the difference
the two-axis split exists to absorb: it costs identity a constant header-band diff, costs parity
nothing, and an identity row that fails while its parity row passes is content-derived by
construction. Do not "fix" the fixture to say The Quarry — that would move it away from `src/data`.

**The pipeline is proven, with one real number.** Captured `MIRROR About A1.dc.html` off 4394 and
Ghost's `/about/` off 2368 at the same 1568 px width and scored them: **97.38 %** identity over 24
bands. For context, `after-scores.json` records the Astro row for `about-01 light` at **97.90**
against a floor of **98.02** and a diagnostic noise floor of **99.36** — so the Ghost skeleton sits
**0.52 behind the reference build** on a Surface whose designed layout (split hero, stats grid,
masthead, contact block) has not been built yet. The worst band is `y=200` at 9.33 %, which is the
header — where the wordmark difference lives, exactly as predicted above.

That number is evidence the harness runs, not a quality claim: one Surface, one Mode, a skeleton
template. What it settles is that the identity axis is measurable here now, which is what every
later Surface ticket's floor comparison was waiting on.

## The Ghost route map: one Surface, one template, one URL

Ghost gives native routes for some Surfaces and nothing for others, so the binding is decided
once here rather than re-invented by each Surface as it lands.

| Surface           | URL (configured)         | Template                               | Why that treatment                                                                  |
| :---------------- | :----------------------- | :------------------------------------- | :---------------------------------------------------------------------------------- |
| homepage          | `/`                      | `home.hbs`                             | A `route:` — the magazine cover, always at `/`, never page one of something else    |
| Feed              | `/archive/`              | `index.hbs`                            | The `collection:` — it owns the posts and their permalinks, and it paginates        |
| Post              | `/{slug}/`               | `post.hbs`                             | The collection's `permalink`, so post URLs stay at the site root as in the design   |
| Tag archive       | `/tag/{slug}/`           | `tag.hbs`                              | Native taxonomy                                                                     |
| Author archive    | `/author/{slug}/`        | `author.hbs`                           | Native taxonomy                                                                     |
| Tags Directory    | `/tags/`                 | `page-tags.hbs`                        | A standing page: it lists tags, not posts, so no collection can produce it          |
| Authors Directory | `/authors/`              | `page-authors.hbs`                     | Same — a masthead is a page, not a feed                                             |
| About             | `/about/`                | `page-about.hbs`                       | Standing page                                                                       |
| Membership        | `/membership/`           | `page-membership.hbs`                  | Standing page                                                                       |
| Recommendations   | `/recommendations/`      | `page-recommendations.hbs`             | Standing page wrapping the `{{recommendations}}` helper                             |
| Sign in / Sign up | `/sign-in/`, `/sign-up/` | `page-sign-in.hbs`, `page-sign-up.hbs` | Standing pages; Portal owns the exchange itself                                     |
| Error             | any missing URL          | `error-404.hbs`                        | Ghost resolves `error-404.hbs` before `error.hbs`; verified with a real missing URL |

**Why the homepage is a route and the Feed is the collection.** A post can live in exactly one
collection, so no configuration exists in which both `/` and `/archive/` own the same posts. The
design draws a magazine cover and a separate archive; the only way to get both is to make one of
them a `route:`. The cover is the one that can be a route, because it is editorially curated
rather than paginated.

The consequence is the constraint every home partial is written under: a `route:` has **no posts
context and no pagination at all**, so every editorial slot in `home.hbs` is a `{{#get}}`. That
also makes the template correct bare, where `/` _is_ the collection and `home.hbs` is its page 1.
Verified in both configurations — bare, `/` renders `home.hbs` and `/archive/` correctly 404s;
configured, both resolve and only `/archive/` paginates.

**Every page layout ships twice**, `page-{slug}.hbs` and `custom-{slug}.hbs` over one shared
partial in `partials/pages/`. Ghost resolves `page-{slug}` → the selected custom template →
`page.hbs`, so the demo slugs keep working while a buyer can apply any of these layouts to a page
named anything. `custom-wide.hbs` has no `page-*` counterpart on purpose: it is a layout to opt
into, not a demo page.

Departure from the plan: it specified a single `custom-directory.hbs` for the tags, authors and
recommendations directories. Those are three different Surfaces reading three different sources,
so one alias could only ever render one of them and a buyer picking "Directory" would have no way
to know which. Three aliases, named for what they render.

### Route paths against the reference build

Post, tag and author URLs match the reference build. The rest cannot: the Astro build has one
route per template × layout (`/homepage-01`, `/homepage-02`, …) because it is a preview of a
design, and a Ghost publication has one URL per Surface with the layout chosen in settings. That
is the layout picker's job, not a route's, and it is why 27 Astro routes collapse to 13 Surfaces.
`/blog-01` becomes `/archive/`; `/tags-single-01` becomes `/tag/{slug}/`; `/404-02` has no URL of
its own at all.

### Two traps this cost

**Ghost caches the theme's template list.** Adding `home.hbs` to an already-active theme produced
`Missing template home.hbs for route "/"` and a 400 on the homepage until Ghost was restarted. New
template, restart Ghost — the same brand-new-file trap the Astro build has with Tailwind's Vite
plugin, in a different costume.

**The routes.yaml upload endpoint is `POST`, not `PUT`.** `PUT
/ghost/api/admin/settings/routes/yaml/` answers 404 with a misleading "client accept-version is
behind" message; the route is registered as `POST` in
`core/server/web/api/endpoints/admin/routes.js`.

### Smoke assertions must be unique, not merely present — and `data-surface` is how

`scripts/ghost/routes.json` (configured) and `routes-bare.json` (bare) drive `pnpm ghost:smoke`
and `ghost:smoke:bare`, and `pnpm ghost:routes` regenerates both from the fixture.

The first version of this note claimed every `expect` string was "a marker only its own template
emits". That was true when written and false two commits later, which is the more useful lesson.
The markers were design strings — `Subjects`, `Writers`, `About`, `Membership`, `Archive` — and once
the demo publication seeded a real navigation menu, all five appeared in the Chrome of every page.
The suite still reported 12/12 while proving nothing about which template had rendered. Five of
twelve assertions were inert and the passing run hid it.

So each template's outermost element now carries one `data-surface` attribute naming the Surface it
renders, and that is what the assertions match. Two weaker options were rejected:

- **`{{body_class}}`** identifies the Surface _kind_, not the template: `/about/` is
  `page-template page-about` whether `page-about.hbs` rendered or `page.hbs` fell back — which is
  exactly the distinction the route map needs to prove.
- **Design copy** is neither unique (the nav problem above) nor layout-independent: `Latest` exists
  only in the A1 home layout, so flipping one setting would have quietly inerted the homepage
  assertion too.

`build-routes.mjs` now refuses to write a config unless every assertion is **present on its own
route and absent from all eleven others**. Presence alone is not evidence of resolution; that check
is the whole point of the file.

The 404 Surface is deliberately absent from both files: `smoke.py` requires status 200, so
asserting the error Surface there would fail the run for being right.

## The layout picker: one shape, repeated per Surface

Both layouts of Variant A ship and the publication owner picks per Surface, so the mechanism is
decided once here and every later Surface repeats it without re-deciding anything. Proven
end-to-end on the homepage.

```handlebars
{{#get "posts" limit="7" include="authors,tags" as |feed|}}
  {{#match @custom.homepage_layout "Editorial masthead"}}
    {{> "home/a2" feed=feed}}
  {{else}}
    {{> "home/a1" feed=feed}}
  {{/match}}
{{else}}
  …empty state…
{{/get}}
```

Four rules, each load-bearing:

1. **One `{{#match}}`, at the top of the template.** Nothing below reads `@custom`, so a partial
   can be shared or moved without dragging a settings dependency behind it.
2. **Match the non-default option; the default lives in the `{{else}}`.** A value that does not
   match cannot render nothing — it falls through to a layout.
3. **Fetch once, above the dispatch; both layouts consume the same block param.** Two layouts must
   never mean two queries.
4. **A child partial that varies takes it as an argument** — `{{> "post-meta" byline=true}}` — and
   never reaches back up to `@custom`. This is Source's `navigationLayout=` pattern.

### What Ghost guarantees about the value, measured

- Writing an undeclared value through `PUT /ghost/api/admin/custom_theme_settings/` is **rejected
  with 422** (`Unallowed value for 'homepage_layout'`), and the previous value stands.
- A value orphaned by the theme renaming its options is **silently coerced to the default** on
  theme reload. So the stale-database case that rule 2 looks like it is defending against is
  actually handled by Ghost, and the earlier version of this note claiming otherwise was wrong.
- The case rule 2 really defends is a setting that is **absent entirely**. Removing
  `homepage_layout` from `package.json` while `home.hbs` still read it rendered the default layout
  at 200 with no Handlebars error. That is the guarantee worth having: a typo in a `@custom` key,
  or a settings sync that did not happen, degrades to a layout rather than a blank page.

### Flipping it needs no rebuild — but a new file needs a restart

Changing the setting through Ghost admin changes the rendered layout immediately: no code edit, no
asset rebuild, no restart. Verified by markers unique to each layout — A1's `md:grid-cols-3` grid
against A2's numbered `<ol>` — in both modes, with the tokens correct in each (`#faf9f7`/`#1c1917`
light, `#12100e`/`#f5f2ec` dark).

Adding a _new_ partial is the opposite: Ghost caches the theme's file list, so `home/a1.hbs` and
`home/a2.hbs` were invisible until `ghost restart`. New file, restart Ghost; changed setting,
nothing.

### A setting ships with the template that reads it

gscan enforces this in both directions and both are errors: a setting declared in `config.custom`
that no template references, and a `{{@custom.x}}` in a template with no matching declaration.
`homepage_layout` therefore arrives with `home.hbs`, `newsletter_text` arrived with the sign-up
form, and the remaining seven settings in the plan's config block arrive with their own Surfaces.
The cap is 20 (measured), so there is room.

## The demo publication: one reconciled content set

`scripts/ghost/build-fixture.mjs` reads `src/data/*.ts` and emits `fixture.json`;
`scripts/ghost/import.mjs` applies it. The fixture is the artifact and the API only applies it, so
reproducing the demo content never depends on a network path or a key. Output is a pure function of
`src/data` plus a fixed seed, so two runs are byte-identical.

`src/data` is imported, never re-transcribed. Node can strip types but cannot resolve the
extensionless sibling imports TypeScript uses (`archive.ts` imports `'./posts'`), so
`scripts/ghost/load-data.mjs` bundles the modules in memory with esbuild — already a dependency —
and imports the result from a `data:` URL. No temp file, no loader hook, no second copy of the data.

**Measured, end to end through the rendered site** (`pnpm ghost:verify`): 104 posts across 6 pages
of 18; all 14 subject counts and all 5 writer counts exactly as designed; **all 35 designed
reading-time labels byte-identical**; 12 posts non-public so the gate has something to gate.
`pnpm ghost:idempotence` re-imports and diffs a full snapshot: identical.

### The two things the generator solves rather than approximates

**The counts are a joint assignment.** 104 posts must satisfy five author marginals
(34/27/19/14/10) and fourteen tag marginals (summing 173) at once, with each designed post's own
author and tag already fixed. Filler is assigned from the largest remaining marginal first, then
every marginal is asserted exactly before anything is written. A near miss would otherwise surface
at gate time as "the directory shows 33, not 34" with no traceable cause.

**Reading time runs backwards from the label.** Ghost computes it as
`readingMinutes(html, feature_image ? 1 : 0)` — the same `@tryghost/helpers` function the theme
helper uses, confirmed in `core/server/api/endpoints/utils/serializers/output/utils/extra-attrs.js`
— so with one image the label is `round(words/275 + 0.2)` minutes and the exact word count for M
minutes is `275 × (M − 0.2)`. A "7 min read" post gets 1870 words, a "12 min read" post 3245.
Exact, not ±1, and it survives Ghost's HTML → Lexical → HTML round trip.

The prose generator is built on single alphanumeric tokens on purpose: Ghost counts words by
matching letter/digit runs _after_ stripping tags, so one apostrophe or hyphen would split a
visible word into two counted ones and put every label off by a minute.

### Reconciliation concessions

The Astro build gives each template its own dataset deliberately, because the design sources
genuinely differ. Ghost renders one publication, so those divergences die here. Precedence is by
breadth — `posts.ts` (the set the blog, tag and author templates share) wins, then `archive.ts`,
then the two per-template archives, then the membership strip, then the post detail page. Two pools
leave a field implicit because their template supplies it, and it is filled from the pool's own
context: every row on the author archive is by that author, every row on the tag archive carries
that tag.

Ten values were dropped. Each costs the Surface named beside it, and none is a defect to chase:

| post                               | field      | kept                  | dropped                           |
| :--------------------------------- | :--------- | :-------------------- | :-------------------------------- |
| What editors owe their readers now | `excerpt`  | the shared set's      | the post page's longer standfirst |
| The archive is the product         | `featured` | `true`                | archive's `false`                 |
| Type is the interface              | `tag`      | `Craft`               | archive's `Typography`            |
| On refusing the interview          | `tag`      | `Craft`               | tag archive's `Interviews`        |
| Two editors, one masthead          | `author`   | Marisol Ade           | tag archive's Erin Laurier        |
| Two editors, one masthead          | `date`     | 24 Sep 2025           | tag archive's 18 Dec 2025         |
| Twenty years, four publications    | `author`   | Marisol Ade           | tag archive's Erin Laurier        |
| Twenty years, four publications    | `date`     | 02 Jul 2025           | tag archive's 25 Sep 2025         |
| Twenty years, four publications    | `img`      | pexels-2705436        | tag archive's pexels-4641190      |
| Twenty years, four publications    | `alt`      | its matching alt text | the dropped image's alt text      |

The cost lands on the tag archive: three posts there now show the author, date and photograph the
author archive gave them. The fixture reports this list on every build, so the table cannot drift
away from the data.

Two further concessions are structural rather than per-post. **Ghost has no author-role field**, so
the masthead carries location and post count and the designed role line ("Founding editor") becomes
page content. **Ghost tiers have no "most popular" flag**, so the design's `featured` tier becomes
the `@custom.featured_tier` setting.

### The design's own nav is not ported

`navigation.ts` is a variant browser: eight menus of preview routes like `/homepage-01`. That is a
review affordance, not a publication's menu. The fixture seeds the menu the Surfaces actually imply
— Archive, Subjects, Writers, About, Membership — because the theme renders
`{{navigation}}` from the publication's own settings and a buyer edits it in admin.

### What the Ghost API would not do, and what it did instead

Four findings, each of which changed the design of the importer:

- **There is no way to create a staff user through the Admin API.** No `POST /users/` exists, only
  an invite flow that needs a mailbox. The five writers therefore go in through Ghost's own JSON
  importer (`POST /db/`), which matches users on email and does not duplicate them. Imported users
  land with status `locked` — they cannot sign in until they reset a password, which is correct for
  demo authors and affects neither authorship nor their archive Surface.
- **That importer is the wrong tool for everything else.** A repeat import left `probe-post-2`
  beside `probe-post` and added a bookkeeping `hash-import-<timestamp>` tag to the publication,
  which would have shown up in the Tags Directory and broken the fourteen-subject count. Posts,
  pages, tags, settings, tiers and recommendations all go through the Admin API, keyed on slug.
- **An Admin API key is not enough, so there is no key.** Integrations are refused by every
  endpoint beyond content: importing db content answers `You do not have permission to
importContent db`, and editing a user, writing settings, tiers or recommendations answers `API
tokens do not have permission to access this endpoint`. Since the owner credentials are needed
  regardless, a key would be a second credential covering only the easy half. Auth is one owner
  session, from `.env`.
- **`limit=all` really is capped at 100.** The idempotence check first compared 100 posts of 104
  and called them identical. It pages now. This is the documented `applyLimitCap` behaviour, met in
  practice rather than read about.

Also: `openAsBlob` produces an untyped Blob and Ghost answers `415 Please select a valid image`, so
every upload sets its content type explicitly.

### A fresh Ghost is not empty, so `--prune` exists

A fresh install ships a "Coming soon" post, a `news` tag and an auto-created paid tier named after
the site. The design's publication is exactly 104 posts, 14 subjects and 3 tiers, so on a fresh
install the two collide and the feed reads 105. `pnpm ghost:import:fresh` passes `--prune`, which
deletes posts, pages and tags the fixture does not own and deactivates paid tiers it does not own
(tiers are financial records; Ghost has no DELETE for them). It is **off by default and
irreversible when on** — the same script pointed at a real publication would delete that
publication. It never touches users.

### The masthead lists people who have written

Every staff account is an "author" to Ghost, so the owner rendered as a sixth writer reading "No
posts" beside the design's five. The guard is in the loop, not the query, because **`count.posts` is
not filterable on authors** in Ghost 6: `filter="count.posts:>0"`, `":>=1"` and `":-0"` each return
an empty set rather than a filtered one. Ordering by `count.posts desc` means the first row carries
the highest count, so testing that one row is enough to know whether anyone has published — without
it, a publication with no posts renders an empty bordered list.

The gate asserts the row _count_, not just the five known names: asserting only the names passed
while the sixth row was still there.

## What the code review caught

Both review axes were run against `main...HEAD` before this branch was called done. Six findings
were real and are fixed; three are recorded departures rather than defects. Worth keeping because
every one of them was invisible to a passing gate.

**Ten templates rendered their own documentation.** All ten `page-*` / `custom-*` aliases opened
their comment with `{!--` instead of `{{!--`, so four lines of internal commentary rendered as
visible text at the top of five standing-page Surfaces. Cause: the aliases were generated by a
Python script whose `.format()` call ate the doubled braces. It was on screen in a screenshot taken
during the route-map work and went unnoticed — a reminder that "I looked at it" is not verification.
`pnpm ghost:verify` now has no way to miss it, because the leak would break the `data-surface`
assertions.

**`--prune` used `limit=all`.** The same cap this file documents, in the one place where missing it
silently leaves foreign posts behind while reporting a clean prune. Both prune and the idempotence
check page now.

**`custom_template` held a filename.** The importer wrote `page-about.hbs` into a field that holds
a selected custom template's _name_ (`custom-about`). Ghost cannot match that, so the pages
rendered correctly only because `page-{slug}.hbs` resolution had already done the work — a value
that looked load-bearing and was inert. It is null now, which is the honest statement: these slugs
exist so slug resolution handles them.

**Body HTML was not image-mapped.** Only `feature_image` and `profile_image` were rewritten to their
uploaded URLs, so the styleguide page's inline figure pointed at `/img/…` and rendered as a broken
image. `remoteHtml()` now rewrites bodies too.

**The styleguide page was dropped.** The plan lists it among the seeded pages and Phase 5's gate
reads it ("the styleguide page renders every card styled with no unstyled `.kg-*` block"). It is in
the fixture now, as a page whose body exercises the Koenig card types — verified rendering real
`kg-card` / `kg-image-card` nodes rather than hand-written markup.

**Two glossary breaches.** `CONTEXT.md` is explicit that light/dark is **Mode** ("_Avoid_: theme")
and that Demo content is "5 **Authors**, 14 **Tags**, 104 **Posts**". The runtime had shipped
`Alpine.store('theme')`, a `mirror-theme` storage key and a `theme-toggle` partial, and the tooling
had invented `writers`/`subjects` for Authors/Tags. Renamed throughout: the store is `mode`, the key
is `mirror-mode`, the partial is `partials/mode-toggle.hbs`. Chrome copy still says "Writers" and
"Subjects" — that is the publication's own wording, which the glossary distinguishes from the
internal terms.

### Three findings that are departures, not defects

**The homepage does not paginate.** The route-map ticket asks for the homepage and the Feed to be
"distinct Surfaces at distinct URLs, each paginating independently". They are distinct and the Feed
paginates; the homepage cannot, because it is a `route:` and a route has no collection. Making it
paginate would mean making it a collection, and a post lives in exactly one collection — so the
cover and the archive would collapse back into one URL. The design draws a cover, and a cover is
not page one of a list. Recorded as a deliberate half-satisfaction of that criterion rather than
quietly claimed as met.

**The auth Surfaces ship working forms.** The route map needed `page-sign-in.hbs` and
`page-sign-up.hbs` to exist, and the ticket allows placeholder content. They carry real
`[data-members-form]` forms with `[data-members-email]` instead, because the alternative — a
complete-looking form that silently no-ops — is the exact failure mode this repo's rules forbid. The
Members auth ticket still owns Portal, the entry points and the member-state matrix.

**The directories list real records.** Same reasoning: `page-tags.hbs` and `page-authors.hbs` query
the publication rather than rendering an empty shell, because a directory that lists nothing cannot
demonstrate that its Surface resolves. Their designed layouts remain with the Standing Pages ticket.

## The identity gate: the Ghost render, scored against the design PNGs

`pnpm ghost:score` captures every Surface off the running Ghost in both Modes, scores each capture
against the reference PNG the design was drawn as, and reports the gap to the noise floor that PNG's
own design source scores. One command, and until it existed no Surface ticket could prove it had not
regressed: the reference build's numbers were recorded and nothing at all was pointed at Ghost.

**A word on "floor".** `CONTEXT.md` defines **Floor** as the identity a Surface has already achieved
and may not fall below. This section, `baseline-scores.json`'s `floor` key and `report.py`'s `floor`
column all mean the other thing — the **noise floor**, what the design source itself scores against
its own PNG, a ceiling no markup can pass. The harness reports the distance to that ceiling; it does
not yet ratchet anything, and the Ship ticket owns the first recorded Ghost Floor in the CONTEXT.md
sense.

**The identity gap is reported, not gated.** Every Surface is currently below the reference build's
noise floor by design, so an armed `--max-drop` would fail every run; it exists for a Surface ticket
to arm deliberately once its Surface has landed. What fails the run today is the four refusals below.

```bash
pnpm ghost:jobs    # regenerate the capture set from surfaces.json (ghost:score does this itself)
pnpm ghost:score   # smoke, capture, score — the gate
pnpm verify:floors # the harness's self-check: score the design sources, reproduce every Floor
```

**Nothing about the reference is re-derived.** `scripts/verify/baseline-index.json` already holds the
reference PNG and the height it was rendered at, and `baseline-scores.json` holds the noise floor, so
`scripts/ghost/build-jobs.mjs` replaces exactly one column — the URL. A second copy of a floor is a
floor that can drift, and the two ports have to be comparable to be worth measuring.

**`scripts/ghost/surfaces.json` is the reviewable half.** 27 Astro preview routes (Surface × Layout)
collapse onto the 14 `data-surface` values this theme emits, whose Layout is a setting rather than a
URL, and the map says which is which. Paths are not written there twice: they are looked up in
`routes.json` by `data-surface` marker, so the harness captures the same URL `build-routes.mjs` has
already proved unique. Three rows are the exceptions and each says why in the file — the styleguide
page has no `page-*` template of its own, the Gate needs a members-only slug no route config carries,
and the error Surface needs a genuinely missing URL.

**A row that cannot be captured yet is pending, not scored.** Only the homepage has a layout picker
today, so the 11 A2 rows of the other Surfaces have nothing to select: 32 captures score, 22 report
their reason and wait for the ticket named in it. Capturing A1 and scoring it against the A2 PNG would
produce a number, and the number would be a lie. Pending is not a quiet exit, either: a selection with
nothing capturable in it fails, and `report.py` fails a report that scored zero captures — otherwise
one `skip` line could take a Surface out of smoke, capture and scoring in a single edit and the run
would still come back green.

### The four refusals

1. **Smoke first.** Every URL the run is about to capture, through `smoke.py`: status, byte floor, and
   the Surface's own `data-surface` marker read out of the live page. Two things had to change there.
   `smoke.py` grew a per-route `status`, because the error Surface is a real capture and asserting it
   as a 200 would fail the run for being right. And it grew `min_body_bytes`, because a whole-document
   floor is worthless on this platform: `{{ghost_head}}` alone is 6.1 KB of Portal script and members
   CSS, so a Surface rendering an empty body would still clear the 5,000-byte default on 14 of 15
   routes. The floor now measures the bytes between `<body` and `</body>` — 2,000, just under the
   smallest body any Surface renders (the error Surface at 2,601, About at 2,631).
2. **The publication must not be wearing platform chrome.** `portal_button` and `announcement_content`
   are forced off for the run and restored after — Portal's floating button sits over the footer of
   every Surface, and an announcement bar mounts from `announcement-bar.min.js`, which `{{ghost_head}}`
   emits only while the setting is set. Settings, not markup: the theme is not allowed to know it is
   being photographed. The write is read back, because Ghost's settings endpoint filters a payload to
   the keys it recognises rather than rejecting it — an unrecognised key is accepted with a 200 and
   dropped, which would leave the chrome in all 32 captures behind a clean report.
3. **A Layout that does not render is not a Layout.** Captures are grouped by the settings they need;
   after each flip the rendered body is hashed, and two Layouts of one URL that produce byte-identical
   HTML fail the run. The guard is on the Layout rather than on the setting on purpose — it catches
   both a flip the front end ignored and two rows accidentally declaring the same setting value.
4. **Ghost's own log, positionally.** Byte offsets are taken before the run and only the appended
   region is read: anything in `*.error.log`, and bunyan levels 50/60 in the main log. A front-end 404
   does **not** reach the error log — measured, and load-bearing, because the error Surface's capture
   would otherwise dirty every run. The directory is listed again at the end rather than walked from
   the cursor, so a log file that appeared during the run is read, and a rotated one — smaller than
   its own recorded offset — is read from zero instead of being called clean.

All four were tested by breaking them, which is the only way to know a gate is not inert:

| broken                                                 | what the run did                                      |
| :----------------------------------------------------- | :---------------------------------------------------- |
| a marker changed to one the page does not carry        | `FAIL /about/ missing 'data-surface="page-tags"'`, 1  |
| `portal_button` misspelled, so Ghost dropped the write | `came back as undefined, not false`, 1                |
| both homepage rows pointed at the same layout setting  | byte-identical HTML, 1, settings still restored       |
| an unauthorised admin request fired mid-run            | 2 error lines named, 1                                |
| `--max-drop=0.5` instead of `--max-drop 0.5`           | `unknown argument`, 1 — a disarmed gate is not a pass |

The chrome refusal was also exercised the other way, on a real setting rather than a misspelled one:
with an announcement bar set, `{{ghost_head}}` emits `announcement-bar.min.js`, the run reported
`settings announcement_content=""`, captured, printed `restored announcement_content`, and the script
tag was back in the page afterwards. The restore is deliberately unable to throw — it runs in a
`finally`, where a throw would replace the failure that brought the run there, and each write is
independent so a failed theme-settings restore cannot strand `portal_button`. A restore that fails
says `NOT RESTORED <key>` and names what to put back by hand.

**Mode comes from `?mode=`,** the support hook `default.hbs` already ships and `ghost/README.md`
already documents. It resolves before first paint and writes nothing to storage, which is exactly what
a capture needs; the alternative was a second appearance mechanism that existed only for the harness.

### The self-check found two things the recorded numbers could not have

`report.py --capture-field orig` scores the **staged design source** against its own PNG, which _is_
the definition of the noise floor — so every gap must come back `0.00`. It does, on all 54 rows, which
is what makes the heights, the reference paths and the scoring flags trustworthy before anything is
read into a port's gap. Getting there cost two fixes:

- **`prep-paywalled.json` still pointed at another machine's home directory.** `prep.json` was fixed
  when the identity axis was unblocked; its sibling was missed, so the four paywalled noise floors
  could not be reproduced at all — the run scored whatever `.originals` happened to hold and came back
  at 5.41 and 2.65. It is `~`-relative now, and `pnpm verify:prep:gate` stages the four files
  **without** `--clean`, after `verify:prep`, because the paywalled pass writes into the same directory.
- **`verify:shots` could not be run at all.** `baseline-jobs.json` carries `.shots/` in every `out`
  and `shoot.py` joins `out` onto `--out-dir`, so the committed script wrote `.shots/.shots/build-*.png`
  — and its 54 URLs point at port 4393, a static origin of the reference build that no longer runs
  here. `shoot.py` gained `--base`, which replaces the origin of every job URL: a committed jobs file
  records which pages to shoot at which height, and the caller says where that origin is today.
  `verify:shots` now points at the dev server on 4380 with `--out-dir .`.

### The reference build reproduces through the same harness

With `--base` in place, `pnpm verify:shots` and `pnpm verify:score` were run for the first time: 54
captures off 4380, scored against the same PNGs and noise floors. **50 of the 54 land within 0.05 of
the numbers `after-scores.json` records.** The four that do not are exactly the homepage rows, and
they land on the numbers recorded _after_ the pagination divergence rather than before it —
`homepage-01` light **96.64** against the recorded 96.64, dark **96.62** against 96.62. So the dev
origin reproduces the reference build's identity numbers, the recorded 4393 captures were equivalent,
and the two ports are now measured by one command each with nothing between them but the URL column.

### The first scored run: 32 captures, and what the numbers are not

| route                | layout | mode  | vs PNG | floor |    gap |
| :------------------- | :----- | :---- | -----: | ----: | -----: |
| `about-01`           | A1     | light |  97.80 | 98.02 |  -0.22 |
| `about-01`           | A1     | dark  |  97.50 | 98.12 |  -0.62 |
| `authors-01`         | A1     | light |  97.42 | 98.30 |  -0.88 |
| `tags-01`            | A1     | light |  97.75 | 98.76 |  -1.01 |
| `404`                | A1     | light |  97.61 | 98.96 |  -1.35 |
| `membership-01`      | A1     | light |  96.57 | 97.95 |  -1.38 |
| `author-single-01`   | A1     | light |  95.26 | 98.16 |  -2.90 |
| `blog-01`            | A1     | light |  90.60 | 97.98 |  -7.38 |
| `sign-up`            | —      | light |  91.07 | 98.99 |  -7.92 |
| `styleguide`         | —      | light |  90.12 | 98.54 |  -8.42 |
| `post-01`            | A1     | light |  82.18 | 90.67 |  -8.49 |
| `homepage-02`        | A2     | light |  89.15 | 98.31 |  -9.16 |
| `sign-in`            | —      | light |  89.76 | 99.07 |  -9.31 |
| `tags-single-01`     | A1     | light |  88.54 | 98.37 |  -9.83 |
| `post-01-paywalled`  | A1     | light |  80.06 | 96.14 | -16.08 |
| `homepage-01`        | A1     | light |  71.32 | 96.59 | -25.27 |
| `recommendations-01` | A1     | light |  33.50 | 98.38 | -64.88 |

Seventeen of the 32 rows are shown, every route's light Mode plus About's dark row; the full set,
including the dark row of every other route, lands in `.shots/ghost/scores.json` on every run.

Every capture is below its noise floor and that is the expected state of a skeleton: none of these
Surfaces has had its designed layout built yet, which is what the Surface tickets are for.

Three rows are worth naming so nobody reads them as harness faults. `recommendations-01` at **33.50**
is Ghost's `{{recommendations}}` helper rendering each entry's cover image full-bleed where the design
draws a compact list — three-quarters of every band differs, and the capture is 2.6 MB of photograph.
`homepage-01` at **71.32** is the magazine cover against a template that has a grid and no cover.
`post-01-paywalled` at **80.06** carries platform chrome the harness cannot exclude with a setting:
Ghost core emits its own `gh-post-upgrade-cta` panel inside the body of a gated Post — accent-coloured,
"This post is for paying subscribers only", styled by `{{ghost_head}}`'s `gh-members-styles` block —
and no reference PNG has it. It is named on that row in `surfaces.json`; suppressing it belongs to the
Gate state ticket, which owns the designed Gate that replaces it. All three belong to their Surface
ticket.

The comparison is Ghost-vs-PNG against a noise floor of source-vs-PNG, the same axis as the reference
build's table above — not the Ghost-vs-staged-original number the toolchain section recorded as proof
the pipeline ran. That one was 97.38 for About A1 light; this run puts the same Surface at 97.80
against a noise floor of 98.02, so About is **0.22** off a ceiling the design source itself sets.

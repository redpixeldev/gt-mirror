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
| homepage          | `/`                      | `home.hbs`                             | The `collection:` — the magazine cover is page 1 of it, so the cover paginates      |
| Feed              | `/archive/`              | `index.hbs`                            | A `controller: channel` — the same posts, paginated, at a URL of their own          |
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

**Why the homepage is the collection and the Feed is a channel.** A post lives in exactly one
collection, so no configuration exists in which both `/` and `/archive/` own the same posts. The
design draws a magazine cover and a separate archive, and both of them paginate — which rules out
the obvious split. A `route:` would give `/archive/` a URL and no posts context and no pagination
at all, and the Surface whose whole job is paging through everything is the wrong one to spend
that on.

`controller: channel` is the third option Ghost offers and the right one here: a channel is a
paginated view over posts that does **not** own their permalinks. So `/` stays the collection,
keeps issuing `/{slug}/`, and is page 1 of six; `/archive/` lists the same posts with a page count
of its own. Ghost resolves a channel's page size exactly as it resolves a collection's — `limit:`
on the route if present, otherwise `posts_per_page` from the theme's package.json.

The `/` collection deliberately declares **no** `template:`. Ghost's own template hierarchy puts
`home.hbs` on `/` and `index.hbs` on `/page/2/` onwards (`frontPageTemplate`, applied only when
the path is exactly `/`), so the cover owns the first page and the Feed layout owns the rest.
Naming a template there would put the cover — and its fixed twelve most recent posts — on all six.

The constraint every home partial is still written under is that a publication may instead hand
`/` to a `route:`, which has **no posts context and no pagination**. So every editorial slot in
`home.hbs` is a `{{#get}}` and the pagination call is guarded on `pagination.pages`. Verified in
both configurations — bare, `/` renders `home.hbs`, `/page/2/`…`/page/6/` render the Feed layout
and `/archive/` correctly 404s; configured, `/` and `/archive/` both resolve and both paginate.

History, because the earlier note here reached the opposite conclusion: this was first configured
with `/` as a `route:` and `/archive/` as the collection, on the reasoning that a cover is curated
rather than paginated. That reasoning missed the channel controller, and its cost was a homepage
that could not draw the pagination control the design puts on it at all.

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
{{!-- home.hbs --}}
{{#match @custom.homepage_layout "Editorial masthead"}}
  {{> "home/window" wide=true}}
{{else}}
  {{> "home/window"}}
{{/match}}

{{!-- partials/home/window.hbs --}}
{{#get "posts" limit="12" include="authors,tags" as |feed|}}
  {{#if ../wide}}
    {{> "home/a2" feed=feed}}
  {{else}}
    {{> "home/a1" feed=feed}}
  {{/if}}
{{else}}
  …empty state…
{{/get}}
```

Four rules, each load-bearing:

1. **One `{{#match}}`, at the top of the template.** Nothing below reads `@custom`, so a partial
   can be shared or moved without dragging a settings dependency behind it.
2. **Match the non-default option; the default lives in the `{{else}}`.** A value that does not
   match cannot render nothing — it falls through to a layout.
3. **Fetch once; both layouts consume the same block param.** Two layouts must never mean two
   queries. The query lives one partial down rather than directly under the `{{#match}}` so that
   `{{pagination}}` can be called outside it — see the Feed and homepage section below.
4. **A child partial that varies takes it as an argument** — `{{> "post-meta" byline=true}}` — and
   never reaches back up to `@custom`. This is Source's `navigationLayout=` pattern.

Rule 4 has one trap, and it is silent. `{{#get}}` renders its block with the query's response as
the context, so a partial argument read from inside the block is **one frame up**: `{{#if wide}}`
is undefined there and renders the default layout under either setting. It has to be
`{{#if ../wide}}`. This cost a full capture run: the A2 homepage rendered A1 and the capture
harness's Layout guard passed it, because the two settings groups did differ — by a wrapper `div`.

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

## Chrome: the parts of a Surface that belong to the publication (2026-08)

Header and Mode switch on every Surface; menu, collapsed panel and footer on every Surface the design
draws them on — the members bar carries none of the three, as the table below records. Everything
here is wired to the publication's own data — its menus, its logo, its accent, its members — because
the whole point of porting a design to a platform is that the buyer's own site drives it.

### The template names its chrome; the context cannot

`default.hbs` is a shell now: head, `<body>`, `{{{body}}}`, scripts. Each template opens with the bar
its Surface wears, wraps its own `<main>`, and closes with the foot:

| call                                 | Surfaces                                  | the design it ports       |
| :----------------------------------- | :---------------------------------------- | :------------------------ |
| `{{> "chrome/header"}}`              | home, Feed                                | the listing bar, 22px pad |
| `{{> "chrome/header" compact=true}}` | post, page, tag, author, custom-\*, error | the reading bar, 20px pad |
| `{{> "chrome/header" auth=true}}`    | sign-in, sign-up                          | the members bar, 18px pad |
| `{{> "chrome/footer"}}`              | everything except the two above and error | the four-column foot      |
| `{{> "chrome/footer" slim=true}}`    | error-404, error                          | the one-row foot          |
| _(no footer)_                        | sign-in, sign-up                          | the design draws none     |

A single layout with the chrome in it would have to guess the shape, and the render context — the
obvious place to guess from — cannot carry it. Measured on this install, with `{{#foreach @root.context}}`
in the layout:

| URL                | context            |
| :----------------- | :----------------- |
| `/`                | `home`, `index`    |
| `/archive/`        | **`archive`**      |
| `/archive/page/2/` | `paged`, `archive` |
| `/about/`          | `page`             |
| `/tag/essays/`     | `tag`              |
| `/author/erin-…/`  | `author`           |
| a post             | `post`             |
| a missing URL      | **empty**          |

The Feed's context is the _name of the collection in the buyer's routes.yaml_ — `archive` here,
`index` on a bare install — and an error page has no context at all. So `{{#is "index"}}` is false on
the Feed of this very install, and no `{{#is}}` can match the error Surface. The shape is a property
of the Surface, the Surface is the template (per the route map above), and that is where it is named.
The cost is two partial calls and a `<main>` per template; the same shape the reference build has,
where every page composes `Header` / `main` / `Footer` itself.

`<body>` is a flex column, so a Surface with no foot fills the viewport instead of leaving a strip of
the wrong colour under it — the sign-in field runs to the bottom edge as the design draws it, and the
slim foot sits on the bottom edge of a 404.

### The menu is the publication's, in four renderings, from one partial

`{{navigation}}` executes `partials/navigation.hbs` when a theme ships one, and — the load-bearing
part — **forwards every hash attribute** to it (`_.merge(this, options.hash)`). So one partial serves
the bar, the collapsed panel, a footer column and the slim foot's row: `{{navigation variant="bar"}}`,
`variant="overlay"`, `variant="column" heading=…`, `variant="row"`. The helper also hands over
`current`, computed by comparing each item's path with the page's, which is what draws the accent
underline without the theme knowing any URLs.

Two hazards in that merge, both avoided rather than discovered later:

- it writes onto the **calling context**, so a variant set by one call is still set for the next.
  Every call names its variant, and no branch is a fall-through default.
- the key must be one no Ghost context uses. The column heading is `heading`, not `title`, because
  `title` would overwrite the rendered post's title for the rest of the page.

The design fills two footer columns with link lists it wrote by hand. A publication has exactly two
menus it can edit, so those are the two columns: **Primary** under "Sections", **Secondary** under
"More". Nothing in the chrome is a hardcoded link. An RSS link is a menu item like any other — the
design's is inside a column, and `/rss/` in the secondary menu puts it there. Proven by editing the
setting rather than by reading the template: adding a "Field Notes" item through the Admin API put it
in the bar and the footer, and removing it took it out again.

### Search is the platform's, and the trigger is what turns it on

The reference build searches a compile-time index; Ghost ships an index, a popup and a shortcut, and
the reference build already carries the handoff hook. So the theme has **no search code at all**: the
design's ⌕ button carries `data-ghost-search` and sodo-search binds it.

Read out of sodo-search 1.8 rather than assumed, because the second fact decides the markup:

- `getCustomTriggerButtons()` collects `[data-ghost-search]`, so any element can be the trigger;
- `addKeyboardShortcuts()` registers **⌘K only if that collection is non-empty**.

The design draws no ⌕ on the reading bar, so a Surface rendered with `compact=true` has no visible
search control — and would have had no shortcut either. The collapsed panel's search control is what
fixes that: it is a button dressed as a field (there is nothing for a field to submit to when the
platform's popup has an input of its own), it carries the attribute, and it is in the DOM at every
width because `nav:hidden` only hides it. Verified on `/about/`: one trigger on the page, none of it
visible, and ⌘K opens the popup. Verified end to end on `/`: the popup returns real results from the
publication — "editors" finds _Two editors, one masthead_ and _What editors owe their readers now_.

**The members bar is the exception, and it is the design's exception.** It carries no ⌕ and no
collapsed panel — the design's sign-in bar is a wordmark and a way back — so it carries no trigger,
and ⌘K is off on those two Surfaces. `ghost/README.md` says so rather than promising a shortcut that
is not there.

**Closing the popup had to be finished by the theme.** sodo-search moves focus onto its iframe on the
way in and, on the way out, empties `#sodo-search-root` and leaves focus on `<body>` — measured, with
every close path a bare `dispatch('update', {showPopup: false})` and no stored `activeElement`
anywhere in the bundle. A visitor who searched from the bar and dismissed the popup would land at the
top of the document on the next Tab, which is a dead end the theme's own control created. So
`main.js` remembers the trigger in the capture phase (and, for ⌘K, whatever had focus), watches that
root for the popup going away, and puts focus back if the trigger is still visible. Verified both
ways: after Escape, focus is on the ⌕ button, and searching from the collapsed panel returns focus
into the panel — which is also why the panel is the one control in itself that does not close on the
way out.

### The rest of the wiring, and what each thing refuses to invent

- **The Mode switch renders once, in the bar, on all three shapes.** The design keeps it in the
  preview tool's own toolbar, which a shipped page does not have; the reference build put it in the
  bar for the same reason and paid the same price.
- **The wordmark is type, then artwork, then type again.** The design sets the publication name in
  the display face, which takes its colour from the text token and flips with the Mode for free. A
  buyer may have uploaded a logo, and a theme that ignores it makes a control in admin do nothing, so
  the image wins when there is one. An image does not flip and Ghost has one logo setting, so
  `@custom.dark_mode_logo` is the way out; with it empty the dark Mode sets the publication name in
  the display face — the same word in the same face as the artwork it stands in for.
- **The bar's call to action is `chrome/cta.hbs`,** which resolves the publication's four member
  states: Account for `@member`, Sign in while `@site.members_invite_only`, Subscribe on
  `@site.signup_url` otherwise, and **nothing at all** when members are off — Ghost turns `signup_url`
  into a feed-reader URL in that state, and a Subscribe that means RSS is bait. The design draws only
  the third of those, because the design has one visitor. Proven by flipping the setting:
  `members_signup_access` of `all`, `invite` and `none` renders Subscribe, Sign in and no control.
- **The footer's email field is Ghost's own signup form.** `data-members-form` on the form and
  `data-members-email` on the input are the whole contract; Portal binds the submit and reports back
  on the form element. Read out of portal 2.71, not from docs, and the class set is narrower than it
  looks: the handler clears `success`, `invalid` and `error`, adds `loading` for the round trip, and
  ends by adding exactly one of `success` or `error`. It never adds `invalid`. The `loading` rule is
  the one with teeth — Portal detaches its own submit listener for the duration, so a second click on
  a slow connection reaches the browser, and a form with no action turns that into a GET navigation
  that throws the pending signup away. The form renders only while `@site.members_enabled`: a form
  that cannot sign anyone up is worse than no form.
- **The menu renders whatever a menu item can be.** Ghost's `navigationIcons` lab lets an item carry
  an icon and no label, and the helper only drops items with neither — so a theme that renders
  `{{label}}` alone turns such an item into an empty, nameless link. `chrome/nav-label.hbs` is the
  shape Ghost's own default navigation template uses, shared by all four renderings, and it is
  trimmed at both ends because the bar's current item is marked with a border that a stray whitespace
  node would widen. Proven by turning the lab on: an icon-only item rendered as an `<img>` with
  Ghost's own `iconAlt`, and turning it off left the markup byte-identical.
- **The collapsed panel measures the bar.** The reading bar is 76px and the listing bar 80px on this
  install, and the panel opened at exactly `top: 76` and `top: 80` — on boot, on every open, and on a
  resize while open. That last one is not theoretical: at 280px the listing bar wraps to 128px, and
  the open panel's offset followed it to 128.
- **The scroll lock is a class, not a style.** `siteMenu` puts `.menu-open` on `<body>`; a media query
  keyed to `--breakpoint-nav` decides what it means, so the width at which a full-height panel exists
  stays in one place. Widening the window past the breakpoint with the panel open lifts the lock —
  checked, because a page a visitor cannot scroll is the failure that mechanism exists to prevent.
- **`<main>` is inert while the panel is open, and there is a skip link.** The panel covers the page
  completely, so without `inert` a Tab past its last control walks into content nobody can see. The
  skip link is the design's one omission the theme adds back: `sr-only` until focused, so it costs
  the pixel reference nothing, and it gives `#main` — written into all 21 templates — a consumer.

### A bug the geometry probe found: every Surface was 80px too narrow

Comparing the rendered chrome with the design source in a browser — not comparing pixels, comparing
boxes — turned up something no score had isolated. The `container` utility reads
`var(--container-max, 1240px)`, and all 26 of the reference build's Surface pages pass `1320px`
explicitly; the port passed nothing, so every Ghost Surface rendered 1240px wide against a design
drawn at 1320px. `screen.css` now states the page width once. With it, every box in the chrome
matches the design source exactly:

| measured on `/about/`   |        Ghost | design source |
| :---------------------- | -----------: | ------------: |
| bar width               |         1320 |          1320 |
| header height           |           79 |            79 |
| bar padding / gap       |      20 / 30 |       20 / 30 |
| footer grid             |      4 × 287 |       4 × 287 |
| footer pad / gap / rule | 56 / 36 / 20 |  56 / 36 / 20 |

The one design source drawn at 1240px is the styleguide, and it reaches Ghost through `page.hbs`
alongside every other generic page, where 1320px is right. Branching a shipped template on a demo
page's slug is not a trade worth making; the styleguide rows carry the 80px instead.

### What the identity axis says about chrome, and why it is not the judge here

Full run after the chrome landed: **32 scored, mean −0.53 against the skeleton, 26 of 32 within 0.5**.
Nothing regressed sharply except the two members rows (−2.4) and Recommendations (−2.0).

That the numbers go _down_ while the chrome goes from a stacked-`<ul>` skeleton to the design's bar is
worth understanding rather than explaining away. An empty band scores better against a populated
design than a populated band whose words differ: the bar now carries this publication's menu
(Archive · Subjects · Writers · About · Membership, against the design's Home · Archive · Authors ·
About), its name — Mirror, not The Quarry, recorded above as content-derived and not to be "fixed" —
and one control the design never drew.

So chrome was measured where it can be measured: by cropping the regions and scoring them against
their own noise floor, with no realignment. Each crop starts at the region's own top edge, so a
Surface body that is still a skeleton cannot drag the number.

| region of `/about/` light      | Ghost | noise floor |   gap |
| :----------------------------- | ----: | ----------: | ----: |
| header, its 78px               | 95.96 |       97.09 | −1.13 |
| footer columns, first 200px    | 94.70 |       94.96 | −0.26 |
| footer's bottom rule, its 54px | 98.24 |       99.31 | −1.07 |

The footer sits at its floor — the design's footer, ported, with the publication's own two menus in
it. Its bottom rule lands at y=3309 of the capture against y=3310 in the reference PNG: one pixel,
on a Surface whose body is not built, because `<main>` grows into the page the way the design's does.

The header's 1.13 is the Mode switch and the different labels, and there is a second measurement that
shows what that costs once a Surface's body matches: the reference build's members bar is the same bar
with the same switch, and it scores **97.68 against a 99.07 floor**. `score.py` realigns each band by
up to ±40px, so a uniformly taller bar is absorbed almost entirely when the content below it matches.
It is not absorbed today because every Surface body is still a skeleton — which is what the remaining
Surface tickets are for, and why the chrome's own numbers had to be taken region by region rather
than read off the page total.

## The Post Surface, and the one thing a theme must not do to a photograph (2026-08)

A Post reads end to end in both Layouts: the cover or the title page, the standfirst, the byline,
the primary Tag, the article, the contents list, the share actions, the writer, the neighbouring
posts, three related posts, the subscribe band. `post.hbs` is a dispatch and nothing else — the
layout-picker shape `home.hbs` documents, with the non-default option matched explicitly so a
stored value nobody recognises falls through to a Layout rather than to a blank page.

| the design's element  | where it comes from on Ghost                                         |
| :-------------------- | :------------------------------------------------------------------- |
| cover photo + caption | `feature_image`, `feature_image_alt`, `feature_image_caption`        |
| standfirst            | `custom_excerpt` — the excerpt the author wrote, never a truncation  |
| byline avatar         | the author's `profile_image`, or a one-letter badge                  |
| "12 min read"         | `{{reading_time}}`, computed per render from words and images        |
| contents list         | the rendered article's own `h2[id]`, read in the browser             |
| tag chips             | `{{#foreach tags visibility="public"}}`, each linking to its archive |
| "27 posts" in the bio | one `{{#get "authors" include="count.posts"}}`                       |
| prev / next           | `{{#prev_post}}` / `{{#next_post}}`                                  |
| related reading       | `{{#get "posts" filter="tags:[…]+id:-{{id}}" limit="3"}}`            |
| the subscribe band    | Ghost's own signup form, `partials/newsletter.hbs`                   |

### The contents list is read off the page, because there is nowhere else to read it

Ghost has no table-of-contents helper and a template cannot see inside `{{content}}`. So `postToc`
walks `.mirror-content h2[id]` on boot and Alpine fills the list. This is not a workaround for a
missing helper — it is the only construction that stays true when an author adds a section, because
there is no second list to update. A post with no `h2` renders no block at all: `x-show` plus
`x-cloak` means the shell is hidden before Alpine runs and stays hidden if it never does, so nobody
gets an empty box. The ids are Ghost's own — its renderer slugifies every heading and suffixes
collisions (`…-1`, `…-2`) — so the anchors survive an export. **Measured on
`/against-the-infinite-feed/`: six `h2`, six entries, labels and hrefs equal to the headings,
`aria-current` on the section the reader has reached.**

`h2` only, matching the design's own list, which skips the `h3` under one of its chapters.

### The rail is sticky only while there is a second column

Below `stack` the grid collapses to one column, and a sticky child of a one-column grid pins itself
while the rest of the column scrolls past underneath — the article runs straight through the
contents list. `max-stack:static` on the aside and `max-stack:grid-cols-…` on the grid are the same
decision at the same token, so they cannot disagree. `items-start` is what makes it sticky at all:
a stretched grid item is as tall as the article and has nothing to scroll within.

**Measured: at 1568px the rail sits at `top: 120px` after scrolling 2,500px; at 700px it computes
`position: static`, and its bottom (775px) is above the article column's top (815px).**

### The share row does what its labels say

The design draws three buttons and gives them nothing to do. Copy link asks the clipboard and swaps
its own label only after the write resolves, so a refused permission or an insecure origin cannot
produce a false "Copied"; it carries `x-cloak`, so with scripting off it is absent rather than dead.
Email and Bluesky are links, because they are navigations. All three address the post with
`{{url absolute="true"}}` — including the clipboard, which is handed the canonical address from the
template rather than reading `location.href`: `?mode=dark` is a hook this theme honours before
first paint, and copying the current URL would hand the recipient a link that overrides their own
appearance.

### What Ghost styles, and what the theme had to

`cards.min.css` — out of `{{ghost_head}}`, below this theme's stylesheet — styles the INSIDE of
cards and nothing else. Outside a card it sets no heading, no paragraph, no list, no figure and no
caption, so the article's typography is the theme's, restated as element rules under
`.mirror-content` with `@apply` against the same class lists the reference components carry. Every
rule starts at that class because at equal specificity the later stylesheet wins, and cards.min.css
is the later stylesheet.

It does set some card MARGINS, and two of them outrank anything `.mirror-content .kg-card` can say:
`.kg-image-card:not(.kg-card-hascaption) + .kg-image-card` is 0,3,0 and `.kg-callout-card +
.kg-callout-card` is 0,2,0 in the later stylesheet. So two adjacent uncaptioned photographs sit
19.2px apart and two adjacent callouts 1em apart, where a single card gets the design's 44px. Both
are cases the design never draws — every figure it draws has a caption — so the platform keeps
them rather than the theme spending a fourth class on a guess.

Two cards are overridden because the design draws them itself: the callout gets an accent rail
instead of a filled block, and the pull quote is set centred in the display face. Even those two
are overridden only as far as the design actually specifies. The callout's BACKGROUND stays
Ghost's, because the colour is the author's choice in the editor and `.kg-callout-card-accent`
carries `color: #fff` in the same declaration that sets its background — claiming one and not the
other put white text on a near-white panel. Only the grey and white variants, the editor's default
and the design's own tint, are repainted. The callout's badge also stays Ghost's: it holds
whatever emoji the author picked, at 1.15em with 0.8em of padding, where the design draws a 22px
accent circle — measured at the 617px measure that narrows the callout's text column from 531px to
458px.

The rest keep Ghost's geometry with the publication's accent — reimplementing bookmark, product,
gallery, toggle, header and signup at four levels of specificity would be a second theme's worth of
CSS for cards the design only ever drew as specimens. Recorded as a Concession.

Two traps in that layer are worth knowing before adding a rule to it. `:is()` takes the weight of
its most specific branch, so `:is(figure > img, .kg-image)` is 0,2,0 for BOTH branches — which is
what lets the element branch beat cards.min.css, and why it is a direct child: at that weight
`figure img` also captures the images inside a bookmark card and a gallery card, which are figures
too, and centred a bookmark's favicon in the middle of its metadata row. And a reset written as
`blockquote p { margin-top: 0 }` is 0,1,2, which defeats the `> * + *` rule beneath it and runs
every paragraph of a two-paragraph quote together; it is written as `> :first-child` instead.

**A leftover `prose` class was doing real damage.** Seven templates carried
`class="mirror-content measure prose"` from the skeleton, and `@tailwindcss/typography` sets
`--tw-prose-headings: gray-900` on it. In the light Mode that reads as ordinary dark ink; in the
dark Mode it is near-black text on a near-black page. Measured before the fix: `h2` computed
`oklch(0.21 0.034 264.665)`, body `oklch(0.373 …)`. After removing the class, every element inherits
`rgb(245, 242, 236)`. The identity axis never saw it — those pages moved by less than 0.1 — which is
the case for reading computed styles and not only scores.

### The Concession: the platform's article output against the design source

The reference build transcribed the design's article by hand and crops each inline figure to a
ratio it chose per figure (`aspect-[3/2]`, `aspect-[21/9]`). Ghost's image card renders the
photograph the editor uploaded, whole, at its own ratio. Both of the design's inline photographs are
portraits — 1200×2133 and 1200×1800 — so at the 617px measure they stand **1094px and 924px** tall
where the design shows 411px and 264px: **1,343px of extra page**.

A theme could crop them (`aspect-ratio` + `object-fit: cover`) and match the design. It must not:
the editor uploaded that photograph and Ghost's editor has no way to say "not there". Casper and
Source do the same thing this theme does — `max-width` and nothing else.

To measure what that costs rather than assert it, one Ghost post was created through the Admin API
carrying the design's own title, standfirst, tag, author, date, cover and article text, scored
against the same PNG the reference build is scored against, and deleted. Both columns are
`score.py` at `--height 6200` (A1) and `--height 5450` (A2) — a little under each capture height,
so neither side is scored against blank canvas, which is why they differ slightly from the Floors
in `scripts/verify/baseline-scores.json` (taken at the full 6296 and 5541):

| light                             | reference build | Ghost, same article |  gap |
| :-------------------------------- | --------------: | ------------------: | ---: |
| whole page, A1                    |           90.52 |               81.19 | 9.33 |
| **above the first inline figure** |       **95.89** |           **95.81** | 0.08 |
| whole page, A2                    |           97.52 |               82.63 | 14.9 |
| **above the first inline figure** |       **96.89** |           **96.77** | 0.12 |

(The two bolded rows are `--height 2200` and `--height 1600`: the region above each Layout's first
inline figure.)

Above the first figure — the cover, the titling, the standfirst, the byline, the contents list, two
sections and a blockquote — the port is **0.08 (A1) and 0.12 (A2)** off the reference build. Below
it the two documents are offset by the image height and `score.py`'s ±40px realignment cannot
recover, so every band reads as a miss. That is the whole of the Post Surface's residual, it is a
decision about somebody else's photograph rather than a defect in the template, and it is not being
chased.

### What the run reports, and why the demo numbers are lower still

| route             | mode  | Layout | vs PNG | floor |    gap |
| :---------------- | :---- | :----- | -----: | ----: | -----: |
| post-01           | light | A1     |  81.37 | 90.67 |  −9.30 |
| post-01           | dark  | A1     |  81.29 | 90.22 |  −8.93 |
| post-02           | light | A2     |  88.10 | 97.69 |  −9.59 |
| post-02           | dark  | A2     |  87.67 | 97.78 | −10.11 |
| post-01-paywalled | light | A1     |  86.55 | 96.14 |  −9.59 |
| post-01-paywalled | dark  | A1     |  87.53 | 96.10 |  −8.57 |
| post-02-paywalled | light | A2     |  85.09 | 97.46 | −12.37 |
| post-02-paywalled | dark  | A2     |  85.66 | 97.53 | −11.87 |

The scored rows are the demo publication's own posts, whose bodies are generated prose with no
figures and no cards, so on top of the residual above they carry a different photograph in the cover
band and different words in every text band. Four rows scored where four were pending, and the
gated A1 rows rose 6.30 (light) and 4.97 (dark) as the designed head, contents list, share row and
end blocks replaced the skeleton. The gated rows still carry Ghost core's own `gh-post-upgrade-cta`,
which the Gate state ticket replaces.

**Of the 32 rows that scored before this ticket, 26 did not move at all** — measured by stashing
the change set, restoring the harness's two files from the stash, and running `score.mjs` on the
pre-ticket templates. That before-state is not reproducible from the repository, because
`.shots/ghost/scores.json` is rewritten in place on every run and is not committed; the two `post-01`
rows are not comparable either way, since this ticket also moved the Post capture to a different
post.

Three harness changes came with this Surface, all of them found by this Surface's numbers refusing
to hold still:

- **The Post Surface is captured on a post with a post on each side of it.** `build-routes.mjs`
  picked the first designed post, which is the newest in the fixture and therefore has no next — so
  every run scored a page the design has no drawing for, and the "Next →" card was never captured.
- **`fetch` is retried past a dead keep-alive socket.** Node pools connections and Ghost drops an
  idle one, so the first call after a settings group's screenshots — a pause of several seconds —
  threw `TypeError: fetch failed` / `ECONNRESET` and ended a full run at the handover between
  groups, reproducibly. Only a transport failure is retried, and only for a method that can be
  repeated without creating anything: GET, HEAD and the settings PUT. A POST that creates a post or
  a tag is not, because a reset can arrive after Ghost processed the request and a duplicate is
  worse than a failed run.
- **A screenshot is accepted only once the PNG reaches its IEND chunk.** `shoot.py` treated the
  file's EXISTENCE as completion and terminated Chrome on it, and Chrome creates the file before it
  has finished writing it. This was found while chasing a Surface that lost six points between two
  runs of unchanged code — the gated A1 row read 86.55, then 80.56, while the same URL captured on
  its own read 86.24 three times in a row — and it is NOT what caused that. The cause is in the
  next section, found on the next ticket. Waiting for the end of the PNG is still the correct test
  and cannot hang the run: Chrome with `--screenshot` never exits, so the file has to stay the
  signal, and the existing deadline covers a Chrome that stalls.

Three smaller Concessions, all recorded rather than worked around:

- **One initial, not two.** The design's byline badge holds `MA`; Handlebars cannot take a substring
  and Ghost ships no helper that can, so the fallback badge holds `{{name.[0]}}`. Publications whose
  writers uploaded a photograph never see it.
- **A code block has no language strip.** The design draws a header naming the language above the
  code; Ghost emits `<pre><code class="language-json">` with nothing to hang a strip on, so the
  surface, the scrollbar and the type are ported and the strip is not.
- **A pull quote cannot be imported.** `kg-blockquote-alt` is a variant the editor sets on a
  blockquote node; HTML carrying that class round-trips to a plain blockquote. The theme styles the
  card for posts written in the editor, which is where it can exist.

One trap worth writing down: **prettier must never be pointed at a `.hbs` file here.** There is no
Handlebars plugin configured, so its HTML printer rewrote `default.hbs` — single-quoted attributes,
`{{!-- --}}` comments collapsed to `{{! }}`, and the doctype deleted.

## The Gate, and the five-point ghost in the harness (2026-08)

A members-only Post shows the Gate to a reader without access and the whole article to a reader
with it. That sentence contains the only decision that matters here, and it is about which of two
platform fields the template is allowed to read.

### `access`, never `visibility`

`visibility` is what the post ASKS for — `public`, `members`, `paid`, or a named set of `tiers`. It
is a column on the post and it is the same for every reader. `access` is what Ghost computed for
THIS request, by checking the reader's session against that visibility. A paying member on an
entitled tier reading a `paid` post has `visibility: paid` and `access: true`.

So the branch is `{{#if access}}`, and a theme that branches on visibility shows a paywall to a
reader who has already paid. That is not a subtle failure — it is the one bug on this Surface that
costs a publication money, and it is invisible to everything the harness measures, because the
identity axis only ever captures a signed-out reader.

Verified against all four states rather than argued from the docs. A member comped on the Basic
tier and a free member were created through the Admin API, signed in with real magic-link tokens,
and both deleted afterwards:

| reader         | `paid` post                                                | `members` post | public post  |
| -------------- | ---------------------------------------------------------- | -------------- | ------------ |
| signed out     | Gate                                                       | Gate           | full article |
| free member    | Gate, "Upgrade your membership" → `#/portal/account/plans` | full article   | full article |
| Basic (comped) | full article, 6 headings, contents list, tag chips         | full article   | full article |

`visibility` is still what the card SAYS. A `members` post wants a free account and a `paid` post
wants money; offering the wrong one is a dead end for the reader, so the eyebrow, the heading and
the button all read `{{#has visibility=…}}`. A free member sees no "Sign in" button, because they
are signed in and the only move left is the upgrade.

### The branch lives in one partial

`post/body.hbs` holds it, and both layouts call that partial. The Gate is a state of one Post, not
a Layout and not a Surface: everything above it — the cover or the title page, the standfirst, the
byline — is identical in both states, and everything below the article stays too. What goes is the
body, the contents list, and the tag chips.

The chips go because they close the article: the design's own source keeps "Filed under" inside its
body component, so a gated post shows the chips no more than it shows the last chapter. The
contents list goes because a gated post's free portion is its opening, where the headings are not,
and a list of anchors into a body the reader cannot read is navigation that leads nowhere. A1 drops
its inline disclosure and A2's rail drops its list and keeps its share block, which is what the
design draws.

### Why the gated branch prints `html` instead of calling `{{content}}`

Ghost's content helper substitutes its own `gh-post-upgrade-cta` panel for the body whenever
`access` is false. It is the helper's return value, not something appended after it, and there is
no option to stop it — so a theme with its own Gate must not call the helper on that branch.

That is not a hole in the gate. Ghost's output serializer replaces `html` with the free portion
before any template runs: the part before the post's paywall card, or the empty string when the
post has none. `{{{html}}}` on the no-access branch cannot reach a word the reader has not been
given, and the theme never reaches for it on the other branch.

One measured consequence: Ghost's injected `<style id="gh-members-styles">` still ships the CSS for
the panel nobody renders. Left alone. It is a few hundred bytes of the platform's own head, and the
alternative is a theme that tries to edit `{{ghost_head}}`.

### The demo publication gives its opening away

A gated post with no paywall card has `html: ''`, so the Gate would sit directly under the byline
with nothing above it. Ghost's HTML-to-Lexical converter turns an `<!--members-only-->` comment
into a paywall card, so `build-fixture.mjs` closes the opening paragraph of every gated designed
post with one. The marker costs no words — Ghost's own word count strips comments along with tags,
so the reading-time labels still assert exactly.

After the FIRST paragraph, because that is what the design draws. Measured in a browser: the
design's gated Post shows 423px of teaser above its Gate, and one paragraph of the generator's
prose is 392px. The marker at the end of the opening SECTION instead gives three paragraphs and
1,249px — a realistic publication and the wrong drawing, worth 4.6 points on the A2 row.

**The Concession: the teaser is not clipped, and the fade goes with the clip.** The design holds
its third paragraph to 150px and fades it into the card. The free portion is the part the author
chose to publish; hiding it behind a gradient with no way to open it is the theme withholding
something the platform gave away, which is the same mistake as cropping the photograph one section
up. `paywall-fade` stays in `main.css` unused by the theme, because a fade without a clip is a
drawing of truncation over text that is not truncated.

### There is no price in the button

The design's primary button reads "Upgrade — $8/month". `$8` is a real number the platform holds:
the Basic tier's `monthly_price` is 800, and `{{price monthly_price currency=currency}}` prints
`$8`. It is still not printed, because a theme cannot ask the platform which tier is the entry
price. `{{#get "tiers"}}` accepts `order` and `limit` in its signature and the tiers service
ignores both — measured: `order="monthly_price ASC"` and `order="monthly_price DESC"` return the
same sequence, and `limit="1"` returns two tiers. So "from $X" would quote whichever paid tier the
service happened to return first.

A wrong price on a paywall is the worst thing this theme could print, and Portal — which the button
opens — quotes every tier's real price against live Stripe data. The button reads "Choose a
membership" signed out, "Sign up free" on a members-only post, and "Upgrade your membership" for a
member who needs a higher tier.

The pitch takes the same rule. Its first sentence is the platform's reading time, which survives
gating because Ghost counts the words before it removes them. Its second is `@site.description` —
the publication's own pitch, in the publication's own voice. The design's second sentence names
specific member benefits ("the annual field report and the complete interview archive"), and a
theme that claims what a membership includes is guessing at someone else's product.

### The button carries a `data-portal` attribute only where the href agrees with it

Portal binds a click listener to every `[data-portal]` element and its handler calls
`preventDefault()` unconditionally, then routes on the attribute alone. So an anchor that pairs
`href="{{@site.signup_url}}"` with `data-portal="signup"` throws away the computed URL and asks
Portal for a signup page — including on a publication whose signups are closed, where Ghost turns
`signup_url` into a feed-reader address precisely so a theme will not offer one. Ghost still loads
Portal on such a site if donations or recommendations are on, and this theme ships a
`/recommendations/` Surface, so the popup really would open.

The Gate therefore resolves the publication's member states the way `chrome/cta.hbs` does, by the
same rule: the state whose address the platform computes gets the href and no attribute, and the
states with no computed equivalent name their Portal route and agree with it.

What each state offers is one question further, because what unlocks the page depends on the post
as well as the publication: a `members` post is opened by any account, a `paid` or `tiers` post
only by a paid one. Ghost has a setting for each, and `members_enabled` is not it — it is only
`signup_access !== 'none'`, so it is true on a publication set to paid-members-only, where a button
promising a free account promises something Portal will not create.

| the reader, the post, the publication           | the Gate's buttons                                               |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| signed out, `members` post, `allow_self_signup` | Sign up free, `{{@site.signup_url}}`, no attribute, plus Sign in |
| signed out, paid post, not invite-only          | Choose a membership, same href rule, plus Sign in                |
| signed out, invite-only                         | Sign in only — new memberships are closed, so offering one lies  |
| signed out, `members` post, paid-only signups   | Sign in only — no free account is on offer                       |
| member on too low a tier                        | Upgrade, `#/portal/account/plans`, href and attribute agreeing   |
| members off entirely                            | no buttons; the card still says why the page stops               |

The card's eyebrow, heading and pitch are the same in all of them. A reader on a publication with
members switched off is still owed the reason the article ends where it does.

### The five-point ghost had two causes, and the second one was the harness's own cache

Twice, hours apart, the gated A1 row lost five to six points between two full runs of unchanged
code, and both times the same page captured on its own was stable to the byte. The second time it
was cornered: keep the bad PNG, diff it against a known-good one, and look.

Every row from y=20 down differed, because the site header was 50px taller — its navigation had
rendered as an **unstyled vertical list**, in the body serif and the accent colour, while the rest
of the page was styled correctly. A stylesheet arriving partly applied. `shoot.py` was running four
headless Chromes at once against a single-process Ghost, and occasionally one of them got a
stylesheet it could only half apply. `--concurrency` now defaults to 1. Measured before changing it:

| how                                        | result                           |
| ------------------------------------------ | -------------------------------- |
| one page, six times, alone                 | byte-identical, 90.65 every time |
| that page's group of four, three times     | byte-identical                   |
| two full 36-shot runs at `--concurrency 4` | one row differs by 4.98          |
| two full 36-shot runs at `--concurrency 1` | all 36 byte-identical            |

That was not the end of it, and the way the rest was found is the part worth keeping. **Every job is
now captured twice and the run fails unless the two files match**, because nothing about a finished
PNG says the page finished: `--virtual-time-budget` settles a failed subresource exactly as it
settles a loaded one, and a capture missing one image scores five hundredths of a point away from
the truth rather than obviously wrong. The check found a second defect on its first run, and a
reviewer had found the same one by hand in the artefacts of the run before it.

The gated dark capture rendered both author avatars as Chrome's broken-image placeholder — two
squares, 34px and 56px, and nothing else on the page different. It reproduced in run after run,
which is why it did not read as a flake. Ghost served that image 40 times out of 40 under a burst,
a cold Chrome profile captured the page correctly four times out of four, and the second pass of
the same run was always right. The difference was that `shoot.py` reused its Chrome profiles across
runs: 507MB of them had accumulated in `.shots/ghost/.profiles`, and the one profile index that
captured that row held a cached failure for that image. Warm caches had been hiding every other
image fetch, and poisoning that one permanently.

A capture must not inherit another run's cache, so each job's profile directory is now removed
before its Chrome starts. Two full `score.mjs` runs after that — 72 captures each, every pair
compared — report 0 of 36 rows differing, and the gated dark row reads 90.67, which is what a cold
capture had said all along.

The suite costs about 220 seconds for 72 captures against 19 for a parallel 36. That is the cheapest
200 seconds in this repo: between them these two faults sent three separate investigations after
bugs in the theme that were never there.

One of the three did find something. The author avatar carried `loading="lazy"` and
`decoding="async"`, which the design source puts only on images below the fold — and this one sits
under the title. Both attributes tell the browser it may paint a frame without the image, so the
capture was within its rights. Removed: it is a 3KB thumbnail, and both places it appears on a post
request the same URL, so deferring the second saves nothing the first has not already done.

### The route configs learned that a marker can belong to two routes

A Post that gates and a Post that does not are both the Post Surface, so `data-surface="post"` is
now on two routes by design while `data-gate` is on exactly one. `build-routes.mjs` used to assert
one marker per route and uniqueness per route, which made a second Post route unrepresentable; it
now maps marker → the routes that claim it, and checks each marker is present on all of them and
absent from every other.

`smoke.py` gained `absent` alongside `expect`, both taking a string or a list. It is the only way
to assert a state a page does NOT enter: the interesting failure here is the paywall silently
opening, and a page with no Gate on it looks perfectly healthy. Both new checks were negative-tested
— an `absent` marker that is present and an `expect` marker that is missing each fail the run.

`absent` is also the one assertion this harness can only verify one way. A run can prove a string
is not on a page; it cannot prove the string is one any page could ever produce, so a typo would
pass forever — and the strongest of the three is exactly the one nothing else corroborates:
`class="gh-post-upgrade-cta` names markup only Ghost core emits, and the theme now renders its own
Gate in its place, so no page in this configuration can show it. `build-routes.mjs` therefore
requires every `absent` marker to be either some route's `expect` or named in an `UNCORROBORATED`
map with the reason it cannot be shown. Two of the three qualify on the first count; the third is
named, once, deliberately.

### The check the harness could not make, and now does

Every route config in this repo is fetched signed out, which is the blind spot on this Surface. A
regression was constructed to prove it: replace `{{#if access}}` with `{{#match visibility "public"}}`
and the smoke suite reports **13/13** while every paying member is shown a paywall they had already
bought. That is the one failure on this Surface that costs a publication money, and the hand
verification that caught it during this ticket would have run exactly once.

`scripts/ghost/check-access.mjs` (`pnpm ghost:access`) is that verification, kept. Nine reads: three
readers — signed out, a free member, a member comped on the Basic tier — against the fixture's
first designed public, `members` and `paid` posts. The members are created through the Admin API,
signed in with real magic-link tokens, and deleted in a `finally`, because a probe member left
behind is a member the publication now has. "Article" is asserted as the presence of what the Gate
replaces — the body headings and the tag chips — because a template that rendered nothing would
pass the absence of a Gate. It fails on the constructed regression and passes on the shipped one.

One thing had to change for it to be runnable at all: **the owner session is now cached on disk.**
Ghost allows a hundred logins per IP per hour and then answers 429 for the rest of the hour — which
it did, mid-verification, because every script invocation logged in afresh. `admin.mjs` now tries a
stored cookie against a cheap authenticated read first, and only logs in when that read says the
session is gone. One login per Ghost restart.

### What the run reports

| row                     | before | after     | Floor | gap   |
| ----------------------- | ------ | --------- | ----- | ----- |
| post-01-paywalled light | 86.55  | **90.65** | 96.14 | −5.49 |
| post-01-paywalled dark  | 87.53  | **90.67** | 96.10 | −5.43 |
| post-02-paywalled light | 85.09  | **90.74** | 97.46 | −6.72 |
| post-02-paywalled dark  | 85.66  | **90.59** | 97.53 | −6.94 |

The four gated rows are now the closest Post rows in the build — the ungated pair sits at −8.93 to
−10.11 — which is the expected shape: a gated page has one paragraph of the demo publication's
generated prose to differ from the design on, and an ungated one has thirty.

The residual is 65px of accumulated height, not the copy. Measured on the A1 light pair:

| landmark                | design | theme | running total |
| ----------------------- | -----: | ----: | ------------: |
| first line of the body  |   1076 |  1041 |          35px |
| top of the Gate card    |   1493 |  1449 |          44px |
| bottom of the Gate card |   1828 |  1760 |          68px |
| top of the writer card  |      — |     — |          65px |

The first 35px is above the body — title, standfirst, byline — and belongs to the ungated Post rows,
which carry a larger version of it. The Gate's own contribution is 33px: the card is 24px shorter
than the design's, because its pitch is two lines where the design's is three, and the teaser region
is 9px short rather than the 31px the paragraph measurement suggested, because the card's own
`mt-[22px]` absorbs most of the difference.

65px is what produces the gap, because it is past `score.py`'s ±40px per-band realignment. Three
bands carry almost all of it — y=2400 at 29.81%, y=2500 at 33.90% and y=2600 at 66.98%, the first
and third with their shift clamped at +40 — while every band above the card is within a point or
two of the reference build. The Astro build tracks the design to within 9px over the same span,
which is why it sits at −0.09 and this sits at −5.49.

Two defects from the previous ticket were fixed on the way, both visible in every Post capture and
neither large enough for the score to notice:

- **Dates were not zero-padded.** Every date in `src/data` is `09 Mar 2026`; the theme asked for
  `D MMM YYYY` and rendered `9 Mar 2026`. Six call sites across five partials, now `DD MMM YYYY`.
- **The adjacent-post cards quoted no reading time.** The design shows `28 FEB 2026 · 6 MIN READ`.
  `{{reading_time}}` does work inside `{{#prev_post}}` and `{{#next_post}}` — verified — so both
  cards now carry it.

## The Feed and homepage Surfaces, and the pagination that made the route map wrong (2026-08)

Both paginated post Surfaces, in both layouts and both Modes, against the reconciled publication.

### The routing had to change before a single template did

The design draws a pagination control on the homepage. The route map said `/` was a `route:`, and a
`route:` has no pagination context at all — `{{pagination}}` throws inside one. So the homepage
could not have the control the ticket asks for, in the configuration the captures are taken in.

`controller: channel` is what the original decision missed. The full reasoning is in the route map
section above; the short version is that `/` is now the collection (so the cover is page 1 of six
and paginates) and `/archive/` is a channel over the same posts (so the Feed paginates
independently without owning permalinks). Verified in both configurations, and the bare install is
not a worse experience for it: `/` is the cover, `/page/2/`…`/page/6/` are the Feed layout,
`/archive/` 404s.

`pnpm ghost:routes:apply` and `ghost:routes:bare` now push `docs/routes.example.yaml` and Ghost's
own defaults to the running install. A buyer pastes that file into Settings → Labs → Routes; this
repo cannot, because which Surface owns which URL is the difference between the capture set finding
the Feed and finding the homepage, and re-pasting a file into an admin screen after every change is
exactly the step that drifts from the file in git. The script waits for the URLs to resolve with
the right `data-surface` marker rather than for the upload's 200 — the URL service restarts
asynchronously.

### The per-page count is `posts_per_page`, and routes.yaml is the knob

Ghost resolves how many posts a page holds in the **routing layer**, before a template runs:
`limit:` on the route if the publication set one, otherwise `posts_per_page` from the theme's
`package.json` (`core/frontend/services/routing/controllers/{collection,channel}.js`). A
`config.custom` setting cannot reach it, so there is no admin control for it and a theme that
claimed one would be lying. The theme ships 18 — the archive length the design draws, which over
104 posts is six pages — and the publication owner changes it by editing `limit:` in the routes
file they already own, which is editable in admin under Labs. Verified: `limit: 9` gives nine rows
and twelve pages on `/archive/`, and removing it returns to eighteen and six.

### `{{pagination}}` counts whatever context it is called in

The helper reads `page`/`pages`/`prev`/`next` off `this`, and `{{#get}}` renders its block with the
query's own response as the context — including that query's pagination. Called inside the
homepage's twelve-post `{{#get}}`, the control offered **nine pages of twelve** on a Surface that
has six pages of eighteen, and it looked entirely plausible.

`{{#with @root}}` fixes it in place and **gscan rejects `@root`** as an unknown global
(GS120-NO-UNKNOWN-GLOBALS), so the structure carries it instead: the query and the two layouts moved
into `partials/home/window.hbs` and the control is called from `home.hbs`, one frame out, on the
page's own context. `{{#if pagination.pages}}` guards the call — the dotted path is unambiguously a
lookup where a bare `pagination` shares a namespace with the helper — which is also what lets a
publication hand `/` to a `route:` after all.

### The numbered control is four pages wide, not five, and Handlebars is why

The design draws `1 2 3 … 6`. Handlebars has no arithmetic and Ghost ships no `math` helper, so the
only page numbers `partials/pagination.hbs` can name are the ones already in context: `1` (a
literal), `prev`, `page`, `next` and `pages`. On page 1 that is `1 2 … 6`; from page 2 on it is the
standard elided window `1 … 3 4 5 … 6`, which is wider than the design's and more useful.

The gap on the left is exact — `prev > 2` is a literal comparison. The gap on the right can only be
tested as `pages > next`, so on the one page per run where exactly one number is hidden between
`next` and the last page, the ellipsis stands in for that single page. Accepted; it is one glyph.

Two traps in the same file. `prev`/`next` are `null` at the ends of the range and **a null
comparison is not false in JavaScript**: `null < 6` is true, so the right-hand blocks need an
existence guard and not just the comparison. And the design draws both arrows on page 1, muted on
the left and inked on the right, which is exactly a disabled previous and a live next — so the
inert step renders as a `span` with the same box rather than as a link to nowhere.

### Swiper's arithmetic, written out — and a Tailwind ordering trap worth 21 points

The featured strip drops Swiper for native scroll-snap. Swiper's only remaining consumers were
`slidesPerView`/`spaceBetween` and two buttons calling `slidePrev`/`slideNext`; snap is
keyboard- and touch-accessible for free, caches no width to re-measure once the webfonts settle,
and honours `prefers-reduced-motion` by switching the scroll behaviour rather than a speed.

For a numeric `slidesPerView`, Swiper sets each slide to
`(trackWidth - spaceBetween * (slidesPerView - 1)) / slidesPerView`. The design source configures
1.15 slides, 2.2 from 640px and 3.3 from 1000px, 20px apart, so at the 1568px capture width a card
is `(1256 - 46) / 3.3 = 366.67px` — the number the reference build's Swiper produces, which is why
the two strips land on the same pixels.

Writing that as `sm:basis-[…] min-[1000px]:basis-[…]` **does not work**: Tailwind v4 groups
arbitrary `min-[…]` variants apart from the named breakpoints and emits them first, so at 1568px
the `sm` rule won and every card came out at the 2.2-per-view width. The first homepage capture
scored **75.17 against a floor of 96.59** for that one reason. It is now the `featured-card`
utility in `ghost/assets/css/screen.css`: three media queries in source order, with no ordering to
get wrong.

### The active pill is `aria-current`, because on Ghost the pills are links

In the reference build the Feed's tag row is a set of buttons driving a client-side filter over 18
posts on one page. Here the Feed is 104 posts over six pages and a filter would hide only the rows
on the page the reader happens to be on; filtering by tag on Ghost is a Surface of its own. So each
pill is a link to that tag's archive and "All" is a link to `{{page_url 1}}` — the Feed's own first
page, resolved from the request, because the URL is the buyer's.

That changes the attribute that marks the active pill: `aria-pressed` belongs to a button. The
value is `aria-current="true"` — "the current item within a set", which is what an active filter
is — and not `"page"`, because from `/archive/page/3/` the All pill's href points at page 1 rather
than at the page the reader is on. `tag-pill` in `src/styles/main.css` colours from `aria-pressed`,
so `ghost/assets/css/screen.css` adds the link case beside it rather than widening the utility —
the utility belongs to the design, links here belong to the platform — and it matches on the
attribute's presence rather than its value, so a Surface that really is the URL its pill names can
use `"page"` and get the same fill. Verified on `/archive/`: the All pill computes to
`background: #1c1917` with white text, the other seven are transparent, the strip wraps, and a
walk of every pill's ancestors reports **zero** clipping containers, so the focus ring has room
to draw.

### The counts are the publication's, not the page's

The design counts each tag within the eighteen posts it lists. A pill here links to every post
under that tag, so the number on it is that tag's real total, and the tags shown are the busiest
rather than a hardcoded list: the homepage strip shows eight, the Feed's filter row shows All plus
seven, which is the pill count the design draws on each. On the demo publication the first four
match the design exactly (Essays 34, Interviews 21, Craft 18, Field notes 16) and the rest do not,
because the reconciled fixture has fourteen tags where the design drew eight and seven.

### Concessions

| Surface        | What the design draws                  | What ships                                                                | Why the platform forces it                                                                                                                                                                                                                                                                                                                    |
| :------------- | :------------------------------------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed           | A "Newest first / Oldest first" toggle | No sort control                                                           | Ghost paginates server-side and offers no reader-facing order: `routes.yaml` fixes one order per route, and nothing in a template or a URL changes it per request. A toggle that reversed the eighteen rows on the current page would say "oldest first" and show the newest eighteen backwards                                               |
| Feed           | Archive-specific standfirst            | `@site.description`                                                       | A collection or channel has no title or description of its own; the publication's own sentence is the only per-publication prose available here. Costs one line of `text-lead`, which is the whole of the residual 32px shift on both Feed captures                                                                                           |
| Feed           | `104 posts · 5 writers`                | The writer half counts **staff accounts**                                 | `count.posts` is not filterable on authors in Ghost 6 (`count.posts:>0` returns an empty set, `posts.count:>0` fails the query) and Handlebars cannot count the rows a loop's own guard kept. The writers strip below CAN guard row by row and does, so the line reads one higher than the strip on a publication with an unpublished account |
| Feed, homepage | Two-letter initials on every avatar    | The writer's photo where they uploaded one, one letter where they did not | Already recorded on the Post Surface; not re-decided here                                                                                                                                                                                                                                                                                     |
| Homepage       | `1 2 3 … 6`                            | `1 2 … 6` on page 1                                                       | No arithmetic in Handlebars — see above                                                                                                                                                                                                                                                                                                       |

The access chip returns to the design source's own wording, `Members` and `Paid`, where the
reference build deliberately renders `Pro` and `Basic`. Those are Ghost's words for the two
visibilities and they are what the reference PNGs show, so the port is both more honest and closer
to the drawing. `visibility: tiers` has no single word and prints the tier list, as the Gate does.

### What the run reports

All eight captures, against the Floors recorded for the reference build:

| route         | mode  | layout |     Ghost | reference build | Floor |   gap |
| :------------ | :---- | :----- | --------: | --------------: | ----: | ----: |
| `homepage-01` | light | A1     | **96.15** |           96.64 | 96.59 | −0.44 |
| `homepage-01` | dark  | A1     | **96.06** |           96.62 | 96.61 | −0.55 |
| `homepage-02` | light | A2     | **97.49** |           97.66 | 98.31 | −0.82 |
| `homepage-02` | dark  | A2     | **97.42** |           97.67 | 98.36 | −0.94 |
| `blog-01`     | light | A1     | **97.54** |           98.09 | 97.98 | −0.44 |
| `blog-01`     | dark  | A1     | **97.51** |           98.13 | 98.02 | −0.51 |
| `blog-02`     | light | A2     | **95.95** |           97.02 | 96.62 | −0.67 |
| `blog-02`     | dark  | A2     | **95.89** |           97.10 | 96.70 | −0.81 |

The reference-build column is the number the Astro build scores against the same PNG, which is the
useful comparison: the Floor for the two homepage rows predates the pagination divergence, and
`homepage-02` has sat ~0.68 below its Floor ever since that control moved. Against the reference
build the port is within **0.17 to 1.21**, and the whole of `blog-02`'s 1.21 is the one-line site
description shifting every band below the masthead by 32px — measured, and consistent at +32/+33
across every band from y=300 to y=4100.

`blog-02` was `skip`ped in the Surface map until this ticket; it is now captured, and the run's
pending count drops from 18 to 16.

### Two captures came out unstable, and it was not the markup

`shoot.py` captures every job twice and fails the run unless the two files are byte-identical. The
first run of each of `blog-01` and `homepage-01` failed it: 34 pixels, maximum delta 2, on two
thumbnails near the bottom of a 7,061px page.

The cause is Ghost generating image derivatives on first request. These Surfaces are the first to
ask for `size/w600` and `size/w960` of the archive photos, so the first capture raced a JPEG that
was still being written. The second run of the identical command was byte-identical in both cases.
Nothing in the theme needed changing — but the lesson for the next Surface ticket is that the first
capture run after new `img_url` sizes appear is a warm-up, not a result.

### What the review caught, and what it says about this repo's own trap

Two of the fixes above came out of the code review rather than out of the harness, and both are
the **same** `{{#get}}` frame bug the layout picker section now documents:

- `tag-strip.hbs` read `wide` instead of `../wide`, so the A2 homepage rendered A1's right-tucked
  strip with no post counts. Worth **0.06 and 0.10** on the two `homepage-02` captures — small
  enough that the identity numbers would never have found it, and wrong enough that a buyer
  would.
- `writers.hbs` read `anchor` and `headingId` instead of `../anchor` and `../headingId`, shipping
  `id=""` and an `aria-labelledby` pointing at nothing on both Surfaces: a region landmark with no
  accessible name, and no `#authors`/`#writers` anchor for a same-page link to reach. Zero pixels.

That is three occurrences of one trap in one ticket, which makes it the most expensive thing in
this file to not know. **Anything read from inside a `{{#get}}` block that was passed INTO the
partial needs `../`.** `{{#if}}` does not add a frame of its own, so one `../` is right even when
the read is nested inside a guard.

A second class of bug, three times over: a `{{#get}}`'s `{{else}}` is **not** the empty-result
branch. `options.inverse` is called for an invalid resource and for an API error and for nothing
else (`core/frontend/helpers/get.js`), so an empty result — and a slow query under
`optimization:getHelper:timeout:threshold`, which resolves empty with Ghost's own
`<span data-aborted-get-helper>` prepended — both render the main block. The homepage's "No posts
yet." was therefore unreachable, and the featured strip and both tag rows would have rendered a
heading, a rule and 36–64px of padding around nothing. Every one of them now guards inside the
block on its own block param, which is the shape `post/related.hbs` and `partials/pages/*.hbs`
already used. The comment that claimed the `{{else}}` caught a get-helper timeout was inherited
from the previous version of `home.hbs` and was exactly backwards.

Also fixed, all on the same pass: the featured track's `overflow-x: auto` makes `overflow-y`
compute to `auto`, so it clipped the focus ring on a card the way the tag strips once clipped the
ring on a pill — `snap-track` now carries 4px of block padding and a matching negative margin, so
the ring has room and the box is unchanged. The Feed's All pill moved from `aria-current="page"` to
`aria-current="true"`. And `partials/pagination-page.hbs` collapsed seven repeated class lists in
the control down to two.

## Browsing by subject: the Tags Directory and the tag archive (2026-08)

Two Surfaces, not one. The Directory lists subjects; the archive is the Feed filtered to one of
them. They look alike in the card layout, and `CONTEXT.md` was written to settle exactly that — so
they get separate templates, separate queries and separate layout selects: the Directory follows a
new `@custom.directory_layout`, the archive follows `@custom.feed_layout`, because a buyer who
asked for a wide row per post meant it wherever posts are listed.

### The scored route moved, because the design drew a different tag

`scripts/ghost/routes.json` pointed the `tag` Surface at `/tag/essays/`, which was fine while the
row only had to prove a template resolved. The reference PNG is the **Interviews** archive — 21
posts, its own description, its own twelve stories — so the capture path is now
`/tag/interviews/`. Scoring one tag's archive against another tag's drawing measures nothing.

### A tag can be filed twice, so the fixture stopped dropping the second one

`build-fixture.mjs` resolved every disagreement between the Astro build's per-template datasets by
precedence and recorded the loser as a dropped value. That is right for a date, a photograph or a
primary author, and wrong for a tag: **a tag is the one field a post can hold twice.** A piece can
be filed under Craft and still be one of the Interviews.

So where two pools disagree about a post's tag, the higher pool still decides which is PRIMARY —
primary is what every card's eyebrow prints — and the loser is now carried as a **secondary** tag
instead of being dropped. Two assertions came back:

| post                      | primary | also carried |
| :------------------------ | :------ | :----------- |
| Type is the interface     | Craft   | Typography   |
| On refusing the interview | Craft   | Interviews   |

The reconciliation concession count falls from **10 to 8**, and `/tag/interviews/` lists the post
the design draws seventh rather than eleven of twelve stories plus whatever the marginals spared.
The fixture reports the count on every build, so this cannot drift silently either.

### What still separates the Ghost tag archive from its drawing

Three things, in descending order of what they cost:

1. **One `posts_per_page` for every paginated Surface.** The design draws twelve posts on the tag
   archive and eighteen on the Feed; Ghost resolves the page length in the routing layer, and
   `taxonomies` in `routes.yaml` takes a permalink string and nothing else
   (`route-settings-parser.js`: `z.record(z.string(), z.string())`) — there is no per-taxonomy
   `limit`. Eighteen wins because the Feed is the Surface with more traffic and `archive.ts` is
   the broader dataset. The consequence is structural: from y≈2550 the reference PNG shows
   pagination, the tag strip and the subscribe band while the port is still showing cards. On the
   A2 card grid, where the differing pixels are photographs rather than text, that alone bounds
   the capture at roughly 83 %.
2. **The tag's description has two values in the design and one field in Ghost.** `tags.ts` gives
   Interviews "Editors and founders on the decisions they would make again."; `tagArchive.ts`
   gives it "Editors, founders and reporters on the decisions they would make again — and the
   ones they wouldn't." The fixture keeps the first, by the same breadth rule that governs every
   other reconciliation — fourteen tags beat one. Measured cost: the archive's description sets on
   one line instead of two, so every band below the masthead is **28px** high on the page.
3. **Two more posts genuinely carry the tag.** `posts.ts` files "Notes on a slower publishing
   calendar" and "The fixer's ledger" under Interviews; the design's standalone archive dataset
   does not list them. They are the publication's own filing, not a defect, and deleting them to
   match a mockup would be the fixture lying about the content.

None of the three is a port defect and none is fixable in the theme. They are recorded here so the
Ship ticket's report has a named reason per capture rather than a shrug.

### The first crumb is not a link, because there is no URL to point it at

The design draws "Tags / Interviews" with the first word linking to the Directory. **Ghost has no
Tags Directory URL.** The directory is a Page the publication creates and names, so its slug is the
buyer's and nothing about it reaches a template; hardcoding `/tags/` would 404 on every publication
that called it something else. The crumb is a `<span>` that inherits the nav's colour, so the
drawing is unchanged and no link points at nothing. Concession, and it costs zero pixels.

### The date range is two queries, and the second one lives in a partial

The masthead prints "21 posts · 2025 — 2026". Ghost stores no date range on a tag and Handlebars
has no arithmetic, so the two ends are the tag's oldest and its newest post — two `limit="1"`
queries against an indexed order. Neither can be read off the page's own `posts`: the masthead
renders on every page of the archive and page 3 carries neither end.

The second query is in `partials/tag/range-to.hbs` rather than nested in the first, and that is
forced. `{{#get}}` resolves the mustaches in its `filter` against the **current context**
(`parseOptions(ghostGlobals, this, …)` in `core/frontend/helpers/get.js`), and inside a `{{#get}}`
block that context is the query's response — the tag's slug is one frame up, and the resolver
understands a plain path and a dotted one and nothing else, so `filter="tag:{{../slug}}"` fails the
render outright. A partial's hash arguments **are** merged into its context, so handing the slug to
a second partial puts it back within reach of a plain path. That is the general escape hatch for
any second query that needs a value from outside the first.

A tag whose posts all fall in one year prints that year once. `{{#match}}` unwraps a `SafeString`
before comparing (`core/frontend/helpers/match.js`), which is what lets two rendered `{{date}}`
calls be compared at all.

### The Directory is alphabetical, and an empty tag never reaches it

The reference build orders the Directory by name, and so does the port: a directory is browsed, and
a browsed list is alphabetical. The earlier stub ordered by post count to make the silent 100-row
cap (`core/shared/max-limit-cap.js`) drop the emptiest tags; ordering by name means a publication
past 100 public tags loses the end of the alphabet instead, which `ghost/README.md` now says out
loud. Reordering a Surface to hide a cap is worse than the cap.

**A tag with no posts is not in the Directory at all, whatever the theme does.** `TagPublic` is
declared with `shouldHavePosts` (`core/server/models/tag-public.js`), which joins through
`posts_tags` — so the public tags API only ever answers with tags something is filed under.
Measured: a tag created through the Admin API with no posts is absent from `/tags/`; the moment a
post carries it, it appears. The empty-state branch below the query is therefore for a publication
with no tags at all, not for an empty tag.

### An imageless tag keeps its frame; an imageless post does not

Opposite calls, on purpose. In `directory/tag-cards.hbs` a tag with no `feature_image` renders a
bordered panel of the same 16:10 box, because every card in a row shares a baseline and dropping
the box on one tag lifts its name while its neighbours' stay put — a grid whose whole job is
comparison, visibly broken. In `archive/card.hbs` a post with no feature image starts at the
eyebrow, the same as the Feed's grid and the related strip, because a post without a photograph is
a normal post and a placeholder panel there would be the theme inventing one.

Verified against a real tag: `Zzz bare`, created with no description and no image and attached to
one post, rendered the frame in the card layout and a name-and-count row in the editorial layout,
and its own archive printed "1 post · 2020" with no empty column where the description would be.

### The lead story is page 1 only

The A1 archive opens with the newest post as a lead under the eyebrow "Latest in Interviews". That
is true of the newest post in the tag and of nothing on page 2, so later pages run every post
through the same row as the rest rather than printing a lie or dropping the eyebrow. The archive
narrows to a list once the reader has paged past the front of it, which is also what paging asked
for.

### One strip, two queries

`partials/tag-strip.hbs` split into a query and a drawing. The tag archive's "Other tags" is the
same strip over a different query — every tag EXCEPT the one being read — and a `{{#get}}` cannot
take a filter conditionally: `filter="slug:-{{exclude}}"` with nothing to exclude reaches NQL as
`slug:-` and fails the query. So each caller owns its `{{#get}}` and `partials/tag-pills.hbs` owns
the pill, in the three sizes the design draws. The A2 strip and the homepage's two are unchanged.

### `pnpm ghost:scan` had never run on this machine

The script calls a bare `gscan`, which was on nobody's PATH; `npx gscan` serves a cached **3.3.1**
from the Ghost 3.x era, which does not know the `match` helper and reports four templates as
invalid Handlebars. `gscan` is now a devDependency at **6.4.2** — the same version Ghost 6.60
bundles — and `pnpm ghost:scan` is clean.

Two non-fatal findings it reports are older than this ticket and belong to the Ship ticket: the
`dark_mode_logo` description is 136 characters against gscan's 100-character advice, and
`partials/chrome/mode-toggle.hbs` is flagged for a `{{t}}` with no string, which it has —
`{{t "Toggle dark mode"}}` inside a double-quoted attribute is a parser false positive worth
confirming against gscan 6 before it is worked around.

### What the run reports

All eight captures, against the Floors recorded for the reference build:

| route            | mode  | layout |     Ghost | Floor |    gap |
| :--------------- | :---- | :----- | --------: | ----: | -----: |
| `tags-01`        | light | A1     | **98.38** | 98.76 |  −0.38 |
| `tags-01`        | dark  | A1     | **98.31** | 98.81 |  −0.50 |
| `tags-02`        | light | A2     | **97.82** | 97.83 |  −0.01 |
| `tags-02`        | dark  | A2     | **97.73** | 97.89 |  −0.16 |
| `tags-single-01` | light | A1     | **95.89** | 98.37 |  −2.48 |
| `tags-single-01` | dark  | A1     | **96.07** | 98.42 |  −2.35 |
| `tags-single-02` | light | A2     | **77.02** | 97.18 | −20.16 |
| `tags-single-02` | dark  | A2     | **79.53** | 97.25 | −17.72 |

The two Directory rows are the whole Surface, top to bottom, and `tags-02` is within a hundredth of
its Floor. The two archive rows are the three content divergences above, in the two shapes that
weigh them differently: A1's rows are text on a background, so a shifted row costs a few percent of
its band, while A2's cards are photographs, so a shifted card costs all of one. Ordered by how much
each is worth, the archive gap is the page length first, the description second and the two extra
posts third — and the first of those is the platform's.

`tags-02` and `tags-single-02` were `skip`ped in the Surface map until this ticket; the run's
pending count drops from 16 to 12.

Also: the first capture run after new `img_url` sizes appear is a warm-up, not a result. This ticket
introduced `size="s"` and `size="xl"` derivatives and `shoot.py` failed its own stability check on
the first run of `tags-single-01`, exactly as the Feed ticket predicted it would.

## The writers: the masthead and one writer's archive (2026-08)

The same two-Surface split as the subjects. The Authors Directory lists people and follows
`@custom.directory_layout`; the author archive lists one writer's posts and follows
`@custom.feed_layout`. Neither template reads the other's select.

The scored route moved with the drawing, as the tag archive's did: `09-author-A1` is **Marisol
Ade**'s page, so the capture path is `/author/marisol-ade/` rather than the `/author/erin-laurier/`
the smoke map happened to name first.

### Ghost caps a biography at 250 characters, and the design's is 437

The masthead in `authors.ts` gives every writer a one-line bio; `authorArchive.ts` gives Marisol a
five-sentence one, and the reference build prints each on its own Surface. Ghost has one field,
and the choice is not the fixture's to make: `users.bio` carries
`validations: { isLength: { max: 250 } }` (`core/server/data/schema/schema.js`), and the long bio
is 437 characters. It cannot be stored.

So the short bio is what a Ghost publication can hold, and the author archive's five-line
paragraph renders as one. That costs about 90px at the top of the A1 profile, which shifts every
band under it, and nothing at all on the A2 profile — where the bio lives in a rail beside the
posts rather than above them, so a shorter rail moves no card. Concession, forced.

### Two first-party helpers close the two link gaps

The design prints a writer's site as `marisolade.net` and their handle as `@marisolade`. Ghost
stores a full URL (`https://marisolade.net`) and a bare handle (`marisolade`), and Handlebars can
do neither transformation — but Ghost ships both:

- `{{readable_url website}}` returns `url.hostname.replace(/^www\./,'') + pathname` for a parsed
  URL (`core/frontend/helpers/readable_url.js`), which is exactly the design's rendering.
- `{{social_url type="twitter"}}` builds the profile URL from the handle. It resolves through
  `localUtils.findKey(platform, this, siteData)`, and `findKey` is a `reduceRight` over
  `[context, siteData]` (`core/frontend/services/theme-engine/handlebars/utils.js`), so the
  CONTEXT wins — inside `{{#author}}` it is the writer's own handle, and the site's is only a
  fallback. Every call is inside `{{#if twitter}}` so that fallback can never attribute the
  publication's account to a writer who has none.

### `{{#has any="…"}}` is the `or` Handlebars does not have

A writer with neither a site nor a handle would otherwise leave an empty flex box carrying the
row's margin, or an empty third grid column carrying its 36px gutter. `{{#has any="website,twitter"}}`
tests the current context for a non-empty property — `evaluateList` in
`core/frontend/helpers/has.js` splits the list and runs `_.has && !_.isEmpty` over it — so the
whole block is dropped rather than emptied. Every other line on the profile is guarded on its own,
which is what makes a writer with no photograph, no location, no bio and no links render a name
and a post count instead of a broken grid.

Verified by blanking a real staff user's `bio`, `website`, `twitter`, `location` and
`profile_image` through the Admin API: the masthead row rendered the monogram, the name, "19
POSTS" and the latest piece with no links column and no gap where one would be, and the profile
Surface did the same. The fixture put all five fields back on the next import.

### "Latest —" is one query per writer, and there is no second option

The masthead prints each writer's most recent piece. Ghost's authors resource carries
`count.posts` and nothing about which post is newest, and Handlebars cannot join two queries — so
the row runs an indexed `limit="1"` read filtered to that writer. `filter="authors:{{slug}}"`
resolves as a plain path because the loop's context IS the writer, and the result is read through
the `latest` block param rather than through the block's own context, which is what keeps it free
of the `../` that a `{{#get}}` otherwise forces on everything passed into it.

A masthead is a handful of people and the Directory's own 100-row cap bounds the worst case, so
this is a documented cost rather than a hidden one.

### A post has one face and every writer's name

`{{#primary_author}}{{name}}{{/primary_author}}` was the byline in nine places, and on a
co-authored post each of them silently credited one writer. Ghost's own `{{authors}}` helper is
the obvious replacement and does not fit: its autolink wraps every name in an **unclassed** `<a>`
(`templates.link({url, text})` in `core/frontend/helpers/authors.js`), and this theme's bylines are
drawn either as unlinked meta text or as links carrying a class. So the list is walked in two
partials — `byline.hbs` for plain names, `byline-links.hbs` for linked ones — and both are used
everywhere a post's credit is printed: the two Feed layouts, both homepage layouts, the tag
archive's lead, the shared archive row and card, the post hero, the title page's "Written by" and
`post-meta.hbs`.

`primary_author` still supplies the FACE, because the design draws one. The separators are content
rather than decoration, so neither the comma nor the "and" is `aria-hidden`.

Measured both ways. A real co-author added to "Two editors, one masthead" through the Admin API
rendered "Marisol Ade and Erin Laurier" on the post Surface, on the tag archive row and in the
Feed; and with the fixture's one-author-per-post publication restored, all eighteen previously
scored captures came back byte-for-byte identical — 96.15, 96.06, 97.49, 97.42, 97.54, 97.51,
95.95, 95.89 and the six post rows, unchanged to the second decimal. A refactor across nine
templates that moves no pixel is the only kind worth making on a scored theme.

The fixture keeps one author per post, and that is not laziness: the design's five author
marginals sum to exactly 104 over 104 posts, so a single co-authored post makes them
unsatisfiable. Multi-author is a capability of the theme, demonstrated against the running
install, not a property of the demo publication.

### The rail is sticky only while there is a second column

Same rule as the post Surface's rail, and the same reason: below `--breakpoint-stack` the grid
collapses to one column, and a sticky child there pins itself while the rest of the column scrolls
underneath — the post grid would run straight through the portrait, the bio and the links.
Measured on the running install: at 1200px the grid computes to `280px 784px` and the rail to
`position: sticky`; at 767px it computes to a single `727px` track and the rail to
`position: static`.

### What the run reports

All eight captures, against the Floors recorded for the reference build:

| route              | mode  | layout |     Ghost | Floor |   gap |
| :----------------- | :---- | :----- | --------: | ----: | ----: |
| `authors-01`       | light | A1     | **97.86** | 98.30 | −0.44 |
| `authors-01`       | dark  | A1     | **97.64** | 98.36 | −0.72 |
| `authors-02`       | light | A2     | **97.32** | 97.96 | −0.64 |
| `authors-02`       | dark  | A2     | **97.07** | 98.06 | −0.99 |
| `author-single-01` | light | A1     | **93.14** | 98.16 | −5.02 |
| `author-single-01` | dark  | A1     | **93.35** | 98.22 | −4.87 |
| `author-single-02` | light | A2     | **88.43** | 97.27 | −8.84 |
| `author-single-02` | dark  | A2     | **89.35** | 97.36 | −8.01 |

The two Directory rows are the whole Surface and sit within a point of their Floors. The two
profile rows carry the same page-length concession the tag archive does — the design draws twelve
posts and Ghost serves eighteen, so from y≈1900 the reference PNG shows pagination and the
subscribe band while the port is still showing posts — plus, on A1 only, the 250-character bio cap
above. Post order and post content match the drawing row for row on both layouts, which is what
says the remainder is the platform rather than the port.

`authors-02` and `author-single-02` were `skip`ped in the Surface map until this ticket; the run's
pending count drops from 12 to 8.

## The standing Pages: About, Membership, Recommendations (2026-08)

Three Surfaces with no date in the reading order, each in both Layouts and both Modes. About and
Membership share a new `@custom.page_hero` (centred statement or split hero); Recommendations
follows `@custom.directory_layout` with the other two directories.

### One body, and the rule for what goes around it

The design interleaves prose and derived data on both of the long Pages. About puts the masthead
BETWEEN the mission statement and "Get in touch"; Membership puts the paywall teasers between the
comparison matrix and the member quotes. A Ghost page has exactly one `{{content}}`, and no
template can split it.

So the rule, applied twice: **prose the publication wrote is one `{{content}}` block, and the
sections the theme derives bracket it rather than interrupt it.** About renders intro → figures →
body → masthead; Membership renders hero → tiers → body → paywall teasers. Each moves one designed
section past the prose. Recorded as a Concession, and it is the same shape of answer as the Feed's
"the theme names its own Surface" — where the platform has one slot, the theme decides an order
and says so.

### Nothing on the Membership Surface is written down

Tier names, descriptions, benefits and both prices come from `{{#get "tiers"}}`, and every amount
goes through `{{price}}` — `monthly_price` is an integer in the currency's smallest unit, so
printing `{{monthly_price}}` raw would advertise an $800 membership. Both price sets are rendered
and Alpine swaps them, exactly as the reference build does: the Handlebars runs once, and
`x-text` only chooses between two strings already on the page, so a reader with no JavaScript sees
the monthly prices rather than an empty card.

**The billing switch follows the tiers, not the Stripe flag.** The first version guarded it with
`{{#if @site.paid_members_enabled}}`, which is false until Stripe is connected — and this install
has three real tiers with the flag false, so the control that reveals the yearly prices was
missing from every capture. The condition that actually matters is whether there is a second price
to switch to, which is `{{#get "tiers" filter="type:paid" limit="1"}}`. Worth **0.5 of a point**
on all four Membership captures, and worth considerably more to a publication that has written its
plans and not yet plugged in payments.

The free tier prints the theme's word rather than a formatted zero: a free tier carries no currency
in Ghost, and `{{price 0}}` without one returns a bare `0` (`core/frontend/helpers/price.js`).

Two claims in the design are arithmetic the platform will not do. The yearly note reads "Two months
free · billed annually" and the yearly pill reads "−17%", both of which compare two prices;
Handlebars has no arithmetic, and hardcoding either would print a discount a publication with
different prices does not offer. The note reads "Billed annually" and the pill carries no
percentage. Concession.

### The comparison matrix cannot be derived, so the publication writes it

Ghost stores `benefits` as a list PER TIER. The design's matrix is benefit × tier, which needs the
union of three lists and a membership test per cell; Handlebars can do neither. So the matrix is
editor content, styled by the `.mirror-content` layer — and so are the member quotes, which are
testimonials with no resource behind them, and the FAQ, which is Ghost's own **toggle card**: real
markup, the platform's accordion JS, and something a buyer can edit. `card_assets` keeps toggle's
assets for exactly this.

The ticket's requirement is that the matrix never crops the tier being sold, and the reference
build meets it by swapping the table for labelled cards below the stacking width. A theme cannot
restructure HTML it did not write, so the block scrolls instead. Measured at four widths on the
running install: at 320, 360, 480 and 768px the document itself never overflows
(`scrollWidth === clientWidth`), and at 320px — the only width where the table stops shrinking —
the wrapper is scrollable and the Pro column is reachable. `overflow-x` makes `overflow-y` compute
to `auto`, so the wrapper carries 4px of block padding and a matching negative margin to keep a
focus ring inside a toggle card from being clipped; the same fix the featured strip needed.

### What the editor's HTML keeps and what it drops

Measured through a real import, HTML → Lexical → HTML:

| written                                              | rendered                                              |
| :--------------------------------------------------- | :---------------------------------------------------- |
| `<div class="kg-callout-card kg-callout-card-grey">` | kept, classes intact — the design's accent rail draws |
| `<div class="kg-toggle-card">` × 5                   | kept, with Ghost's accordion JS                       |
| `<table>`                                            | kept, bare, no wrapper element                        |
| `<blockquote class="kg-blockquote-alt">`             | class dropped — a plain quote                         |
| `<blockquote>…<cite>who</cite></blockquote>`         | the `<cite>` is dropped                               |

Two of those changed the fixture rather than the theme. The pull quote loses the design's centred
display treatment and becomes the rail quote, which is a Concession. The attributions now ride
inside the quote after an em dash, because losing the words is worse than losing the meta type
they were set in.

### `{{this.url}}`, and a link that looked right and went nowhere

Every recommendation linked to `/`. `url` is a registered Ghost helper and Handlebars resolves a
bare mustache as a helper before it looks at the context, so `{{url}}` returned the URL of the
page being rendered rather than the recommendation's own. What made it survive a scored run is
that the row still LOOKED correct: the visible address is `{{readable_url url}}`, where `url` is a
helper ARGUMENT and therefore a plain path lookup — so the text read `marginalpress.com` while the
href read `/`. `{{this.url}}` forces the context lookup.

Worth knowing beyond this Surface: any resource that carries a property sharing a helper's name —
`url`, `title`, `content`, `excerpt`, `date`, `tags`, `authors`, `price` — needs `this.` when the
property is what is wanted.

### The recommendations partial is the one place a partial reads `@custom`

`{{recommendations}}` renders through `templates.execute('recommendations', …)`
(`core/frontend/helpers/recommendations.js`), which resolves a theme partial named exactly
`recommendations` ahead of Ghost's own. The helper takes no arguments through to it, and
`recommendations` is not a `{{#get}}` resource — `RESOURCES` in `core/frontend/helpers/get.js`
lists posts, tags, pages, authors, tiers and newsletters and nothing else — so there is no way to
query the rows from a template and dispatch around them. The layout picker is therefore read
inside the partial, which is a documented exception to this theme's rule rather than a lapse of
it. The `@` frame survives because the helper builds its own with `createFrame(options.data)`.

Its default `limit` is **5** (`parseOptions`), which would have truncated this publication's nine
silently; the call passes `limit="100"`, the same number Portal's own recommendation modal asks
for.

Both actions on a recommendation reach a real destination. "Visit" is the publication's URL;
"Subscribe" is `{{this.url}}#/portal/signup`, which is safe precisely where `one_click_subscribe`
is true, because Ghost sets that flag by asking the recommended URL whether it is a Ghost site
with members enabled. Every one of them carries `data-recommendation="{{id}}"`, which is what
Portal binds its click tracker to (`setupRecommendationButtons` in portal 2.71, posting to
`/members/api/recommendations/{id}/clicked/`).

WHAT ONE-CLICK SUBSCRIBE ACTUALLY IS. Inside Portal's own recommendation modal, a signed-in Member
subscribes to a recommended publication without leaving the page — Portal holds their email and
posts it for them. That flow lives in Portal's React bundle and a theme cannot invoke it, so this
button opens the other publication's signup with the reader's email still to type. Concession.

### The About figures are counted, not written

The design hardcodes four numbers. An About page that still says 104 posts a year later is worse
than no figure, so each is a `limit="1"` query read for its pagination total, and "publishing
since" is the oldest post's year. The writer count is staff accounts rather than published
writers, for the reason the Feed's masthead line already records: `count.posts` is not filterable
on authors in Ghost 6.

The About body is the one piece of design prose that exists twice — as Astro components with a
utility class on every element, and as the editor HTML a Ghost page stores. There is no single
representation that serves both, so the second copy lives in `src/data/about.ts` beside the
figures it belongs with, rather than in the fixture builder, and `src/data` stays the only place
the demo publication is written down. Membership's body needs no second copy at all: it is derived
from `COMPARE`, `QUOTES` and `FAQS` in `src/data/membership.ts`.

### `{{#if content}}` is always false

The About and Membership bodies rendered as nothing on the first try. `content` is a HELPER, not a
property — the page's HTML is on `html` — so `{{#if content}}` tests a key that does not exist and
takes the inverse branch every time. `{{#if html}}` is the guard. It is the same class of mistake
as `{{url}}` above, from the same cause, found in the same hour.

### What the run reports

All twelve captures, against the Floors recorded for the reference build:

| route                | mode  | layout |     Ghost | Floor |       gap |
| :------------------- | :---- | :----- | --------: | ----: | --------: |
| `recommendations-01` | light | A1     | **98.02** | 98.38 |     −0.36 |
| `recommendations-01` | dark  | A1     | **97.35** | 98.42 |     −1.07 |
| `recommendations-02` | light | A2     | **96.01** | 96.39 |     −0.38 |
| `recommendations-02` | dark  | A2     | **95.33** | 96.48 |     −1.15 |
| `about-01`           | light | A1     | **96.74** | 98.02 |     −1.28 |
| `about-01`           | dark  | A1     | **96.00** | 98.12 |     −2.12 |
| `about-02`           | light | A2     | **96.57** | 93.84 | **+2.73** |
| `about-02`           | dark  | A2     | **95.88** | 94.06 | **+1.82** |
| `membership-01`      | light | A1     | **92.73** | 97.95 |     −5.22 |
| `membership-01`      | dark  | A1     | **92.63** | 98.05 |     −5.42 |
| `membership-02`      | light | A2     | **92.69** | 97.94 |     −5.25 |
| `membership-02`      | dark  | A2     | **92.38** | 98.05 |     −5.67 |

`recommendations-01` moved from **31.46** to **98.02**: it had been rendering Ghost's own five-item
list against a nine-row design. The two `about-02` rows are the first captures in this port to
score ABOVE their Floor — the reference build's own A2 About scores 93.84 against that PNG, and
the port scores 96.57, because the split hero reads the page's feature image where the reference
build hardcodes a different crop.

Membership carries the whole cost of the three concessions above: one body block where the design
interleaves two, an editor's table where the design draws a matrix it can restyle, and a subscribe
band whose copy is the publication's two settings rather than the design's per-Surface wording.
Post-for-post and price-for-price the Surface matches; the gap is structural and named.

`recommendations-02`, `about-02` and `membership-02` were `skip`ped in the Surface map until this
ticket; the run's pending count drops from 8 to 2.

## The error Surfaces (2026-08)

A missing URL renders the designed 404 in both Layouts and both Modes, and every other status code
falls through to a generic Surface of the same shape. The layout picker is `@custom.page_hero`,
the select About and Membership already read: a buyer who asked for a centred statement gets one
here too.

### This Surface cannot be previewed, only visited

Ghost has no route that renders an error template on request — an error page is what the router
falls through to. So the capture set points both rows at a URL that genuinely does not exist and
asserts the **404 status** alongside the `data-surface` marker; a hand-made preview route would
have proved that the markup compiles and nothing about what a reader actually reaches.

The two rows share one path and differ only by the setting, which is the first time in this run
that the Layout guard — two Layouts of one URL must put different documents on screen — is doing
its whole job on a Surface with no URL of its own.

### The words are the theme's on 404 and the platform's everywhere else

Ghost's `{{message}}` for a missing URL is "Page not found", which is the status line again in
words. The designed Surface writes a sentence instead — "This story was never filed" over an
explanation — so error-404.hbs prints the theme's translatable copy and keeps `{{statusCode}}` for
the numeral, which is the only part of the platform's error that carries information there.

`error.hbs` does the opposite, and deliberately: a 500 or a 503 is a case nobody designed a page
for, and Ghost's own message is the only thing on the screen that tells the reader anything. It
prints `{{statusCode}}`, `{{message}}` and `{{errorDetails}}` in the A1 drawing, plus a link back
to the front page.

It also has no subscribe block, where the 404 does. A reader who mistyped a URL is still a reader;
someone looking at a server error is being asked to wait, and a signup form under a 500 reads as
the publication changing the subject.

**Both branches were rendered, not assumed.** `error-404.hbs` was moved out of the theme and Ghost
restarted, which is what it takes — the theme's file list is cached, so a new or missing template
needs a restart, the same lesson the layout picker recorded. The missing URL then rendered
`data-surface="error"`, the numeral 404, Ghost's own "Page not found" as the heading, the back
link and the slim foot. The template was moved back and the run re-scored identically.

### What the Chrome does here

`{{#is}}` cannot match an error page — it has no context at all, which is the measurement that
made every Surface in this theme name its own chrome — so the template names the compact bar and
the slim foot itself. `<body>` is a flex column, so the message centres in whatever space is left
and the foot sits on the bottom edge, which is the shape `NotFoundShell.astro` draws with
`min-h-screen`.

THE ROUTE BACK IS THE CHROME'S. The design draws no "back to the front page" link on either error
layout, and none is added: the wordmark links to `{{@site.url}}` and the whole primary menu is in
the bar above the message. Confirmed on the rendered 404 — the wordmark's href is the site root
and the nav carries five working links. `error.hbs` keeps an explicit back link, because a reader
who has hit a 500 may not trust the navigation either.

Portal loads on an error page out of `{{ghost_head}}`, so the subscribe block on the 404 is Ghost's
real signup rather than a form that goes nowhere — verified on the rendered page, which carries
`data-members-form="signup"` and the portal bundle.

### What the run reports

| route    | mode  | layout |     Ghost | Floor |   gap |
| :------- | :---- | :----- | --------: | ----: | ----: |
| `404`    | light | A1     | **98.63** | 98.96 | −0.33 |
| `404`    | dark  | A1     | **98.10** | 98.97 | −0.87 |
| `404-02` | light | A2     | **98.44** | 98.73 | −0.29 |
| `404-02` | dark  | A2     | **97.92** | 98.77 | −0.85 |

The A1 row moved from **97.41** to 98.63 — the placeholder it replaced set the numeral at the
display size rather than the design's clamp and carried a back link the design does not draw.
`404-02` was `skip`ped in the Surface map until this ticket, and the run's pending count reaches
**zero**: every Surface the design draws is now captured in both Modes.

### The log refusal learned one exclusion

With every Surface captured, the run started failing its own log check: Ghost refreshes a
recommendation's metadata over the network, and this publication's nine recommended publications
are the design's inventions — `secondread.club` and the rest resolve nowhere — so any run that
renders the Recommendations Surface logs `ENOTFOUND` and `No provider found for supplied URL` at
level 50.

That is the demo content being fictional, not a Surface failing to render. `logSince` now drops
exactly those two shapes and nothing else, with the reasoning beside the regex: an outbound fetch
that could not resolve cannot be produced by a template, and a template that throws still fails
the run. Leaving them in would have trained whoever runs this to read past the check, which is
worse than not having it.

The first full run with all 54 captures is clean, and `shoot.py`'s stability guard passed on every
one of them — including the three-pixel anti-aliasing jitter on one card's rounded corner that
failed two earlier runs. That one is capture noise on a border radius, not markup: three pixels at
a maximum delta of 3, on the same corner both times.

## Members auth: how far Portal reaches, and where the design stops (2026-08)

Ghost renders the members flow through **Portal**, a React bundle in an iframe that a theme cannot
template. The design draws two full auth Surfaces. Both statements are true at once, and the
resolution is that they are answering different questions: Portal is the modal a reader opens from
anywhere, and the designed Surfaces are the ADDRESS a publication sends people to.

So the theme ships both. `/sign-in/` and `/sign-up/` are the designed Surfaces, built on Ghost's own
members contract rather than on anything reimplemented — `data-members-form`, `data-members-email`,
`data-members-name`, and Portal binding the submit out of `{{ghost_head}}`. Portal is what a reader
gets from the header, the Gate and the tier buttons.

### THE CONCESSION

**Every entry point in the Chrome opens Portal's drawing, not the designed one, and a theme cannot
change that.** The header's Subscribe, the Gate's call to action, the recommendation subscribe
buttons and the Membership Surface's tier buttons all hand off to Portal, whose type, spacing,
field treatment and success states are Portal's own. What the theme can reach is the accent colour,
which plans it offers, its button style and its terms copy — all publication settings — and beyond
those the modal is the platform's.

The residual distance is therefore: a reader who NAVIGATES to `/sign-in/` sees the design; a reader
who CLICKS Subscribe sees Portal. The reference build's own auth captures already sit about 1.4
below their Floors for a separate and accepted reason, and this Concession is on top of that.

Measured, not asserted. Portal opened from the Membership Surface renders its primary button at
`rgb(168, 88, 12)` and its links at the same value, which is `#a8580c` — the design's burnt amber,
carried from `@site.accent_color`.

### `portal_plans` defaults to free-only, which made Portal contradict the theme

`portal_plans` ships as `["free"]` and Ghost only widens it when Stripe is connected. The result on
this install was a Membership Surface listing three real tiers beside a signup modal offering one —
the theme telling the truth and the platform's own modal appearing not to. The Admin API accepts
`["free","monthly","yearly"]` without Stripe, so the fixture sets it: what Stripe decides is whether
a checkout can COMPLETE, not whether a plan exists.

With Stripe absent, a paid tier button opens Portal and Portal answers "Unable to initiate checkout
session". That is the honest platform behaviour for a publication that has written its plans and
not yet plugged in payments, and it is what a buyer in that state should see.

### The four states are Ghost's three classes

The reference build drives its auth form's four states from an Alpine value, because it has no
server to answer. Here every state is real markup and Portal's own class decides which is on
screen: `loading` for the round trip, then exactly one of `success` or `error`. Nine CSS rules in
`assets/css/screen.css` are the whole of the theme's side, and the success panel is a SIBLING of
the form so that "the form leaves and the panel arrives" is one adjacent-sibling selector.

One line of JavaScript sits on top: Portal reports the OUTCOME of a submit and never the input, so
the theme copies the typed address into "we sent a link to …" at submit time. The markup reads
correctly without it — it ships the words "the address you entered" — which is the test for whether
an enhancement is allowed to be one.

### Proved against the running install, end to end

| step                        | result                                                                                                |
| :-------------------------- | :---------------------------------------------------------------------------------------------------- |
| signup through `/sign-up/`  | Portal bound the submit; Ghost issued a magic link                                                    |
| mail delivery               | failed — this install has no transport — reported in `[data-members-error]` and the error panel drawn |
| the emailed link            | followed from Ghost's log; the member was created and signed in                                       |
| the Chrome, signed in       | the bar's control changed from **Subscribe** to **Account**                                           |
| `/sign-in/`, signed in      | "You are signed in", `harness.reader@mirror.test`, Manage your account                                |
| sign out                    | the bar's control returned to **Subscribe**                                                           |
| sign-in through `/sign-in/` | a second magic link, followed, signed in again                                                        |

The failure in row two is worth keeping in the record rather than configuring away: it is the first
time the theme's error branch has been driven by a real failure rather than by a class added by
hand, and it drew exactly what it should — the panel, Ghost's own sentence inside it, and the form
still filled in.

The test member was deleted afterwards. The demo publication has no members, and it should not: a
fixture that seeds one would make every gate check depend on who the harness happens to be.

### The preview-only state switcher is not in the theme

`FormStateSwitch` and its `?state=loading|success|error` are a review affordance of the reference
build — the design source keeps the equivalent in its own preview chrome. Neither is ported, and
grepping the theme for `state=` returns nothing. The four states are reachable here only by driving
the form, which is the point.

The design's `Privacy · Terms` line under both cards is not carried either. It links nothing in the
reference build, Ghost has no field for a policy page, and a link to a page that does not exist is
worse than no link.

### What the run reports

| route     | mode  |     Ghost | Floor |   gap |
| :-------- | :---- | --------: | ----: | ----: |
| `sign-in` | light | **97.27** | 99.07 | −1.80 |
| `sign-in` | dark  | **96.82** | 99.09 | −2.27 |
| `sign-up` | light | **96.87** | 98.99 | −2.12 |
| `sign-up` | dark  | **96.19** | 99.01 | −2.82 |

From **87.67 / 87.59 / 88.66 / 86.38**: the placeholder cards these replaced were a heading, a
field and a button, where the design draws a centred column with an eyebrow, a subhead, a shadowed
card and its footnotes. What remains is the upgrade panel's copy, which names the cheapest real
tier rather than the design's sentence, and the missing policy line.

### Byte equality was the wrong test for "the same capture twice"

With 54 captures in a run, `shoot.py`'s stability guard started failing on a different Surface each
time — and never on the same one twice, which is the shape of a measurement problem rather than a
markup one. Measured across three of them: 3 pixels at a maximum channel delta of 3 on a card's
border radius, 12 at delta 2 on a grid's last row, 32 at delta 2 down one column of thumbnails,
each on a frame of four to seven million pixels. A browser rasterising a rounded corner over a JPEG
is not bit-deterministic.

The guard now states a bound instead of implying one: **at most two levels on any channel, and at
most one pixel in twenty thousand.** Nothing a template can do lands inside that envelope — a
layout that moved, a string that changed, an image that loaded late all touch thousands of pixels
at full contrast, and this check caught exactly those twice earlier in the port. Outside the bound
a capture is still unstable and still fails the run, and the report now prints what it measured
rather than only that the files differed.

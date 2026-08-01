# Known traps

Defects that cost real fidelity and are invisible until measured. Apply the fixes during
the design-system phase, before any template exists.

## Fonts

**Request every axis a variable font needs, explicitly.**
Asking a provider for weights alone can return an instance pinned to a default optical
size. Measured on Newsreader: text rendered ~5% wider until `opsz` was requested, which
broke every line in the build. If the design uses a variable font, name its axes.

**Glyphs the UI font lacks fall through to a different font than the design's.**
Arrows (← → ▾) are the usual case. A metric-matched fallback changes both the advance
width and the line box — measured 80.56 vs 81.91px on one button, 37.5 vs 38.5px on
pagination. Pin those glyphs to the same stack the design falls through to, usually
`system-ui`.

**A substituted mono face changes every line it touches.**
If the brief forbids loading the design's mono font, pin mono leading with a constant and
say what it costs. Browsers quantise `line-height: normal` per size — for IBM Plex Mono,
12.5 / 14 / 14.5 / 15 / 16 / 16.5 / 17px across 10–13px — so no constant is exact.
Residual ≈0.25px per chip, ≈0.09px per 11px line, accumulating down the page.

**If the theme does load its mono face, do not pin mono leading.** The pin exists to
normalise a substitute and will fight a real font.

## Tailwind Preflight

Preflight quietly overrides things the design assumes. All four of these were found by
measurement, not by eye.

**`line-height: 1.5` on `html`.** Most designs set leading per element and leave the page
at `normal`. Reset it, and clear the built-in font-size/line-height pairings, or every
element without explicit leading inflates. Affected 123 elements in one build.

**`antialiased` thins every stem.** Never apply Tailwind's `antialiased` utility unless
the design's own reset sets `-webkit-font-smoothing`. Measured: ~15% less ink in a serif
headline, and roughly a point of pixel identity on *every page*. Removing it moved one
page from 98.53% to 99.74%.

**`a { text-decoration: inherit }`.** Links the design leaves underlined render plain,
because they inherit `none` from their paragraph. Restore `underline` explicitly on any
link the design underlines.

**List markers are stripped.** A design's bulleted list needs `list-disc` and its padding
put back.

**`margin: 0` on everything.** A native `<dialog>` centres itself with `margin: auto`;
Preflight zeroes it and the dialog opens pinned to the top-left. `m-auto` restores it.

## Utility layer beats base layer

A base-layer `line-height` loses to any size utility, because those compile to
`line-height: var(--tw-leading, …)` in the utilities layer. When pinning leading for a
family, set the custom property too, not just the declaration.

## Alpine

**`$root`, not `$el`, inside an `Alpine.data()` method.** `$el` resolves to whichever
element the expression is running on — an input, a close button — while `$root` is the
component's own element. This silently breaks focus restoration.

**Render every state; toggle with `x-show`.** Error panels, success panels, accordion
answers and search results should be real markup, so they survive with JavaScript off and
remain searchable. Cloak the ones that start closed so nothing flashes open.

## Build

**A 200 response is not proof a page rendered.** Three separate incidents in one build
shipped an empty body behind a 200 — a prop destructured but never defined, and twice a
missing import. Assert a byte floor and a clean dev log.

**Restart the dev server after adding a page.** Tailwind's Vite plugin does not always
rescan a brand-new file, so arbitrary values silently fail to generate and the element
falls back to inherited styling. A production build scans from scratch, so this is a
dev-only trap.

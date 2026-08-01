# Verification

## What to score against

**Score the build against the original design source rendered through the same
pipeline — never against the reference images.**

Same browser, same window width, same device scale factor, both captured minutes apart.
Every difference that survives is then a real difference in the markup. A reference PNG
was exported by a different renderer on a different machine; scoring against it measures
that gap as well as yours, and the two are not separable.

The reference images still earn their place, for two things:

1. **They set the run's noise floor.** Score the *original* against its PNG. Whatever
   that number is, your build cannot beat it, and a build that scores about the same
   against the PNG has nothing left to fix. On `gt-mirror`'s `/about-01`: original vs
   PNG 94.78%, build vs PNG 94.77%, build vs original 99.49%. The 5% is the export
   pipeline, not the markup.
2. **They confirm you rendered the right thing.** Eyeball them to check you are looking
   at the intended variant and theme before you spend an hour on a score.

## The pipeline

`scripts/` holds it. Copy the folder into the repo; do not rewrite it.

```
prep_originals.py   stage the design sources into a servable folder
shoot.py            headless Chrome captures, several at a time
score.py            banded, per-band-aligned scoring, plus region diff panels
smoke.py            every route: 200 and a body above the byte floor
```

`scripts/README.md` has the invocations and a worked config.

## How the score works, and why

Bands of 100px, each realigned independently within ±40px before it is scored, at a
luminance tolerance of 12.

The alignment is the whole trick. One extra pixel of leading near the top of a page
pushes everything below it out of register, and a naive diff then reports a near-total
mismatch for a page that is one pixel wrong. Per-band alignment localises the error, and
the reported shift per band tells you where the drift entered.

Trailing content past `--height` is excluded so a page that legitimately ends at a
different length does not score as a mismatch against blank canvas.

## The accepted noise floor

Roughly 1–1.5%, from three understood causes:

| cause | typical size |
| :-- | :-- |
| a substituted mono face | 0.25px per chip, 0.09px per 11px line |
| photo resampling at a sub-pixel offset | up to 9% of a detailed image's pixels |
| glyph antialiasing on serif text | 3–5% of a text-dense band |

**Investigate a page below ~98.5%. Above it, stop.** The gt-mirror build settled between
98.6% and 99.7% across 20 pages, with the low end always a page carrying a large photo.

A deliberate chrome change also shows up as a fixed cost in the top band and nowhere
else. Verify that with `--skip-header`: if the score below the header is unchanged, the
delta is the chrome and there is nothing to fix. Measured on `/about-01` after the nav,
logo and search work: 99.36% overall, 99.44% below the header, with 3.19% of the top
band accounted for by the logo image and search button that the design source has no
equivalent of.

## Two headless traps

- **`ui-monospace` resolves to a different face in headless Chrome than in a real
  browser.** Mono-heavy pages can drift there in the *opposite* direction from reality —
  measured 48px table rows headless against 47px, while the real browser had them 1.8px
  *shorter*. When headless and a DOM measurement disagree about mono, the DOM
  measurement taken in a real browser is the honest figure. Report that one.
- **`requestAnimationFrame` callbacks do not fire in the automated tab.** Never build
  behaviour on rAF, and never try to verify one there. Alpine's `$nextTick` does run.

## Beyond pixels

A score is one axis. Also verify, in a real browser, in both themes:

- keyboard reaches every control; focus is visible and returns sensibly after a menu,
  dialog or field closes
- the theme toggle persists across a reload, and the unset state follows the OS
- DOM measurements for anything the pixel score cannot separate — a font substitution,
  a leading constant, a line box
- formatter, linter, typechecker clean; a production build succeeds

## Reporting

Report a table per batch: page, theme, score, and what the residual is. Never report a
number without saying what it was measured against, and never round a measurement into
an impression. "99.4% against the rendered original, residual is the mono substitution
in the tier chips" is a result; "pixel perfect" is not.

---
name: build-theme-markup
description: Rebuild a multi-page theme from design sources (HTML export, Figma export, or screenshots) as a production Astro + Tailwind site, verified pixel-for-pixel against the design.
---

# Build Theme Markup

Use this to rebuild a complete multi-template theme — homepage, archive, post, tags,
authors, about, membership, auth, 404, styleguide — from design sources, as a real
Astro + Tailwind + Alpine site, then verify it against the design.

This is a batch workflow. It builds a design system first, then the shared chrome, then
templates in batches. It does not work page by page.

## Activation

### Use For

- rebuilding a design-tool export (`.dc.html`, Figma export, static HTML) as a themed site
- building several variants of the same theme from one source set
- porting a finished theme to a new brand, palette or type system
- any job phrased as "build this whole theme / all these pages from the design"

### Do Not Use For

- a single page or section from one image — use `markup-from-image`
- restyling an existing site without design sources
- extracting components from code that already exists — use `componentize`

## Load First

Read these before the design-system phase; they carry the parts that must not be
re-derived each run.

- `chrome-contract.md` — the house standard for Header, Footer, Logo, nav and search
- `known-traps.md` — Preflight, font and rendering defects that cost real fidelity
- `verification.md` — the harness, what to compare against, and the accepted noise floor

`scripts/` holds the harness itself — `prep_originals.py`, `shoot.py`, `score.py`,
`smoke.py`, and a README with the invocations. Copy the folder into the repo and drive
it from configs; do not rewrite it per theme.

## Inputs

Ask for whatever is missing; take everything else from the sources.

| input | required | notes |
| :-- | :-- | :-- |
| design sources | yes | a folder of `.dc.html`, an HTML export, or reference images |
| reference images | preferred | one per template, per variant, per theme |
| target repo | yes | clone it; confirm it is a starter, not an existing build |
| fonts | if not in the source | family, weights, styles, and whether to self-host |
| logo | if the design has one | one file per theme mode, or one that works on both |

## Progress Updates

Keep the user informed; runs are long.

- One line before each phase, and a table after each batch.
- Report scores as measurements, never as impressions.

## Workflow

1. **Discover.** Inspect the sources before anything else. Classify them: a design-tool
   export with an embedded config object, plain HTML, or images only. Report which, and
   what you can and cannot derive from it. Do not start building until this is settled.
2. **Derive, then ask.** Pull every value you can from the sources — type scale,
   tracking, radii, palette, weights, variant names, template list, copy. Ask the user
   only for what genuinely is not in them: site name, logo light/dark mapping, and
   anything that should differ from the house standard.
3. **Design system.** Transcribe tokens into one CSS file, register fonts, apply the
   Preflight overrides from `known-traps.md`. Build **only the styleguide page** and
   verify it deeply. Every systemic defect lives here; finding one now saves it from
   every later page.
4. **Chrome.** Build Layout, Logo, Header, Footer, navigation data and search to
   `chrome-contract.md`. Before any template.
5. **Batches.** Group templates by source file — one file usually holds every variant and
   one shared data set. Build all variants of a template together, write its data once.
6. **Verify each batch** with the harness. Report a table. Investigate only what falls
   below the threshold in `verification.md`.
7. **Document.** Write `DECISIONS.md` as you go — every non-obvious call with the
   measurement behind it. Update the repo README with routes, tokens and conventions.

## Rules

- Derive values from the source, never from this skill's examples or from memory.
- Copy transcribed from the design is content; the site name, logo and titles are chrome.
  Renaming chrome does not license rewriting copy.
- One data file per template. Do not derive one template's demo content from another's —
  sources differ deliberately.
- Every page renders the shared `Header` and `Footer` components and passes only which
  section is current plus a variant label. A link array in a page is a bug.
- Sections that repeat across templates become components with props; sections that only
  look similar stay separate.
- Reuse the existing repo conventions — package manager, formatting, path aliases, dark
  mode strategy — over anything this skill suggests.
- Restart the dev server after adding a page; Tailwind does not always rescan new files.
- Mark demo-only affordances (variant browsers, state switches, query overrides) in their
  own docstrings as things to delete before shipping.

## Guardrails

- Never commit, push, branch or deploy. The user reviews and ships.
- Never treat a 200 response as proof a page rendered. Assert a byte floor.
- Never report a fidelity number without saying what it was measured against.
- Do not chase differences that `verification.md` lists as the accepted noise floor.
- Do not silently substitute a font, colour or glyph the design specifies; if the spec
  forbids loading it, say so and record the cost.
- Stop and ask if the sources contradict the brief, or if a source folder looks like a
  different design system than the one named.

## Verify

- Every route returns 200 **and** a body above the byte floor, with a clean dev log.
- Both themes render, and the theme toggle persists.
- Keyboard reaches every interactive control; focus is visible and returns sensibly after
  a menu, dialog or field closes.
- Images have alt text; decorative images have empty alt.
- Each batch scores above the threshold against the rendered original, with anything
  below investigated and explained.
- Formatter, linter and typechecker are clean.
- `DECISIONS.md` records every call a future run would otherwise re-derive.

# Coding standards

Read at review, against a diff. These are the judgement calls. Formatting, lint, gscan, locales and
every rendered-output check are mechanical and live in `pnpm gate` (`scripts/gate.mjs`), so a rule
belongs here only when no script could enforce it.

## Language

- **Names come from `CONTEXT.md`.** Code, comments, commit messages and docs use its terms (Surface,
  Layout, Layout override, Gate, Mode, Concession, Demo site, Day-one publication…). A new concept
  gets its `CONTEXT.md` entry in the same change. A word on an entry's `_Avoid_` list is a finding.

## Decisions

- **A divergence from the design is a Concession, and it is written down** — an ADR in `docs/adr/`
  or an entry in `DECISIONS.md`, in the same change as the code that makes it.
- **A buyer-visible behaviour is documented in `ghost/README.md`** in the same change: a setting, a
  template a buyer can pick, a menu convention, a URL that does something.
- **Demo-only data stays in `scripts/ghost/demo-overlay.mjs`.** The scored publication
  (`scripts/ghost/fixture.json`) and the buyer's zip carry none of it (ADR 0006).

## Templates

- **The Layout picker pattern holds** (the header comment in `ghost/home.hbs`): the template reads
  the `@custom` setting once and hands it to the Surface's partial as `layout`; partials dispatch on
  the argument. `partials/recommendations.hbs` is the one recorded exception.
- **Every `../` in a partial is explained** by the comment above it — which frame it climbs out of
  and why (`docs/ghost-platform.md` lists the frames Ghost's helpers push, and the one case where
  they don't). A partial's header comment names the context and the hash arguments it expects.
- **Comments carry the reason**, not a restatement of the markup: the platform behaviour, the design
  constraint, or the Concession the code answers to.

## Evidence

- **A refactor that claims "no render change" shows it**: `pnpm ghost:snapshot` before and after,
  and `pnpm ghost:snapshot:diff` reporting `N/N identical`, quoted in the commit or the report.
- **A change is done when `pnpm gate` passes in full** — every Ghost started, nothing skipped.

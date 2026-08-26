# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase. This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` at the root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the glossary. It exists and is maintained; read it before
  naming anything.
- **`docs/adr/`** — read the ADRs that touch the area you're about to work in.

`docs/adr/` does not exist yet. If it's still absent, **proceed silently**. Don't flag it; don't
suggest creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and
`/improve-codebase-architecture`) creates ADRs lazily, when a decision actually gets made.

There is no `CONTEXT-MAP.md` and no per-context `CONTEXT.md` — this is a single-package Astro repo
(`pnpm-workspace.yaml` carries only `onlyBuiltDependencies`; there is no `packages/`). If the repo
ever splits into workspaces, add a root `CONTEXT-MAP.md` and update this file.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept — a todo title, a refactor proposal, a hypothesis, a test
name — use the term as `CONTEXT.md` defines it, and don't drift to a synonym it explicitly avoids.
This repo's glossary is unusually strict about a handful of overloaded words:

- **Variant** is a design direction (A vs B); **Layout** is one Variant's treatment of one Surface.
- **Surface** is a kind of page a reader can be on; **Page** is a content record.
- **Feed** is the paginated list of Posts — never "blog", "index" or "archive".
- **Mode** is light/dark — never "theme".
- **Gate** is a state of a Post — never "paywall page".
- **Concession** is a deliberate divergence from the design — never "bug" or "TODO".

If the concept you need isn't in the glossary, that's a signal — either you're inventing language the
project doesn't use (reconsider), or there's a real gap (note it for `/domain-modeling`).

Two other files carry standing decisions: `CLAUDE.md` (build output, Tailwind v4 wiring, fonts) and
`DECISIONS.md`. Treat a decision recorded there like an ADR until it's migrated into `docs/adr/`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

# Chrome contract

The house standard for site chrome. Build it this way in every theme unless the user
says otherwise — it is the shape four separate rewrites converged on.

## The rule that prevents the rewrite

**A page passes which section is current and a variant label. Nothing else.**

```astro
<Header variant='site' compact current='tags' />
…
<Footer variantLabel='Variant A1 · lead + list' titleWeight='medium' class='mt-24' />
```

No `const navLinks`, no `const footerColumns`, no link arrays in any page or template.
If you find yourself writing one, it belongs in `data/navigation.ts`. Detail templates
that render several pages (a post template, a 404 shell) follow the same rule.

## data/navigation.ts

One module owns every link the chrome renders:

- `NAV` — one canonical nav for the whole theme, each item `{ key, label, href, children }`
- `NavKey` — a union of the keys, so `current='taggs'` fails the build rather than
  silently highlighting nothing
- `FOOTER_COLUMNS`, `SITE_TITLE`, `SITE_TAGLINE`
- `ROUTES` — every destination content links to
- `postHref(locked)` — members-only posts resolve to the paywalled layout, so tier chips
  mean something

Where a design ships a different nav per template, unify it and pass `current`. It costs
a little fidelity in the header band (measured 0.03–0.05 points, confined to the header)
and buys a site that behaves like a site.

## Header

Three variants, one component:

| variant | used by | shape |
| :-- | :-- | :-- |
| `site` | every content page | full nav, search, subscribe |
| `demo` | the styleguide specimen | same nav, boxed, inert |
| `auth` | sign-in / sign-up | logo plus one link back, no nav, no search |

`compact` gives the tighter bar the detail templates use and hides search. Auth pages
have no footer at all; their `<main>` flexes to fill the viewport, which is what centres
the card.

## Logo

An image, in **both** header and footer, linked to the homepage, `alt` = site name.

- Two files, light-ink and dark-ink, swapped by the dark class. If the artwork reads on
  both backgrounds, one file and no swap.
- Trim both to the letterforms using **one shared crop** so the two align exactly, and
  resize to roughly 4× the largest rendered width.
- Because the art is trimmed, height utilities are **cap-height, not font-size**: the
  value that reads as a 26px wordmark is about 19px.
- Supplied artwork on an opaque background must be knocked out — use the ink as the
  alpha channel so the letterforms keep their antialiasing, then tint per theme.

## Nav dropdowns (preview aid)

While variants are under review, each nav item opens a menu of the layouts beneath it so
every route is one gesture away.

- Opens on hover **and** on keyboard focus; the label itself still navigates.
- One menu open at a time, via a shared Alpine store, with a ~200ms grace period on close.
- The panel's box touches the label — the visible offset is the panel's own transparent
  padding — so there is no dead gap to cross.
- Escape closes; focus leaving the group closes immediately.
- Item labels are descriptors only: "Two-column list", not "A1 · two-column list".
- An "Other" group collects 404s, auth pages and the styleguide.

Mark it in its own docstring as a preview aid: a shipping theme deletes the dropdown and
renders the same labels as plain links.

## Search

Inline in the header, on the non-compact headers only.

- The button swaps the nav for a field **in the same row**, so the header never changes
  height and nothing below it moves.
- Results in a panel under the field. Escape and click-outside close it, restore the nav
  and return focus to the button.
- The index is built at compile time from the demo content — every post the site shows,
  deduped — so there is no index file and no network call.
- Results link to the layout matching each post's membership state.
- Keep the platform's own search hook on the button (for Ghost, `data-ghost-search`) and
  bail out of opening if the platform's script is present, so the two never both open.

## Content links

Real routes, not placeholder anchors. Post cards resolve through `postHref()`; tag chips
go to the tag archive; bylines go to the author page.

Leave inert, deliberately: pagination when there is no second page, links to third-party
sites that do not exist, feed URLs the platform serves at runtime, and legal placeholders.
Say so in `DECISIONS.md` rather than leaving it to look unfinished.

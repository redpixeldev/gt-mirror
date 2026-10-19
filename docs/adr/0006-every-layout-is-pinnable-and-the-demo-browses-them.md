# Every Layout is pinnable, and the Demo site browses them

A **Layout** is a site-wide theme setting (`homepage_layout`, `feed_layout`, `directory_layout`,
`page_hero`, `post_layout`), read on the server, and Handlebars cannot see a query string, so one
Ghost can render only one Layout per **Surface**. A buyer judging the theme needs to see all of them.
The decision: the theme ships a **Layout override** for both Layouts of every Surface, and the
**Demo site** reaches each one through a **Layout browser** menu. The overrides are buyer features in
the shipped zip; the menu, the routes that point at them and the records that use them are
demo-only.

Two template families, because Ghost reaches Surfaces two ways:

- **Record Surfaces** (Post, About, Membership, the Tags and Authors Directories) take their
  content from a Post or Page, so the record picks the Layout: `custom-{surface}-{layout}.hbs`,
  listed in the editor's template picker. The existing `custom-about.hbs` and its siblings keep
  following the setting.
- **Route Surfaces** (homepage, Feed, tag archive, author, error) have no record to carry a choice,
  so a `routes.yaml` entry names a `layout-{surface}-{layout}.hbs`. The prefix is load-bearing:
  Ghost resolves `tag-{slug}.hbs` and `author-{slug}.hbs` ahead of `tag.hbs`, so `tag-grid.hbs`
  would capture a buyer's Tag whose slug is `grid`. No `custom-` prefix, so these stay out of the
  picker and are inert until a route names them.

Both Layouts are pinned, not only the alternate: an override that silently equals the default once
the owner flips the global setting is a trap.

The Layout browser is grouped by setting, not by Surface, because `feed_layout` governs the Feed,
the tag archive and the author page together; grouping by Surface would advertise a per-Surface
choice the buyer cannot make. Its labels are the admin option names.

One **Concession**: the Recommendations Directory has no override. `{{recommendations}}` consumes
every hash argument as an API option and renders its partial with only the response and a copy of
the caller's `@` frame (`core/frontend/helpers/recommendations.js`,
`theme-engine/handlebars/template.js`), and a theme can put no value of its own into that frame, so
no template can tell the partial which Layout to draw. It follows `directory_layout` alone; the
Layout browser lists it once, and Cover cards stays visible on the two Directories that share the
setting.

## Considered options

- **Two Demo sites**, all defaults on one and all alternates on the other, with no theme code at
  all. Complete, and each site is a configuration a buyer can actually have. Rejected for a second
  host, a double import, and a cross-domain jump on every switch.
- **A demo-only overlay theme** (`ghost-demo/` merged into a second zip). Keeps the buyer zip
  unchanged, but the Demo site would run a theme the buyer cannot install byte for byte, and the
  per-record overrides are worth shipping on their own.
- **`page-{slug}.hbs` / `post-{slug}.hbs` keyed to Demo content slugs.** Invisible in the picker, but
  it bakes Demo content into the theme and captures any buyer record that reuses the slug.
- **Alternates only.** Half the files, and the trap above.

## Consequences

- The `layout-*` and `custom-*-*` filenames are a public contract: a buyer's `routes.yaml` and
  per-Post template choices name them, so renaming or removing one breaks a live site.
- The tag archive and author Surfaces can reach a pinned Layout only through a channel with
  `data:`, which 301s the record's own URL to the channel. On the Demo site `/tag/newsletters/`
  and `/author/iben-falk/` therefore always show Grid. Chosen over the least-linked records
  because a Grid of five Posts is an **Underset**.
- Ghost has no route that renders an error template on request, so `/404-split/` answers 200. Its
  template carries `noindex`; the real 404 still follows `page_hero`.
- The menu, the demo routes and the duplicate Pages live in an overlay applied by
  `build-demo-zip.mjs` only, so the scored local install, its **Floors** and its **Parity** rows are
  untouched. That is why the overrides need a third local Ghost and a `demo:smoke` run of their own
  that asserts each link renders the Layout its label names.
- Supersedes the `DECISIONS.md` entry that the Reference build's variant browser is not ported.

# The theme omits chrome it has no content for

MIRROR was drawn against **Demo content** — 104 Posts, 14 Tags, 5 Authors, a photograph on
everything — so every band, heading and counted figure in the design presumes content to put in it.
A **Day-one publication** has almost none of that, and the design says nothing about what should
happen there. The rule is: where the publication has no content for a piece of chrome, the theme
renders no chrome. `about/stats.hbs`'s "Subjects" cell disappears at zero rather than printing a
36px `0`; a menu the owner has emptied takes its `<nav>` landmark with it rather than leaving a
labelled container holding nothing. Anything the theme draws for content that is not there is an
**Orphan**, and an Orphan is a defect.

The rule applies only to what the theme itself emits. Ghost's navigation helper already returns an
empty string for an empty menu (`core/frontend/helpers/navigation.js:151-153`), so `navigation.hbs`
never runs and needs no guard — but the four wrappers around its call sites are the theme's own
(`chrome/footer.hbs`, `chrome/header.hbs`, `chrome/menu.hbs`, `page-design-tokens.hbs`), and those
did need one.

## Considered options

- **Print the honest zero.** Truthful, and the figure reappears by itself the moment the owner adds
  a Tag, with no template change. Rejected because it makes the theme announce its own emptiness in
  display type on the one day a buyer is most likely to be looking at it.
- **Deliberate empty-state copy everywhere.** More considered per case, but each instance is a
  judgment call plus a translatable string, and "would a reader be confused here?" is not a
  criterion a later reader can apply consistently. Kept only where a whole Surface would otherwise
  be blank — which is what `home/no-posts.hbs` already is, and it stays.
- **Suppress a band below a content threshold.** Cleanest launch-day result, rejected because a
  hard-coded threshold is a magic number and the band silently appearing later reads as a bug.

## Consequences

Omission is already the theme's instinct elsewhere — `archive/card.hbs:17-19` refuses to draw a
placeholder panel for a Post with no feature image, and `post/toc.hbs:11-12` renders no block for a
Post with no headings — so this ADR names an existing habit rather than introducing a new one, and
the dozen partials it now applies to move toward the theme's own grain.

The cost is that an Orphan is invisible to the geometry audit by construction:
`scripts/verify/probe-audit.js:62` skips any element with a zero-width or zero-height box. That is
why the Day-one run carries a rule of its own for navigation and list landmarks with no items, and
why the Day-one publication is in the pre-ship harness rather than run on demand.

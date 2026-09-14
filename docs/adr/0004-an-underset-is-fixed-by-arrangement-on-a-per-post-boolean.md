> **Superseded in part by [ADR 0005](0005-an-imageless-publication-drops-a1s-lead-band-and-widens-the-grid.md).**
> The lead-band rule below still holds, and is what A1 draws when the publication photographs
> something in its newest five but not its lead. The imageless cover's accent wash and isometric
> lattice are gone — that cover is now type-set on the page background — and a publication whose
> newest five posts are all imageless omits the lead band rather than rearranging it.

# An Underset is fixed by arrangement, on a per-post boolean

ADR 0003 gave the theme a rule for chrome it has no content for: omit it. That rule is wrong for
the defect one step along, where the content is present and the arrangement is what fails. A1's
homepage lead is `27fr` beside a `20fr` rail, and ~435px of the lead column's height is its
`aspect-[16/10]` photograph. Ghost lets a post publish with no image, so on an image-free
publication that band drew a 222px lead beside a 706px rail — **484px of empty column, measured on
the Day-one publication**. Omitting the band would delete a post. That class of defect is an
**Underset** (CONTEXT.md), and the rule is: change the arrangement, and decide it from a boolean
the post itself carries.

So A1's lead now drops the two-column split when its own post has no `feature_image`: the lead
runs the width as a type-set standfirst, the three companions run three across beneath it, and the
archive grid's tracks follow its cards (`auto-fit` over a `min(360px,100%)` track, capped per card)
rather than sitting at a fixed three. The imageless cards and companions carry a top rule, since
the drawn card is capped by its own image and an imageless one opened on nothing.

Two figures decided the shape of this. Type alone recovers **56px of the 484**: a Day-one post runs
about fifty words, so the h1 step of the scale plus an eighty-word excerpt has nothing left to
fill a column with. And stretching the rail recovers **nothing at all** — a grid row's height is
set by its tallest column, so `items-stretch` spreads the column that is already long and leaves
the short one exactly as empty.

## Considered options

- **A post-count threshold** (`pagination.total < 8` → stack). Reaches further: it would also catch
  a photographed publication with three posts. Rejected for the reason ADR 0003 already records
  against content thresholds — the band would re-set itself the day post eight was published, and
  a layout that changes shape on publish reads as a bug. A per-post boolean has no such day, and
  the same publication renders the same band on every page it appears on.
- **A `:has(> article img)` variant on the container.** Same result with no template restructuring.
  Rejected because it makes the page's geometry depend on a descendant selector nobody would think
  to look for; the Handlebars version says what it is at the point of decision. The cost is that
  the whole band now sits inside the lead's own `{{#foreach}}` and the companions read the window
  back through `../feed`.
- **A theme setting** ("lead treatment: photograph / type-set"). Explicit and inference-free, and
  rejected because the Day-one buyer sees the broken band before they find the control — it fixes
  the reported symptom last.
- **Leaving it.** The recorded position until now (DECISIONS.md, 2026-09: "the content is there,
  there is just very little of it"). Overturned by the measurement: 484px is not "very little of
  it", it is a quarter of the band.

## Consequences

Every branch is inside an image guard, so a publication with photographs renders the drawn band
exactly. That is verified rather than asserted: the demo homepage at the 1568px capture width is
**byte-identical** to its pre-change capture in Light, and no Floor moves.

The same reasoning covers the imageless cover. The design draws A1's cover as a full-bleed
photograph, and without one it was 660px of flat `#0c0a09`; it now carries a diagonal wash of the
publication's accent and an isometric lattice, both unreachable when a photograph exists. The
lattice is a tiling rather than a figure precisely so that it has no size to get wrong on a phone —
what ends it is a mask, not the geometry.

The rule's limit is worth stating: it fixes an Underset caused by _thin content_, because that is
what a post-level field can see. An Underset caused by _few items_ — one Tag in a three-track
directory — is still handled by the grid keyword (`auto-fit` plus a per-item cap), not by this
rule, and a publication with three photographed posts still gets the drawn band with a short grid
under it.

# An imageless publication drops A1's lead band, and the grid widens to absorb it

Supersedes the second half of `docs/adr/0004` (the imageless cover's accent wash and isometric
lattice) and extends its first half, which survives unchanged as the mixed case below.

ADR 0004 fixed a **thin-content Underset** by rearranging the band it broke: with no photograph
A1's lead ran the content width as a type-set standfirst, three companions across beneath it. That
holds when the publication has some photographs. On a publication with none — the **Day-one
publication**, but equally a text-only newsletter five years in — it produces a homepage of four
running-text posts stacked above nine more of the same, with the type-set band claiming cover
prominence for a post no more visual than the cards under it. So when the newest five posts carry
no `feature_image`, A1 now:

- draws the cover as **type rather than a photograph's substitute** — eyebrow, rule, the title at
  the cover's own `5.4vw` ramp with its ceiling raised to 112px, rule, the standfirst in italic —
  on the page's own background, in tokens, at content height rather than `min(76vh,660px)`;
- **omits the lead band entirely**, rather than rearranging it;
- **widens the archive grid from `6–14` to `2–14`**, so the band's four posts become cards.

The grid MUST widen. The homepage window and the `/` collection are both fourteen
(`partials/home/window.hbs`), so a layout that draws fewer than fourteen re-opens the pagination
hole that number exists to close. That is also what makes omission legitimate here at all: this is
the one **Underset** fixed by dropping a band rather than by rearranging it, and it is allowed only
because no Post dies. `CONTEXT.md` now says so in the term itself.

The condition is a date cutoff, because Handlebars cannot aggregate. `{{#foreach}}` has no
accumulator and `{{#has any="feature_image"}}` answers for one post, so the question "did any of
the newest five carry an image" is asked of NQL instead: from the oldest post of the slice,
`published_at:>='{{published_at}}'+feature_image:-null` — one extra `{{#get}}` whose only job is
to come back empty.

Three details are load-bearing, each measured on the running instances rather than reasoned:

- `from="2" limit="4"`, never `to="5"`. Ghost sets `@last` on `current === to`
  (`core/frontend/helpers/foreach.js`), so `to="5"` never fires on a publication with fewer than
  five posts and the decision renders nothing at all. With `limit`, `to` falls back to the window's
  length, so the cutoff lands on position 5 or on the oldest post there is.
- The cutoff is `>=`, so the test spans positions 1–5 and the cover is inside it. Two treatments,
  one condition: a photographed cover can never sit above a dropped band. Testing 2–5 alone needs a
  second date, and a second date can only reach a filter as `{{../published_at}}`, which is fatal in
  Ghost 6 — `IncorrectUsageError: unsupported path segment ""`, served as a 200 with a hole.
- `{{published_at}}` renders `2026-08-28T09:00:00.000+00:00`. The `+00:00` is safe only inside the
  filter's quotes; unquoted, NQL reads that `+` as its own AND.

## Considered options

- **A strict 2–5 test**, ignoring the cover. What was actually asked for. Rejected on the `../`
  limit above: the second cutoff date can only reach the filter smuggled through a partial's hash,
  a construction no reader would expect, to separate a case that differs only when the cover is
  photographed and the next four are not.
- **Grid always `2–14`, CSS hiding its first four cards** when the band drew them. No extra query,
  and rejected twice over: duplicate content in the DOM of the most-crawled page, and it is the
  descendant-selector geometry ADR 0004 already refused.
- **Dropping the band whenever its own lead has no photograph**, deleting 0004's type-set
  arrangement. The simplest template of the three — one per-post boolean, no cutoff query — and
  rejected because a publication that photographs its cover and nothing else then loses the band
  for four posts that had a working arrangement.
- **A post-count threshold.** Rejected for the reason ADR 0003 records: the band would re-set the
  day post eight was published.
- **Keeping the wash and the lattice** under a type-set titling. Rejected on sight: the point of
  the band is that it is not a place where a picture should be.

## Consequences

Every branch sits inside an image guard, so a photographed publication renders the drawn Surface
exactly. Verified rather than asserted, and stated against the harness's own noise floor: the demo
homepage at 1568px differs from its pre-change capture by **3 pixels of 6.07M, each one channel
value**, inside a featured-card photograph's rounded corner — and **two captures of identical code
differ by exactly that much**, in whichever Mode the run happens to land on. So the change is at or
below what the capture can resolve, and no Floor moves. File-level equality is not the test the
earlier entries claimed: a capture and its own repeat pass differ by four bytes.

A1 now carries three arrangements for one band, and the mixed case composes two rule conventions:
ADR 0004's imageless companions cap themselves with `border-t`, while the grid below now closes its
imageless cards with `border-b`. That seam is reachable only on a publication that photographs
something in its newest five and nothing at positions 2–5, it has no Floor, and it was left rather
than harmonised because harmonising means restyling a recorded arrangement the change did not
otherwise touch.

Two smaller decisions ride along, both fixing defects this change makes prominent rather than
introduces:

- **A one-post publication renders no `Latest` section at all** (`{{#if feed.[1]}}`). With a single
  post both bands below the cover are empty and the heading, its rule and the tag strip were chrome
  over nothing — an **Orphan** by ADR 0003.
- **The featured strip hides its prev/next pair when the track does not overflow**, measured with
  `scrollWidth` against `clientWidth` on resize and after `document.fonts.ready`. The design draws
  both buttons unconditionally against six featured posts; a publication that has flagged two had
  two buttons that scrolled nothing. Measured rather than counted, because three cards fit at
  1568px and two overflow a phone.

The tier chip the mockup drew on a featured card was NOT taken. The design source puts
`{{ p.tier }}` on the grid cards, the companion rows and A2's shortlist, and deliberately not on a
featured slide — adding it there would repaint the demo publication's own captures and move a Floor
for a Day-one drawing.

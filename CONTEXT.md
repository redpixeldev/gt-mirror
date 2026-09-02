# MIRROR theme

The language of this repo: a magazine theme that exists twice — as a measured static build and as
the Ghost theme that build is evidence for. Terms here are the ones that were used ambiguously at
least once; general web and Ghost vocabulary is not repeated.

## Language

### The design

**Variant**:
One of the design source's four complete directions (A1, A2, B1, B2); only the A pair is built.
_Avoid_: version, style, mode

**Editorial**:
The name of Variant A — Newsreader at display and body sizes, Archivo for UI, stone neutrals, one
amber accent.

**Layout**:
The arrangement one Variant prescribes for one surface, e.g. A1's magazine cover or A2's editorial
masthead.
_Avoid_: variant (a Layout is a Variant's treatment of a single surface, not a direction)

**Surface**:
A distinct page kind a reader can be on — homepage, feed, post, tag archive, author, directory,
about, membership, auth, error.
_Avoid_: page (a Page is a content record), route, template

**Chrome**:
The parts of a Surface that belong to the publication rather than to its content — header, nav,
logo, footer, appearance toggle.

**Mode**:
Light or dark. A visitor-level choice, never a Layout choice.
_Avoid_: theme, dark mode variant

**Concession**:
A place where the theme deliberately renders something other than the design, because the platform
emits no structure to hang the design on.
_Avoid_: bug, regression, TODO

**Extension**:
A place where the theme renders something the design does not draw, because the platform emits
structure the design never anticipated.
_Avoid_: feature, enhancement, concession (a **Concession** renders less than the design; an
Extension renders more)

**Orphan**:
A heading, landmark or band the theme draws for content the publication does not have.
_Avoid_: empty state (that is the deliberate copy shown _instead_ of a band), hole (a pagination
gap), concession (an Orphan is a defect, not a deliberate reduction)

**Syntax palette**:
The colour set applied to the tokens inside a code block.
_Avoid_: syntax theme, code theme (theme is the shipped artifact)

### The publication

**Post**:
A dated article by one or more **Authors**, carrying one primary **Tag** and an access level.

**Page**:
A standing content record with no date in the reading order — About, Membership, the directories.

**Platform card**:
A Koenig block from the editor's card set — sixteen of which Ghost ships its own CSS for.
_Avoid_: card (unqualified it also names the design's post and author components), kg-card

**Feed**:
The paginated list of every **Post** in reverse-chronological order.
_Avoid_: blog, index, archive (used interchangeably in the Astro build's route names)

**Directory**:
A Surface that lists **Tags**, **Authors** or recommended publications rather than **Posts**.

**Gate**:
The block shown in place of the rest of a **Post** when the reader's access level is insufficient.
_Avoid_: paywall page, paywalled variant (it is a state of one Post, not a Layout)

**Tier**:
A named price level a **Member** can hold. Free is a Tier.

**Member**:
A reader with an identity on the publication. A **Subscriber** is a Member on a paid **Tier**.
_Avoid_: user, account, customer

### The build

**Reference build**:
The static Astro build of the theme — the pixel baseline every later port is scored against.
_Avoid_: prototype, mockup (it is measured, and it is not thrown away)

**Demo content**:
The invented publication the design was drawn with — 5 **Authors**, 14 **Tags**, 104 **Posts**.
Distinct from **Chrome copy**, which is the theme's own wording.

**Day-one publication**:
The one-**Author**, seven-**Post**, image-free, **Tag**-free publication on Ghost's own default
configuration — what a buyer has before configuring anything.
_Avoid_: bare (that is Ghost's default routing), minimal content, starter content

**Specimen**:
A rendered instance of one element or **Platform card**, present to be looked at rather than read.
_Avoid_: example, sample, demo (**Demo content** is the invented publication)

**Design tokens sheet**:
The one **Specimen** sheet the design draws — colour swatches, the type scale, the spacing ramp,
the controls, and one rendered article — and the Surface the theme is scored against. Published at
`/design-tokens/`.
_Avoid_: styleguide (that is now the exhaustive Surface), specimen sheet (any page of **Specimens**
is that; only this one is drawn)

**Style guide**:
The unscored Surface that renders every **Platform card** and every editor-emitted element, in
every variant the editor can produce, in both **Modes**. Published at `/styleguide/`.
_Avoid_: card audit (its earlier name, when it held only what the drawing omitted), card gallery

**Pixel identity**:
The percentage of pixels matching the design source at a fixed capture width, per Surface per
**Mode**.
_Avoid_: accuracy, fidelity, score

**Floor**:
The **Pixel identity** a Surface has already achieved and may not fall below.

## Relationships

- A **Variant** prescribes one **Layout** per **Surface**; the theme ships both A **Layouts** and
  lets the publication owner pick per Surface.
- Every **Surface** renders in both **Modes**, so a Surface has two **Pixel identity** figures.
- A **Post** has exactly one **Gate** state, decided by its access level against the reader's
  **Tier** — never by its **Layout**.
- A **Directory** lists **Tags** or **Authors**; a **Feed** lists **Posts**. Both paginate.
- **Demo content** exists so **Pixel identity** is measurable; **Chrome copy** ships with the theme.
- An **Extension** renders only where the design drew nothing, so it may never move a **Floor**.
- A **Syntax palette** has one set of colours per **Mode**, like every other colour in the theme.
- A **Platform card** the design draws may have its colour claimed as a **Concession** reduced,
  which can move a **Floor**; one the design draws nothing for may be claimed only as an
  **Extension**.
- The **Design tokens sheet** holds only **Specimens** the design draws, so it is scored; the
  **Style guide** holds every card the editor can emit, so it cannot be — and the two are separate
  Surfaces because they answer different questions: what the drawing says, and what the platform
  can produce.
- A **Day-one publication** has no **Pixel identity** and therefore no **Floor**: the design source
  was drawn with **Demo content**, so an absence has nothing to be scored against.
- An **Orphan** is what a **Day-one publication** is run to find, and it is always a defect — the
  design drew content in that place, and the theme drew the chrome without it.

## Example dialogue

> **Dev:** "The paywalled post — is that a third post **Layout**?"
> **Designer:** "No. There are two **Layouts**, A1 and A2, and either can be in the **Gate** state.
> The **Gate** replaces the body and drops the section nav; everything above it is unchanged."
>
> **Dev:** "And the tags page and the tag archive — same **Surface**?"
> **Designer:** "Different. The tags page is a **Directory**: it lists **Tags**. The tag archive is a
> **Feed** filtered to one **Tag**. They only look similar in A2 because both use cards."
>
> **Dev:** "Syntax colour in a code block — is that a **Concession**, since the design draws none?"
> **Designer:** "The other way round. A **Concession** is where we render less than the drawing
> because the platform gives us nothing to hang it on. Colour in code is an **Extension**: the
> drawing has no opinion, so we may add one — but only inside a block that names a language, which
> the drawing's own specimen does not. That is what keeps it off every **Floor**."
>
> **Dev:** "Ghost's bookmark card is a white panel in the dark **Mode**. Is that the recorded
> **Concession**?"
> **Designer:** "Only its geometry is. The design draws that card in both **Modes**, so its colour
> is ours to claim and the **Design tokens sheet** scores it. The audio card is the other way round
> — the design draws no player at all, so colour there is an **Extension**, and it is specimened on
> the **Style guide** where no **Floor** can be moved."

## Flagged ambiguities

- "variant" was used for both a design direction (A vs B) and a per-surface arrangement (A1 vs A2) —
  resolved: **Variant** is the direction, **Layout** is the arrangement.
- "page" meant both a Ghost content record and any URL — resolved: **Page** is the record,
  **Surface** is the kind of URL.
- "blog" / "index" / "archive" all named the same paginated list — resolved: **Feed**.
- "theme" was used for light/dark — resolved: that is **Mode**; theme means the shipped artifact.
- "paywalled" read as a Layout in the Astro route names (`/post-01-paywalled`) — resolved: it is the
  **Gate** state of a **Post**.
- microlighter's "theme" (`data-syntax-theme`) named the same thing as the shipped artifact —
  resolved: it is a **Syntax palette**.
- "card" named both a Koenig block and a design component (post card, author card) — resolved: the
  editor's block is a **Platform card**.
- "styleguide" named both the design's drawn sheet and any page of **Specimens** — resolved twice.
  First: the drawn one was the **Styleguide** and the exhaustive one the **Card audit**. That put the
  buyer's question ("what will my editor's cards look like") under the more obscure name, so the
  names now follow the reader: the exhaustive Surface is the **Style guide** at `/styleguide/`, and
  the drawn sheet is the **Design tokens sheet** at `/design-tokens/`.
- "Concession" was stretched to cover Ghost's light-only card CSS, which hid a defect behind a
  deliberate choice — resolved: the platform's geometry is a **Concession**; the platform's colour
  in a **Mode** the platform never drew is a bug.
- "bare" named Ghost's default routing in the harness (`--bare`, `routes-bare.json`) and was
  reached for again to mean "a publication with almost nothing in it" — resolved: the routing is
  **bare**, the publication is the **Day-one publication**, and the two vary independently.

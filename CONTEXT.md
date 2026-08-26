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

### The publication

**Post**:
A dated article by one or more **Authors**, carrying one primary **Tag** and an access level.

**Page**:
A standing content record with no date in the reading order — About, Membership, the directories.

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

## Example dialogue

> **Dev:** "The paywalled post — is that a third post **Layout**?"
> **Designer:** "No. There are two **Layouts**, A1 and A2, and either can be in the **Gate** state.
> The **Gate** replaces the body and drops the section nav; everything above it is unchanged."
>
> **Dev:** "And the tags page and the tag archive — same **Surface**?"
> **Designer:** "Different. The tags page is a **Directory**: it lists **Tags**. The tag archive is a
> **Feed** filtered to one **Tag**. They only look similar in A2 because both use cards."

## Flagged ambiguities

- "variant" was used for both a design direction (A vs B) and a per-surface arrangement (A1 vs A2) —
  resolved: **Variant** is the direction, **Layout** is the arrangement.
- "page" meant both a Ghost content record and any URL — resolved: **Page** is the record,
  **Surface** is the kind of URL.
- "blog" / "index" / "archive" all named the same paginated list — resolved: **Feed**.
- "theme" was used for light/dark — resolved: that is **Mode**; theme means the shipped artifact.
- "paywalled" read as a Layout in the Astro route names (`/post-01-paywalled`) — resolved: it is the
  **Gate** state of a **Post**.

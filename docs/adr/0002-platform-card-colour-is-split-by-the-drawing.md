# Platform card colour is split by the drawing

Ghost 6.60 ships CSS for sixteen **Platform cards** (`core/frontend/public/cards.manifest.json`), and
`prefers-color-scheme` appears **zero** times across all sixteen. Five of them hardcode a light
palette outright: `.kg-audio-card` (`background:#fff; color:#222`, time `#ababab`),
`.kg-bookmark-card a.kg-bookmark-container` (`background:#fff`), `.kg-file-card
a.kg-file-card-container` (`#fff`/`#222`), `.kg-product-card-container`, and
`.kg-signup-card-fields`/`-input` (`#fff`, border `#e6e6e6`). This theme has a visitor-level
**Mode**, which Ghost's card CSS has never heard of, so each of those renders a white panel with
near-black ink in the middle of a near-black page.

DECISIONS.md recorded bookmark, product, gallery, toggle, header and signup as a **Concession** —
"reimplementing [them] at four levels of specificity would be a second theme's worth of CSS". That
argument was about **geometry**, and it is still right. Colour rode along with it by accident.

The theme now claims the colour, and governs each card by whether the design draws it. The design's
own **Design tokens sheet** §07 draws bookmark, gallery, button, toggle and product; it draws no audio,
video, file, signup, header or embed. So:

- a **Platform card** the design draws gets the design's colour in both **Modes**. That is a
  **Concession** reduced, it belongs on the **Design tokens sheet**, and it may move a **Floor**.
- a **Platform card** the design draws nothing for gets a token remap only — surface, text, muted,
  border. That is an **Extension**, it belongs on the **Style guide**, and per CONTEXT.md it may
  never move a **Floor** — which is true by construction, since the **Style guide** carries no
  reference PNG and `scripts/ghost/build-jobs.mjs` derives the score index from
  `scripts/verify/baseline-index.json` by `route|mode`.

The alternative was one uniform remap of every hardcoded hex to a **Mode** token, in a single rule
block, with no distinction drawn. It is less CSS and it is unenforceable: audio-player colour, which
nothing drew, would be the same class of claim as bookmark colour, which the design specifies in
both **Modes**, and the **Extension** rule would have no rule block it could point at.

Three cards are deliberately not claimed. `kg-video-card`'s twenty-six `#fff` values all sit in the
control bar, which paints over `#00000080` on top of the video — correct in both **Modes**.
`kg-header-card`'s `kg-style-dark`/`-light`/`-image`/`-accent` are the author's choice in the
editor, not a **Mode** failure. `kg-nft-card` is deprecated in the Ghost 6 editor and reaches
legacy content only.

## Consequences

Geometry stays a **Concession** and colour stops being one. A card the design draws is answerable
to a **Floor**; a card it does not draw is answerable to the **Style guide** and to nothing else,
which is what keeps a player's colour from ever being scored against a drawing that contains no
player.

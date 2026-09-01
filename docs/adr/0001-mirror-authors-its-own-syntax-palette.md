# MIRROR authors its own Syntax palette

The theme highlights code with [microlighter](https://github.com/davatron5000/microlighter), which
ships ten palettes of its own. We use none of them: the thirteen `--syntax-*` properties and the
`::highlight()` rules are written in `ghost/assets/css/screen.css` against the design's existing
tokens, with exactly two new raw values per Mode (strings, types).

Three reasons, in order of weight. `src/styles/main.css` is documented as the single place raw
colour lives — "flipping the theme is nothing more than swapping this variable set" — and importing
a palette would install a second colour authority beside it. Every bundled palette also carries
`[data-syntax-theme=…] pre:has(code){background-color;color}` at specificity 0,1,2, which outranks
`.mirror-content pre` at 0,1,1 and would repaint the code surface the design fixed — so we would be
overriding the file we imported. And GitHub's blues and purples, or Dracula's neons, are not this
theme: MIRROR is stone neutrals and one amber accent, and code is the one place a foreign palette
would be most visible.

The cost is ownership. The registry names (`comment`, `keyword`, `attribute-value`, …) are
microlighter's, so a future version that scopes a new category renders it unstyled until we add a
rule. That failure is quiet and correct — an unnamed category inherits the code colour, which is
what the design draws — which is why this is a cost we accept rather than a risk we mitigate.

## Consequences

Syntax colour is an **Extension**: the design draws code in one colour, so nothing here is
transcribed from it. It renders only inside a block whose author named a language, which is why it
moves no **Floor** — the design's own specimen names no language and is untouched.

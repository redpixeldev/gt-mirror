# Ghost platform reference

Where Ghost answers the questions a theme change raises, and the platform behaviours that have
already cost a debugging session; the installed source in `~/ghost-mirror/current` (Ghost 6.60) is
the source of truth, and every line below was checked against it.

Paths without a prefix are relative to `~/ghost-mirror/current`. `ghost/…` and `.prettierignore`
are paths in this repository.

## Source map

| Question                                             | File                                                                             | Look at                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| What does helper `{{x}}` do?                         | `core/frontend/helpers/<x>.js`                                                   | One file per helper (`get.js`, `foreach.js`, `match.js`, `navigation.js`, `recommendations.js`, …).           |
| What does a built-in helper partial render?          | `core/frontend/helpers/tpl/`                                                     | Default `.hbs` partials a theme overrides under `partials/`.                                                  |
| How is an async helper's error handled?              | `core/frontend/services/helpers/handlebars.js`                                   | `:15-34` — the helper's output becomes `''` (the error text in development); the page still renders.          |
| Which template renders this URL?                     | `core/frontend/services/rendering/templates.js`                                  | `:27-31` error templates, `:55-59` router name and slug template, `:93-104` entry templates.                  |
| How are templates compiled?                          | `core/frontend/services/theme-engine/engine.js`                                  | `:16` — `compile(source, { preventIndent: true })`.                                                           |
| How does a helper render its partial?                | `core/frontend/services/theme-engine/handlebars/template.js`                     | `:14-29` `templates.execute`. Helpers reach it through the proxy file `core/frontend/services/handlebars.js`. |
| Where do the editor's custom templates come from?    | `core/frontend/services/theme-engine/active.js`                                  | `:50` — `checkedTheme.templates.custom`, i.e. gscan's output.                                                 |
| How does `custom-foo-bar.hbs` become a picker label? | `node_modules/gscan/lib/read-theme.js`                                           | `:170-180` `generateName`: strip `post-`/`page-`/`custom-`, hyphens to spaces, title-case.                    |
| Where does `{{asset}}` add `?v=`?                    | `core/frontend/meta/asset-url.js`                                                | `:160-180` picks a card, content or global hash; `:191` appends it.                                           |
| Where is `cards.min.css` emitted?                    | `core/frontend/helpers/ghost_head.js`                                            | `:484-489`, inside `{{ghost_head}}`.                                                                          |
| Which `@` globals does gscan accept?                 | `node_modules/gscan/lib/ast-linter/rules/internal/scope.js`                      | `:5-31` allowlist: `site member setting config labs custom page` plus the loop data variables.                |
| How does Handlebars decide a block pushed a frame?   | `node_modules/handlebars/dist/cjs/handlebars/runtime.js`                         | `:263` `wrapProgram`.                                                                                         |
| Which includes does a public endpoint allow?         | `core/server/api/endpoints/<resource>-public.js`                                 | `ALLOWED_INCLUDES` near the top of each file.                                                                 |
| Where are login rate limits set?                     | `core/shared/config/defaults.json`                                               | `:102` `spam` block; `global_block` at `:132-137`.                                                            |
| Where do heading ids in post content come from?      | `node_modules/@tryghost/kg-lexical-html-renderer/build/cjs/utils/generate-id.js` | `:4-18`.                                                                                                      |

## Traps

**Test a Layout override template on a page whose slug has no template.** Ghost puts
`page-{slug}`/`post-{slug}` ahead of the record's `custom_template`, so a `custom-*` choice does
nothing on `/about/`, `/membership/`, `/tags/`, `/authors/` or `/recommendations/`.
`core/frontend/services/rendering/templates.js:100-104`.

**Read nothing through `../` on the first pass of `{{#foreach ../navigation from=@number}}`.**
That iteration's context is the outer item itself, and Handlebars pushes a depth frame only when the
context object changes, so `../` resolves one level shallower there; gate with `{{#unless @first}}`.
`node_modules/handlebars/dist/cjs/handlebars/runtime.js:263`.

**Compare HTML with whitespace collapsed after moving markup into a partial.** Under
`preventIndent` the call line's leading whitespace is emitted as content before the partial, and the
partial's own whitespace is emitted verbatim. `core/frontend/services/theme-engine/engine.js:16`,
`node_modules/handlebars/dist/cjs/handlebars/compiler/compiler.js:203-206`.

**Expect `{{recommendations}}` to honour only `limit`, `order`, `filter` and `page`.** Every other
hash argument is dropped, and the partial receives only the API response plus a copy of the
caller's `@` frame, so no per-template Layout reaches it. It renders nothing while
`recommendations_enabled` is off. `core/frontend/helpers/recommendations.js:66-77,86-111`.

**Use `match`'s `~`, `~^` and `~$` on strings only.** Any non-string operand is false; there is no
"any item matches" test, so detecting a nav parent needs a look-ahead to the next item.
`core/frontend/helpers/match.js:62-69`.

**Read a partial's hash arguments as `../x` inside a `{{#get}}` block.** The block's context is the
query response; `{{#if}}` adds no frame, so one `../` stays right inside a guard.
`core/frontend/helpers/get.js:382`, `node_modules/handlebars/dist/cjs/handlebars/helpers/if.js:29`.

**Call `{{pagination}}` outside any `{{#get}}` block.** Inside one, `this.pagination` is the get's
own pagination. `{{#with @root}}` is no escape: gscan rejects `@root` as GS120-NO-UNKNOWN-GLOBALS.
`core/frontend/helpers/get.js:376-378`, `core/frontend/helpers/pagination.js:25`,
`node_modules/gscan/lib/ast-linter/rules/internal/scope.js:5-13`.

**Guard emptiness inside the `{{#get}}` block (`{{#if posts}}…{{else}}…{{/if}}`).** The get's
`{{else}}` runs only for an unknown resource or an API error; an empty result renders the main block,
and so does a query aborted by the timeout threshold, prefixed with "Could not load content".
`core/frontend/helpers/get.js:424,489` (inverse), `:331,365-391` (abort).

**Write `{{#get}}` filter mustaches as plain or dotted paths from the current context.** Segments
must match `\w+` with an optional `[N]`/`[*]`; `{{../id}}` throws `unsupported path segment ""`, and
the get renders as an empty string inside an otherwise normal 200 page.
`core/frontend/helpers/get.js:91-106`, `core/frontend/services/helpers/handlebars.js:29-33`.

**Fetch an Author's post count with `{{#get "authors" filter="slug:{{slug}}" include="count.posts"}}`.**
Authors embedded in a Post never carry `count.posts`; only the authors endpoint allows that include.
`core/server/api/endpoints/posts-public.js:11`, `core/server/api/endpoints/authors-public.js:6`.

**Link a client-side table of contents to the ids Ghost already puts on headings.** Each heading
gets a slugified id, and repeats are suffixed `-1`, `-2`.
`node_modules/@tryghost/kg-lexical-html-renderer/build/cjs/utils/generate-id.js:8-16`.

**Run Ghost with node@22.** `package.json:226` pins `"node": "^22.23.1"`.

**Scope card styling with that load order in mind.** `{{ghost_head}}` emits `cards.min.css`, and it
sits after the theme stylesheet in `ghost/default.hbs` (`:21` vs `:51`), so at equal specificity the
card stylesheet wins. `core/frontend/helpers/ghost_head.js:487-489`.

**Reuse a cached owner session.** `POST /session` is guarded per IP by `global_block`: 99 free
retries over a 3600-second lifetime, then 429 for the rest of the hour. The counters live in the
`brute` table; `delete from brute;` clears them. `core/server/web/api/endpoints/admin/routes.js:399-401`,
`core/shared/config/defaults.json:132-137`, `core/server/data/schema/schema.js:511`.

**Reference theme assets through `{{asset}}` only.** It appends the `?v=<hash>` cache-buster that a
hand-written URL lacks. `core/frontend/meta/asset-url.js:191`.

**Format `.hbs` files by hand.** With no Handlebars plugin, Prettier's glimmer printer
single-quotes attributes, collapses `{{!-- --}}` comments and deletes `<!DOCTYPE html>`;
`.prettierignore:12` excludes `*.hbs`.

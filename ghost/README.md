# MIRROR

An editorial theme for considered publications. Two layouts, two modes, self-hosted type.

MIRROR is built on exactly two families — **Newsreader** for reading and **Archivo** for
interface and metadata — and ships them with the theme. Nothing is fetched from Google at
render time.

## Install

1. Download `mirror.zip`.
2. In Ghost admin, go to **Settings → Design & branding → Change theme → Upload theme**.
3. Upload the zip and activate it.

The theme requires **Ghost 6.0 or newer**.

## Settings

Everything below lives in **Settings → Design & branding**, under the theme's own section.

| Setting                | Options                       | What it does                                                               |
| :--------------------- | :---------------------------- | :------------------------------------------------------------------------- |
| **Default appearance** | Light · Dark · System         | The mode a first-time visitor sees. Their own choice always wins.          |
| **Dark mode logo**     | An image                      | Your logo, redrawn in light ink, for the dark Mode.                        |
| **Post layout**        | Centered classic · Title page | Cover photo over centred titling, or a title page with a sticky side rail. |
| **Newsletter heading** | Text                          | The heading on every subscribe block.                                      |

More settings arrive with the layouts they control; each one is documented here as it lands.

### Posts

- **Post layout** picks between the two designed reading columns. _Centered classic_ leads with
  the feature image and puts the contents list above the article; _Title page_ drops the photo,
  sets the title large, and moves the contents list and the share actions into a rail beside
  the article. Both carry the writer, the neighbouring posts, three related posts and the
  subscribe band.
- **The contents list is built from your headings.** Every `Heading 2` in the post becomes an
  entry, numbered in order, and the entry you are reading is highlighted as you scroll. A post
  with no `Heading 2` shows no contents list. Nothing to configure, and nothing to keep in step
  by hand.
- A post with **no feature image** starts at the title in either layout — there is no empty
  band. Add a **caption** to the feature image and it prints under it in _Centered classic_.
- **Related posts** are the three most recent other posts sharing the post's first tag. An
  untagged post shows none.
- **Copy link** copies the post's address; **Email** and **Bluesky** open a pre-filled message.
  The chips under the article link to each tag's archive, and every byline links to the writer.
- The article body is set in the design's own type scale, and Ghost's editor cards keep the
  platform's layout with MIRROR's colours. Two exceptions the design draws itself: a callout
  gets an accent rail rather than a filled block, and a pull quote is set centred in the
  display face.

### Header, menu and footer

- The header menu is **Settings → Navigation → Primary**, and the footer's two link columns
  are the **Primary** and **Secondary** menus. Edit either in admin and the pages follow; the
  theme hardcodes no links. A feed link is a menu item like any other — add `/rss/` to the
  secondary menu to put it in the footer.
- Below 1200px the header collapses to a menu button, and the panel it opens carries search,
  the whole menu and the subscribe button.
- **Search is Ghost's own.** The ⌕ button opens the platform's search, and `⌘K` works on every
  page except sign-in and sign-up, which carry no search control. Nothing about the search
  index lives in this theme.
- The header's button follows your membership settings: **Subscribe** normally, **Sign in**
  while signups are invite-only, **Account** for a signed-in member, and nothing at all if
  memberships are off.
- The footer's email field is Ghost's signup form, so it creates real members and sends a
  real magic link. It appears only while memberships are on.
- If you upload a **publication logo** it replaces the wordmark. MIRROR's dark Mode needs a
  light-ink version of it: set **Dark mode logo**, or leave it empty and the dark Mode sets
  your publication name in the theme's display face.

### Appearance, accent and fonts

- A visitor's light/dark choice is stored in their browser and survives a reload. **Default
  appearance** only decides what someone sees before they have chosen.
- The theme's one chromatic colour comes from **Settings → Design & branding → Brand →
  Accent color**. MIRROR's demo site uses a burnt amber. Be aware that a very light accent
  will not meet AA contrast against the theme's warm neutrals.
- If you pick fonts under **Design & branding → Typography**, MIRROR honours them. Leave them
  alone and you get Newsreader and Archivo as the theme was designed.

## Support and debugging

**`?mode=light` / `?mode=dark`** on any URL forces that mode for the page view, ahead of both
the visitor's stored choice and the **Default appearance** setting. Nothing is written to the
visitor's browser, so it is safe to send someone a link. It exists so a screenshot or a bug
report can address a colour mode directly instead of describing it.

## Development

From the repository root, not from this directory:

```bash
pnpm ghost:build   # compile assets/built/screen.css and assets/built/main.js
pnpm ghost:dev     # the same two, in watch mode
pnpm ghost:scan    # gscan, warnings fatal
pnpm ghost:zip     # build, scan, stage and zip to dist/mirror.zip
```

`assets/css/` and `assets/js/` are sources and are excluded from the zip; `assets/built/` is
generated and is not committed. The stylesheet imports the Astro reference build's
`src/styles/main.css`, which is the single source of truth for every token, font face and
utility in the theme — see `DECISIONS.md` in the repository root.

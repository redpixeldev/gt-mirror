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

| Setting                | Options               | What it does                                                      |
| :--------------------- | :-------------------- | :---------------------------------------------------------------- |
| **Default appearance** | Light · Dark · System | The mode a first-time visitor sees. Their own choice always wins. |
| **Dark mode logo**     | An image              | Your logo, redrawn in light ink, for the dark Mode.               |

More settings arrive with the layouts they control; each one is documented here as it lands.

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

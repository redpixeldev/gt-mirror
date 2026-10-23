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

| Setting                | Options                             | What it does                                                               |
| :--------------------- | :---------------------------------- | :------------------------------------------------------------------------- |
| **Default appearance** | Light · Dark · System               | The mode a first-time visitor sees. Their own choice always wins.          |
| **Dark mode logo**     | An image                            | Your logo, redrawn in light ink, for the dark Mode.                        |
| **Homepage layout**    | Magazine cover · Editorial masthead | A cover story over a grid, or your masthead over a ranked list.            |
| **Feed layout**        | List · Grid                         | A wide row per post, or a grid of cards. Also the tag and writer archives. |
| **Directory layout**   | Editorial rows · Cover cards        | A row per subject, or a grid of cards with cover photos.                   |
| **Post layout**        | Centered classic · Title page       | Cover photo over centred titling, or a title page with a sticky side rail. |
| **Page hero**          | Centered statement · Split hero     | Opener for About and Membership, and for the error page.                   |
| **Featured tier**      | Text                                | The tier that carries the accent panel and the "Most popular" chip.        |
| **Newsletter heading** | Text                                | The heading on every subscribe block.                                      |

More settings arrive with the layouts they control; each one is documented here as it lands.

### The front page and the feed

- **Homepage layout** picks between the two designed front pages. _Magazine cover_ leads with your
  newest post at full width over its photo, then your featured posts in a strip you can scroll,
  then a lead story with the rest of the latest around it. _Editorial masthead_ drops the photo,
  sets the newest post centred and typographic, and runs the rest as a numbered shortlist over a
  grid.
- **Nothing on the front page is a list you maintain.** The cover story is simply your newest
  post, the strip is every post you marked **featured**, and the grid is what follows. Publishing
  moves all of them; there is no ordering to keep in step by hand.
- **Feed layout** picks between the two designed archives. _List_ gives each post a wide row with
  a thumbnail, an excerpt and the writer's face; _Grid_ gives each one a card.
- **The tag row above the feed** shows your seven busiest subjects, with the number of posts under
  each, and every pill is a link to that subject's own archive. The one you are on is filled.
- **How many posts a page holds** is `posts_per_page` in this theme, and it ships at 18. Ghost
  decides that in its routing layer rather than in the theme's settings, so there is no control
  for it in admin — to change it, add `limit:` to the route in **Settings → Labs → Routes**.

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
- **A code block that names its language gets the design's strip.** Type the language into the
  editor's code card — `json`, `javascript`, `css`, `bash`, `python`, `sql`, `yaml`, `diff` and 30
  more — and MIRROR prints it in a header above the code with a **copy** button beside it, then
  colours the code in the publication's own palette rather than an editor's: stone, with your
  accent on keywords, in both light and dark. Leave the language empty and the block stays exactly
  as the design draws it — one colour, no strip. A language nobody has a grammar for still gets its
  strip; only the colour is missing.
- **Nothing loads on a page with no code.** The highlighter is fetched by the page that needs it,
  and each language's grammar only when a block on that page is written in it.

### Subjects

- **A tag's archive** — `/tag/{slug}/` — is your feed filtered to one subject, and it follows
  **Feed layout**: _List_ gives it a lead story over compact rows, _Grid_ gives every post an
  equal card. The lead only appears on page 1, because on page 2 it would not be the latest
  anything.
- The archive's masthead prints the tag's **name**, its **description** and its **post count**,
  followed by the years it spans — read from the tag's oldest and newest posts, so a subject
  published in one year prints that year rather than a range of it to itself.
- Below it, **Other tags** links to your eight busiest subjects, never including the one being
  read. A tag with no description simply prints its count.
- **The Tags Directory** is a page of your own — the demo calls it `/tags/`, and any page can
  use the layout by picking **Tags** in the page settings menu. It lists every subject
  **alphabetically**, with its post count, and follows **Directory layout**. A subject with no
  cover photo keeps the empty frame so the grid stays a grid.
- **A subject with no posts is not listed.** Ghost's own tag API only answers with tags that
  have something filed under them, so an empty tag never reaches the directory.
- A publication with **more than 100 public tags** loses the end of the alphabet: Ghost caps
  every theme query at 100 rows, and that cap is not something a theme can lift.
- **The page's own title and one-line summary** are the directory's heading and lead. Write the
  sentence in the page body, or set an excerpt in the page settings if the body is longer — the
  directory prints the excerpt, because the list below it is the page's real content.

### Writers

- **A writer's archive** — `/author/{slug}/` — follows **Feed layout** too: _List_ puts a centred
  profile above compact rows, _Grid_ moves the profile into a rail beside a grid of cards. The
  rail stops being sticky once the page stacks, so nothing scrolls through the portrait on a
  phone.
- **The masthead** is a page of your own — the demo calls it `/authors/`, and any page can use
  the layout by picking **Authors** in the page settings menu. It lists every writer who has
  published, most prolific first, and follows **Directory layout**.
- **A staff account is not yet a writer.** Someone who has not published does not appear on the
  masthead, and neither does an empty row where they would have been.
- Each row prints the writer's **photo, post count, location, bio, latest piece, site and
  social handle** — every one of them optional. A writer with none of them still gets a row
  with their name, their count and a monogram in place of the photograph.
- Ghost's **bio field holds 250 characters**; longer text is refused when you save it, not
  truncated by the theme.
- Your site link prints as its domain and your handle prints with the `@`, both linking to the
  real destination. Both come from **Settings → Staff**, on each writer's own profile.
- **A post with more than one writer credits all of them**, everywhere a byline appears. The
  face beside the byline is the first writer's.

### About, Membership and Recommendations

- All three are pages of your own, and each has a layout you can apply to a page with any name
  by picking **About**, **Membership** or **Recommendations** in the page settings menu. The demo
  calls them `/about/`, `/membership/` and `/recommendations/`.
- **Page hero** picks the opener on About and Membership: _Centered statement_ sets the title
  large and centred, _Split hero_ sets it beside your page's feature image (on Membership,
  beside its own standfirst).
- **About counts its own figures.** Posts published, writers, subjects and the year you started
  are read from the publication every time the page renders — there is nothing to keep in step
  by hand. Below them comes your page body, then the masthead.
- **Membership prices come from your Tiers, never from the theme.** Names, descriptions,
  benefits and both prices are Settings → Membership, the monthly/yearly switch shows as soon as
  one paid tier exists, and every button opens the real signup for that tier and interval.
  **Featured tier** names the one that gets the accent panel.
- The **benefit comparison, member quotes and questions** are your page's own body. Write the
  comparison as a table and the questions as **toggle** cards — the theme styles both, and the
  table scrolls rather than cropping its last column on a phone.
- **Behind the paywall right now** is the three most recent posts a free reader cannot finish.
  It disappears on a publication that gates nothing.
- **Recommendations** lists what you added under **Settings → Recommendations**, in either
  Directory layout. Every entry links to the publication, and where Ghost knows it runs Ghost,
  a second button opens that publication's own signup.

### When a link is wrong

- **A missing URL gets the designed page**, in whichever **Page hero** you picked, with the menu
  above it and the one-row foot below. The wordmark and the whole menu are the way back.
- It offers the newsletter rather than an apology and a dead end, and that form is your real
  signup. It disappears with memberships off.
- **Every other error** — a server error, a temporary outage — gets a plainer page carrying
  Ghost's own message, its code, and a link to the front page. Nothing is invented there: what
  the platform reports is what the reader is told.

### Header, menu and footer

- The header menu is **Settings → Navigation → Primary**, and the footer's two link columns
  are the **Primary** and **Secondary** menus. Edit either in admin and the pages follow; the
  theme hardcodes no links. A feed link is a menu item like any other — add `/rss/` to the
  secondary menu to put it in the footer.
- Below 1200px the header collapses to a menu button, and the panel it opens carries search,
  the whole menu and the subscribe button.
- **Submenus** are written in the labels. Name the parent in the child's label — `Feed / Grid`
  belongs to the item labelled `Feed` and shows as `Grid` — and put the first child directly
  under its parent in the list; the rest are collected wherever they sit. On a wide screen the
  parent opens a panel on hover or keyboard focus, and its label still goes to its own URL;
  give a parent the URL `#` and it becomes a heading that only opens its panel. Below 1200px the
  panel lists each group under its heading. A child whose parent is missing, or whose parent is
  not followed by a child, is not shown. The footer's **Sections** column lists only the
  top-level items.
- **Search is Ghost's own.** The ⌕ button in the header opens the platform's search on every page
  except sign-in and sign-up, which carry no chrome at all, and `⌘K` works wherever the button
  does. Nothing about the search index lives in this theme.
- The header's button follows your membership settings: **Subscribe** normally, **Sign in**
  while signups are invite-only, **Account** for a signed-in member, and nothing at all if
  memberships are off.
- The footer's email field is Ghost's signup form, so it creates real members and sends a
  real magic link. It appears only while memberships are on.
- If you upload a **publication logo** it replaces the wordmark. MIRROR's dark Mode needs a
  light-ink version of it: set **Dark mode logo**, or leave it empty and the dark Mode sets
  your publication name in the theme's display face.

### Signing in and signing up

- **`/sign-in/` and `/sign-up/` are pages of your own**, and the layouts apply to a page with
  any name through **Sign in** and **Sign up** in the page settings menu. They are real Ghost
  signup forms: a visitor who submits one gets a real magic link.
- Each renders what your settings allow. Already a member: their address and a link to their
  account. Invite-only: sign in, because offering a signup that will be refused is a lie.
  Memberships off: a sentence and no controls.
- **Every other button opens Ghost's own Portal** — the header's Subscribe, the paywall's call
  to action, the plan buttons, and the subscribe buttons beside a recommendation. Portal takes
  your **accent colour** and the plans you offer, and everything else about it belongs to Ghost
  rather than to this theme.
- **Which plans Portal offers** is Settings → Portal. Ghost starts a new site on the free plan
  only; add the paid ones there once your tiers exist, or the signup modal will offer less than
  your membership page does.

### Appearance, accent and fonts

- A visitor's light/dark choice is stored in their browser and survives a reload. **Default
  appearance** only decides what someone sees before they have chosen.
- The theme's one chromatic colour comes from **Settings → Design & branding → Brand →
  Accent color**. MIRROR's demo site uses a burnt amber. Be aware that a very light accent
  will not meet AA contrast against the theme's warm neutrals.
- If you pick fonts under **Design & branding → Typography**, MIRROR honours them. Leave them
  alone and you get Newsreader and Archivo as the theme was designed.

### URLs

MIRROR works on a stock Ghost install, where `/` is your posts collection: the magazine cover is
its first page and the feed layout takes over from `/page/2/`. If you would rather have the cover
at `/` always and the feed at a URL of its own, upload `docs/routes.example.yaml` from this
theme's repository under **Settings → Labs → Routes** — it puts the feed at `/archive/`, and both
pages then page independently. Nothing else about the theme changes either way.

### One post, page or URL in the other layout

Every layout setting picks a layout for the whole publication. Each layout is also a template, so
one post, page or URL can have the other one regardless of the setting:

- **Posts and pages**: in the post or page settings menu, **Template** lists both layouts of the
  post and of About, Membership, the subject list and the writer list — _Post Title Page_, _About
  Split Hero_, _Tags Cover Cards_ and so on. _Default_ follows the setting. Ghost gives a page
  whose URL is `about`, `membership`, `tags`, `authors` or `recommendations` its own template
  first, so on those five the menu has no effect; change the setting, or use another URL.
- **Recommendations** has no such template: Ghost renders that list through a helper that passes
  nothing through from the page, so it always follows **Directory layout**.
- **The front page, the feed, a subject, a writer and the error page** have no settings menu, so
  a route picks the layout instead, in **Settings → Labs → Routes**. The templates are
  `layout-home-magazine-cover`, `layout-home-editorial-masthead`, `layout-feed-list`,
  `layout-feed-grid`, `layout-tag-list`, `layout-tag-grid`, `layout-author-list`,
  `layout-author-grid`, `layout-error-centered-statement` and `layout-error-split-hero`:

  ```yaml
  routes:
    /gallery/:
      controller: channel
      template: layout-feed-grid
    /essays-as-cards/:
      controller: channel
      filter: tag:essays
      data: tag.essays
      template: layout-tag-grid
  ```

  A subject or writer route needs `data:`, and Ghost then redirects that subject's own URL to the
  route. A route answers 200, so the two error-page templates tell search engines not to index
  them.

## Support and debugging

**`?mode=light` / `?mode=dark`** on any URL forces that mode for the page view, ahead of both
the visitor's stored choice and the **Default appearance** setting. Nothing is written to the
visitor's browser, so it is safe to send someone a link. It exists so a screenshot or a bug
report can address a colour mode directly instead of describing it.

## Development

From the repository root, not from this directory:

```bash
pnpm ghost:build          # compile assets/built/screen.css and assets/built/main.js
pnpm ghost:dev            # the same two, in watch mode
pnpm ghost:scan           # gscan, warnings fatal
pnpm ghost:audit          # the responsive audit: every Surface at twelve widths
pnpm ghost:score          # capture every Surface in both Modes and score it
pnpm ghost:snapshot       # save every Layout-bearing Surface's HTML in both Layouts to <dir>
pnpm ghost:snapshot:diff  # compare two snapshot dirs, ignoring whitespace and save-time noise
pnpm ghost:zip            # build, scan, stage and zip to dist/mirror.zip
pnpm ghost:demo           # the demo publication as one import file, its routes file and its checklist
pnpm ghost:routes:apply   # push docs/routes.example.yaml to the running install
pnpm ghost:routes:bare    # put Ghost's own default routes back
```

`pnpm gate` runs every check a change has to pass: the build, gscan, Prettier and ESLint on
changed files, then the fixture, smoke, audit, Day-one, Demo site and score runs against the three
local Ghosts. It refuses to start until all three are listening, and prints the command for any
that isn't. `pnpm gate:static` is the part that needs no Ghost. `pnpm install` registers it as the
pre-commit hook (`.githooks/`), and CI runs it on every push and pull request
(`.github/workflows/gate.yml`).

`assets/css/` and `assets/js/` are sources and are excluded from the zip; `assets/built/` is
generated and is not committed. The stylesheet imports the Astro reference build's
`src/styles/main.css`, which is the single source of truth for every token, font face and
utility in the theme — see `DECISIONS.md` in the repository root.

### The Day-one publication

The theme was drawn against a publication with 104 posts, 14 subjects, 5 writers and a photograph
on everything. A buyer's blog on its first day has none of that, and that is the only configuration
in which the theme's absence paths render at all — the text wordmark, the initial-monogram
portraits, and every band that has no content to hold. It runs on a second Ghost of its own so the
scored publication is never disturbed.

```bash
pnpm day-one:fixture     # the publication, both route lists, the capture matrix, the audit paths
pnpm day-one:import      # apply it to the Ghost on :2369 (destructive to THAT install only)
pnpm day-one             # both routings, both smoke passes, then the width audit
pnpm day-one:shots       # the capture matrix into .shots/day-one/ — unscored artefacts to read
```

Its Ghost is `~/ghost-mirror/config.day-one.json` — port 2369, its own sqlite file, its own
content directory with the theme symlinked into `themes/`. Start it from the same tree:

```bash
cd ~/ghost-mirror && NODE_ENV=day-one /opt/homebrew/opt/node@22/bin/node current/index.js
```

`--posts N` on the generator changes the publication's size and rewrites all five outputs at once;
7 is committed because it leaves the homepage grid holding two of its nine slots. Nothing in the
run is scored: there is no reference drawing of an absence, so the assertions are structural and
the screenshots are there to be looked at.

### The Demo site, locally

The Demo site is the scored publication plus the **Layout browser** — a header menu of every
Layout of every Surface, so a buyer can see each one without touching a setting (ADR 0006 in the
repository). `scripts/ghost/demo-overlay.mjs` defines it once; `pnpm ghost:demo` applies it and
writes the routes file the Demo site needs beside the zip. It runs on a third Ghost of its own so
neither the scored publication nor the Day-one one is disturbed.

```bash
pnpm demo:import         # rebuild the demo files, apply them to the Ghost on :2370 (destructive to THAT install)
pnpm demo:routes         # upload dist/mirror-demo-routes.yaml there
pnpm demo:smoke          # walk every Layout browser entry: status, Surface, Layout, Gate, canonical
pnpm demo                # all three
```

`demo:smoke` takes `--base`, so `node scripts/ghost/demo-smoke.mjs --base https://mirror.redpixelthemes.com`
checks the published Demo site the same way. It fails when an entry renders a Layout other than the
one its label names — which is what happens if someone changes a Layout setting on the Demo site,
because the default entries link to the real URLs.

Its Ghost is `~/ghost-mirror/config.demo.json` — port 2370, its own sqlite file, its own content
directory with the theme symlinked into `themes/`. Start it from the same tree:

```bash
cd ~/ghost-mirror && NODE_ENV=demo /opt/homebrew/opt/node@22/bin/node current/index.js
```

On a fresh database, create the owner with the `.env` credentials the scripts sign in with — at
`http://localhost:2370/ghost/`, or `POST /ghost/api/admin/authentication/setup/` — and activate
MIRROR before the first `pnpm demo`.

### The Demo site on Laravel Cloud

The published Demo site is a Laravel Cloud app built from `demo-host/` (ADR 0007 in the repository).
Nothing on it is migrated: it is rebuilt from the repository like the local one. Cloud's disk is
wiped on every deploy, reboot and wake, so everything Ghost writes goes to the bucket through the
S3 adapters Ghost ships (uploads, `routes.yaml`, redirects); the theme is the one thing baked into
the deploy. `demo-host/ghost-config.mjs` maps Cloud's variables to Ghost's config and refuses to
boot when one is missing; `pnpm demo-host:test` covers it, and the gate runs it.

One-time setup, in the Cloud dashboard:

- **Application** from `redpixeldev/gt-mirror`, root directory `demo-host`. Build command
  `npm install -g pnpm && npm run build`, start command `node start.mjs` (not through npm, so
  Cloud's SIGTERM reaches Ghost's own shutdown handler directly), Node 22.
- **Compute**: one Flex instance, scale-to-zero on, never more than one replica — Ghost keeps its
  scheduler and caches in process. **Push to deploy off**.
- **Laravel MySQL** (Flex) and a **public** Laravel Object Storage bucket attached as the default
  disk. Copy the bucket's public URL into the environment as `AWS_URL`; Cloud does not inject it.
- **Mail**: Plunk SMTP as Ghost's own variables — `mail__transport=SMTP`, `mail__from`,
  `mail__options__host`, `mail__options__port`, `mail__options__secure`,
  `mail__options__auth__user`, `mail__options__auth__pass`. Any variable in Ghost's own `a__b`
  spelling overrides what `ghost-config.mjs` derives.

Then deploy, and seed on the `*.laravel.cloud` address. `pnpm demo:cloud` creates the owner from
`DEMO_CLOUD_ADMIN_EMAIL` / `DEMO_CLOUD_ADMIN_PASSWORD` in `.env` (not the local harness's login:
this one is public, and password-only), activates MIRROR, runs the Demo import and routes, and ends
with `demo:smoke`. It is safe to re-run.

```bash
cloud deploy mirror-demo main -n && cloud deploy:monitor -n
pnpm demo:cloud --base https://<environment>.laravel.cloud
```

To move `mirror.redpixelthemes.com` across: attach it as a custom domain, set `url` to it on the
environment, redeploy, point DNS at Cloud, and run
`node scripts/ghost/demo-smoke.mjs --base https://mirror.redpixelthemes.com`. Keep the old server
for 14 days as the rollback, then shut it down.

Every later deploy is manual and follows a passing `pnpm gate`, then that same smoke run. Pages
sit in Cloud's edge cache for an hour; a deploy purges it, a re-seed does not, so purge from the
environment's **Edge network** card after one. To upgrade Ghost, bump `GHOST_VERSION` in
`demo-host/build.mjs` in the same commit as the local `~/ghost-mirror` upgrade.

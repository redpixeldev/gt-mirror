# The Demo site runs on Laravel Cloud, rebuilt from the repo

The **Demo site** (`mirror.redpixelthemes.com`, the manifest's `demo` field) moves off a self-managed
VPS onto Laravel Cloud as a generic Node.js app, from a top-level directory of this repo. Cloud's
disk is ephemeral — it resets on every deploy, reboot, wake from scale-to-zero and host migration —
and it offers MySQL but not SQLite, so the Demo site is treated as derived state: everything it
shows is rebuilt from the repo (`demo-overlay.mjs`, the demo fixture, the theme) rather than
migrated from the VPS. Only the Demo site moves; the three harness Ghosts stay local, because
**Pixel identity** and **Parity** are measured on the local install and the Demo site carries no
**Floor**.

## Considered options

- **Keep the VPS.** Persistent disk, SQLite works, nothing to bake — but a box to patch, and a
  Demo site that drifts from the repo through Admin edits nobody records.
- **A separate hosting repo** pulling a built `mirror.zip`. Keeps gt-mirror theme-only, but a theme
  change ships only when someone bumps it there, so the Demo site can lag `main`.
- **Always-on instance.** No cold start for a buyer arriving from the marketplace; rejected on
  cost, with the edge cache below covering most visits instead.

## Consequences

- Only the theme is baked at build time (`demo-host/build.mjs` stages `ghost/` into
  `content/themes/mirror`): Ghost has no remote theme store, so a theme uploaded through Ghost
  Admin lasts only until the next reboot, which Cloud may perform without a deploy.
- Everything else Ghost writes goes to a public Laravel Object Storage bucket through the S3
  adapters Ghost 6.60 ships itself — `S3Storage` for uploads, `S3RouteSettingsStore` for
  `routes.yaml`, `S3RedirectsStore` for redirects — so no third-party adapter, and a routes upload
  through Admin or `upload-routes.mjs` persists as on any Ghost. The public bucket makes
  `routes.yaml` publicly readable; it is the Demo site's public routing anyway.
- Image keys sit under `content/images/`, with `urls.image` set to the bucket, so `img_url` builds
  the same `/size/…` URLs on the Demo site as on a buyer's Ghost. The bucket cannot resize, so
  `demo-host/presize.mjs` uploads every size those URLs can name, the publication icon's
  `w256h256` included, made by Ghost's own transform, with a year-long Cache-Control. It runs on
  the Cloud environment as the last step of `pnpm demo:cloud`. An image uploaded through Admin has
  no sizes until it runs again. (Until 2026-10 keys had no `content/` segment, which kept the
  favicon from 404ing but left every image unsized; see DECISIONS.md.)
- Ghost stores absolute image URLs, so moving the bucket means re-seeding.
- Content is seeded by `pnpm demo:cloud`, which creates the owner, activates MIRROR, and runs the
  `pnpm demo` pipeline against the Cloud URL with its own session and image map. It needs
  `security.staffDeviceVerification` off there, as in the local `config.demo.json`, which leaves
  the owner's password as the only factor — hence credentials of its own, not the harness's.
- Ghost is unpacked into `demo-host/current/` and installed with its own lockfile, as Ghost-CLI
  does: the published package cannot be an npm dependency (its own dependencies point at
  `file:components/*.tgz`), and Ghost finds its root through a `current` directory. The version is
  pinned exactly to the local harness's (`~/ghost-mirror/current`) and bumped in the same commit,
  so the Demo site runs what the gate scored.
- Exactly one instance, scale-to-zero on. Ghost's in-process scheduler and caches forbid more than
  one; sleeping means the first uncached visit after idle pays Ghost's boot.
- Ghost's frontend `maxAge` is raised to an hour so Cloud's edge serves warm pages without waking
  the instance. Deploys purge the edge; a re-seed or Admin edit without a deploy needs a manual
  purge or stays stale for up to an hour.
- Push-to-deploy is on (changed 2026-10; it was off): every push to `main` deploys, so the full
  `pnpm gate` belongs before the push. CI runs only `gate:static`, so a push that skipped the full
  gate publishes a build nobody scored. `demo:smoke --base https://mirror.redpixelthemes.com` runs
  after each deploy.
- Member mail (magic links) goes through Plunk SMTP, so the Membership Surface and the **Gate** can
  be tried for real.
- Cutover goes through the `*.laravel.cloud` vanity domain first, then the DNS flip; the VPS stays
  up 14 days as a DNS-only rollback, then is shut down.

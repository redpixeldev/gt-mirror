# Verification harness

Four scripts. Copy this folder into the repo (`scripts/verify/`) and drive them from a
package script; do not rewrite them per theme — everything theme-specific lives in the
two JSON configs.

Requires Python 3, `pillow`, `numpy`, and a Chrome or Chromium binary. Set `CHROME_BIN`
if it is somewhere unusual.

```bash
pip install pillow numpy
```

## 1. Stage the originals

```bash
python3 prep_originals.py --config verify/prep.json --clean
cd .originals && python3 -m http.server 4381 --bind 127.0.0.1 &
```

Or in one step: `python3 prep_originals.py --config verify/prep.json --serve 4381`.

Writes one file per template × variant × theme, so every combination is a plain URL.
See the module docstring for the config shape and why each transform is needed.

A worked `prep.json`, from gt-mirror:

```json
{
  "source": "~/Downloads/Mirror Ghost Theme",
  "glob": "MIRROR *.dc.html",
  "out": ".originals",
  "copy": ["support.js"],
  "assets": [{ "from": "public/img", "glob": "pexels-*.jpg", "to": "img" }],
  "replace": [
    {
      "find": "\"https://images.pexels.com/photos/\" + id + \"/pexels-photo-\" + id + \".jpeg?auto=compress&cs=tinysrgb&w=1200\"",
      "with": "\"/img/pexels-\" + id + \".jpg\""
    }
  ],
  "inject_css": "[data-screen-label] > div > div:first-child { display: none !important }",
  "variants": [
    { "suffix": "", "replace": [] },
    {
      "suffix": " A2",
      "replace": [
        {
          "find": "&quot;options&quot;:[&quot;a1&quot;,&quot;a2&quot;,&quot;b1&quot;,&quot;b2&quot;],&quot;default&quot;:&quot;a1&quot;",
          "with": "&quot;options&quot;:[&quot;a1&quot;,&quot;a2&quot;,&quot;b1&quot;,&quot;b2&quot;],&quot;default&quot;:&quot;a2&quot;"
        }
      ]
    }
  ],
  "themes": [
    { "suffix": "", "replace": [] },
    {
      "suffix": " DARK",
      "replace": [
        {
          "find": "&quot;theme&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;light&quot;,&quot;dark&quot;],&quot;default&quot;:&quot;light&quot;",
          "with": "&quot;theme&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;light&quot;,&quot;dark&quot;],&quot;default&quot;:&quot;dark&quot;"
        }
      ]
    }
  ]
}
```

The escaped `&quot;` is not a mistake — the export keeps its config as an HTML attribute,
so the strings you match are escaped in the file. Open one source and copy the exact run
of text rather than reconstructing it.

## 2. Capture both sides

```bash
python3 shoot.py --jobs verify/jobs.json --out-dir .shots
```

```json
[
  { "url": "http://localhost:4380/about-01", "out": "about-01.png", "height": 3450 },
  {
    "url": "http://127.0.0.1:4381/MIRROR%20About.dc.html",
    "out": "o-about-01.png",
    "height": 3450
  }
]
```

Give both sides of a pair the same `height`, generous enough to reach the footer. Width
defaults to 1568, the design canvas — override with `--width` if the source differs.

## 3. Score

```bash
python3 score.py .shots/about-01.png .shots/o-about-01.png --height 3370 --label about-01
python3 score.py .shots/about-01.png .shots/o-about-01.png --height 3370 --worst 5
python3 score.py .shots/about-01.png .shots/o-about-01.png --panel 800:1000:beats
```

`--worst N` ranks the bands so you can go straight to the problem. `--panel Y0:Y1:NAME`
writes a stacked build / original / diff image for a region — look at it before forming
a theory. `--skip-header` isolates a deliberate chrome change from the page body.

Set `--height` a little below the capture height so neither image is scored against
blank canvas at the bottom.

## 4. Smoke every route

```bash
python3 smoke.py --base http://localhost:4380 --routes verify/routes.json
```

Exits non-zero on any route that 404s, falls under the byte floor, or is missing an
expected string. Run it after every batch — a component that throws during render still
answers 200.

## Wiring it up

```json
"scripts": {
  "verify:smoke": "python3 scripts/verify/smoke.py --base http://localhost:4380 --routes scripts/verify/routes.json",
  "verify:prep":  "python3 scripts/verify/prep_originals.py --config scripts/verify/prep.json --clean",
  "verify:shots": "python3 scripts/verify/shoot.py --jobs scripts/verify/jobs.json --out-dir .shots"
}
```

Every `4380`/`4381` in this file is an example, not a default — pick ports that are
free on the machine, record them in the repo's `DECISIONS.md`, and substitute them
here. `smoke.py` deliberately has no default `--base` so a stale example port fails
loudly instead of smoking another project's preview.

Keep `.shots/` and the staged originals out of version control.

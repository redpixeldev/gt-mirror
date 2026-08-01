#!/usr/bin/env python3
"""Stage the design sources into a folder that can be served and captured.

    python3 prep_originals.py --config prep.json
    python3 prep_originals.py --config prep.json --serve 4381

A design-tool export is not directly comparable as shipped. Three things have to happen
first, and all three are why this script exists rather than a `cp`:

1. **Point remote assets at local copies.** The export loads photos from a CDN with
   query-string resizing; the same URL can come back a different size on a different
   day. Serve the same files the build serves.
2. **Hide the design tool's own chrome bar.** It sits above the page and is usually a
   fractional height, and a fractional offset cannot be cropped out of a raster without
   a half-pixel error that smears every band below it. Hide it in CSS instead.
3. **Emit one file per variant and theme.** These exports keep their state in an
   embedded config with a `default` per property. Flipping the default in a copy of the
   file gives a directly-loadable URL per combination — no clicking, no scripting, and
   no risk of capturing mid-transition.

Everything specific to a given export lives in the config file, not here:

    {
      "source": "~/Downloads/Mirror Ghost Theme",
      "glob": "MIRROR *.dc.html",
      "out": "origsrv",
      "copy": ["support.js"],
      "assets": [{"from": "~/repo/public/img", "glob": "pexels-*.jpg", "to": "img"}],
      "replace": [
        {"find": "https://images.pexels.com/photos/\" + id + \"/…",
         "with": "/img/pexels-\" + id + \".jpg", "required": true}
      ],
      "inject_css": "[data-screen-label] > div > div:first-child { display: none !important }",
      "variants": [
        {"suffix": "",     "replace": []},
        {"suffix": " A2",  "replace": [{"find": "…default…a1", "with": "…default…a2"}]}
      ],
      "themes": [
        {"suffix": "",       "replace": []},
        {"suffix": " DARK",  "replace": [{"find": "…default…light", "with": "…default…dark"}]}
      ]
    }

`required` (default true) makes a missing `find` a hard error — a silently-skipped
replacement produces a capture that looks plausible and scores wrong.

`inject_css` goes into a `<style>` appended just before `</head>`, so it wins on
specificity ties and needs no per-file marker to anchor to. Point it at whatever wraps
the tool's own bar; check one file to get the selector right, then it applies to all.

Config values are matched against the raw file text. In these exports the config object
is HTML-escaped, so the strings you match usually contain `&quot;`.
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import pathlib
import shutil
import socketserver
import sys


def expand(p: str) -> pathlib.Path:
    return pathlib.Path(os.path.expanduser(p))


def apply_replacements(text: str, rules: list[dict], where: str) -> str:
    for rule in rules:
        find, with_ = rule['find'], rule['with']
        if find not in text:
            if rule.get('required', True):
                raise SystemExit(f'{where}: pattern not found -> {find[:90]!r}')
            continue
        text = text.replace(find, with_)
    return text


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--config', required=True)
    p.add_argument('--serve', type=int, default=0, metavar='PORT', help='serve the output folder and block')
    p.add_argument('--clean', action='store_true', help='delete the output folder first')
    args = p.parse_args()

    cfg = json.loads(pathlib.Path(args.config).read_text())
    source, out = expand(cfg['source']), expand(cfg['out'])

    if args.clean and out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    for name in cfg.get('copy', []):
        shutil.copy2(source / name, out / name)
        print(f'copied {name}')

    for spec in cfg.get('assets', []):
        dest = out / spec.get('to', '.')
        dest.mkdir(parents=True, exist_ok=True)
        n = 0
        for f in sorted(expand(spec['from']).glob(spec.get('glob', '*'))):
            shutil.copy2(f, dest / f.name)
            n += 1
        print(f'copied {n} assets -> {dest}')

    variants = cfg.get('variants') or [{'suffix': '', 'replace': []}]
    themes = cfg.get('themes') or [{'suffix': '', 'replace': []}]
    css = cfg.get('inject_css')

    written = 0
    for src in sorted(source.glob(cfg.get('glob', '*.html'))):
        base = apply_replacements(src.read_text(), cfg.get('replace', []), src.name)
        if css:
            if '</head>' not in base:
                raise SystemExit(f'{src.name}: no </head> to inject into')
            base = base.replace('</head>', f'<style>{css}</style>\n</head>', 1)

        stem, ext = src.name[: -len(''.join(src.suffixes))], ''.join(src.suffixes)
        for variant in variants:
            vtext = apply_replacements(base, variant.get('replace', []), f'{src.name}{variant["suffix"]}')
            for theme in themes:
                text = apply_replacements(vtext, theme.get('replace', []), f'{src.name}{theme["suffix"]}')
                (out / f'{stem}{variant["suffix"]}{theme["suffix"]}{ext}').write_text(text)
                written += 1
    print(f'wrote {written} files -> {out}')

    if args.serve:
        os.chdir(out)
        handler = http.server.SimpleHTTPRequestHandler
        handler.log_message = lambda *a: None  # type: ignore[method-assign]
        with socketserver.TCPServer(('127.0.0.1', args.serve), handler) as httpd:
            print(f'serving {out} at http://127.0.0.1:{args.serve} — ctrl-c to stop')
            httpd.serve_forever()
    return 0


if __name__ == '__main__':
    sys.exit(main())

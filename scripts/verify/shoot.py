#!/usr/bin/env python3
"""Capture full-height screenshots with headless Chrome, several at a time.

    python3 shoot.py --jobs jobs.json --out-dir shots
    python3 shoot.py --url http://localhost:4380/homepage-01 --out shots/hp.png --height 4000

jobs.json is a list of `{"url", "out", "height", "width"?}`. `width` defaults to
--width (1568, the design source's canvas).

Every job gets its own `--user-data-dir`; Chrome refuses to run concurrent instances
against a shared profile and will silently drop all but the first.

Two flags carry the whole thing:

* `--run-all-compositor-stages-before-draw` — without it Chrome will screenshot a frame
  that has not finished compositing, and long pages come out half-painted.
* `--virtual-time-budget` — advances the page's clock without waiting in real time, so
  fonts, images and mount-time scripts all settle before the frame is taken.

Note two headless behaviours that have produced wrong conclusions:
`requestAnimationFrame` callbacks do not fire in this tab, and `ui-monospace` resolves
to a different face than in a real browser. Never verify either one here.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time

CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
]


def find_chrome(explicit: str | None) -> str:
    if explicit:
        return explicit
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    raise SystemExit('Chrome not found — pass --chrome /path/to/chrome')


def launch(chrome: str, url: str, out: str, width: int, height: int, profile: str, budget: int):
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    if os.path.exists(out):
        os.remove(out)
    cmd = [
        chrome,
        '--headless=old',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--run-all-compositor-stages-before-draw',
        f'--virtual-time-budget={budget}',
        f'--user-data-dir={profile}',
        f'--window-size={width},{height}',
        f'--screenshot={out}',
        url,
    ]
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--jobs', help='JSON file: [{"url","out","height","width"?}, …]')
    p.add_argument('--url')
    p.add_argument('--out')
    p.add_argument('--height', type=int, default=4000)
    p.add_argument('--width', type=int, default=1568, help="the design canvas width (default 1568)")
    p.add_argument('--out-dir', default='.', help='prefix for relative `out` paths in --jobs')
    p.add_argument('--profiles', default='', help='where to put Chrome profiles (default <out-dir>/.profiles)')
    p.add_argument('--concurrency', type=int, default=4)
    p.add_argument('--budget', type=int, default=28000, help='virtual-time budget in ms')
    p.add_argument('--timeout', type=int, default=180, help='seconds to wait for all shots')
    args = p.parse_args()

    if args.jobs:
        with open(args.jobs) as f:
            jobs = json.load(f)
    elif args.url and args.out:
        jobs = [{'url': args.url, 'out': args.out, 'height': args.height}]
    else:
        raise SystemExit('pass --jobs, or both --url and --out')

    chrome = find_chrome(os.environ.get('CHROME_BIN'))
    profiles = args.profiles or os.path.join(args.out_dir, '.profiles')
    for job in jobs:
        job['out'] = job['out'] if os.path.isabs(job['out']) else os.path.join(args.out_dir, job['out'])

    pending, running = list(enumerate(jobs)), []
    deadline = time.time() + args.timeout
    while pending or running:
        while pending and len(running) < args.concurrency:
            i, job = pending.pop(0)
            proc = launch(
                chrome,
                job['url'],
                job['out'],
                job.get('width', args.width),
                job.get('height', args.height),
                os.path.join(profiles, f'p{i}'),
                args.budget,
            )
            running.append((proc, job))
        time.sleep(1)
        for entry in list(running):
            proc, job = entry
            if proc.poll() is not None or os.path.exists(job['out']):
                if proc.poll() is None:
                    proc.terminate()
                running.remove(entry)
                size = os.path.getsize(job['out']) if os.path.exists(job['out']) else 0
                print(f'{"ok " if size else "MISS"} {job["out"]}  {size:,} bytes  <- {job["url"]}')
        if time.time() > deadline:
            for proc, job in running:
                proc.terminate()
                print(f'TIMEOUT {job["out"]} <- {job["url"]}')
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

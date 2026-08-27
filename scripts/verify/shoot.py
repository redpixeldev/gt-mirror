#!/usr/bin/env python3
"""Capture full-height screenshots with headless Chrome, one page at a time by default.

    python3 shoot.py --jobs jobs.json --out-dir shots
    python3 shoot.py --url http://localhost:4380/homepage-01 --out shots/hp.png --height 4000

jobs.json is a list of `{"url", "out", "height", "width"?}`. `width` defaults to
--width (1568, the design source's canvas). `--base` replaces the origin of every
job URL, so a committed jobs file records which pages to shoot at which height and
the caller says where that origin is today — a jobs file naming a port nobody serves
any more is a jobs file nobody can run.

`--concurrency` DEFAULTS TO 1, AND RAISING IT MAKES CAPTURES WRONG, NOT JUST SLOW. At 4 the
origin occasionally serves a page whose stylesheet arrives partly applied: the site header's
navigation renders as an unstyled vertical list, which is 50px taller, which moves every band
below it out of register. Measured: the same page captured alone six times is byte-identical, and
two full 36-shot runs at `--concurrency 1` are byte-identical on all 36; at 4 they are not.

EVERY JOB IS CAPTURED TWICE AND THE RUN FAILS UNLESS THE TWO FILES MATCH, because serialising the
captures narrowed that failure without closing it. A later run — at `--concurrency 1` — produced a
page whose two author avatars came out as Chrome's broken-image placeholder, and it scored five
hundredths of a point away from the truth rather than obviously wrong. Nothing about a finished PNG
says the page finished: `--virtual-time-budget` settles a failed subresource exactly as it settles
a loaded one. Two captures of a page that renders deterministically are identical to the byte, so
the compare is the only completeness test available here that does not depend on knowing what the
page was supposed to contain. The second pass runs after the whole first pass, so the two are as
far apart in time as the run allows.

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
import shutil
import subprocess
import sys
import time
import urllib.parse

CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
]

REPEAT_SUFFIX = '.repeat.png'


def find_chrome(explicit: str | None) -> str:
    if explicit:
        return explicit
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    raise SystemExit('Chrome not found — pass --chrome /path/to/chrome')


def complete_png(path: str) -> bool:
    """True once `path` is a PNG that has been written all the way to its IEND chunk."""
    try:
        with open(path, 'rb') as f:
            f.seek(-12, os.SEEK_END)
            return f.read()[4:8] == b'IEND'
    except OSError:
        return False


def launch(chrome: str, url: str, out: str, width: int, height: int, profile: str, budget: int):
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    if os.path.exists(out):
        os.remove(out)
    # A CAPTURE MUST NOT INHERIT ANOTHER RUN'S CACHE. Reusing a profile looks like a kindness — the
    # images come from disk and the run is faster — until one of them caches a failed response.
    # Then that profile renders a broken image on every run from then on, identically, so it reads
    # as a property of the page rather than of the cache. That is exactly what happened: 507MB of
    # profiles had accumulated, one of them held a bad entry for an author's avatar, and the gated
    # dark row was five hundredths of a point wrong in run after run until the tree was deleted.
    # Only this job's own directory is removed, so a caller who points --profiles somewhere of
    # their own loses nothing else.
    shutil.rmtree(profile, ignore_errors=True)
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
    p.add_argument(
        '--concurrency',
        type=int,
        default=1,
        help='pages at once; above 1 the origin can serve a partly applied stylesheet (see above)',
    )
    p.add_argument('--budget', type=int, default=28000, help='virtual-time budget in ms')
    p.add_argument(
        '--timeout',
        type=int,
        default=1200,
        help='seconds to wait for all shots; a 36-job run is 72 captures and takes about 220',
    )
    p.add_argument(
        '--once',
        action='store_true',
        help='capture each job once and skip the stability compare — for iterating, never for a recorded run',
    )
    p.add_argument('--base', help='replace the origin of every job URL, e.g. http://localhost:4380')
    args = p.parse_args()

    if args.jobs:
        with open(args.jobs) as f:
            jobs = json.load(f)
    elif args.url and args.out:
        jobs = [{'url': args.url, 'out': args.out, 'height': args.height}]
    else:
        raise SystemExit('pass --jobs, or both --url and --out')

    if args.base:
        origin = args.base.rstrip('/')
        for job in jobs:
            job['url'] = origin + urllib.parse.urlsplit(job['url'])._replace(scheme='', netloc='').geturl()

    chrome = find_chrome(os.environ.get('CHROME_BIN'))
    profiles = args.profiles or os.path.join(args.out_dir, '.profiles')
    for job in jobs:
        job['out'] = job['out'] if os.path.isabs(job['out']) else os.path.join(args.out_dir, job['out'])

    # Every job is captured TWICE, into separate profiles and separated in time by the whole first
    # pass, and the run fails unless the two files are byte-identical. See the note at the top: a
    # capture that dropped one image scores like a page that moved, and nothing about a finished PNG
    # says the page finished. The compare is what turns that into a failure instead of a number.
    repeats = [{**job, 'out': job['out'] + REPEAT_SUFFIX, 'first': job['out']} for job in jobs]
    queue = jobs if args.once else jobs + repeats

    pending, running = list(enumerate(queue)), []
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
            # Chrome with --screenshot writes the file and then does NOT exit, so the file is the
            # completion signal — but the file APPEARS while it is still being written, and
            # terminating on the strength of its existence truncates it. `complete_png` waits for
            # the IEND chunk, which is the end of a PNG by definition.
            if proc.poll() is not None or complete_png(job['out']):
                if proc.poll() is None:
                    proc.terminate()
                running.remove(entry)
                size = os.path.getsize(job['out']) if os.path.exists(job['out']) else 0
                label = 'again' if 'first' in job else ('ok ' if size else 'MISS')
                print(f'{label} {job["out"]}  {size:,} bytes  <- {job["url"]}')
        if time.time() > deadline:
            for proc, job in running:
                proc.terminate()
                print(f'TIMEOUT {job["out"]} <- {job["url"]}')
            return 1

    return 0 if args.once else compare(repeats)


def compare(repeats: list[dict]) -> int:
    """Fail the run on any capture that did not come out the same twice."""
    unstable = []
    for job in repeats:
        first, second = job['first'], job['out']
        same = (
            os.path.exists(first)
            and os.path.exists(second)
            and open(first, 'rb').read() == open(second, 'rb').read()
        )
        if same:
            os.remove(second)
        else:
            unstable.append(job)

    for job in unstable:
        print(f'UNSTABLE {job["first"]} != {job["out"]}  <- {job["url"]}')
    if unstable:
        print(
            f'\n{len(unstable)} capture(s) came out differently the second time. Both files are on '
            'disk; diff them. A page that renders twice the same is the only page worth scoring.'
        )
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

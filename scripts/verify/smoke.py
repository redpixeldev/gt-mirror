#!/usr/bin/env python3
"""Check every route returns 200 **and** a body big enough to be a real page.

    python3 smoke.py --base http://localhost:4380 --routes routes.json
    python3 smoke.py --base http://localhost:4380 --routes routes.json --min-bytes 8000

A 200 is not proof a page rendered. An Astro component that throws during render — a
missing import, a prop destructured but never defined — returns 200 with a body of a
few dozen bytes, and the dev server logs it where nobody is looking. Three separate
pages shipped that way in one build before the byte floor was added.

routes.json is a list of paths, or of `{"path", "min_bytes"?, "expect"?}` where
`expect` is a substring that must appear in the body.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import urllib.error
import urllib.request

DEFAULT_MIN = 5000


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--base', required=True, help='dev-server origin; use the port recorded in DECISIONS.md')
    p.add_argument('--routes', required=True, help='JSON list of paths or {path, min_bytes?, expect?}')
    p.add_argument('--min-bytes', type=int, default=DEFAULT_MIN)
    p.add_argument('--timeout', type=float, default=30)
    args = p.parse_args()

    routes = json.loads(pathlib.Path(args.routes).read_text())
    failures = []

    for entry in routes:
        route = {'path': entry} if isinstance(entry, str) else entry
        url = args.base.rstrip('/') + route['path']
        floor = route.get('min_bytes', args.min_bytes)
        try:
            with urllib.request.urlopen(url, timeout=args.timeout) as r:
                body, status = r.read(), r.status
        except urllib.error.HTTPError as e:
            body, status = e.read(), e.code
        except Exception as e:  # noqa: BLE001 — connection refused, DNS, timeout
            print(f'FAIL {route["path"]:<32} {e}')
            failures.append(route['path'])
            continue

        problems = []
        if status != 200:
            problems.append(f'status {status}')
        if len(body) < floor:
            problems.append(f'{len(body):,} bytes < {floor:,} floor')
        expect = route.get('expect')
        if expect and expect.encode() not in body:
            problems.append(f'missing {expect!r}')

        if problems:
            print(f'FAIL {route["path"]:<32} {"; ".join(problems)}')
            failures.append(route['path'])
        else:
            print(f'ok   {route["path"]:<32} {status} {len(body):,} bytes')

    print(f'\n{len(routes) - len(failures)}/{len(routes)} routes ok')
    if failures:
        print('check the dev server log for the render error behind each failure')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())

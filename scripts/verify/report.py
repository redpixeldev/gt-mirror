#!/usr/bin/env python3
"""Score a whole index of captures against the reference PNGs and report the gap to each Floor.

    python3 report.py --index ../ghost/score-index.json --refs "$HOME/Downloads/.../MIRROR VARIATION A"
    python3 report.py --index baseline-index.json --floors baseline-scores.json --refs ... --max-drop 0.5

`score.py` answers "how close is this one capture", which is the right tool with a panel and a
band ranking in front of you. This answers the other question — "did any Surface move" — over
every capture in one run, and it is deliberately origin-agnostic: the same command scores the
Astro reference build and the Ghost port, so the two are comparable rather than each carrying
its own arithmetic.

An index is a JSON list of rows. `baseline-index.json` is already this shape:

    {"route": "about-01", "mode": "light", "build": ".shots/build-about-01-light.png",
     "ref": "11-about-A1-light.png", "h": 3364}

* `ref` is resolved by basename against `--refs`, so whatever path an index records is ignored
  below the filename and no index has to encode one machine's home.
* `h` is the height the reference PNG was rendered at, and the height the capture must be taken
  at — score the first `h` rows so neither side is measured against blank canvas.
* `floor` comes from the row, or from `--floors` keyed on route+mode. It is the **noise floor**:
  what the design source itself scores against the same PNG, a ceiling no markup can pass rather
  than the achieved-identity ratchet `CONTEXT.md` calls a Floor. `gap = score - floor` is the only
  number worth reading — a Surface can sit at 90.6 and be 0.06 off its own ceiling.
* `layout` is reported if present, and `skip` marks a row that cannot be captured yet — it is
  listed as pending with its reason rather than scored against a PNG it does not render.
* `--capture-field` chooses which capture is scored, and `--capture-field orig` is the harness's
  own self-check: the staged design source scored against its PNG *is* the Floor, so every gap
  should come back 0.00. A run of that is how you know the heights, the reference paths and the
  scoring flags still reproduce the recorded numbers before you read anything into a port's gap.

A missing capture, a missing reference PNG or a missing Floor fails the run. Nothing here is
allowed to quietly report on fewer rows than the index describes.

`--refs` defaults to the `references` directory recorded in `prep.json`, the same config that
points `prep_originals.py` at the design sources — one recorded location for the design assets on
a machine, not one per script.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from score import ALIGN, BAND, TOL, gray, load, score  # noqa: E402 — sibling module, path set above

DEFAULT_PREP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prep.json')


def references(explicit: str | None, prep: str) -> pathlib.Path:
    """The reference PNG directory: the flag, else what prep.json records for this machine."""
    if not explicit:
        config = json.loads(pathlib.Path(prep).read_text())
        explicit = config.get('references')
        if not explicit:
            raise SystemExit(f'pass --refs, or add a "references" directory to {prep}')
    path = pathlib.Path(os.path.expanduser(explicit))
    if not path.is_dir():
        raise SystemExit(f'not a directory of reference PNGs: {path}')
    return path


def resolve(
    rows: list[dict],
    refs: pathlib.Path,
    floors: dict[tuple[str, str], float],
    field: str,
) -> list[dict]:
    """Attach the capture, the reference PNG and the Floor to every row, collecting every problem."""
    problems, resolved = [], []

    for row in rows:
        key = (row['route'], row['mode'])
        entry = dict(row)
        entry['capture'] = row.get(field)
        entry['ref_path'] = refs / os.path.basename(row['ref'])
        entry['floor'] = row.get('floor', floors.get(key))

        if not entry['ref_path'].exists():
            problems.append(f'{key[0]} {key[1]}: no reference PNG at {entry["ref_path"]}')
        if entry['floor'] is None:
            problems.append(f'{key[0]} {key[1]}: no recorded Floor — pass --floors or put one in the index')
        if not row.get('skip'):
            if not entry['capture']:
                problems.append(f'{key[0]} {key[1]}: the index row has no "{field}" capture')
            elif not pathlib.Path(entry['capture']).exists():
                problems.append(
                    f'{key[0]} {key[1]}: no capture at {entry["capture"]} — the shoot did not run or it failed'
                )

        resolved.append(entry)

    if problems:
        print('cannot report on the index as written:', file=sys.stderr)
        for problem in problems:
            print(f'  {problem}', file=sys.stderr)
        raise SystemExit(1)

    return resolved


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--index', required=True, help='JSON list of {route, mode, build, ref, h, floor?, layout?, skip?}')
    p.add_argument('--floors', help='JSON list of {route, mode, floor} — used for rows with no floor of their own')
    p.add_argument('--refs', help=f'directory of reference PNGs (default: "references" in {DEFAULT_PREP})')
    p.add_argument('--prep', default=DEFAULT_PREP, help='config recording the reference directory')
    p.add_argument('--out', help='write the scored rows here as JSON')
    p.add_argument('--max-drop', type=float, metavar='N', help='fail if any capture sits more than N below its Floor')
    p.add_argument(
        '--capture-field',
        default='build',
        metavar='KEY',
        help='index key holding the capture to score (default "build"; "orig" scores the staged '
        'design source, which must reproduce the Floor)',
    )
    p.add_argument('--band', type=int, default=BAND)
    p.add_argument('--tol', type=int, default=TOL)
    p.add_argument('--align', type=int, default=ALIGN)
    args = p.parse_args()

    rows = json.loads(pathlib.Path(args.index).read_text())
    floors = {}
    if args.floors:
        floors = {(r['route'], r['mode']): r['floor'] for r in json.loads(pathlib.Path(args.floors).read_text())}

    refs = references(args.refs, args.prep)

    resolved = resolve(rows, refs, floors, args.capture_field)
    scored, pending = [], []

    print(f'{"route":<22} {"mode":<6} {"layout":<7} {"vs PNG":>7} {"floor":>7} {"gap":>7}')
    for row in resolved:
        if row.get('skip'):
            pending.append(row)
            continue
        value, bands = score(
            gray(load(row['capture'])),
            gray(load(str(row['ref_path']))),
            row.get('h'),
            0,
            args.band,
            args.tol,
            args.align,
        )
        gap = value - row['floor']
        scored.append(
            {
                'route': row['route'],
                'mode': row['mode'],
                'layout': row.get('layout', ''),
                'score': round(value, 2),
                'floor': row['floor'],
                'gap': round(gap, 2),
                'bands': len(bands),
                'capture': row['capture'],
                'ref': os.path.basename(row['ref']),
            }
        )
        print(
            f'{row["route"]:<22} {row["mode"]:<6} {row.get("layout", ""):<7} '
            f'{value:7.2f} {row["floor"]:7.2f} {gap:+7.2f}'
        )

    below = [r for r in scored if r['gap'] < 0]
    print(f'\n{len(scored)} captures scored, {len(below)} below their noise floor')
    if below:
        worst = min(below, key=lambda r: r['gap'])
        print(f'worst: {worst["route"]} {worst["mode"]} at {worst["gap"]:+.2f}')
        print('diagnose one with: score.py <build> <ref> --height <h> --worst 5 --panel Y0:Y1:name')

    if pending:
        print(f'\n{len(pending)} captures pending, not scored:')
        for row in pending:
            print(f'  {row["route"]:<22} {row["mode"]:<6} {row["skip"]}')

    if args.out:
        payload = {
            'scored': scored,
            'pending': [{'route': r['route'], 'mode': r['mode'], 'skip': r['skip']} for r in pending],
        }
        pathlib.Path(args.out).write_text(json.dumps(payload, indent='\t') + '\n')
        print(f'\nwrote {args.out}')

    if not scored:
        print(
            f'\nnothing was scored: {len(pending)} of {len(resolved)} rows are pending and none of the rest '
            f'produced a capture — a report over no captures proves nothing',
            file=sys.stderr,
        )
        return 1

    if args.max_drop is not None:
        breached = [r for r in scored if r['gap'] < -args.max_drop]
        if breached:
            print(f'\n{len(breached)} captures more than {args.max_drop} below their noise floor:', file=sys.stderr)
            for r in breached:
                print(f'  {r["route"]} {r["mode"]} {r["gap"]:+.2f}', file=sys.stderr)
            return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())

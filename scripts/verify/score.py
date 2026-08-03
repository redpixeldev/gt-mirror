#!/usr/bin/env python3
"""Score a build capture against the original, rendered through the same pipeline.

Both images are compared in 100px bands, and each band is realigned independently
within +/-40px before it is scored. Without that, one extra pixel of leading near the
top drags every band below it out of register and the page reads as a total mismatch
when it is in fact one pixel off.

    python3 score.py build.png original.png --height 4000
    python3 score.py build.png original.png --skip-header --panel 1200:1500:hero

`--panel` writes a stacked build / original / diff image per region so a low score can
be looked at instead of guessed at.

Needs pillow and numpy.
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
from PIL import Image, ImageDraw

BAND = 100
TOL = 12
ALIGN = 40


def load(path: str) -> Image.Image:
    return Image.open(path).convert('RGB')


def gray(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert('L')).astype(np.int16)


def best_shift(a: np.ndarray, b: np.ndarray, y0: int, y1: int, align: int, tol: int):
    """Vertical offset that best aligns rows y0:y1 of `a` onto `b`, and its mismatch."""
    band = a[y0:y1]
    candidates = [
        (s, int((np.abs(band - b[y0 + s : y1 + s]) > tol).sum()))
        for s in range(-align, align + 1)
        if y0 + s >= 0 and y1 + s <= b.shape[0]
    ]
    if not candidates:
        return 0, band.size
    return min(candidates, key=lambda t: t[1])


def score(
    build: np.ndarray,
    orig: np.ndarray,
    height: int | None = None,
    skip: int = 0,
    band: int = BAND,
    tol: int = TOL,
    align: int = ALIGN,
) -> tuple[float, list[tuple[int, int, int]]]:
    width = min(build.shape[1], orig.shape[1])
    build, orig = build[:, :width], orig[:, :width]
    limit = min(build.shape[0], orig.shape[0])
    if height:
        limit = min(limit, height)

    bad = 0
    bands: list[tuple[int, int, int]] = []
    for y in range(skip, limit - band, band):
        s, d = best_shift(build, orig, y, y + band, align, tol)
        bands.append((y, s, d))
        bad += d
    if not bands:
        raise SystemExit('nothing to score: check --height and the image sizes')
    return 100 - 100 * bad / (len(bands) * band * width), bands


def panel(build_img, orig_img, y0, y1, name, out_dir, align, tol, width=None):
    bg, og = gray(build_img), gray(orig_img)
    w = width or min(bg.shape[1], og.shape[1])
    s, bad = best_shift(bg[:, :w], og[:, :w], y0, y1, align, tol)
    mc = build_img.crop((0, y0, w, y1))
    oc = orig_img.crop((0, y0 + s, w, y1 + s))
    diff = np.abs(gray(mc).astype(np.int16) - gray(oc).astype(np.int16)) > tol
    dv = Image.fromarray(np.where(diff, 255, 0).astype(np.uint8)).convert('RGB')

    h = y1 - y0
    out = Image.new('RGB', (w, h * 3 + 60), (128, 128, 128))
    labels = [(mc, 'BUILD'), (oc, f'ORIGINAL (shift {s:+d}px)'), (dv, f'DIFF {bad:,}px')]
    for i, (img, label) in enumerate(labels):
        out.paste(img, (0, i * (h + 20)))
        ImageDraw.Draw(out).text((6, i * (h + 20) + h + 4), label, fill=(255, 255, 0))
    path = f'{out_dir.rstrip("/")}/panel-{name}.png'
    out.save(path)
    print(f'  {name}: y={y0}-{y1} shift={s:+d} mismatch={bad:,} -> {path}')


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('build')
    p.add_argument('original')
    p.add_argument('--height', type=int, help='score only the first N rows')
    p.add_argument(
        '--skip-header',
        nargs='?',
        type=int,
        const=100,
        default=0,
        metavar='PX',
        help='skip the top N rows (default 100) — use to isolate a deliberate chrome change',
    )
    p.add_argument('--band', type=int, default=BAND)
    p.add_argument('--tol', type=int, default=TOL, help='per-channel luminance tolerance')
    p.add_argument('--align', type=int, default=ALIGN, help='max per-band vertical realignment')
    p.add_argument('--worst', type=int, default=0, metavar='N', help='list the N worst bands')
    p.add_argument('--panel', action='append', default=[], metavar='Y0:Y1:NAME')
    p.add_argument('--out-dir', default='.')
    p.add_argument('--label', default='')
    p.add_argument(
        '--crop-original',
        type=int,
        default=0,
        metavar='PX',
        help='drop N rows from the top of the original — only for a capture whose design-tool '
        'chrome bar was not hidden at prep time. Prefer hiding it: a fractional bar height '
        'cannot be cropped from a raster without a half-pixel error.',
    )
    args = p.parse_args()

    build_img, orig_img = load(args.build), load(args.original)
    if args.crop_original:
        orig_img = orig_img.crop((0, args.crop_original, orig_img.size[0], orig_img.size[1]))
    value, bands = score(
        gray(build_img),
        gray(orig_img),
        args.height,
        args.skip_header,
        args.band,
        args.tol,
        args.align,
    )
    label = args.label or args.build
    print(f'{label}: {value:.2f}%  ({len(bands)} bands, {args.band}px, tol {args.tol}, align +/-{args.align})')

    if args.worst:
        width = min(build_img.size[0], orig_img.size[0])
        print(f'  worst {args.worst} bands:')
        for y, s, d in sorted(bands, key=lambda t: -t[2])[: args.worst]:
            print(f'    y={y:<6} shift={s:+3d}  {d:>8,}px  {100 * d / (args.band * width):5.2f}% of band')

    for spec in args.panel:
        y0, y1, name = spec.split(':')
        panel(build_img, orig_img, int(y0), int(y1), name, args.out_dir, args.align, args.tol)

    return 0


if __name__ == '__main__':
    sys.exit(main())

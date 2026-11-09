#!/usr/bin/env python3
"""Side-by-side sheets for the P1d repair (r2) from shots already taken (no browser; Pillow only).

  python3 tests/onfoot-sheets.py

Writes into tests/out/onfoot/:
  onfoot-p1d-r2-compare-<size>-<view>-<clock>.png   P1c | P1d | P1d r2, a row a preset (Low, HD, Ultra)
  onfoot-p1d-r2-hd-vs-ultra-<size>-<view>-<clock>.png   HD | Ultra (r2), the same frame
  onfoot-p1d-r2-detail-<size>-<view>.png   golden hour | Saturday 21:00, a row a preset (sign, gate, trucks, glass)
Golden hour differs between the passes: P1c and P1d shot it at Saturday 15:50 (the sun about 10 degrees up), r2 at
the hour the sun is about 5 degrees up (16:18 in mid-November). Missing shots are drawn as a grey panel, labelled.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'onfoot')
PRESETS = ['low', 'hd', 'ultra']
NAMES = {'low': 'Low (retro)', 'hd': 'HD', 'ultra': 'Ultra'}
CLOCKS = {'golden': 'golden hour', 'sat21': 'Sat 21:00', 'noon': 'Sat 12:00'}


def shot(size, view, preset, clock, tag):
    return os.path.join(OUT, f'onfoot-{size}-{view}-{preset}-{clock}-{tag}.png')


def panel(path, w, h, label):
    if os.path.exists(path):
        im = Image.open(path).convert('RGB').resize((w, h), Image.LANCZOS)
    else:
        im = Image.new('RGB', (w, h), (60, 60, 60))
        label += ' (missing)'
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, min(w, 8 + 7 * len(label)), 18], fill=(16, 18, 20))
    d.text((5, 3), label, fill=(240, 236, 228))
    return im


def sheet(rows, w, h, out):
    """rows: list of lists of (path, label)"""
    gap = 6
    cols = max(len(r) for r in rows)
    W, H = cols * w + (cols - 1) * gap, len(rows) * h + (len(rows) - 1) * gap
    S = Image.new('RGB', (W, H), (12, 13, 14))
    for i, r in enumerate(rows):
        for j, (p, lab) in enumerate(r):
            S.paste(panel(p, w, h, lab), (j * (w + gap), i * (h + gap)))
    S.save(out)
    return out


def main():
    made = []
    for size, scale in (('1280x720', 0.5), ('390x844', 0.5)):
        sw, sh = (int(int(x) * scale) for x in size.split('x'))
        for view in ('east', 'shed', 'lawn'):
            for clock in ('golden', 'sat21', 'noon'):
                rows = [[(shot(size, view, p, clock, t), f'{lab} {NAMES[p]} {view} {CLOCKS[clock]}') for t, lab in (('p1c', 'P1c'), ('p1d', 'P1d'), ('p1d-r2', 'r2'))] for p in PRESETS]
                made.append(sheet(rows, sw, sh, os.path.join(OUT, f'onfoot-p1d-r2-compare-{size}-{view}-{clock}.png')))
        for view, clock in (('east', 'sat21'), ('shed', 'noon'), ('east', 'golden'), ('lawn', 'sat21')):
            full_w, full_h = (int(x) for x in size.split('x'))
            k = 1 if size == '390x844' else 0.75
            rows = [[(shot(size, view, p, clock, 'p1d-r2'), f'r2 {NAMES[p]} {view} {CLOCKS[clock]}') for p in ('hd', 'ultra')]]
            made.append(sheet(rows, int(full_w * k), int(full_h * k), os.path.join(OUT, f'onfoot-p1d-r2-hd-vs-ultra-{size}-{view}-{clock}.png')))
        for view in ('sign', 'gate', 'trucks', 'glass'):
            rows = [[(shot(size, view, p, c, 'p1d-r2'), f'r2 {NAMES[p]} {view} {CLOCKS[c]}') for c in ('golden', 'sat21')] for p in PRESETS]
            made.append(sheet(rows, sw, sh, os.path.join(OUT, f'onfoot-p1d-r2-detail-{size}-{view}.png')))
    for m in made:
        print(os.path.relpath(m))


if __name__ == '__main__':
    main()

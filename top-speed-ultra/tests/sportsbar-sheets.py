#!/usr/bin/env python3
"""Contact sheets of the sports bar's S4 shots (no browser; Pillow only).

  python3 tests/sportsbar-sheets.py [tag ...]      (tag defaults to r1; with several, each panel takes the first
                                                    tag whose shot exists, and its label names that tag)

Writes into tests/out/sportsbar/:
  s4-sheet-<size>-<place>-<tag>.png   a row a mode (Low, HD, Ultra), a column a time (noon, golden hour, Saturday 21:00)
  s4-sheet-before-after-<n>-<tag>.png   the same poses and clocks on HEAD's build (S3b, 5c572f6; shot by
      sportsbar-s4.mjs --only=before --page=<HEAD's build> --tag=head) beside this build's
Missing shots are drawn as a grey panel, labelled.
"""
import os
import sys
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'sportsbar')
TAGS = sys.argv[1:] or ['r1']
TAG = TAGS[0]


def pick(base):
    for t in TAGS:
        p = os.path.join(OUT, f'{base}-{t}.png')
        if os.path.exists(p):
            return p, t
    return os.path.join(OUT, f'{base}-{TAGS[0]}.png'), TAGS[0]
MODES = [('low', 'Low (retro)'), ('hd', 'HD'), ('ultra', 'Ultra')]
TIMES = [('noon', 'Sat 12:00'), ('golden', 'golden hour'), ('night', 'Sat 21:00')]
PLACES = ['entrance', 'bar', 'pool', 'tv', 'patio']
SIZES = {'1280x720': (426, 240), '390x844': (195, 422)}


def panel(path, w, h, label):
    if os.path.exists(path):
        im = Image.open(path).convert('RGB').resize((w, h), Image.LANCZOS)
    else:
        im = Image.new('RGB', (w, h), (60, 60, 60))
        label += ' (missing)'
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, min(w, 8 + 6 * len(label)), 14], fill=(16, 18, 20))
    d.text((4, 2), label, fill=(240, 236, 228))
    return im


def main():
    made = []
    for size, (w, h) in SIZES.items():
        for place in PLACES:
            gap = 4
            S = Image.new('RGB', (3 * w + 2 * gap, 3 * h + 2 * gap), (12, 13, 14))
            for i, (q, qn) in enumerate(MODES):
                for j, (t, tn) in enumerate(TIMES):
                    p, tg = pick(f's4-{q}-{size}-{t}-{place}')
                    S.paste(panel(p, w, h, f'{qn} / {tn}' + (f' [{tg}]' if len(TAGS) > 1 else '')), (j * (w + gap), i * (h + gap)))
            out = os.path.join(OUT, f's4-sheet-{size}-{place}-{TAG}.png')
            S.save(out)
            made.append(out)
    # before (S3a's and S3b's final shots) | after (S4's, the same pose and clock), a row a pair
    pairs = [
        ('s4-before-s3a-door-low-844x390-head.png', 's4-before-s3a-door-low-844x390', 'Low door, Sat 21:00'),
        ('s4-before-s3a-stall-low-844x390-head.png', 's4-before-s3a-stall-low-844x390', 'Low stall, Sat 21:00'),
        ('s4-before-s3a-patio-low-844x390-head.png', 's4-before-s3a-patio-low-844x390', 'Low patio, Sat 21:00'),
        ('s4-before-s3a-overhead-friday-1280x720-head.png', 's4-before-s3a-overhead-friday-1280x720', 'HD overhead, Fri 21:00'),
        ('s4-before-s3a-tuesday-1280x720-head.png', 's4-before-s3a-tuesday-1280x720', 'HD door, Tue 15:00'),
        ('s4-before-s3b-npc-pool-overhead-1280x720-head.png', 's4-before-s3b-npc-pool-overhead-1280x720', 'HD guests\' pool, Sat 21:00'),
    ]
    w, h, gap = 560, 300, 4
    for k in range(0, len(pairs), 3):
        grp = pairs[k:k + 3]
        S = Image.new('RGB', (2 * w + gap, len(grp) * h + (len(grp) - 1) * gap), (12, 13, 14))
        for i, (b, a, lab) in enumerate(grp):
            S.paste(panel(os.path.join(OUT, b), w, h, 'before (HEAD, S3b) / ' + lab), (0, i * (h + gap)))
            S.paste(panel(pick(a)[0], w, h, 'after (S4) / ' + lab), (w + gap, i * (h + gap)))
        out = os.path.join(OUT, f's4-sheet-before-after-{k // 3 + 1}-{TAG}.png')
        S.save(out)
        made.append(out)
    # (S4's fifth pass, the art review) HD beside Ultra, the same seats on one page: a row a place, a column pair a time
    w, h, gap = 640, 360, 4
    for size in SIZES:
        if size != '1280x720':
            continue
        S = Image.new('RGB', (4 * w + 3 * gap, 3 * h + 2 * gap), (12, 13, 14))
        for i, place in enumerate(['bar', 'pool', 'patio']):
            for j, (t, tn) in enumerate([('noon', 'Sat 12:00'), ('night', 'Sat 21:00')]):
                for k, (q, qn) in enumerate([('hd', 'HD'), ('ultra', 'Ultra')]):
                    p, tg = pick(f's4-{q}-{size}-{t}-{place}')
                    S.paste(panel(p, w, h, f'{qn} / {tn} / {place}' + (f' [{tg}]' if len(TAGS) > 1 else '')), ((2 * j + k) * (w + gap), i * (h + gap)))
        out = os.path.join(OUT, f's4-sheet-hd-vs-ultra-{size}-{TAG}.png')
        S.save(out)
        made.append(out)
    print('\n'.join(made))


if __name__ == '__main__':
    main()

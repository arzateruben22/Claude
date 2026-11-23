#!/usr/bin/env python3
"""Side-by-side sheets for the new HUD (claude/retro-hud): the owner's mockup beside our frame, and our Ultra parts beside
ultra-hud-parts.webp. Usage: python3 tests/retrohud-sheets.py OWNER_DIR [SUFFIX]   (frames in tests/out/retrohud/)."""
import sys, os
from PIL import Image, ImageDraw
owner = sys.argv[1]; suf = sys.argv[2] if len(sys.argv) > 2 else ''
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'retrohud')
def fr(n): return Image.open(os.path.join(out, n.replace('.png', suf + '.png'))).convert('RGB')
def fit(im, h): return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
def label(im, t):
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 260, 26), fill=(0, 0, 0)); d.text((6, 6), t, fill=(255, 255, 255)); return im
def side(a, b, ta, tb, name, h=1500):
    a, b = label(fit(a, h), ta), label(fit(b, h), tb)
    s = Image.new('RGB', (a.width + b.width + 12, h), (20, 20, 20)); s.paste(a, (0, 0)); s.paste(b, (a.width + 12, 0)); s.save(os.path.join(out, name)); print(name, s.size)
side(Image.open(os.path.join(owner, 'ultra-hud-layout.webp')).convert('RGB'), fr('ultra-drift-chase-390x844.png'), 'target (owner)', 'ours (Ultra, 390x844 @3x)', f'sheet-ultra-target-vs-ours-390x844{suf}.png')
# our parts, cropped from the frames (CSS px x 3), in the parts sheet's order, beside the owner's parts sheet
idle, chg, drift = fr('ultra-idle-chase-390x844.png'), fr('ultra-clear-charging-390x844.png'), fr('ultra-drift-chase-390x844.png')
def crop(im, l, t, r, b): return im.crop((l * 3, t * 3, r * 3, b * 3))
parts = [('ABS | TCS', crop(idle, 6, 96, 200, 146)), ('Pause', crop(idle, 224, 0, 288, 64)), ('Map', crop(idle, 268, 0, 392, 124)),
         ('CLEAR PATH ready', crop(idle, 226, 676, 312, 766)), ('CLEAR PATH charging', crop(chg, 226, 676, 312, 766)), ('STEER', crop(idle, 6, 756, 154, 840)),
         ('BRAKE', crop(idle, 210, 752, 302, 840)), ('GAS', crop(idle, 296, 724, 378, 840)), ('HANDBRAKE idle', crop(idle, 148, 740, 216, 840)), ('HANDBRAKE pulled', crop(drift, 148, 740, 216, 840))]
H = 330; tiles = [label(fit(im, H), t) for t, im in parts]
cols = 5; rows = (len(tiles) + cols - 1) // cols; W = max(sum(t.width for t in tiles[r * cols:(r + 1) * cols]) + 8 * cols for r in range(rows))
ours = Image.new('RGB', (W, rows * (H + 8)), (20, 20, 20))
for r in range(rows):
    x = 0
    for t in tiles[r * cols:(r + 1) * cols]: ours.paste(t, (x, r * (H + 8))); x += t.width + 8
tgt = Image.open(os.path.join(owner, 'ultra-hud-parts.webp')).convert('RGB')
tgt = tgt.resize((W, round(tgt.height * W / tgt.width)), Image.LANCZOS)
s = Image.new('RGB', (W, ours.height + tgt.height + 10), (20, 20, 20)); s.paste(label(ours, 'ours (CSS)'), (0, 0)); s.paste(label(tgt, 'target (owner parts sheet)'), (0, ours.height + 10)); s.save(os.path.join(out, f'sheet-ultra-parts{suf}.png')); print('parts', s.size)

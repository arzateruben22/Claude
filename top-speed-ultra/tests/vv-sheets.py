"""Vega & Vinnie's: each proof frame beside the owner's reference photo it answers (tests/out/vv/*.png), and the walk's
10-frame strip. Reads tests/out/vv/vv-shoot-<tag>.json (tests/vv-shoot.mjs writes it) and writes
tests/out/vv/sheets/<view>-<day|night>-<tag>.jpg (reference left, our frame right, both at 640 px tall) and
tests/out/vv/sheets/walk-<tag>.jpg.

  python3 tests/vv-sheets.py <reference folder>
"""
import json, sys, glob, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out', 'vv'); SHEETS = os.path.join(OUT, 'sheets')
REF = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(SHEETS, exist_ok=True)
H = 640

def fit(im, h=H):
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)

def label(im, text):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 8 * len(text) + 16, 24], fill=(0, 0, 0)); d.text((8, 6), text, fill=(255, 255, 255)); return im

for js in sorted(glob.glob(os.path.join(OUT, 'vv-shoot-*.json'))):
    log = json.load(open(js)); tag = log['tag']
    for s in log.get('shots', []):
        ref = os.path.join(REF, s['ref'] + '.png'); ours = os.path.join(OUT, s['file'])
        if not (os.path.exists(ref) and os.path.exists(ours)): continue
        a = label(fit(Image.open(ref).convert('RGB')), f"reference: {s['ref']} (the owner's photo)")
        b = label(fit(Image.open(ours).convert('RGB')), f"ours: {s['file']} ({log['quality']}, {s['hour']}:00 sim)")
        sheet = Image.new('RGB', (a.width + b.width + 8, H), (20, 20, 20)); sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 8, 0))
        sheet.save(os.path.join(SHEETS, f"{s['name']}-{'day' if s['hour'] < 17 else 'night'}-{tag}.jpg"), quality=85)
    w = log.get('walk')
    if w:
        tiles = [label(fit(Image.open(os.path.join(OUT, f['file'])).convert('RGB'), 300), f"{k}: {f['state']} u {f['u']} v {f['v']}") for k, f in enumerate(w['strip'])]
        cols = 5; tw = max(t.width for t in tiles); rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (tw + 6), rows * 306), (20, 20, 20))
        for k, t in enumerate(tiles): sheet.paste(t, ((k % cols) * (tw + 6), (k // cols) * 306))
        sheet.save(os.path.join(SHEETS, f'walk-{tag}.jpg'), quality=85)
print('\n'.join(sorted(os.listdir(SHEETS))))

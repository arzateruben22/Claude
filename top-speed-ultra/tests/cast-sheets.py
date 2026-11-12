"""The cast's comparison sheets (PROJECT_OC_CAST.md): each character's renders (tests/cast-shoot.mjs) beside the same
views cropped from the owner's reference sheets. Writes tests/out/cast/compare-<id>-body.png (front, side, back: sheet
then render) and compare-<id>-head.png (front, profile, three-quarter: sheet then render).
  python3 tests/cast-sheets.py <folder with the 0N-name/ sheet folders>
The sheets are not part of the repository (the owner's reference images); the folder is given on the command line."""
import sys, os
from PIL import Image, ImageDraw

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'cast')
CAST = [('01-mateo-reyes', 'mateo-reyes'), ('02-danny-tran', 'danny-tran'), ('03-marcus-bell', 'marcus-bell'),
        ('04-leila-farahani', 'leila-farahani'), ('05-jas-cruz', 'jas-cruz'), ('06-kate-morgan', 'kate-morgan')]
BODY = {'front': (0, 384), 'side': (768, 1152), 'back': (1152, 1536)}          # x ranges in the 1536x1024 body sheet
FACE = {'head': (0, 525), 'headSide': (525, 1010), 'headThree': (1010, 1536)}   # and in the face sheet (y 0..930)

def fit(im, h):
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)

def crop_render(p, body):
    im = Image.open(p).convert('RGB')
    if not body:
        return im
    # trim the render's empty margins round the figure (the background is the sheets' grey)
    w, h = im.size
    return im.crop((int(w * 0.18), int(h * 0.12), int(w * 0.82), int(h * 0.86)))

def strip(pairs, h, label):
    tiles = []
    for a, b in pairs:
        tiles += [fit(a, h), fit(b, h)]
    W = sum(t.width for t in tiles) + 8 * (len(tiles) - 1)
    out = Image.new('RGB', (W, h + 26), (40, 42, 46))
    x = 0
    for i, t in enumerate(tiles):
        out.paste(t, (x, 26))
        ImageDraw.Draw(out).text((x + 6, 6), ('sheet' if i % 2 == 0 else 'in game (LOD 0)'), fill=(230, 232, 236))
        x += t.width + 8
    ImageDraw.Draw(out).text((W - 260, 6), label, fill=(160, 200, 255))
    return out

for d, cid in CAST:
    bs = Image.open(os.path.join(SRC, d, 'body-sheet.webp')).convert('RGB')
    fs = Image.open(os.path.join(SRC, d, 'face-sheet.webp')).convert('RGB')
    body = [(bs.crop((x0, 0, x1, 1024)), crop_render(os.path.join(OUT, f'{cid}-{v}.png'), True)) for v, (x0, x1) in BODY.items()]
    head = [(fs.crop((x0, 0, x1, 930)), crop_render(os.path.join(OUT, f'{cid}-{v}.png'), False)) for v, (x0, x1) in FACE.items()]
    strip(body, 620, cid + ': front, side, back').save(os.path.join(OUT, f'compare-{cid}-body.png'))
    strip(head, 420, cid + ': front, profile, 3/4').save(os.path.join(OUT, f'compare-{cid}-head.png'))
    print('wrote', cid)

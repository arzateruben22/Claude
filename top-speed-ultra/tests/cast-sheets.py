"""The cast's comparison sheets (PROJECT_OC_CAST.md): each character's renders (tests/cast-shoot.mjs) beside the same
views cropped from the owner's reference sheets. Writes tests/out/cast/compare-<id>-body.png (front, side, back: sheet
then render) and compare-<id>-head.png (front, profile, three-quarter: sheet then render).
  python3 tests/cast-sheets.py <folder with the 0N-name/ sheet folders> [suffix]
With a suffix (e.g. -r2) it reads the renders <id>-<view><suffix>.png (cast-shoot.mjs --suffix=) and writes
compare-<id>-body<suffix>.png and compare-<id>-head<suffix>.png.
The sheets are not part of the repository (the owner's reference images); the folder is given on the command line.
  python3 tests/cast-sheets.py --pack <folder with chad/ and chadaline/> [suffix]
The pack's two (2026-11-12): writes pack-<id>-body<suffix>.png (front, side, back) and pack-<id>-head<suffix>.png (front,
three-quarter, profile: the sheet's 2x2 face grid beside the renders yaw0, yaw45 or yaw-45, and yaw90 of
cast-shoot.mjs --views=front,side,back,yaw0,yaw45,yaw-45,yaw90)."""
import sys, os
from PIL import Image, ImageDraw

PACK = len(sys.argv) > 1 and sys.argv[1] == '--pack'
ARGS = sys.argv[2:] if PACK else sys.argv[1:]
SRC = ARGS[0]
SUF = ARGS[1] if len(ARGS) > 1 else ''
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

# the pack's face sheets are a 2x2 grid of 768x512 cells: front, three-quarter / near profile, profile
PACK_CAST = [('chad', 'png', 'yaw-45'), ('chadaline', 'webp', 'yaw45')]   # (his three-quarter is from his left, hers from her right)
if PACK:
    for cid, ext, three in PACK_CAST:
        bs = Image.open(os.path.join(SRC, cid, 'body-sheet.' + ext)).convert('RGB')
        fs = Image.open(os.path.join(SRC, cid, 'face-sheet.' + ext)).convert('RGB')
        body = [(bs.crop((x0, 0, x1, 1024)), crop_render(os.path.join(OUT, f'{cid}-{v}{SUF}.png'), True)) for v, (x0, x1) in BODY.items()]
        cells = {'yaw0': (0, 0, 768, 512), three: (768, 0, 1536, 512), 'yaw90': (768, 512, 1536, 1024)}
        head = [(fs.crop(box), crop_render(os.path.join(OUT, f'{cid}-{v}{SUF}.png'), False)) for v, box in cells.items()]
        strip(body, 620, cid + ': front, side, back').save(os.path.join(OUT, f'pack-{cid}-body{SUF}.png'))
        strip(head, 420, cid + ': front, 3/4, profile').save(os.path.join(OUT, f'pack-{cid}-head{SUF}.png'))
        print('wrote pack', cid)
    sys.exit(0)

for d, cid in CAST:
    bs = Image.open(os.path.join(SRC, d, 'body-sheet.webp')).convert('RGB')
    fs = Image.open(os.path.join(SRC, d, 'face-sheet.webp')).convert('RGB')
    body = [(bs.crop((x0, 0, x1, 1024)), crop_render(os.path.join(OUT, f'{cid}-{v}{SUF}.png'), True)) for v, (x0, x1) in BODY.items()]
    head = [(fs.crop((x0, 0, x1, 930)), crop_render(os.path.join(OUT, f'{cid}-{v}{SUF}.png'), False)) for v, (x0, x1) in FACE.items()]
    strip(body, 620, cid + ': front, side, back').save(os.path.join(OUT, f'compare-{cid}-body{SUF}.png'))
    strip(head, 420, cid + ': front, profile, 3/4').save(os.path.join(OUT, f'compare-{cid}-head{SUF}.png'))
    print('wrote', cid)

# Contact sheet of hand grip poses as the driver sees them: runs tools/preview-hands-eye.mjs once per pose and lays
# the pictures out in a grid, each labelled with its pose.
#   python3 tools/preview-hands-grid.py out.png '[{"alpha":0.5},{"alpha":0.7}]' [--views=eyeR] [--size=300] [--pres=m] [--plain]
import json, subprocess, sys, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
out, poses = args[0], json.loads(args[1])
views, size, pres = opts.get('views', 'eyeR'), opts.get('size', '300'), opts.get('pres', 'm')
tiles = []
for i, p in enumerate(poses):
    f = os.path.join(ROOT, 'tests/out/preview/build', f'grid-{i}.png')
    cmd = ['node', 'tools/preview-hands-eye.mjs', f, f'--views={views}', f'--size={size}', f'--pres={pres}', '--pose=' + json.dumps(p)]
    if 'plain' in opts: cmd.append('--plain')
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-800:]); continue
    im = Image.open(f).convert('RGB')
    d = ImageDraw.Draw(im)
    d.text((6, 4), json.dumps(p)[:90], fill=(255, 255, 255))
    tiles.append(im)
    print(i, json.dumps(p), r.stdout.strip().splitlines()[0])
if tiles:
    cols = int(opts.get('cols', '3')) if len(tiles) > 1 else 1
    w, h = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (w * min(cols, len(tiles)), h * rows), (20, 20, 24))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * w, (i // cols) * h))
    sheet.save(os.path.join(ROOT, out) if not os.path.isabs(out) else out)
    print('wrote', out)

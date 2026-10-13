# Overview render of slice.json (decoded the way the game would) with the game's freeway paths, the venue, its lot
# and the routes from freeway-link.json. Writes tests/out/onfoot/data-overview.png and data-venue.png (zoom).
import os, math, collections as C
from PIL import Image, ImageDraw, ImageFont
from ana import OUT, jload

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SHOTS = os.path.join(ROOT, 'tests', 'out', 'onfoot'); os.makedirs(SHOTS, exist_ok=True)
sl = jload(os.path.join(OUT, 'slice.json')); lk = jload(os.path.join(OUT, 'freeway-link.json'))
net = jload(os.path.join(ROOT, 'src/data/oc-network.json'))
dic = sl['dict']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(n): return ImageFont.truetype(FONT, n) if os.path.exists(FONT) else ImageFont.load_default()
def undelta(a, q=10.0):
    out, x, z = [], 0, 0
    for i in range(0, len(a), 2): x += a[i]; z += a[i + 1]; out.append((x / q, z / q))
    return out
gpaths = []
for rp in net['paths']:
    x = z = 0; pts = []
    for j in range(rp['n']): x += rp['p'][3 * j]; z += rp['p'][3 * j + 1]; pts.append((x / 10, z / 10))
    gpaths.append((rp, pts))

ROAD = {  # class -> (width px at 1 m/px-ish scale factor, colour)
    'motorway': (7, (214, 94, 40)), 'trunk': (6, (226, 130, 50)), 'primary': (5.5, (235, 170, 60)),
    'secondary': (4.5, (240, 205, 90)), 'tertiary': (3.5, (250, 235, 150)), 'residential': (2.4, (255, 255, 255)),
    'unclassified': (2.4, (255, 255, 255)), 'living_street': (2, (255, 255, 255)), 'service': (1.4, (225, 225, 225)),
    'unknown': (1.2, (200, 200, 210)),
}
WALK = {'footway', 'steps', 'path', 'pedestrian', 'cycleway', 'bridleway', 'track'}
LU = {'park': (190, 225, 175), 'recreation': (200, 230, 185), 'managed': (205, 228, 190), 'horticulture': (205, 228, 190),
      'residential': (236, 228, 218), 'developed': (232, 226, 232), 'construction': (226, 214, 190), 'education': (240, 230, 200),
      'religious': (226, 222, 210), 'medical': (240, 222, 222), 'cemetery': (200, 220, 200), 'pedestrian': (240, 238, 232)}

def render(fn, box, px_per_m, title, labels=True, full=True):
    x0, z0, x1, z1 = box
    W, H = int((x1 - x0) * px_per_m), int((z1 - z0) * px_per_m)
    img = Image.new('RGB', (W, H + 150), (246, 244, 238)); d = ImageDraw.Draw(img, 'RGBA')
    P = lambda p: ((p[0] - x0) * px_per_m, (p[1] - z0) * px_per_m)
    sc = max(0.6, px_per_m / 0.5)
    for e in sl['landuse']:
        if 'p' not in e: continue
        cls = dic['lu'][e['c']]
        col = LU.get(cls) or LU.get({'grass': 'managed', 'garden': 'horticulture', 'pitch': 'recreation', 'playground': 'recreation',
                                    'retail': 'developed', 'commercial': 'developed', 'industrial': 'developed', 'school': 'education',
                                    'hospital': 'medical', 'dog_park': 'park', 'greenfield': 'construction', 'brownfield': 'construction',
                                    'track': 'recreation', 'resort': 'recreation', 'meadow': 'park', 'railway': 'developed'}.get(cls, ''), (232, 230, 225))
        d.polygon([P(p) for p in undelta(e['p'])], fill=col)
    for e in sl['infra']:
        cls = dic['infra'][e['c']]
        if 'p' in e and cls == 'transit:parking':
            d.polygon([P(p) for p in undelta(e['p'])], fill=(214, 214, 220), outline=(170, 170, 180))
    for e in sl['water']:
        if 'p' in e: d.polygon([P(p) for p in undelta(e['p'])], fill=(150, 195, 235))
        else: d.line([P(p) for p in undelta(e['l'])], fill=(110, 170, 225), width=max(1, int(2 * sc)))
    # buildings, shaded by height
    for b in sl['bld']:
        h = b.get('h')
        if h is None: col = (150, 140, 135)
        else:
            t = min(1, h / 40); col = (int(190 - 120 * t), int(170 - 120 * t), int(160 - 90 * t))
        d.polygon([P(p) for p in undelta(b['p'])], fill=col, outline=(90, 80, 80))
    # streets by class (walkways thin and green-grey, rail dashed dark)
    order = ['unknown', 'service', 'living_street', 'unclassified', 'residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']
    segs = [(s, dic['seg'][s['c']], dic['sub'][s['s']] if 's' in s else None) for s in sl['seg']]
    for s, cls, sub in segs:
        pts = [P(p) for p in undelta(s['p'])]
        if cls.startswith('rail:'): d.line(pts, fill=(70, 70, 80), width=max(1, int(1.6 * sc)))
        elif cls in WALK:
            col = (60, 150, 90) if sub in ('sidewalk', None) else (200, 60, 160) if sub == 'crosswalk' else (60, 150, 90)
            d.line(pts, fill=col + (230,), width=max(1, int(1.0 * sc)))
    for k in order:
        for s, cls, sub in segs:
            if cls != k: continue
            w, col = ROAD[cls]
            if sub == 'parking_aisle': col = (205, 205, 215)
            d.line([P(p) for p in undelta(s['p'])], fill=(90, 90, 90), width=max(1, int((w + 1.2) * sc * 0.5)) + 2)
    for k in order:
        for s, cls, sub in segs:
            if cls != k: continue
            w, col = ROAD[cls]
            if sub == 'parking_aisle': col = (235, 235, 245)
            d.line([P(p) for p in undelta(s['p'])], fill=col, width=max(1, int(w * sc * 0.5)))
    # the game's freeway carriageways (blue) and ramps (purple), thin over the real map
    for rp, pts in gpaths:
        if not any(x0 - 50 <= x <= x1 + 50 and z0 - 50 <= z <= z1 + 50 for x, z in pts): continue
        d.line([P(p) for p in pts], fill=(30, 80, 200, 220) if rp['k'] == 'm' else (150, 40, 190, 220), width=max(1, int(1.2 * sc)))
    for i, (rp, pts) in enumerate(gpaths):
        if rp['k'] == 'l' and any(i in e['ramp_paths'][:1] for e in lk['exits']):
            mx, mz = pts[len(pts) // 2]
            if x0 <= mx <= x1 and z0 <= mz <= z1:
                d.text(P((mx, mz)), f'path {i}', fill=(120, 20, 160), font=font(int(11 * max(1, sc / 2))), stroke_width=2, stroke_fill=(255, 255, 255))
    # routes from the two CA-57 Orangewood exits and the I-5 State College exit
    shown = [e for e in lk['exits'] if 'route' in e][:3]
    for e, col in zip(shown, [(0, 160, 120), (230, 40, 40), (0, 120, 230)]):
        d.line([P(p) for p in undelta(e['route']['p'])], fill=col + (200,), width=max(2, int(2.5 * sc)))
        tx, tz = e['terminal']['x'], e['terminal']['z']
        r = 4 * sc; d.ellipse([P((tx, tz))[0] - r, P((tx, tz))[1] - r, P((tx, tz))[0] + r, P((tx, tz))[1] + r], fill=col, outline=(0, 0, 0))
    # venue lot and venue
    lot = sl['infra'][lk['venue']['lot_infra']]
    d.polygon([P(p) for p in undelta(lot['p'])], outline=(220, 0, 0), width=max(2, int(1.5 * sc)))
    if lk['venue']['bld'] is not None:
        d.polygon([P(p) for p in undelta(sl['bld'][lk['venue']['bld']]['p'])], outline=(255, 0, 0), width=max(2, int(1.5 * sc)))
    vx, vz = P((sl['venue']['x'], sl['venue']['z'])); r = 7 * max(1, sc / 2)
    d.regular_polygon((vx, vz, r * 1.6), 5, fill=(255, 30, 30), outline=(0, 0, 0))
    d.text((vx + r * 2, vz - r), 'VENUE (ours)', fill=(200, 0, 0), font=font(int(14 * max(1, sc / 2))), stroke_width=3, stroke_fill=(255, 255, 255))
    # street labels: once per name at its longest piece
    if labels:
        best = {}
        for s, cls, sub in segs:
            if 'n' not in s or cls in WALK or cls.startswith('rail:') or cls == 'service': continue
            pts = undelta(s['p']); L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
            nm = dic['name'][s['n']]
            if nm not in best or L > best[nm][0]: best[nm] = (L, pts, cls)
        f = font(int(12 * max(1, sc / 2)))
        for nm, (L, pts, cls) in best.items():
            if L < (120 if full else 40) and cls not in ('primary', 'secondary', 'motorway'): continue
            mx, mz = pts[len(pts) // 2] if len(pts) > 2 else ((pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2)
            if not (x0 <= mx <= x1 and z0 <= mz <= z1): continue
            d.text(P((mx, mz)), nm, fill=(20, 20, 20), font=f, stroke_width=3, stroke_fill=(255, 255, 255), anchor='mm')
    # legend, scale bar, north arrow
    y = H + 8; f = font(15)
    d.rectangle([0, H, W, H + 150], fill=(255, 255, 255))
    d.text((10, y), title, fill=(0, 0, 0), font=font(17))
    items = [('motorway', ROAD['motorway'][1]), ('primary', ROAD['primary'][1]), ('secondary', ROAD['secondary'][1]),
             ('tertiary', ROAD['tertiary'][1]), ('residential', (255, 255, 255)), ('service / aisle', (225, 225, 225)),
             ('footway/sidewalk', (60, 150, 90)), ('crosswalk', (200, 60, 160)), ('rail', (70, 70, 80)),
             ('game freeway', (30, 80, 200)), ('game ramp', (150, 40, 190)), ('parking area', (214, 214, 220))]
    for i, (lab, col) in enumerate(items):
        cx, cy = 10 + (i % 6) * (W // 6), y + 30 + (i // 6) * 24
        d.rectangle([cx, cy + 4, cx + 26, cy + 14], fill=col, outline=(80, 80, 80)); d.text((cx + 32, cy), lab, fill=(0, 0, 0), font=f)
    leg2 = ' / '.join(f"{e['freeway']} exit '{e['sign'][0]}' path {e['ramp_paths'][0]}: {e['route']['metres']} m" for e in shown)
    d.text((10, y + 84), 'Routes (green, red, blue): ' + leg2, fill=(0, 0, 0), font=font(13))
    d.text((10, y + 104), 'Buildings shaded by height (darker = taller; grey-brown = no height). North is up. '
           'Data: Overture Maps (OSM, ODbL; places CDLA-P-2.0).', fill=(60, 60, 60), font=font(13))
    bar = 500 if full else 100
    d.line([(W - bar * px_per_m - 20, y + 128), (W - 20, y + 128)], fill=(0, 0, 0), width=4)
    d.text((W - bar * px_per_m - 20, y + 108), f'{bar} m', fill=(0, 0, 0), font=f)
    d.polygon([(W - 30, 20), (W - 40, 50), (W - 20, 50)], fill=(0, 0, 0)); d.text((W - 36, 52), 'N', fill=(0, 0, 0), font=f)
    img.save(fn); print('wrote', fn, img.size)

render(os.path.join(SHOTS, 'data-overview.png'), sl['box'], 0.5, 'Anaheim stadium-district slice (3 x 3 km), game coordinates')
vx, vz = sl['venue']['x'], sl['venue']['z']
render(os.path.join(SHOTS, 'data-venue.png'), (vx - 450, vz - 350, vx + 650, vz + 350), 1.4, 'Venue zoom (1.1 x 0.7 km)', full=False)

# ---- city streets (streets-city.json) with the city limits, the slice box and the game freeways
cs = jload(os.path.join(OUT, 'streets-city.json'))
allp = [p for r in cs['boundary'] for p in undelta(r)]
bx0, bx1 = min(p[0] for p in allp) - 300, max(p[0] for p in allp) + 300
bz0, bz1 = min(p[1] for p in allp) - 300, max(p[1] for p in allp) + 300
k = 0.06
W, H = int((bx1 - bx0) * k), int((bz1 - bz0) * k)
img = Image.new('RGB', (W, H + 60), (246, 244, 238)); d = ImageDraw.Draw(img, 'RGBA')
P = lambda p: ((p[0] - bx0) * k, (p[1] - bz0) * k)
for r in cs['boundary']: d.polygon([P(p) for p in undelta(r)], fill=(236, 233, 224), outline=(120, 60, 160), width=3)
CW = {'motorway': (3, (214, 94, 40)), 'trunk': (3, (226, 130, 50)), 'primary': (2, (225, 150, 40)), 'secondary': (2, (210, 180, 60)),
      'tertiary': (1, (190, 170, 90)), 'residential': (1, (150, 150, 150)), 'unclassified': (1, (150, 150, 150)), 'living_street': (1, (150, 150, 150))}
for s in sorted(cs['seg'], key=lambda s: list(CW).index(cs['dict']['cls'][s['c']]) * -1):
    w, col = CW[cs['dict']['cls'][s['c']]]
    d.line([P(p) for p in undelta(s['p'])], fill=col, width=w)
for rp, pts in gpaths:
    if rp['k'] == 'm' and any(bx0 <= x <= bx1 and bz0 <= z <= bz1 for x, z in pts):
        d.line([P(p) for p in pts], fill=(30, 80, 200, 160), width=1)
X0, Z0, X1, Z1 = sl['box']
d.rectangle([P((X0, Z0)), P((X1, Z1))], outline=(220, 0, 0), width=3)
d.regular_polygon((*P((sl['venue']['x'], sl['venue']['z'])), 7), 5, fill=(255, 30, 30), outline=(0, 0, 0))
d.rectangle([0, H, W, H + 60], fill=(255, 255, 255))
d.text((10, H + 6), f"streets-city.json: {len(cs['seg'])} street pieces (motorway to residential) inside the Anaheim city limits (purple). "
       'Red box: the 3 km walkable slice; star: venue; blue: game freeways.', fill=(0, 0, 0), font=font(14))
d.text((10, H + 30), 'Data: Overture Maps 2026-09-23.1 from OpenStreetMap (ODbL). North is up.', fill=(60, 60, 60), font=font(13))
fn = os.path.join(SHOTS, 'data-city.png'); img.save(fn); print('wrote', fn, img.size)

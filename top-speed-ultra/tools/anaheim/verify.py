# Spot-checks of slice.json against what is publicly known about the district and against the game's own freeway
# geometry. Prints a table and writes data/verify.json. Decodes slice.json the way the game would.
import os, math, json, collections as C
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from ana import OUT, DATA, jload, unproj

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sl = jload(os.path.join(OUT, 'slice.json')); net = jload(os.path.join(ROOT, 'src/data/oc-network.json'))
dic = sl['dict']; VX, VZ = sl['venue']['x'], sl['venue']['z']
def undelta(a, q=10.0):
    out, x, z = [], 0, 0
    for i in range(0, len(a), 2): x += a[i]; z += a[i + 1]; out.append((x / q, z / q))
    return out
by_name = C.defaultdict(list); by_route = C.defaultdict(list)
for s in sl['seg']:
    pts = undelta(s['p'])
    if 'n' in s: by_name[dic['name'][s['n']]].append(pts)
    if 'r' in s: by_route[s['r']].append(pts)
def axis(lines):
    """length-weighted bearing of a street (0 = east-west, 90 = north-south), its mean x, z and total length."""
    sx = sz = sl_ = 0; c2 = s2 = 0
    for pts in lines:
        for a, b in zip(pts, pts[1:]):
            L = math.dist(a, b)
            if L == 0: continue
            ang = math.atan2(-(b[1] - a[1]), b[0] - a[0])  # north-positive
            c2 += L * math.cos(2 * ang); s2 += L * math.sin(2 * ang)
            sx += L * (a[0] + b[0]) / 2; sz += L * (a[1] + b[1]) / 2; sl_ += L
    bearing = (math.degrees(math.atan2(s2, c2)) / 2) % 180  # 0 = E-W, 90 = N-S, 45 = NE-SW, 135 = NW-SE
    return bearing, sx / sl_, sz / sl_, sl_
checks = []
def check(name, ok, detail):
    checks.append({'check': name, 'ok': bool(ok), 'detail': detail}); print(('PASS ' if ok else 'FAIL ') + name + ': ' + detail)
def ew(b): return min(b, 180 - b) < 20
def ns(b): return abs(b - 90) < 20
stad = [Polygon(undelta(b['p'])) for b in sl['bld'] if 'c' in b and dic['bcls'][b['c']] == 'stadium']
SX, SZ = (stad[0].centroid.x, stad[0].centroid.y) if stad else (None, None)
for nm, want, rel in [('East Orangewood Avenue', 'EW', lambda x, z: z < VZ and VZ - z < 150),
                      ('South State College Boulevard', 'NS', lambda x, z: x < VX),
                      ('East Katella Avenue', 'EW', lambda x, z: z < SZ),
                      ('East Gene Autry Way', 'EW', lambda x, z: z < VZ)]:
    lines = by_name.get(nm)
    if not lines: check(nm, False, 'not found'); continue
    b, mx, mz, L = axis(lines)
    lon, lat = unproj(mx, mz)
    okdir = ew(b) if want == 'EW' else ns(b)
    check(f'{nm} runs {want}', okdir and rel(mx, mz),
          f'bearing {b:.0f} deg (0=E-W, 90=N-S), length {L:.0f} m, mid {lat:.5f},{lon:.5f}, {mx - VX:+.0f} m E / {mz - VZ:+.0f} m S of venue')
for rt, want in [('CA-57', 'NS'), ('I-5', 'NW-SE')]:
    lines = by_route.get(rt)
    b, mx, mz, L = axis(lines)
    if rt == 'CA-57': ok = ns(b) and SX is not None and mx > SX
    else: ok = 115 < b < 160 and mx < VX
    check(f'{rt} runs {want}', ok, f'bearing {b:.0f} deg, {L:.0f} m of carriageway in slice, mean {mx - VX:+.0f} m E / {mz - VZ:+.0f} m S of venue'
          + (f'; stadium centroid {SX - VX:+.0f} m E' if rt == 'CA-57' else ''))
# Douglass Rd bends north-east from Katella toward the arena (bearing ~50 deg), so check its place, not a bearing:
# east of the CA-57 centreline mean and north of Katella's mean line
b, mx, mz, L = axis(by_name['South Douglass Road']); k57 = axis(by_route['CA-57']); kat = axis(by_name['East Katella Avenue'])
check('South Douglass Road lies east of the CA-57 and north of Katella', mx > k57[1] and mz < kat[2],
      f'bearing {b:.0f} deg, length {L:.0f} m, mean {mx - VX:+.0f} m E / {mz - VZ:+.0f} m S of venue (CA-57 mean {k57[1] - VX:+.0f} m E, Katella mean {kat[2] - VZ:+.0f} m S)')
# stadium and arena against their published coordinates (Angel Stadium 33.8003 N 117.8827 W; Honda Center 33.8078 N 117.8766 W)
from ana import proj
for lab, cls, lat, lon in [('stadium', 'stadium', 33.8003, -117.8827)]:
    if stad:
        x, z = proj(lon, lat); d = math.dist((SX, SZ), (x, z))
        check('stadium footprint centroid vs published coordinates', d < 150, f'{d:.0f} m apart')
bigs = sorted(((Polygon(undelta(b['p'])).area, i) for i, b in enumerate(sl['bld'])), reverse=True)
x, z = proj(-117.8766, 33.8078)
near = min(((Polygon(undelta(sl['bld'][i]['p'])).distance(Point(x, z)), a, i) for a, i in bigs[:40]))
check('arena: a large footprint (>10,000 m2) at the published Honda Center point', near[0] < 30 and near[1] > 10000,
      f'building {near[2]} area {near[1]:.0f} m2, {near[0]:.0f} m from the point, height {sl["bld"][near[2]].get("h")}')
# the game's carriageways vs Overture's motorway centrelines (both from the same source; game is smoothed and pushed apart)
paths = []
for rp in net['paths']:
    x = z = 0; pts = []
    for j in range(rp['n']): x += rp['p'][3 * j]; z += rp['p'][3 * j + 1]; pts.append((x / 10, z / 10))
    paths.append((rp, pts))
X0, Z0, X1, Z1 = sl['box']
for rt, ids in [('CA-57', [8, 9]), ('I-5', [0, 1])]:
    ov = [LineString(p) for p in by_route[rt]]
    ds = []
    for pid in ids:
        L = LineString(paths[pid][1])
        for s in np.arange(0, L.length, 20):
            p = L.interpolate(s)
            if X0 < p.x < X1 and Z0 < p.y < Z1: ds.append(min(o.distance(p) for o in ov))
    ds = np.array(ds)
    check(f'game {rt} paths {ids} sit on Overture {rt} centrelines', np.median(ds) < 5,
          f'{len(ds)} samples every 20 m: median {np.median(ds):.1f} m, 95th pct {np.percentile(ds, 95):.1f} m, max {ds.max():.1f} m')
# venue sits on the south side of Orangewood, inside a mapped building
lines = by_name['East Orangewood Avenue']
d = min(LineString(p).distance(Point(VX, VZ)) for p in lines)
lk = jload(os.path.join(OUT, 'freeway-link.json'))
check('venue is next to Orangewood Ave and inside a building', d < 120 and lk['venue']['bld'] is not None,
      f'{d:.0f} m from the Orangewood centreline, building index {lk["venue"]["bld"]} height {sl["bld"][lk["venue"]["bld"]].get("h")}')
json.dump(checks, open(f'{DATA}/verify.json', 'w'), indent=1)
print(sum(c['ok'] for c in checks), 'of', len(checks), 'pass')

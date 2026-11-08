# Spot-checks of a venue's slice against what is publicly known about the place and against the game's own freeway
# geometry. Prints a table and writes data/<prefix>verify.json. Decodes the slice the way the game would.
#   python3 verify.py [venue]     (default lot57 -> data/verify.json; sportsbar -> data/sportsbar-verify.json)
import os, math, json, collections as C
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from ana import OUT, DATA, jload, unproj, venue

V = venue()
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sl = jload(V['slice']); net = jload(os.path.join(ROOT, 'src/data/oc-network.json'))
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
# the game's carriageways vs Overture's motorway centrelines (both from the same source; game is smoothed and pushed apart)
paths = []
for rp in net['paths']:
    x = z = 0; pts = []
    for j in range(rp['n']): x += rp['p'][3 * j]; z += rp['p'][3 * j + 1]; pts.append((x / 10, z / 10))
    paths.append((rp, pts))
X0, Z0, X1, Z1 = sl['box']
def freeway_check(rt, ids, limit, label=None):
    ov = [LineString(p) for p in by_route[rt]]
    ds = []
    for pid in ids:
        L = LineString(paths[pid][1])
        for s in np.arange(0, L.length, 20):
            p = L.interpolate(s)
            if X0 < p.x < X1 and Z0 < p.y < Z1: ds.append(min(o.distance(p) for o in ov))
    ds = np.array(ds)
    check(label or f'game {rt} paths {ids} sit on Overture {rt} centrelines', np.median(ds) < limit,
          f'{len(ds)} samples every 20 m: median {np.median(ds):.1f} m, 95th pct {np.percentile(ds, 95):.1f} m, max {ds.max():.1f} m')

# ---------------------------------------------------------------- Lot 57 (the stadium district)
def lot57_checks():
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
    for rt, ids in [('CA-57', [8, 9]), ('I-5', [0, 1])]: freeway_check(rt, ids, 5)
    # venue sits on the south side of Orangewood, inside a mapped building
    lines = by_name['East Orangewood Avenue']
    d = min(LineString(p).distance(Point(VX, VZ)) for p in lines)
    lk = jload(V['link'])
    check('venue is next to Orangewood Ave and inside a building', d < 120 and lk['venue']['bld'] is not None,
          f'{d:.0f} m from the Orangewood centreline, building index {lk["venue"]["bld"]} height {sl["bld"][lk["venue"]["bld"]].get("h")}')

# ---------------------------------------------------------------- our sports bar (South Claudina Way)
def sportsbar_checks():
    import re, pyarrow.parquet as pq
    VP = Point(VX, VZ); site = sl['venue']['site']; bi = sl['venue']['bld']
    # the footprint: contains the place point, or is the nearest building to it
    polys = [Polygon(undelta(b['p'])).buffer(0) for b in sl['bld']]
    B = polys[bi]; ds = sorted((p.distance(VP), i) for i, p in enumerate(polys))
    nxt = next(d for d, i in ds if i != bi)
    check('footprint contains the place point or is the nearest building to it', B.contains(VP) or ds[0][1] == bi,
          f'building {bi} {"contains" if B.contains(VP) else "is the nearest to"} the point ({B.distance(VP):.1f} m): '
          f'{B.area:,.0f} m2, {sl["bld"][bi].get("h")} m tall, shared with {site["bld_places"]} other open place records; '
          f'the next building is {nxt:.0f} m from the point')
    # the lot: beside the footprint, clear of buildings, holding mapped aisles, entered from a public street
    lot = Polygon(undelta(site['lot_p']))
    under = sum(lot.intersection(p).area for p in polys)
    ail = sum(LineString(undelta(sl['seg'][i]['p'])).intersection(lot.buffer(0.5)).length for i in site['lot_aisles'])
    check('lot is beside the footprint, clear of buildings, holds mapped aisles and has a street entry',
          lot.distance(B) <= 15 and under < 1 and ail >= 20 and bool(site['lot_entries']),
          f'{site["lot_how"]} lot {lot.area:,.0f} m2, {lot.distance(B):.1f} m from the footprint, {under:.1f} m2 under buildings, '
          f'{ail:.0f} m of mapped aisles inside, entries from {" and ".join(site["lot_entry_streets"])}; the nearest mapped '
          f'parking area is {site["nearest_mapped_parking"]["m_from_bld"]:.0f} m from the building')
    # the streets round it, as the place is described (between E Cerritos Ave and E Katella Ave, west of S Lewis St,
    # just east of the I-5)
    def near(lines): return min(LineString(p).distance(VP) for p in lines)
    for nm, want, rel, where in [('East Katella Avenue', 'EW', lambda x, z, d: z > VZ and d < 200, 'south of the bar'),
                                 ('South Claudina Way', 'NS', lambda x, z, d: d < 40, 'beside the bar'),
                                 ('South Lewis Street', 'NS', lambda x, z, d: x > VX, 'east of the bar')]:
        lines = by_name.get(nm)
        if not lines: check(f'{nm} runs {want} {where}', False, 'not found'); continue
        b, mx, mz, L = axis(lines); d = near(lines)
        check(f'{nm} runs {want} {where}', (ew(b) if want == 'EW' else ns(b)) and rel(mx, mz, d),
              f'bearing {b:.0f} deg (0=E-W, 90=N-S), length {L:.0f} m, mean {mx - VX:+.0f} m E / {mz - VZ:+.0f} m S of the bar, '
              f'nearest {d:.0f} m')
    cs = jload(os.path.join(OUT, 'streets-city.json'))
    cer = [pts for s in cs['seg'] if 'n' in s and cs['dict']['name'][s['n']] == 'East Cerritos Avenue'
           for pts in [undelta(s['p'])] if min(abs(x - VX) for x, z in pts) < 1500]
    if cer:
        b, mx, mz, L = axis(cer); d = near(cer)
        check('East Cerritos Avenue runs EW north of the bar (city layer; outside the 1.2 km box)', ew(b) and mz < VZ,
              f'bearing {b:.0f} deg, {L:.0f} m within 1.5 km east-west, mean {mz - VZ:+.0f} m S of the bar, nearest {d:.0f} m')
    else: check('East Cerritos Avenue runs EW north of the bar (city layer; outside the 1.2 km box)', False, 'not found')
    aw, i5 = by_name['Anaheim Way'], by_route['I-5']
    b, mx, mz, L = axis(aw); ba = axis(i5)[0]
    pa = min((LineString(p) for p in i5), key=lambda g: g.distance(VP)); q = pa.interpolate(pa.project(VP))
    check('Anaheim Way runs NW-SE between the bar and the I-5, which runs NW-SE to its west', 115 < b < 160 and 115 < ba < 160
          and near(aw) < near(i5) and q.x < VX,
          f'Anaheim Way bearing {b:.0f} deg, nearest {near(aw):.0f} m; I-5 bearing {ba:.0f} deg, nearest {near(i5):.0f} m at '
          f'{q.x - VX:+.0f} m E / {q.y - VZ:+.0f} m S of the bar')
    # the network's freeway against the slice's
    freeway_check('I-5', [0, 1], 1.0, 'game I-5 paths [0, 1] sit on the slice\'s Overture I-5 centrelines (median under 1 m)')
    # the freeway link
    lk = jload(V['link'])
    for d in ('N', 'S'):
        ex = [e for e in lk['exits'] if e['freeway'] == f'I-5 {d}' and any('Katella' in t for t in e['sign']) and 'route' in e]
        check(f'I-5 {d}: a Katella Avenue exit is routed to the lot', bool(ex),
              '; '.join(f"ramp {e['ramp_paths']} ('{' / '.join(e['sign'])}') terminal on {', '.join(e['terminal']['streets'])}, "
                        f"{e['route']['metres']} m: {', '.join(e['route']['streets'])}" for e in ex) or 'none')
    bad, n = [], 0
    for e in lk['exits']:
        if 'route' not in e: continue
        n += 1; pts = undelta(e['route']['p']); t = (e['terminal']['x'], e['terminal']['z'])
        if math.dist(pts[0], t) > 0.2 or not lot.buffer(1).contains(Point(pts[-1])) or e['terminal']['metres_from_ramp_centreline'] > 5:
            bad.append(e['ramp_paths'][0])
    check('every route starts at its ramp terminal (within 5 m of the game ramp) and ends in the lot', n > 0 and not bad,
          f'{n} routes ({", ".join(e["freeway"] + " " + str(e["route"]["metres"]) + " m" for e in lk["exits"] if "route" in e)})'
          + (f'; failing ramps {bad}' if bad else ''))
    # the real place is left out of the places file, and its name (read from the raw extract by the place id, at check time
    # only) appears nowhere under src/
    vj = jload(V['json']); pl = jload(V['places'])['place']
    close = sum(math.dist((pl[i + 1] / 10, pl[i + 2] / 10), (VX, VZ)) < 1 for i in range(0, len(pl), 3))
    check('the real place record is left out of the places file', close == 0 and bool(vj.get('drop_place_ids')),
          f'{len(vj.get("drop_place_ids", []))} record(s) at the address dropped; {close} place points within 1 m of the bar')
    real = next(((r['names'] or {}).get('primary') for r in pq.read_table(V['raw']('place'), columns=['id', 'names']).to_pylist()
                 if r['id'] == vj['overture_place_id']), None)
    def norm(t): return re.sub(r'[^a-z0-9]', '', t.lower().replace('&', 'and'))
    keys = {norm(real), norm(real.replace('&', ''))} if real else set()
    hits, nf = [], 0
    for dp, _, fs in os.walk(os.path.join(ROOT, 'src')):
        for f in fs:
            try: txt = open(os.path.join(dp, f), encoding='utf-8').read()
            except (UnicodeDecodeError, OSError): continue
            nf += 1
            if real.lower() in txt.lower() or any(k in norm(txt) for k in keys): hits.append(os.path.relpath(os.path.join(dp, f), ROOT))
    check('the real business name appears nowhere under src/', bool(real) and not hits,
          f'{nf} text files scanned for the name of Overture place {vj["overture_place_id"]} (looked up by id at check time, '
          f'not stored): {len(hits)} hits' + (f' in {hits}' if hits else ''))

if V['key'] == 'lot57': lot57_checks()
else: sportsbar_checks()
json.dump(checks, open(V['verify'], 'w'), indent=1)
print(sum(c['ok'] for c in checks), 'of', len(checks), 'pass')

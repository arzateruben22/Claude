"""The sports bar's near and far street sets (PROJECT_OC_SPORTS_BAR.md, "Inside, outside and overhead").

    python3 tools/anaheim/sportsbar_sets.py            # from the game folder (top-speed-ultra/)

Re-runs the plan's count against src/data/anaheim/sportsbar-slice.json. The near set is what the unit's glazing can
show: every feature, on every layer (buildings, street pieces, land use, water, infrastructure shapes and points), with
any part inside the glazed sectors within 150 m of frame (18, 8). The glazed sectors are the two half-planes outside
the glazed walls: beyond the line of the front wall's outer face, (0, 0) to (6.4, 16.5), where -0.932 u + 0.362 v >= 0,
or beyond the line of the arm's south wall, (0, 0) to (75.2, 0.9), where v <= 0.012 u. The far set is the rest.
Building 61 (the venue's host, in the venue's own row) and the pieces in site.dropSegs are in neither set. The land
cover (two 'urban' pieces over the whole box) isn't drawn, as at Lot 57. Earlier rules (a piece's middle point or a
building's centroid; any vertex; the earlier sectors u <= 7 or v <= 0) are printed beside it for comparison.

The triangles are an ESTIMATE, not a measurement: a cost model of engine/streets.ts drawing as Lot 57's data.ts does,
from its Batch primitives (ribbon 2 per edge, slab 6, walls 2, cap n - 2, cyl 4 per segment with caps), plus our own
small props for the point features. Three detail levels: the near set (with road markings, as Lot 57 marks its near
box), the far set in full (Ultra) and the far set simple (Low and HD: buildings as plain walls and roofs, flat
sidewalks, no markings or crosswalk paint, fences without posts, and of the point props only the poles, towers,
signals and lamps). S1 measures the real figures with breakdown().
"""
import json, math, os, sys
from collections import Counter, defaultdict
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
SLICE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../src/data/anaheim/sportsbar-slice.json')
O, A, B = (-6616.5, -9333.8), (-0.9098, -0.4151), (0.4151, -0.9098)    # the plan's building frame
CENTRE, R, DROP_SEGS, HOST_BLD = (18.0, 8.0), 150.0, {416}, 61
DISC = Point(CENTRE).buffer(R, quad_segs=64)
S, N = (0.362, 0.932), (-0.932, 0.362)                                 # along the front wall, and out of it
FRONT = Polygon([(-1e4 * S[0], -1e4 * S[1]), (1e4 * S[0], 1e4 * S[1]), (1e4 * (S[0] + N[0]), 1e4 * (S[1] + N[1])),
                 (1e4 * (N[0] - S[0]), 1e4 * (N[1] - S[1]))])
SOUTH = Polygon([(-1e4, -120), (1e4, 120), (1e4, -1e4), (-1e4, -1e4)])
REGION = DISC.intersection(unary_union([FRONT, SOUTH]))
EARLIER = DISC.intersection(unary_union([box(-1e4, -1e4, 7, 1e4), box(-1e4, -1e4, 1e4, 0)]))
def in_earlier(q): return (q[0] <= 7 or q[1] <= 0) and math.dist(q, CENTRE) <= R

d = json.load(open(SLICE)); DI = d['dict']
def dec(p):
    x = z = 0; out = []
    for i in range(0, len(p), 2): x += p[i]; z += p[i + 1]; out.append((x / 10, z / 10))
    return out
def fr(g): return ((g[0] - O[0]) * A[0] + (g[1] - O[1]) * A[1], (g[0] - O[0]) * B[0] + (g[1] - O[1]) * B[1])
def length(pts): return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
def frac(flag): return 0.0 if not flag else 1.0 if flag == 1 else sum(b - a for a, b in flag)

DRIVE = {'motorway', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'track'}
LOWRISE_NOT = {'stadium', 'house', 'apartments', 'hotel', 'residential', 'terrace', 'church', 'cathedral', 'hospital',
               'university', 'roof', 'parking'}
PT = {'power:power_pole': 36, 'power:power_tower': 56, 'transportation:street_lamp': 50, 'transportation:traffic_signals': 68,
      'transportation:stop': 22, 'transit:bus_stop': 22, 'emergency:fire_hydrant': 24, 'pedestrian:bench': 36,
      'waste_management:waste_basket': 24, 'transit:bicycle_parking': 24, 'pedestrian:vending_machine': 12,
      'power:transformer': 12, 'power:portal': 24, 'barrier:gate': 12, 'barrier:lift_gate': 12, 'barrier:barrier': 12,
      'barrier:toll_booth': 12}
PT_SIMPLE = {'power:power_pole', 'power:power_tower', 'transportation:street_lamp', 'transportation:traffic_signals'}

def cost(layer, rec, pts, mode):
    """(triangles, batch names) for one feature at one detail level: 'near', 'full' or 'simple'."""
    E, L = len(pts) - 1, length(pts)
    if layer == 'streets':
        cls = DI['seg'][rec['c']] if isinstance(rec['c'], int) else rec['c']; sub = DI['sub'][rec['s']] if 's' in rec else ''
        if cls in ('steps', 'unknown'): return 0, set()
        if cls.startswith('rail'): return (2 if mode == 'simple' else 6) * E, {'rail'}
        if cls in DRIVE:
            t, b = 2 * E, {'roads'}
            br = frac(rec.get('br'))
            if br: t += br * (4 * E + 32 * L / 28); b |= {'walk', 'steel'}          # deck sides, piers every 28 m
            if mode == 'near' and cls in ('motorway', 'primary', 'secondary'):
                t += (4 * E + 2 * L / 12) if rec.get('ow') else (8 * E + 8 * L / 12); b.add('markings')
            elif mode == 'near' and cls in ('tertiary', 'residential', 'unclassified'): t += 4 * E; b.add('markings')
            return round(t), b
        if sub == 'crosswalk': return (0, set()) if mode == 'simple' else (round(2 * L / 1.2), {'markings'})
        if sub == 'sidewalk' and mode != 'simple': return 6 * E, {'walk'}
        return 2 * E, {'walk'}
    if layer == 'buildings':
        n, cls, h = len(pts), DI['bcls'][rec['c']] if 'c' in rec else '', rec.get('h', 7.5)
        holes = sum(len(dec(x)) for x in rec.get('hl', []))
        if mode == 'simple': return 3 * n - 2 + 2 * holes, {'buildings', 'roofs'}
        if h <= 13 and cls not in LOWRISE_NOT:                                     # tilt-up: band, parapet, glazing
            ring = pts + pts[:1]
            bays = sum(int(max(0, math.dist(ring[i], ring[i + 1]) - 6.7) // 4.2) + 1 for i in range(n) if math.dist(ring[i], ring[i + 1]) >= 8)
            return round(7 * n - 2 + 2 * holes + 2.7 * bays), {'buildings-tilt', 'buildings-glass', 'roofs'}
        return 5 * n - 2 + 2 * holes, {'buildings', 'roofs'}
    if layer == 'infrastructure points':
        if mode == 'simple' and rec not in PT_SIMPLE: return 0, set()
        t = PT.get(rec, 0)
        return t, ({'steel', 'lamp-heads'} if rec in ('transportation:street_lamp', 'transportation:traffic_signals') else {'steel'}) if t else set()
    cls, closed = rec                                                                # land use, water, infrastructure
    if closed: E += 1
    if cls in ('power:power_line', 'power:minor_line', 'power:cable'): return 0, {'wires'}    # GL lines
    if cls == 'barrier:kerb': return 0, set()                                             # kerbs come with the roads
    posts = 0 if mode == 'simple' else 10 * (L + (math.dist(pts[0], pts[-1]) if closed else 0)) / 3
    if cls == 'barrier:fence': return round(2 * E + posts), {'chain'} | ({'steel'} if posts else set())
    if cls == 'power:substation': return round(len(pts) - 2 + 2 * E + posts), {'landuse', 'chain'} | ({'steel'} if posts else set())
    if cls in ('barrier:wall', 'barrier:retaining_wall'): return 6 * E, {'walls'}
    if cls == 'bridge:bridge': return (2 * (len(pts) - 2) + 4 * E if closed else 2 * E), {'walk'}
    if cls == 'transit:parking': return len(pts) - 2, {'roads'}
    return max(0, len(pts) - 2), {'landuse'}

F = []                                # (layer, index, label, frame points, geometry, rec, middle point or centroid)
for i, s in enumerate(d['seg']):
    if i in DROP_SEGS: continue
    f = [fr(q) for q in dec(s['p'])]; cls = DI['seg'][s['c']] if isinstance(s['c'], int) else s['c']
    lab = f"seg {i} {cls}{'/' + DI['sub'][s['s']] if 's' in s else ''}{' ' + DI['name'][s['n']] if 'n' in s else ''}"
    F.append(('streets', i, lab, f, LineString(f), s, f[len(f) // 2]))
for i, b in enumerate(d['bld']):
    if i == HOST_BLD: continue
    f = [fr(q) for q in dec(b['p'])]
    F.append(('buildings', i, f'bld {i}', f, Polygon(f, [[fr(q) for q in dec(h)] for h in b.get('hl', [])]), b,
              (sum(q[0] for q in f) / len(f), sum(q[1] for q in f) / len(f))))
for layer, key, cd in (('land use', 'landuse', 'lu'), ('water', 'water', 'water'), ('infrastructure shapes', 'infra', 'infra')):
    for i, a in enumerate(d[key]):
        closed = 'p' in a; f = [fr(q) for q in dec(a['p'] if closed else a['l'])]; cls = DI[cd][a['c']]
        mid = (sum(q[0] for q in f) / len(f), sum(q[1] for q in f) / len(f)) if closed else f[len(f) // 2]
        F.append((layer, i, f'{key} {i} {cls}', f, Polygon(f) if closed else LineString(f), (cls if cd == 'infra' else cd, closed), mid))
ip = d['infra_pts']
for j in range(0, len(ip), 3):
    cls = DI['infra'][ip[j]]; q = fr((ip[j + 1] / 10, ip[j + 2] / 10))
    F.append(('infrastructure points', j // 3, f'pt {j // 3} {cls}', [q], Point(q), cls, q))

rows, near = defaultdict(Counter), {}
tri, bat, by = Counter(), defaultdict(set), Counter()
for layer, i, lab, f, geom, rec, mid in F:
    nr = geom.intersects(REGION); near[(layer, i)] = nr
    rows[layer].update({'all': 1, 'mid': in_earlier(mid), 'vertex': any(in_earlier(q) for q in f), 'earlier': geom.intersects(EARLIER), 'near': nr})
    for mode in (('near',) if nr else ('full', 'simple')):
        t, b = cost(layer, rec, f, mode); tri[mode] += t; bat[mode] |= b
        if nr: by['markings' if 'markings' in b else 'props' if layer == 'infrastructure points' else 'rest'] += t
        elif mode == 'simple' and layer == 'infrastructure points': by['far props'] += t
def far_m(f): return min(math.dist(q, CENTRE) for q in f)

print(f'{SLICE}\nGlazed sectors within {R:.0f} m of frame {CENTRE}. Left out: dropSegs {sorted(DROP_SEGS)}; building {HOST_BLD} (the venue).\n')
print(f"{'':24} {'':>5}  {'earlier sectors (u <= 7 or v <= 0)':^36}  {'glazed sectors':>14}")
print(f"{'layer':24} {'all':>5}  {'middle pt':>10} {'any vertex':>11} {'any part':>11}  {'any part':>14}")
for layer, c in rows.items(): print(f"{layer:24} {c['all']:5}  {c['mid']:10} {c['vertex']:11} {c['earlier']:11}  {c['near']:14}")
print('\nNear streets (nearest vertex from frame (18, 8)):')
for layer, i, lab, f, geom, rec, mid in F:
    if layer == 'streets' and near[(layer, i)]: print(f"  {lab}: {far_m(f):.0f} m{'' if in_earlier(mid) else '  (not near by middle point)'}")
print('Near buildings: ' + ', '.join(f'{lab} ({far_m(f):.0f} m)' for layer, i, lab, f, g, r, m in F if layer == 'buildings' and near[(layer, i)]))
for layer in ('infrastructure shapes', 'infrastructure points'):
    c = Counter(lab.split(' ', 2)[2] for ly, i, lab, *_ in F if ly == layer and near[(ly, i)])
    print(f'Near {layer}: ' + ', '.join(f'{k} {v}' for k, v in sorted(c.items())))
print('Land use and water near: ' + (', '.join(lab for ly, i, lab, *_ in F if ly in ('land use', 'water') and near[(ly, i)]) or 'none'))
print('\nNamed in the plan:')
for ly, i, lab, f, geom, rec, mid in F:
    named = (ly == 'streets' and (i in (391, 135, 355) or (rec.get('r') == 'I-5' or DI['seg'][rec['c']] == 'motorway') and near[(ly, i)])) \
        or (ly == 'infrastructure shapes' and rec[0] in ('power:substation', 'bridge:bridge') and rec[1]) \
        or (ly == 'infrastructure points' and rec == 'power:power_pole' and abs(f[0][0] * A[0] + f[0][1] * B[0] + O[0] + 6605) < 4
            and -9470 < f[0][0] * A[1] + f[0][1] * B[1] + O[1] < -9300)
    if named: print(f"  {lab}{f' ({geom.area:,.0f} m2)' if isinstance(geom, Polygon) else ''}: {'near' if near[(ly, i)] else 'far'}, {far_m(f):.0f} m")
moto = [(i, far_m(f)) for ly, i, lab, f, g, rec, m in F if ly == 'streets' and DI['seg'][rec['c']] == 'motorway' and 's' not in rec]
print('  I-5 carriageways (motorway, not links), nearest first: ' + ', '.join(f"seg {i} {'near' if near[('streets', i)] else 'far'} ({m:.0f} m)" for i, m in sorted(moto, key=lambda x: x[1])[:4]))
print(f"\nEstimated triangles (cost model, not measured): near {tri['near']:,} in {len(bat['near'])} batches "
      f"(markings {by['markings']:,}, point props {by['props']:,}, the rest {by['rest']:,}); "
      f"far {tri['full']:,} in full ({len(bat['full'])} batches), {tri['simple']:,} simple ({len(bat['simple'])} batches; "
      f"its poles, towers, signals and lamps {by['far props']:,}).")
print(f"Near batches: {', '.join(sorted(bat['near']))}. Far simple: {', '.join(sorted(bat['simple']))}.")

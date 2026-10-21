"""The sports bar's street sets and street trees (PROJECT_OC_SPORTS_BAR.md, "Inside, outside and overhead").

    python3 tools/anaheim/sportsbar_sets.py            # from the game folder (top-speed-ultra/)

Re-runs the plan's count against src/data/anaheim/sportsbar-slice.json. Two sets, both drawn in every state (inside,
outside, overhead), so nothing in them can appear or vanish at a door:
- the near set, drawn in detail: every feature, on every layer (buildings, street pieces, land use, water,
  infrastructure shapes and points), with any part inside the glazed sectors within 210 m of frame (18, 8). The glazed
  sectors are the two half-planes outside the glazed walls: beyond the line of the front wall's outer face, (0, 0) to
  (6.4, 16.5), where -0.932 u + 0.362 v >= 0, or beyond the line of the arm's south wall, (0, 0) to (75.2, 0.9), where
  v <= 0.012 u. Any ray from inside the unit through its glazing ends in them.
- the far set, the rest of the slice, drawn simple at Low and HD (the cheap set) and in full at Ultra. Its split into
  the part in the glazed sectors ("view") and the part wholly outside them ("behind") is printed for the plan's
  fallback (hide "behind" from inside).
Building 61 (the venue's host, in the venue's own row) and the pieces in site.dropSegs are in neither set. The land
cover (two 'urban' pieces over the whole box) isn't drawn, as at Lot 57.

The triangles are an ESTIMATE, not a measurement: a cost model of engine/streets.ts drawing as Lot 57's data.ts does,
from its Batch primitives (ribbon 2 per edge, slab 6, walls 2, cap n - 2, cyl 4 per segment with caps), plus our own
small props for the point features. Three detail levels: the near set (with road markings, as Lot 57 marks its near
box), the far set in full (Ultra) and the far set simple (Low and HD: buildings as plain walls and roofs, flat
sidewalks, no markings or crosswalk paint, fences without posts, and of the point props only the poles, towers,
signals and lamps). The simple set is drawn untextured in vertex colour, so its batches merge into four: opaque, the
lamp heads (glow), the chain-link and the wires. Also places our own street trees by the plan's rule and checks
them. S1 measures the real figures with breakdown().
"""
import json, math, os, sys
from collections import Counter, defaultdict
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
SLICE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../src/data/anaheim/sportsbar-slice.json')
O, A, B = (-6616.5, -9333.8), (-0.9098, -0.4151), (0.4151, -0.9098)    # the plan's building frame
CENTRE, R, DROP_SEGS, HOST_BLD = (18.0, 8.0), 210.0, {416}, 61
DISC = Point(CENTRE).buffer(R, quad_segs=64)
S, N = (0.362, 0.932), (-0.932, 0.362)                                 # along the front wall, and out of it
FRONT = Polygon([(-1e4 * S[0], -1e4 * S[1]), (1e4 * S[0], 1e4 * S[1]), (1e4 * (S[0] + N[0]), 1e4 * (S[1] + N[1])),
                 (1e4 * (N[0] - S[0]), 1e4 * (N[1] - S[1]))])
SOUTH = Polygon([(-1e4, -120), (1e4, 120), (1e4, -1e4), (-1e4, -1e4)])
SECT = unary_union([FRONT, SOUTH]); REGION = DISC.intersection(SECT)
C = Point(CENTRE)

d = json.load(open(SLICE)); DI = d['dict']
def dec(p):
    x = z = 0; out = []
    for i in range(0, len(p), 2): x += p[i]; z += p[i + 1]; out.append((x / 10, z / 10))
    return out
def fr(g): return ((g[0] - O[0]) * A[0] + (g[1] - O[1]) * A[1], (g[0] - O[0]) * B[0] + (g[1] - O[1]) * B[1])
def length(pts): return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
def frac(flag): return 0.0 if not flag else 1.0 if flag == 1 else sum(b - a for a, b in flag)
def seg_cls(s): return DI['seg'][s['c']] if isinstance(s['c'], int) else s['c']

DRIVE = {'motorway', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'track'}
LOWRISE_NOT = {'stadium', 'house', 'apartments', 'hotel', 'residential', 'terrace', 'church', 'cathedral', 'hospital',
               'university', 'roof', 'parking'}
PT = {'power:power_pole': 36, 'power:power_tower': 56, 'transportation:street_lamp': 50, 'transportation:traffic_signals': 68,
      'transportation:stop': 22, 'transit:bus_stop': 22, 'emergency:fire_hydrant': 24, 'pedestrian:bench': 36,
      'waste_management:waste_basket': 24, 'transit:bicycle_parking': 24, 'pedestrian:vending_machine': 12,
      'power:transformer': 12, 'power:portal': 24, 'barrier:gate': 12, 'barrier:lift_gate': 12, 'barrier:barrier': 12,
      'barrier:toll_booth': 12}
PT_SIMPLE = {'power:power_pole', 'power:power_tower', 'transportation:street_lamp', 'transportation:traffic_signals'}
MERGE = {'lamp-heads': 'far-glow', 'chain': 'chain', 'wires': 'wires'}   # simple mode: everything else is 'far'

def cost(layer, rec, pts, mode):
    """(triangles, batch names) for one feature at one detail level: 'near', 'full' or 'simple'."""
    E, L = len(pts) - 1, length(pts)
    if layer == 'streets':
        cls = seg_cls(rec); sub = DI['sub'][rec['s']] if 's' in rec else ''
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

F = []                                # (layer, index, label, frame points, geometry, rec)
for i, s in enumerate(d['seg']):
    if i in DROP_SEGS: continue
    f = [fr(q) for q in dec(s['p'])]
    lab = f"seg {i} {seg_cls(s)}{'/' + DI['sub'][s['s']] if 's' in s else ''}{' ' + DI['name'][s['n']] if 'n' in s else ''}"
    F.append(('streets', i, lab, f, LineString(f), s))
for i, b in enumerate(d['bld']):
    if i == HOST_BLD: continue
    f = [fr(q) for q in dec(b['p'])]
    F.append(('buildings', i, f'bld {i}', f, Polygon(f, [[fr(q) for q in dec(h)] for h in b.get('hl', [])]), b))
for layer, key, cd in (('land use', 'landuse', 'lu'), ('water', 'water', 'water'), ('infrastructure shapes', 'infra', 'infra')):
    for i, a in enumerate(d[key]):
        closed = 'p' in a; f = [fr(q) for q in dec(a['p'] if closed else a['l'])]; cls = DI[cd][a['c']]
        F.append((layer, i, f'{key} {i} {cls}', f, Polygon(f) if closed else LineString(f), (cls if cd == 'infra' else cd, closed)))
ip = d['infra_pts']
for j in range(0, len(ip), 3):
    cls = DI['infra'][ip[j]]; q = fr((ip[j + 1] / 10, ip[j + 2] / 10))
    F.append(('infrastructure points', j // 3, f'pt {j // 3} {cls}', [q], Point(q), cls))

which, rows = {}, defaultdict(Counter)                 # set per feature: 'near', 'view' (far, in sectors), 'behind'
tri, bat, by = Counter(), defaultdict(set), Counter()
for layer, i, lab, f, geom, rec in F:
    w = 'near' if geom.intersects(REGION) else 'view' if geom.intersects(SECT) else 'behind'
    which[(layer, i)] = w; rows[layer].update({'all': 1, w: 1})
    for mode in (('near',) if w == 'near' else ('full', 'simple')):
        t, b = cost(layer, rec, f, mode); tri[mode] += t; bat[mode] |= b
        if w == 'behind': tri['behind ' + mode] += t
        if mode == 'simple': bat['merged'] |= {MERGE.get(x, 'far') for x in b}
        if w == 'near': by['markings' if 'markings' in b else 'props' if layer == 'infrastructure points' else 'rest'] += t
        elif mode == 'simple' and layer == 'infrastructure points': by['far props'] += t

print(f'{SLICE}\nNear set: any part in the glazed sectors within {R:.0f} m of frame {CENTRE}. '
      f'Left out: dropSegs {sorted(DROP_SEGS)}; building {HOST_BLD} (the venue).\n')
print(f"{'layer':24} {'all':>5} {'near':>6} {'far':>6}  (far in the sectors / wholly behind)")
for layer, c in rows.items(): print(f"{layer:24} {c['all']:5} {c['near']:6} {c['view'] + c['behind']:6}  ({c['view']} / {c['behind']})")
print('Near buildings: ' + ', '.join(f'{lab} ({g.distance(C):.0f} m)' for ly, i, lab, f, g, r in F if ly == 'buildings' and which[(ly, i)] == 'near'))
for layer in ('infrastructure shapes', 'infrastructure points'):
    c = Counter(lab.split(' ', 2)[2] for ly, i, lab, *_ in F if ly == layer and which[(ly, i)] == 'near')
    print(f'Near {layer}: ' + ', '.join(f'{k} {v}' for k, v in sorted(c.items())))
print('Land use and water near: ' + (', '.join(lab for ly, i, lab, *_ in F if ly in ('land use', 'water') and which[(ly, i)] == 'near') or 'none'))

seg = {i: (f, g, r) for ly, i, lab, f, g, r in F if ly == 'streets'}
def at(i): return which[('streets', i)]
print('\nNamed in the plan (set, nearest point from frame (18, 8)):')
NAMED = {'I-5 northbound carriageway': [560, 362], 'I-5 southbound carriageway': [222, 358, 438],
         'East Katella Avenue': [135, 136, 355, 423, 426], 'Anaheim Way': [137, 412, 420, 421, 427],
         'South Claudina Way': [391, 411, 417], 'the railway': [141]}
for name, ids in NAMED.items():
    chain = all(seg[a][2]['k'][-1] == seg[b][2]['k'][1] for a, b in zip(ids, ids[1:])) if 'I-5' in name else None
    print(f"  {name}: " + ', '.join(f'{i} {at(i)} ({seg[i][1].distance(C):.0f} m)' for i in ids)
          + ('' if chain is None else f"; one-way, {'one chain end to end' if chain else 'NOT one chain'}"))
for ly, i, lab, f, g, r in F:
    if (ly == 'buildings' and i in (24, 26, 411)) or (ly == 'infrastructure shapes' and i in (92, 167)):
        h = f", {r['h']:.1f} m tall" if ly == 'buildings' and 'h' in r else ''
        print(f"  {lab}{h}: {which[(ly, i)]} ({g.distance(C):.0f} m)")
moto = [i for i in seg if seg_cls(seg[i][2]) == 'motorway' and 's' not in seg[i][2]]
print('  Every I-5 carriageway piece (motorway, not a link) within 400 m: ' + ', '.join(
    f'{i} {at(i)}' for i in sorted(moto, key=lambda i: seg[i][1].distance(C)) if seg[i][1].distance(C) < 400))
streams = NAMED['I-5 northbound carriageway'] + NAMED['I-5 southbound carriageway']
print(f"  The light streams run on {streams}: {sum(seg[i][1].length for i in streams):,.0f} m of carriageway, "
      f"every piece {'near' if all(at(i) == 'near' for i in streams) else 'NOT all near'}, out to "
      f"{max(math.dist(q, CENTRE) for i in streams for q in seg[i][0]):.0f} m.")

print(f"\nEstimated triangles (cost model, not measured): near {tri['near']:,} in {len(bat['near'])} batches "
      f"(markings {by['markings']:,}, point props {by['props']:,}, the rest {by['rest']:,}); "
      f"far {tri['full']:,} in full ({len(bat['full'])} batches), {tri['simple']:,} simple "
      f"({len(bat['simple'])} batches by material, {len(bat['merged'])} merged: {', '.join(sorted(bat['merged']))}; "
      f"its poles, towers, signals and lamps {by['far props']:,}). Of the far set, wholly behind the glazed sectors: "
      f"{tri['behind simple']:,} simple, {tri['behind full']:,} full.")
print(f"Near batches: {', '.join(sorted(bat['near']))}.")

# ------------------------------------------------------------------ our street trees (ours: nothing is mapped)
ROAD_W = {'primary': (12, 24), 'secondary': (11.5, 30), 'tertiary': (14, 14), 'residential': (11, 11),
          'unclassified': (11, 11), 'service': (6, 6), 'motorway': (14, 14)}          # Lot 57's data.ts widths; motorway ours
def dfr(du, ds): return (du * N[0] + ds * S[0], du * N[1] + ds * S[1])      # front-wall frame: d out, s along
aisle = [fr(q) for q in dec(d['seg'][416]['p'])[:4]] + [fr(q) for q in ((-6613.4, -9324.8), (-6611.6, -9327.3),
         (-6610.7, -9330.5), (-6609.2, -9357.2), (-6613.2, -9374.9))]          # aisle 416 as we draw it, 4.5 m
ribbons = [LineString(aisle).buffer(2.25)]
for i, (f, g, r) in seg.items():
    cls = seg_cls(r); w = ROAD_W.get(cls)
    if w and 's' not in r or (w and DI['sub'][r['s']] in ('driveway', 'parking_aisle')):
        ribbons.append(g.buffer((w[0] if r.get('ow') else w[1]) / 2))
roads = unary_union(ribbons)
poles = [Point(f[0]) for ly, i, lab, f, g, r in F if ly == 'infrastructure points' and r == 'power:power_pole']
host = Polygon([fr(q) for q in dec(d['bld'][HOST_BLD]['p'])]); patio = box(2.0, -5.5, 24.0, 0.0)
cands = [('palm', dfr(10.1, s)) for s in range(-6, 25, 6)] + [('shade tree', (u, -19.0)) for u in range(-2, 23, 6)]
trees, dropped = [], []
for kind, q in cands:
    p = Point(q); why = []
    if p.distance(roads) < 1.0: why.append(f'{p.distance(roads):.1f} m from a road or aisle edge')
    if min(p.distance(x) for x in poles) < 1.5: why.append('by a power pole')
    if p.distance(host) < 1.0 or p.distance(patio) < 1.0: why.append('by the building or patio')
    if not REGION.contains(p): why.append('outside the near set')
    (dropped if why else trees).append((kind, q, why))
k = Counter(t[0] for t in trees)
print(f"\nStreet trees: {len(trees)} ({', '.join(f'{v} {n}s' for n, v in sorted(k.items()))}), all in the near set; "
      f"dropped {len(dropped)}: " + '; '.join(f"{n} at ({q[0]:.1f}, {q[1]:.1f}): {', '.join(w)}" for n, q, w in dropped))
print('  at ' + ', '.join(f'{n} ({q[0]:.1f}, {q[1]:.1f})' for n, q, w in trees))
TREE = {'palm': (222 + 108, 382 + 108), 'shade tree': (400 + 28, 1600 + 28)}   # crown + trunk: Low, HD and Ultra
print('  triangles: Low {:,}, HD and Ultra {:,}, in up to 4 instanced meshes'.format(
    sum(TREE[n][0] for n, q, w in trees), sum(TREE[n][1] for n, q, w in trees)))

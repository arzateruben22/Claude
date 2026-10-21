"""The sports bar's interior and patio layout against building 61 (PROJECT_OC_SPORTS_BAR.md, "Inside").

    python3 tools/anaheim/sportsbar_zones.py           # from the game folder (top-speed-ultra/)

1. Overlaps, the way S1's checks will test them: every zone lies inside the walls' inner faces (the footprint shrunk
   0.25 m, cut at the party wall's face, u 35.8), or inside the patio's fence; no two zones overlap; no two slots
   overlap, nor a slot and a zone that isn't its own. Seats are circles of radius 0.45 m; standing, staff and player
   spots radius 0.3 m (Lot 57's RADIUS as measured). Seats that one piece of furniture spaces are exempt from each other:
   the booth run's seats, one high-top's four stools, one patio table's four seats. Touching is allowed; overlapping
   by more than 1 mm isn't.
2. Walking, on a model of Lot 57's walk grid as measured (L12: world-aligned 0.5 m cells, so 24.5 degrees off the
   frame; a cell is in the region when its centre is; a cell is free when it and its four neighbours are in the region
   and its centre is 0.32 m (RADIUS + 0.02) from every wall and collider; 8-connected with no corner cutting), at 25
   grid offsets. The region is painted as S1 paints it: over the walls and the patio fence, to 0.5 m past their inner
   faces (they're colliders, so the four-neighbour rule never binds beside them), less the bartenders' lane and the
   staff flap. From just inside the front door, every seat's and spot's stand point has a reachable free cell within
   0.6 m and the staff hand-off point H is reached. A second fill puts the lane and the flap back in the region, so
   only the colliders close them: no reached cell lies in either. The colliders are our furniture sizes, listed below.
3. The bartenders' lane path (staff only, off the walk grid): the 0.3 m body along it clears every collider.
The standing floor's 20 spots and the pool and darts watchers aren't modelled. The layout below is copied from the
plan by hand: change both together.
"""
import itertools, json, math, os, sys
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
SLICE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../src/data/anaheim/sportsbar-slice.json')
O, A, B = (-6616.5, -9333.8), (-0.9098, -0.4151), (0.4151, -0.9098)
d = json.load(open(SLICE))
x = z = 0; ring = []
for i in range(0, len(d['bld'][61]['p']), 2):
    x += d['bld'][61]['p'][i]; z += d['bld'][61]['p'][i + 1]
    g = (x / 10 - O[0], z / 10 - O[1]); ring.append((g[0] * A[0] + g[1] * A[1], g[0] * B[0] + g[1] * B[1]))
HOST = Polygon(ring)
INNER = HOST.buffer(-0.25, join_style=2).intersection(box(-5, -5, 35.8, 30))
PATIO = box(2.05, -5.45, 23.95, 1.0).difference(HOST)          # inside the fence, outside the building
SEAT, STAND = 0.45, 0.3
def front_u(v, d_in):                 # a point d_in metres in from the front wall's inner face, at frame v
    v0 = v + 0.362 * d_in; return 0.388 * v0 + 0.27 + 0.932 * d_in

ZONES = {                             # name: (u0, u1, v0, v1)
    'darts': (7.6, 12.6, 11.5, 15.8), 'pool': (8.9, 17.4, 4.3, 9.5), 'shuffleboard': (3.2, 9.9, 1.15, 1.75),
    'bar': (14.0, 27.6, 13.3, 15.8), 'restrooms': (27.6, 31.0, 11.6, 15.8), 'kitchen': (31.0, 35.8, 9.0, 15.8),
    'tv wall': (35.6, 35.8, 0.8, 9.0), 'standing floor': (31.5, 35.5, 0.8, 8.6), 'booths': (20.5, 31.3, 0.75, 2.35),
    'high-tops': (19.5, 31.0, 3.0, 10.0), 'water station': (29.0, 29.6, 11.2, 11.6), 'host stand': (6.5, 7.1, 7.95, 8.45),
}
TABLES = [4.2, 7.1, 10.0, 12.9, 15.8, 20.95]                  # the patio's six bench tables, centred at v -1.3
PZONES = {'patio rail': (3.0, 9.5, -5.45, -5.15), 'patio door': (18.0, 19.8, -1.5, 0.0),
          'heater 1': (12.6, 13.2, -4.25, -3.65), 'heater 2': (20.65, 21.25, -4.25, -3.65),
          'planter 1': (2.1, 2.9, -5.4, -4.4), 'planter 2': (9.9, 11.7, -5.45, -4.95),
          'planter 3': (14.1, 15.9, -5.45, -4.95), 'planter 4': (22.0, 23.9, -5.45, -4.95),
          **{f'patio table {k + 1}': (u - 0.75, u + 0.75, -2.1, -0.5) for k, u in enumerate(TABLES)}}
SLOTS = []                            # (name, owner zone or None, furniture group or None, u, v, radius, stand point)
for i, u in enumerate(14.6 + 1.05 * k for k in range(9)): SLOTS.append((f'bar stool {i + 1}', 'bar', None, u, 12.85, SEAT, (u, 12.25)))
for i, u in enumerate((13.75, 23.8, 24.45, 25.1)): SLOTS.append((f'bar gap {i + 1}', 'bar', None, u, 12.95, STAND, (u, 12.95)))
SLOTS.append(('server pick-up', 'bar', None, 26.15, 12.95, STAND, (26.15, 12.95)))
for v in (2.9, 3.95, 5.0, 6.05, 10.6, 11.65, 12.7, 13.75):
    SLOTS.append((f'rail stool v {v}', None, None, front_u(v, 0.6), v, SEAT, (front_u(v, 1.2), v)))
for t, (cu, cv) in enumerate([(21.0, 4.6), (24.6, 4.6), (28.2, 4.6), (21.0, 8.6), (24.6, 8.6), (28.2, 8.6)]):
    for du, dv in ((0.7, 0), (-0.7, 0), (0, 0.7), (0, -0.7)):
        SLOTS.append((f'high-top {t + 1}', 'high-tops', f'ht{t}', cu + du, cv + dv, SEAT, (cu + 1.3 * du / 0.7, cv + 1.3 * dv / 0.7)))
for b in range(5):                    # 5 booths 2.15 m apart from u 20.5: a bench each side of the table, 2 seats a bench
    u0 = 20.5 + 2.15 * b
    for side, su in (('east', u0 + 0.35), ('west', u0 + 1.8)):
        for sv in (1.15, 1.95): SLOTS.append((f'booth {b + 1} {side}', 'booths', 'booth run', su, sv, SEAT, (su, 2.85)))
SLOTS += [('shuffleboard thrower', 'shuffleboard', None, 2.7, 1.45, STAND, (2.7, 1.45)),
          ('shuffleboard side 1', 'shuffleboard', None, 5.0, 2.1, STAND, (5.0, 2.1)),
          ('shuffleboard side 2', 'shuffleboard', None, 7.0, 2.1, STAND, (7.0, 2.1)),
          ('water', 'water station', None, 29.3, 10.85, STAND, (29.3, 10.85)),
          ('pass server 1', 'kitchen', None, 30.6, 10.35, STAND, (30.6, 10.35)),
          ('pass server 2', 'kitchen', None, 30.6, 11.0, STAND, (30.6, 11.0)), ('host', 'host stand', None, 6.8, 7.6, STAND, (6.8, 7.6))]
PSLOTS = [(f'patio rail stool {k + 1}', 'patio rail', None, 3.6 + 1.05 * k, -4.75, SEAT, (3.6 + 1.05 * k, -3.95)) for k in range(6)]
for k, u in enumerate(TABLES):        # a bench each side (east and west), two seats a bench; you stand beside the bench
    for su, au in ((u - 0.6, u - 1.3), (u + 0.6, u + 1.3)):
        for sv in (-0.9, -1.7): PSLOTS.append((f'patio table {k + 1}', f'patio table {k + 1}', f'pt{k}', su, sv, SEAT, (au, sv)))

bad = 0
def fail(msg):
    global bad; bad += 1; print('  FAIL', msg)
def check(zones, slots, room, label):
    print(f'{label}: zones inside, then overlaps')
    for n, (u0, u1, v0, v1) in zones.items():
        out = box(u0, v0, u1, v1).difference(room).area
        if out > 1e-4: fail(f'{n}: {out:.3f} m2 outside')
    for (a, ra), (b, rb) in itertools.combinations(zones.items(), 2):
        ov = box(ra[0], ra[2], ra[1], ra[3]).intersection(box(rb[0], rb[2], rb[1], rb[3])).area
        if ov > 1e-4: fail(f'{a} and {b}: {ov:.3f} m2')
    for n, own, grp, u, v, r, _ in slots:
        c = Point(u, v).buffer(r, quad_segs=32)
        if c.difference(room).area > 1e-4: fail(f'{n} at ({u:.2f}, {v:.2f}) leaves the room')
        for zn, (u0, u1, v0, v1) in zones.items():
            if zn != own and c.intersection(box(u0, v0, u1, v1)).area > 1e-4: fail(f'{n} at ({u:.2f}, {v:.2f}) is in {zn}')
    for (n1, o1, g1, u1, v1, r1, _), (n2, o2, g2, u2, v2, r2, _) in itertools.combinations(slots, 2):
        if g1 and g1 == g2: continue
        if math.hypot(u1 - u2, v1 - v2) < r1 + r2 - 1e-3: fail(f'{n1} and {n2}: {math.hypot(u1 - u2, v1 - v2):.3f} m apart')
check(ZONES, SLOTS, INNER, 'Inside')
check(PZONES, PSLOTS, PATIO, 'Patio')

# ------------------------------------------------------------------ the colliders (our furniture sizes)
def bx(u0, u1, v0, v1): return box(u0, v0, u1, v1)
def ci(u, v, r): return Point(u, v).buffer(r, quad_segs=16)
COUNTER = [bx(14.0, 26.8, 13.3, 14.05), bx(14.0, 14.15, 14.05, 15.2), bx(14.0, 27.6, 15.2, 15.8)]   # top, end return, back bar
GATE = bx(26.8, 27.6, 13.25, 13.35)                            # the staff flap's swing gate: blocks guests and the player
SOLID = COUNTER + [GATE, bx(27.6, 31.0, 11.6, 15.8), bx(31.0, 35.8, 9.0, 15.8), bx(29.0, 29.6, 11.2, 11.6),
         bx(7.6, 12.6, 15.75, 16.3), bx(3.2, 9.9, 1.15, 1.75), bx(20.5, 31.3, 0.75, 2.35), bx(6.5, 7.1, 7.95, 8.45),
         bx(35.6, 35.8, 0.8, 9.0), bx(31.65, 32.35, 0.7, 1.2), bx(10.375, 11.625, 5.78, 8.02), bx(14.675, 15.925, 5.78, 8.02)]
SOLID += [ci(14.6 + 1.05 * k, 12.85, 0.2) for k in range(9)]
for cu, cv in [(21.0, 4.6), (24.6, 4.6), (28.2, 4.6), (21.0, 8.6), (24.6, 8.6), (28.2, 8.6)]:
    SOLID += [ci(cu, cv, 0.35)] + [ci(cu + du, cv + dv, 0.2) for du, dv in ((0.7, 0), (-0.7, 0), (0, 0.7), (0, -0.7))]
for v in (2.9, 3.95, 5.0, 6.05, 10.6, 11.65, 12.7, 13.75): SOLID.append(ci(front_u(v, 0.6), v, 0.2))
for v0, v1 in ((2.5, 6.3), (10.0, 15.0)):                      # the window rails' shelves, 0.3 m deep on the glazing
    SOLID.append(Polygon([(front_u(v0, 0), v0), (front_u(v1, 0), v1), (front_u(v1, 0.3), v1), (front_u(v0, 0.3), v0)]))
SOLID += [bx(3.0, 9.5, -5.45, -5.15)] + [ci(3.6 + 1.05 * k, -4.75, 0.2) for k in range(6)]
SOLID += [bx(u - 0.75, u + 0.75, -2.1, -0.5) for u in TABLES] + [ci(12.9, -3.95, 0.3), ci(20.95, -3.95, 0.3)]
SOLID += [box(*(lambda r: (r[0], r[2], r[1], r[3]))(PZONES[p])) for p in PZONES if p.startswith('planter')]
WALK = unary_union([INNER, PATIO, bx(17.95, 19.85, -0.2, 0.8)])   # the room, the patio and the patio door's opening
EDGE, SOLIDS = WALK.boundary, unary_union(SOLID)
LANE = bx(14.15, 27.6, 14.05, 15.2).union(bx(26.8, 27.6, 13.35, 14.05))
H, START = (27.2, 10.9), (5.0, 8.2)

# ------------------------------------------------------------------ the bartenders' lane path (staff only)
TRACK = LineString([(14.6, 14.625), (27.2, 14.625), (27.2, 13.3), H])
body = TRACK.buffer(0.3, quad_segs=16)
hit = [round(body.intersection(s).area, 4) for s in SOLID if s is not GATE and body.intersection(s).area > 1e-4]
print(f"Lane path: {TRACK.length:.1f} m; the 0.3 m body {'clears every collider' if not hit else f'hits {hit}'} "
      f"(least clearance {min(TRACK.distance(s) for s in SOLID if s is not GATE) - 0.3:.2f} m)")
if hit: fail('lane path')
hc = min(EDGE.distance(Point(H)), SOLIDS.distance(Point(H)))
print(f"Hand-off H {H}: {hc:.2f} m clear (0.68 m puts a free cell centre within 0.35 m of it at any grid offset)")
if hc < 0.674: fail('H too tight')

# ------------------------------------------------------------------ the walk grid, at 25 offsets
def world(u, v): return (O[0] + u * A[0] + v * B[0], O[1] + u * A[1] + v * B[1])
def frame(x, z): return ((x - O[0]) * A[0] + (z - O[1]) * A[1], (x - O[0]) * B[0] + (z - O[1]) * B[1])
bu0, bv0, bu1, bv1 = WALK.bounds
xs, zs = zip(*(world(u, v) for u, v in ((bu0, bv0), (bu0, bv1), (bu1, bv0), (bu1, bv1))))
TARGETS = [(n, sp) for n, own, grp, u, v, r, sp in SLOTS + PSLOTS]
PAINT = WALK.buffer(0.5, join_style=2)  # the region over the walls and the fence, 0.5 m past their inner faces (S1)
REGION = PAINT.difference(LANE)        # less the lane and the flap
FOUR = ((1, 0), (-1, 0), (0, 1), (0, -1))
worst, fails = {}, set()
for ox, oz in itertools.product([k * 0.1 for k in range(5)], repeat=2):
    x0, z0 = min(xs) - 1 + ox, min(zs) - 1 + oz
    nx, nz = int((max(xs) - x0) / 0.5) + 2, int((max(zs) - z0) / 0.5) + 2
    def centre(i, j): return frame(x0 + (i + 0.5) * 0.5, z0 + (j + 0.5) * 0.5)
    inpaint = {(i, j) for i in range(nx) for j in range(nz) if PAINT.contains(Point(centre(i, j)))}
    inreg = {c for c in inpaint if REGION.contains(Point(centre(*c)))}
    clear = {c for c in inpaint if WALK.contains(Point(centre(*c))) and EDGE.distance(Point(centre(*c))) >= 0.32
             and SOLIDS.distance(Point(centre(*c))) >= 0.32}       # only the room's cells: the walls and fence are colliders
    def cell(u, v): x, z = world(u, v); return (int((x - x0) // 0.5), int((z - z0) // 0.5))
    for region in (inreg, inpaint):    # as built; then with the lane and flap in the region, closed by colliders only
        free = {(i, j) for (i, j) in clear if (i, j) in region and all((i + a, j + b) in region for a, b in FOUR)}
        seen, todo = set(), [min(free, key=lambda c: math.dist(c, cell(*START)))]
        seen.add(todo[0])
        while todo:
            i, j = todo.pop()
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                q = (i + di, j + dj)
                if q in free and q not in seen and (not (di and dj) or ((i + di, j) in free and (i, j + dj) in free)):
                    seen.add(q); todo.append(q)
        centres = [centre(i, j) for i, j in seen]
        if region is inreg:
            for n, sp in TARGETS + [('H', H)]:
                dmin = min(math.dist(c, sp) for c in centres)
                worst[n] = max(worst.get(n, 0), dmin)
                if dmin > 0.6: fails.add(n)
        elif any(LANE.contains(Point(c)) for c in centres): fails.add('the lane is reachable')
for n in sorted(fails): fail(f'walk grid: {n} (worst {worst.get(n, 0):.2f} m from a reachable cell)')
print(f"Walk grid: {len(TARGETS)} stand points and H reached at all 25 offsets within "
      f"{max(worst.values()):.2f} m; the lane and the flap unreachable" if not fails else 'Walk grid: see failures')

seats = sum(1 for s in SLOTS if s[5] == SEAT); pseats = sum(1 for s in PSLOTS if s[5] == SEAT)
print(f'\nInner area {INNER.area:.1f} m2, the patio inside its fence {PATIO.area:.1f} m2; {len(ZONES)} + {len(PZONES)} zones, '
      f'{len(SLOTS)} + {len(PSLOTS)} slots ({seats} seats inside, {pseats} on the patio); first south rail stool '
      f'({front_u(2.9, 0.6):.2f}, 2.9), {math.hypot(front_u(2.9, 0.6) - 2.7, 2.9 - 1.45):.2f} m from the thrower; '
      f"{'all pass' if not bad else f'{bad} failures'}")

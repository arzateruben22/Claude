"""The sports bar's interior layout against building 61 (PROJECT_OC_SPORTS_BAR.md, "Inside").

    python3 tools/anaheim/sportsbar_zones.py           # from the game folder (top-speed-ultra/)

Checks the plan's "Inside" table the way S1's checks will: every zone lies inside the walls' inner faces (the footprint
shrunk 0.25 m, cut at the party wall's face, u 35.8), no two zones overlap, and no two slots overlap, nor a slot and a
zone that isn't its own. Seats are circles of radius 0.45 m; standing spots, staff spots and the player radius 0.3 m
(Lot 57's RADIUS). Seats that one piece of furniture spaces are exempt from each other: the booth run's seats (each
bench seats two, and neighbouring booths' benches stand back to back on one backrest), one high-top's four stools.
Other slots of one object, such as the bar's stools, standing gaps and pick-up, are not. Touching is allowed;
overlapping by more than 1 mm isn't. The standing floor's 20 spots, the pool and darts watchers and the patio (outside
the building; its clearances are in the plan's "The front") aren't modelled here. The layout below is copied from the
plan by hand: change both together.
"""
import itertools, json, math, os, sys
from shapely.geometry import Point, Polygon, box

HERE = os.path.dirname(os.path.abspath(__file__))
SLICE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../src/data/anaheim/sportsbar-slice.json')
O, A, B = (-6616.5, -9333.8), (-0.9098, -0.4151), (0.4151, -0.9098)
d = json.load(open(SLICE))
x = z = 0; ring = []
for i in range(0, len(d['bld'][61]['p']), 2):
    x += d['bld'][61]['p'][i]; z += d['bld'][61]['p'][i + 1]
    g = (x / 10 - O[0], z / 10 - O[1]); ring.append((g[0] * A[0] + g[1] * A[1], g[0] * B[0] + g[1] * B[1]))
INNER = Polygon(ring).buffer(-0.25, join_style=2).intersection(box(-5, -5, 35.8, 30))
SEAT, STAND = 0.45, 0.3
def front_u(v, d_in):                 # a point d_in metres in from the front wall's inner face, at frame v
    v0 = v + 0.362 * d_in; return 0.388 * v0 + 0.27 + 0.932 * d_in

ZONES = {                             # name: (u0, u1, v0, v1)
    'darts': (7.6, 12.6, 11.5, 15.8), 'pool': (8.9, 17.4, 4.3, 9.5), 'shuffleboard': (3.2, 9.9, 1.15, 1.75),
    'bar': (14.0, 27.0, 13.3, 15.8), 'restrooms': (27.6, 31.0, 11.6, 15.8), 'kitchen': (31.0, 35.8, 9.0, 15.8),
    'tv wall': (35.6, 35.8, 0.8, 9.0), 'standing floor': (31.5, 35.5, 0.8, 8.6), 'booths': (20.5, 31.3, 0.75, 2.35),
    'high-tops': (19.5, 31.0, 3.0, 10.0), 'water station': (29.0, 29.6, 11.2, 11.6), 'host stand': (6.5, 7.1, 7.95, 8.45),
}
SLOTS = []                            # (name, owner zone or None, furniture group or None, u, v, radius)
for i, u in enumerate(14.6 + 1.05 * k for k in range(9)): SLOTS.append((f'bar stool {i + 1}', 'bar', None, u, 12.85, SEAT))
for i, u in enumerate((13.75, 23.8, 24.45, 25.1)): SLOTS.append((f'bar gap {i + 1}', 'bar', None, u, 12.95, STAND))
SLOTS.append(('server pick-up', 'bar', None, 26.15, 12.95, STAND))
for v in (2.9, 3.95, 5.0, 6.05, 10.6, 11.65, 12.7, 13.75): SLOTS.append((f'rail stool v {v}', None, None, front_u(v, 0.6), v, SEAT))
for t, (cu, cv) in enumerate([(21.0, 4.6), (24.6, 4.6), (28.2, 4.6), (21.0, 8.6), (24.6, 8.6), (28.2, 8.6)]):
    for du, dv in ((0.7, 0), (-0.7, 0), (0, 0.7), (0, -0.7)): SLOTS.append((f'high-top {t + 1}', 'high-tops', f'ht{t}', cu + du, cv + dv, SEAT))
for b in range(5):                    # 5 booths 2.15 m apart from u 20.5: a bench each side of the table, 2 seats a bench
    u0 = 20.5 + 2.15 * b
    for side, su in (('east', u0 + 0.35), ('west', u0 + 1.8)):
        for sv in (1.15, 1.95): SLOTS.append((f'booth {b + 1} {side}', 'booths', 'booth run', su, sv, SEAT))
SLOTS += [('shuffleboard thrower', 'shuffleboard', None, 2.7, 1.45, STAND),
          ('shuffleboard side 1', 'shuffleboard', None, 5.0, 2.1, STAND), ('shuffleboard side 2', 'shuffleboard', None, 7.0, 2.1, STAND),
          ('water', 'water station', None, 29.3, 10.85, STAND),
          ('pass server 1', 'kitchen', None, 30.6, 10.35, STAND), ('pass server 2', 'kitchen', None, 30.6, 11.0, STAND),
          ('host', 'host stand', None, 6.8, 7.6, STAND)]

bad = 0
def fail(msg):
    global bad; bad += 1; print('  FAIL', msg)
print('Zones inside the inner faces:')
for n, (u0, u1, v0, v1) in ZONES.items():
    r = box(u0, v0, u1, v1); out = r.difference(INNER).area
    if out > 1e-4: fail(f'{n}: {out:.3f} m2 outside')
    else: print(f'  {n}: {r.boundary.distance(INNER.boundary):.2f} m clear of the walls')
print('Zones overlapping:')
for (a, ra), (b, rb) in itertools.combinations(ZONES.items(), 2):
    ov = box(ra[0], ra[2], ra[1], ra[3]).intersection(box(rb[0], rb[2], rb[1], rb[3])).area
    if ov > 1e-4: fail(f'{a} and {b}: {ov:.3f} m2')
print('Slots inside, clear of other zones and of each other:')
for n, own, grp, u, v, r in SLOTS:
    c = Point(u, v).buffer(r, quad_segs=32)
    if c.difference(INNER).area > 1e-4: fail(f'{n} at ({u:.2f}, {v:.2f}) leaves the room')
    for zn, (u0, u1, v0, v1) in ZONES.items():
        if zn != own and c.intersection(box(u0, v0, u1, v1)).area > 1e-4: fail(f'{n} at ({u:.2f}, {v:.2f}) is in {zn}')
for (n1, o1, g1, u1, v1, r1), (n2, o2, g2, u2, v2, r2) in itertools.combinations(SLOTS, 2):
    if g1 and g1 == g2: continue
    if math.hypot(u1 - u2, v1 - v2) < r1 + r2 - 1e-3: fail(f'{n1} and {n2}: {math.hypot(u1 - u2, v1 - v2):.3f} m apart')
seats = sum(1 for s in SLOTS if s[5] == SEAT)
print(f'\nInner area {INNER.area:.1f} m2; {len(ZONES)} zones, {len(SLOTS)} slots ({seats} seats inside); '
      f'first south rail stool ({front_u(2.9, 0.6):.2f}, 2.9), {math.hypot(front_u(2.9, 0.6) - 2.7, 2.9 - 1.45):.2f} m from the thrower; '
      f"{'all pass' if not bad else f'{bad} failures'}")

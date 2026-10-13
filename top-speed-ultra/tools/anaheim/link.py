# The freeway link: which of the game's freeway exits (src/data/oc-network.json) lead toward the venue, and which
# real streets lead from each ramp terminal to the venue's parking lot. Decodes slice.json the way the game would
# (so it also checks the format), routes over its street graph, and writes src/data/anaheim/freeway-link.json.
import json, math, heapq, os, collections as C
from shapely.geometry import Point, Polygon, LineString
from ana import OUT, jload, slice_box

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
net = jload(os.path.join(ROOT, 'src/data/oc-network.json'))
sl = jload(os.path.join(OUT, 'slice.json'))
X0, Z0, X1, Z1 = sl['box']; VX, VZ = sl['venue']['x'], sl['venue']['z']
dic = sl['dict']

def undelta(a, q=10.0):
    out, x, z = [], 0, 0
    for i in range(0, len(a), 2):
        x += a[i]; z += a[i + 1]; out.append((x / q, z / q))
    return out

# ---------------------------------------------------------------- game paths
paths = []
for rp in net['paths']:
    x = z = y = 0; pts = []
    for j in range(rp['n']):
        x += rp['p'][3 * j]; z += rp['p'][3 * j + 1]; y += rp['p'][3 * j + 2]; pts.append((x / 10, z / 10, y / 10))
    paths.append(pts)
jat = C.defaultdict(list)  # (path, ctrl index) -> other (path, ctrl index)
for j in net['junctions']:
    for a in j:
        for b in j:
            if a != b: jat[tuple(a)].append(tuple(b))
def nxt(pid):
    """link paths that continue from the end of path pid"""
    end = (pid, net['paths'][pid]['n'] - 1)
    return [p for p, ci in jat[end] if ci == 0 and net['paths'][p]['k'] == 'l']
mains = {i: f"{rp['route']} {rp['dir']}" for i, rp in enumerate(net['paths']) if rp['k'] == 'm'}

# ---------------------------------------------------------------- slice street graph
segs = []
for s in sl['seg']:
    pts = undelta(s['p'])
    cls = dic['seg'][s['c']]; sub = dic['sub'][s['s']] if 's' in s else None
    segs.append({'pts': pts, 'cls': cls, 'sub': sub, 'name': dic['name'][s['n']] if 'n' in s else None,
                 'k': list(zip(s.get('k', [])[0::2], s.get('k', [])[1::2])), 'ow': s.get('ow', 0), 'lk': bool(s.get('lk')),
                 'r': s.get('r')})
conn = undelta(sl['conn'])
DRIVE = {'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'living_street', 'trunk'}
G = C.defaultdict(list)  # node -> [(node, cost, metres, seg index)]
# cost per metre: prefer the public arterials a driver would take; lot aisles and driveways only at the ends
W = {'primary': 1.0, 'trunk': 1.0, 'secondary': 1.0, 'tertiary': 1.15, 'unclassified': 1.6, 'residential': 1.8,
     'living_street': 2.5, 'service': 3.0}
def plen(pts, a, b): return sum(math.dist(pts[i], pts[i + 1]) for i in range(a, b))
for si, s in enumerate(segs):
    if s['cls'] not in DRIVE: continue
    ks = sorted(s['k'])
    for (va, ca), (vb, cb) in zip(ks, ks[1:]):
        L = plen(s['pts'], va, vb); cst = L * W[s['cls']]
        if s['ow'] >= 0: G[ca].append((cb, cst, L, si))
        if s['ow'] <= 0: G[cb].append((ca, cst, L, si))

# ramp terminals: connectors shared by a motorway link segment and a non-link street segment
link_conns = C.defaultdict(set); street_conns = C.defaultdict(set)
for si, s in enumerate(segs):
    for v, c in s['k']:
        if s['cls'] == 'motorway' and (s['lk'] or s['sub'] == 'link'): link_conns[c].add(si)
        elif s['cls'] in DRIVE: street_conns[c].add(si)
terminals = [c for c in link_conns if c in street_conns]

# ---------------------------------------------------------------- the venue building and lot
bld_at, lot_i = sl['venue']['bld'], sl['venue']['lot']
lot_poly = Polygon(undelta(sl['infra'][lot_i]['p']))
lot_d = lot_poly.distance(Point(VX, VZ))
# destination nodes: connectors of parking aisles inside (or within 5 m of) that lot
dest = {c for s in segs if s['sub'] == 'parking_aisle' for v, c in s['k'] if lot_poly.buffer(5).contains(Point(conn[c]))}
if not dest:  # fall back to any drivable connector inside the lot
    dest = {c for c in G if lot_poly.buffer(5).contains(Point(conn[c]))}

def route(src):
    D = {src: 0.0}; M = {src: 0.0}; prev = {}; pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u in dest:
            chain, n = [], u
            while n in prev: n, si = prev[n]; chain.append(si)
            return M[u], u, chain[::-1], prev
        if d > D.get(u, 1e18): continue
        for v, cst, L, si in G[u]:
            if d + cst < D.get(v, 1e18): D[v] = d + cst; M[v] = M[u] + L; prev[v] = (u, si); heapq.heappush(pq, (d + cst, v))
    return None

# ---------------------------------------------------------------- exits from the game network
exits = []
for s in net['signs']:
    if s['p'] not in mains: continue
    rp = paths[s['p']]
    x, z, _ = rp[s['i']]
    if not (X0 - 1500 <= x <= X1 + 1500 and Z0 - 1500 <= z <= Z1 + 1500): continue
    chain = [s['ramp']]
    for _ in range(4):
        n = nxt(chain[-1])
        if not n: break
        chain.append(n[0])
    # ramp terminal: the street connector closest to the chain's centreline
    line = LineString([(p[0], p[1]) for pid in chain for p in paths[pid]])
    best = min(terminals, key=lambda c: line.distance(Point(conn[c])), default=None)
    if best is None or line.distance(Point(conn[best])) > 40: continue
    tdist = line.distance(Point(conn[best]))
    streets = sorted({segs[si]['name'] for si in street_conns[best] if segs[si]['name']})
    r = route(best)
    e = {'main_path': s['p'], 'freeway': mains[s['p']], 'sign': s['text'], 'ramp_paths': chain,
         'terminal': {'x': round(conn[best][0], 1), 'z': round(conn[best][1], 1), 'streets': streets,
                      'metres_from_ramp_centreline': round(tdist, 1),
                      'ramp_s_m': round(LineString([(p[0], p[1]) for p in paths[chain[0]]]).project(Point(conn[best])), 1)}}
    if r:
        d, u, chain_si, _ = r
        names = []
        for si in chain_si:
            nm = segs[si]['name'] or (f"({segs[si]['sub'] or segs[si]['cls']})")
            if not names or names[-1] != nm: names.append(nm)
        # the route as a polyline (decimetres, delta-coded) for a guidance line
        pts = []
        n = u; prev = r[3]; nodes = [u]
        while n in prev: n = prev[n][0]; nodes.append(n)
        nodes = nodes[::-1]
        for a, b, si in zip(nodes, nodes[1:], chain_si):
            ks = dict((c, v) for v, c in segs[si]['k'])
            va, vb = ks[a], ks[b]
            seg_pts = segs[si]['pts'][min(va, vb):max(va, vb) + 1]
            if va > vb: seg_pts = seg_pts[::-1]
            pts += seg_pts if not pts else seg_pts[1:]
        flat, px, pz = [], 0, 0
        for x, z in pts:
            qx, qz = round(x * 10), round(z * 10); flat += [qx - px, qz - pz]; px, pz = qx, qz
        e['route'] = {'metres': round(d), 'streets': names, 'p': flat}
        e['straight_line_m_terminal_to_venue'] = round(math.dist(conn[best], (VX, VZ)))
    exits.append(e)
exits.sort(key=lambda e: e.get('route', {}).get('metres', 1e9))
out = {
    'v': 1,
    'what': 'Game freeway exits near the venue (path ids are indices into src/data/oc-network.json paths) and the real '
            'streets from each ramp terminal to the venue lot. Routes obey one-way tags; drivable classes only.',
    'attribution': sl['attribution'],
    'venue': {'x': VX, 'z': VZ, 'bld': bld_at, 'lot_infra': lot_i, 'lot_metres_from_venue': round(lot_d, 1),
              'lot_area_m2': round(lot_poly.area)},
    'exits': exits,
}
with open(os.path.join(OUT, 'freeway-link.json'), 'w') as f: json.dump(out, f, separators=(',', ':'))
for e in exits:
    print(e['freeway'], e['main_path'], e['sign'], 'ramps', e['ramp_paths'], 'terminal', e['terminal']['streets'],
          e['terminal']['metres_from_ramp_centreline'], '->', e.get('route', {}).get('metres'), e.get('route', {}).get('streets'))
print('venue bld', bld_at, 'lot', lot_i, round(lot_d, 1), 'm', round(lot_poly.area), 'm2', 'terminals', len(terminals), 'dest nodes', len(dest))

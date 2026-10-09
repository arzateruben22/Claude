# Builds the game's Orange County freeway network from Overture Maps transportation data (derived from
# OpenStreetMap, ODbL) and AWS Terrain Tiles (USGS NED and others). Output: one JSON file the game imports.
import sys, os, json, math, base64, gzip, collections, heapq
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter, gaussian_filter1d, map_coordinates, maximum_filter1d
from PIL import Image
import shapely
from shapely.geometry import LineString
from shapely.strtree import STRtree
from common import ROUTES, proj, unproj, LAT0, LON0, KX, KZ
from graph import build as build_graph

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DATA, 'oc-network.json')
W = 3.66
LANES = {'I-5': 5, 'I-405': 5, 'SR-91': 5, 'SR-55': 4, 'SR-57': 4, 'SR-22': 4, 'SR-73': 3, 'SR-133': 2, 'SR-241': 2, 'SR-261': 2}
EW = {'SR-91', 'SR-22'}
NAMES = {'I-5': 'Santa Ana Freeway', 'I-405': 'San Diego Freeway', 'SR-91': 'Riverside Freeway', 'SR-55': 'Costa Mesa Freeway',
         'SR-57': 'Orange Freeway', 'SR-22': 'Garden Grove Freeway', 'SR-73': 'San Joaquin Hills Toll Road', 'SR-133': 'Laguna Freeway',
         'SR-241': 'Foothill Toll Road', 'SR-261': 'Eastern Toll Road'}
STEP = 2.0

def log(*a): print(*a, flush=True)

# ------------------------------------------------------------------------------------------------ elevation
class DEM:
    Z = 13
    def __init__(self):
        fs = os.listdir(DATA + '/dem13')
        xs = sorted({int(f.split('_')[0]) for f in fs}); ys = sorted({int(f.split('_')[1][:-4]) for f in fs})
        self.tx0, self.ty0 = xs[0], ys[0]
        H = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
        for x in xs:
            for y in ys:
                a = np.asarray(Image.open(f"{DATA}/dem13/{x}_{y}.png").convert('RGB'), np.float32)
                H[(y - ys[0]) * 256:(y - ys[0] + 1) * 256, (x - xs[0]) * 256:(x - xs[0] + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        self.raw = H
        self.sm = gaussian_filter(H, 1.2)
    def px(self, x, z):
        lon, lat = unproj(np.asarray(x), np.asarray(z))
        n = 2 ** self.Z
        fx = (lon + 180) / 360 * n
        r = np.radians(lat)
        fy = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * n
        return (fx - self.tx0) * 256 - 0.5, (fy - self.ty0) * 256 - 0.5
    def at(self, x, z, smooth=True):
        u, v = self.px(x, z)
        return map_coordinates(self.sm if smooth else self.raw, [np.atleast_1d(v), np.atleast_1d(u)], order=1, mode='nearest')

# ------------------------------------------------------------------------------------------------ polylines
def resample(pts, step=STEP):
    p = np.asarray(pts, float)
    keep = np.concatenate([[True], np.hypot(*np.diff(p, axis=0).T) > 1e-6])
    p = p[keep]
    cum = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    n = max(2, int(round(cum[-1] / step)) + 1)
    t = np.linspace(0, cum[-1], n)
    return np.stack([np.interp(t, cum, p[:, 0]), np.interp(t, cum, p[:, 1])], 1), t

def smooth_line(p, win):
    """moving average that keeps both ends fixed"""
    if len(p) < 5 or win < 3: return p.copy()
    win = min(win, len(p) - (1 - len(p) % 2))
    if win % 2 == 0: win -= 1
    if win < 3: return p.copy()
    h = win // 2
    # odd reflection about the ends keeps the endpoints and their tangents
    pad = np.concatenate([2 * p[0] - p[h:0:-1], p, 2 * p[-1] - p[-2:-h - 2:-1]])
    k = np.ones(win) / win
    out = np.stack([np.convolve(pad[:, 0], k, 'valid'), np.convolve(pad[:, 1], k, 'valid')], 1)
    out[0], out[-1] = p[0], p[-1]
    return out

def arclen(p): return np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])

def headings(p):
    d = np.gradient(p, axis=0)
    return np.arctan2(d[:, 0], d[:, 1])           # h with t = (sin h, cos h)

def dp_keep(p, tol, forced):
    """Douglas-Peucker on a dense polyline; returns kept indices (forced ones always kept)"""
    n = len(p); keep = np.zeros(n, bool); keep[0] = keep[-1] = True
    for f in forced: keep[f] = True
    idx = np.where(keep)[0]
    stack = [(idx[i], idx[i + 1]) for i in range(len(idx) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2: continue
        A, B = p[a], p[b]; seg = p[a + 1:b] - A; ab = B - A; L = np.hypot(*ab)
        if L < 1e-9: d = np.hypot(seg[:, 0], seg[:, 1])
        else: d = np.abs(seg[:, 0] * ab[1] - seg[:, 1] * ab[0]) / L
        i = int(np.argmax(d))
        # also cap the spacing so the in-game spline stays faithful
        if d[i] > tol or (b - a) * STEP > 120:
            m = a + 1 + i if d[i] > tol else (a + b) // 2
            keep[m] = True; stack += [(a, m), (m, b)]
    return np.where(keep)[0]

# ------------------------------------------------------------------------------------------------ network
def main():
    G, raw = build_graph()
    log('graph', G.number_of_nodes(), G.number_of_edges())
    on_main = collections.defaultdict(list)

    # --- main carriageways: the longest chain per route and direction
    mains = []
    import networkx as nx
    for R in ROUTES:
        H = nx.DiGraph()
        for u, v, k, e in G.edges(keys=True, data=True):
            if e['cls'] == 'motorway' and e['sub'] is None and R in e['refs']:
                if H.has_edge(u, v) and H.edges[u, v]['len'] <= e['len']: continue
                H.add_edge(u, v, len=e['len'], key=k)
        comps = sorted(nx.weakly_connected_components(H), key=lambda c: -sum(H.edges[u, v]['len'] for u, v in H.subgraph(c).edges))[:2]
        cs = []
        for c in comps:
            S = H.subgraph(c)
            path = nx.dag_longest_path(S, weight='len')
            cs.append({'nodes': path, 'edges': [(u, v, S.edges[u, v]['key']) for u, v in zip(path, path[1:])]})
        def score(c):
            a, b = G.nodes[c['nodes'][0]]['p'], G.nodes[c['nodes'][-1]]['p']
            return (b[0] - a[0]) if R in EW else (a[1] - b[1])
        cs.sort(key=score, reverse=True)
        for i, c in enumerate(cs):
            dirs = ('E', 'W') if R in EW else ('N', 'S')
            mains.append({'kind': 'm', 'route': R, 'dir': dirs[i], 'lanes': LANES[R], 'name': NAMES[R], 'nodes': c['nodes'], 'edges': c['edges']})
    main_nodes = set()
    for m in mains: main_nodes.update(m['nodes'])

    # --- ramps: link edges reachable from the mains (forwards: exits; backwards: entrances), within 5 km
    def is_ramp_edge(e): return e['sub'] == 'link' or (e['cls'] == 'motorway' and not e['routed'])
    ramp_edges = set()
    for fwd in (True, False):
        dist = {n: 0.0 for n in main_nodes}; pq = [(0.0, n) for n in main_nodes]
        while pq:
            L, x = heapq.heappop(pq)
            if L > dist.get(x, 1e18) or L > 5000: continue
            it = G.out_edges(x, keys=True, data=True) if fwd else G.in_edges(x, keys=True, data=True)
            for a, b, k, e in it:
                if not is_ramp_edge(e) or e['cls'] not in ('motorway', 'trunk'): continue
                if e['cls'] == 'trunk' and e['sub'] != 'link': continue
                ramp_edges.add((a, b, k))
                y = b if fwd else a
                if y in main_nodes: continue
                nl = L + e['len']
                if nl < dist.get(y, 1e18): dist[y] = nl; heapq.heappush(pq, (nl, y))
    log('ramp edges', len(ramp_edges))
    # chain ramp edges into paths between break nodes
    RG = nx.MultiDiGraph(); RG.add_edges_from([(a, b, k) for a, b, k in ramp_edges])
    def is_break(n): return n in main_nodes or RG.in_degree(n) != 1 or RG.out_degree(n) != 1
    used = set(); ramps = []
    for a, b, k in ramp_edges:
        if (a, b, k) in used or not is_break(a): continue
        nodes = [a]; edges = []; cur = (a, b, k)
        while True:
            used.add(cur); edges.append(cur); nodes.append(cur[1])
            if is_break(cur[1]): break
            nxt = list(RG.out_edges(cur[1], keys=True))
            if len(nxt) != 1 or nxt[0] in used: break
            cur = nxt[0]
        ramps.append({'kind': 'l', 'nodes': nodes, 'edges': edges})
    # pure cycles without breaks are impossible here (everything hangs off a main), but catch strays
    log('ramp paths', len(ramps), 'unused edges', len(ramp_edges - used))

    paths = mains + ramps
    for i, p in enumerate(paths): p['id'] = i
    for m in mains: m['nodeset'] = set(m['nodes'])
    # ramps that connect two mains are freeway connectors: two lanes
    for q in ramps:
        q['lanes'] = 1
    # connectors: follow ramp graph from each main diverge to another main
    starts = collections.defaultdict(list)
    for q in ramps: starts[q['nodes'][0]].append(q['id'])
    for q0 in ramps:
        if q0['nodes'][0] not in main_nodes: continue
        stack = [(q0['id'], [q0['id']])]
        while stack:
            qid, trail = stack.pop()
            end = paths[qid]['nodes'][-1]
            if end in main_nodes:
                src = [m['route'] for m in mains if q0['nodes'][0] in m['nodeset']]
                dst = [m['route'] for m in mains if end in m['nodeset']]
                if src and dst and src[0] != dst[0]:
                    for t in trail: paths[t]['lanes'] = 2; paths[t]['conn'] = True
                continue
            if len(trail) > 8: continue
            for nq in starts.get(end, []): stack.append((nq, trail + [nq]))


    # --- dense geometry with OSM levels, per path
    def level_of(e, f):
        for lr in (e['lrules'] or []):
            bt = lr.get('between')
            if bt is None or bt[0] <= f <= bt[1]: return lr['value'] or 0
        return 0
    for p in paths:
        pts = []; lv = []; node_at = {}
        for i, (a, b, k) in enumerate(p['edges']):
            e = G.edges[a, b, k]
            q, t = resample(e['pts'], 4.0)
            L = t[-1] if t[-1] > 0 else 1
            fr = e['fa'] + (e['fb'] - e['fa']) * (t / L)
            l = [level_of(e, f) for f in fr]
            if pts: q = q[1:]; l = l[1:]
            node_at.setdefault(a, len(pts) if not pts else len(pts) - 1)
            pts += q.tolist(); lv += l
            node_at[b] = len(pts) - 1
        p['raw'] = np.asarray(pts); p['rawlv'] = np.asarray(lv, float); p['raw_node_at'] = node_at

    # --- resample at 2 m and smooth; keep every junction node pinned
    for p in paths:
        q, t = resample(p['raw'], STEP)
        p['lv'] = np.interp(t, arclen(p['raw']), p['rawlv'])
        # node positions in the resampled line
        rc = arclen(p['raw'])
        p['node_s'] = {n: rc[i] for n, i in p['raw_node_at'].items()}
        win = 41 if p['kind'] == 'm' else 9
        p['xy'] = smooth_line(q, win)
        p['s'] = t
    # junctions: nodes shared by two or more paths
    node_paths = collections.defaultdict(list)
    for p in paths:
        for n, s in p['node_s'].items(): node_paths[n].append((p['id'], s))
    junctions = {n: v for n, v in node_paths.items() if len(v) > 1}
    log('junctions', len(junctions))

    # --- push paired carriageways apart where they'd overlap
    def half_left(p): return p['lanes'] * W / 2 + (2.4 if p['lanes'] >= 4 else 1.2) + 0.45
    by_route = collections.defaultdict(list)
    for p in mains: by_route[p['route']].append(p)
    for R, (A, B) in by_route.items():
        for P, Q in ((A, B), (B, A)):
            tree = cKDTree(Q['xy'])
            d, idx = tree.query(P['xy'])
            h = headings(P['xy']); left = np.stack([np.cos(h), -np.sin(h)], 1)
            rel = Q['xy'][idx] - P['xy']
            side = np.sum(rel * left, 1)
            need = half_left(P) + half_left(Q) + 0.2
            push = np.where((d < need) & (side > 0), (need - d) / 2, 0.0)
            push = gaussian_filter1d(maximum_filter1d(push, 61), 15)
            push = np.minimum(push, 8)
            P['push'] = push; P['pushdir'] = -left
        for P in (A, B):
            P['xy'] = P['xy'] + P['pushdir'] * P.pop('push')[:, None]
            P.pop('pushdir')

    # --- snap junction nodes: every path through a node takes the position of the most important one
    def rank(p): return (0 if p['kind'] == 'm' else 1, p['id'])
    def pos_at(p, s):
        return np.array([np.interp(s, p['s'], p['xy'][:, 0]), np.interp(s, p['s'], p['xy'][:, 1])])
    for n, lst in junctions.items():
        lst.sort(key=lambda it: rank(paths[it[0]]))
        anchor = pos_at(paths[lst[0][0]], lst[0][1])
        for pid, s in lst[1:]:
            p = paths[pid]
            off = anchor - pos_at(p, s)
            if np.hypot(*off) < 1e-6: continue
            # shift with a fade over 60 m either side so the path stays smooth
            w = np.clip(1 - np.abs(p['s'] - s) / 60.0, 0, 1)
            w = w * w * (3 - 2 * w)
            p['xy'] = p['xy'] + w[:, None] * off[None, :]

    # --- heights: an engineered profile over the bare earth (bridges over the dips, cuts through the humps, grades
    # capped), grade separation where roads cross, and ramps solved as one elastic network pinned to the freeways
    dem = DEM()
    log('dem', dem.raw.shape)
    from scipy.ndimage import grey_closing, grey_opening

    def engineered(g, gmax, span, sig):
        n = len(g)
        w = max(3, int(span / STEP) | 1)
        y = grey_closing(g, size=w, mode='nearest')
        y = grey_opening(y, size=w, mode='nearest')
        y = gaussian_filter1d(y, sig / STEP, mode='nearest')
        dmax = gmax * STEP
        y = y.tolist()
        for _ in range(2):
            for i in range(1, n): y[i] = min(max(y[i], y[i - 1] - dmax), y[i - 1] + dmax)
            for i in range(n - 2, -1, -1): y[i] = min(max(y[i], y[i + 1] - dmax), y[i + 1] + dmax)
        return gaussian_filter1d(np.asarray(y), 20 / STEP, mode='nearest')

    for p in paths:
        g = dem.at(p['xy'][:, 0], p['xy'][:, 1])
        p['ground'] = g
        p['y'] = engineered(g, 0.055, 320, 60) if p['kind'] == 'm' else engineered(g, 0.08, 160, 25)

    def y_at(p, s): return float(np.interp(s, p['s'], p['y']))
    def half_w(p): return p['lanes'] * W / 2 + (3.0 if p['kind'] == 'm' else 1.8)

    # crossings in plan, not counting roads that meet at a junction close by
    lines = [LineString(p['xy']) for p in paths]
    tree = STRtree(lines)
    pairs = tree.query(lines, predicate='intersects')
    node_pos = {n: pos_at(paths[lst[0][0]], lst[0][1]) for n, lst in junctions.items()}
    jkeys = list(node_pos.keys())
    jtree = cKDTree(np.array([node_pos[k] for k in jkeys]))
    path_nodes = [set(p['node_s'].keys()) for p in paths]
    hcache = {}
    def hd(p):
        if p['id'] not in hcache: hcache[p['id']] = headings(p['xy'])
        return hcache[p['id']]
    crossings = []
    for i, j in zip(*pairs):
        if i >= j: continue
        inter = lines[i].intersection(lines[j])
        if inter.is_empty: continue
        for g in getattr(inter, 'geoms', [inter]):
            if g.geom_type != 'Point': continue
            near = jtree.query_ball_point([g.x, g.y], 80)
            if any(jkeys[t] in path_nodes[i] and jkeys[t] in path_nodes[j] for t in near): continue
            si = float(lines[i].project(g)); sj = float(lines[j].project(g))
            hi = hd(paths[i])[min(int(si / STEP), len(paths[i]['xy']) - 1)]
            hj = hd(paths[j])[min(int(sj / STEP), len(paths[j]['xy']) - 1)]
            ang = abs(math.sin(hi - hj))
            if ang < 0.12: continue
            crossings.append((i, si, j, sj, ang))
    log('crossings', len(crossings))

    def upper_lower(c):
        i, si, j, sj, ang = c
        Pi, Pj = paths[i], paths[j]
        li = float(np.interp(si, Pi['s'], Pi['lv'])); lj = float(np.interp(sj, Pj['s'], Pj['lv']))
        if li != lj: up = i if li > lj else j
        elif Pi['kind'] != Pj['kind']: up = i if Pi['kind'] == 'l' else j
        else: up = i if y_at(Pi, si) >= y_at(Pj, sj) else j
        return (i, si, j, sj, ang) if up == i else (j, sj, i, si, ang)
    ul = [upper_lower(c) for c in crossings]

    # 1. freeway over freeway: lift the upper one with a smooth hump (smoothstep sides, under 7% at the steepest)
    def bump(s, s0, need, half):
        t = np.clip((np.abs(s - s0) - half) / (need / 0.045), 0, 1)
        return need * (1 - t * t * (3 - 2 * t))
    for p in mains: p['lift'] = np.zeros_like(p['y'])
    mm = [c for c in ul if paths[c[0]]['kind'] == 'm' and paths[c[2]]['kind'] == 'm']
    for rnd in range(12):
        changed = 0
        for u, su, l, sl, ang in mm:
            U, Lp = paths[u], paths[l]
            lu = float(np.interp(su, U['s'], U['lift']))
            need = 7.2 - ((y_at(U, su) + lu) - (y_at(Lp, sl) + float(np.interp(sl, Lp['s'], Lp['lift']))))
            if need > 0.05:
                U['lift'] = np.maximum(U['lift'], bump(U['s'], su, lu + need, (half_w(Lp) + 4) / max(ang, 0.3) + 8)); changed += 1
        if not changed: break
    for p in mains: p['y'] = p['y'] + p.pop('lift')
    log('freeway-over-freeway crossings', len(mm))

    # 2. a freeway that ends in another (a Y) settles onto it over the last 1.2 km
    for p in mains:
        for n, s in p['node_s'].items():
            if n not in junctions or not (s < 1 or s > p['s'][-1] - 1): continue
            for pid, s2 in junctions[n]:
                M = paths[pid]
                if M['kind'] != 'm' or pid == p['id'] or not (0.5 < s2 < M['s'][-1] - 0.5): continue
                v = y_at(M, s2) - y_at(p, s)
                w = np.clip(1 - np.abs(p['s'] - s) / 1200.0, 0, 1)
                p['y'] = p['y'] + v * w * w * (3 - 2 * w)

    # 3. ramps. Where a ramp still overlaps the freeway it leaves or joins, it is pinned to it.
    main_trees = {p['id']: cKDTree(p['xy']) for p in mains}
    for p in ramps:
        p['fix'] = np.full(len(p['y']), np.nan)
        for n, s in p['node_s'].items():
            if n not in junctions: continue
            for pid, s2 in junctions[n]:
                M = paths[pid]
                if M['kind'] != 'm': continue
                d, idx = main_trees[pid].query(p['xy'])
                inside = d < half_w(M) + half_w(p) * 0.6
                start = min(max(int(round(s / STEP)), 0), len(p['y']) - 1)
                step = 1 if start < len(p['y']) / 2 else -1
                i = start
                while 0 <= i < len(p['y']) and (inside[i] or i == start):
                    p['fix'][i] = M['y'][idx[i]]; i += step
    # one elastic network over every ramp, at ~6 m spacing; ramps meeting ramps share a node
    K = 3
    parent = {}
    def find(a):
        while parent.get(a, a) != a: a = parent[a]
        return a
    offs = {}; tot = 0; node_s = {}
    for p in ramps:
        n = len(p['y']); ks = list(range(0, n, K))
        if ks[-1] != n - 1: ks.append(n - 1)
        offs[p['id']] = (tot, np.asarray(ks)); tot += len(ks)
    first = lambda p: offs[p['id']][0]
    last = lambda p: offs[p['id']][0] + len(offs[p['id']][1]) - 1
    for n, lst in junctions.items():
        ids = []
        for pid, s in lst:
            p = paths[pid]
            if p['kind'] != 'l': continue
            ids.append(first(p) if s < p['s'][-1] / 2 else last(p))
        for a in ids[1:]:
            ra, rb = find(a), find(ids[0])
            if ra != rb: parent[ra] = rb
    rep = np.array([find(i) for i in range(tot)])
    target = np.zeros(tot); fixv = np.full(tot, np.nan); cnt = np.zeros(tot)
    ea, eb = [], []
    for p in ramps:
        o, ks = offs[p['id']]
        ids = rep[o:o + len(ks)]
        np.add.at(target, ids, p['y'][ks]); np.add.at(cnt, ids, 1)
        fv = p['fix'][ks]; m = ~np.isnan(fv); fixv[ids[m]] = fv[m]
        ea += ids[:-1].tolist(); eb += ids[1:].tolist()
    target /= np.maximum(cnt, 1)
    ea, eb = np.asarray(ea), np.asarray(eb)
    deg = np.zeros(tot); np.add.at(deg, ea, 1); np.add.at(deg, eb, 1)
    free = np.isnan(fixv)
    # crossing constraints that involve a ramp: node ranges for the decks
    cons = []
    for u, su, l, sl, ang in ul:
        U, Lp = paths[u], paths[l]
        if U['kind'] == 'm' and Lp['kind'] == 'm': continue
        half = (half_w(Lp) + 3) / max(ang, 0.3) + 4
        def nodes(P, s0):
            if P['kind'] != 'l': return None
            o, ks = offs[P['id']]
            ss = P['s'][ks]
            sel = np.where(np.abs(ss - s0) <= half)[0]
            if len(sel) == 0: sel = [int(np.argmin(np.abs(ss - s0)))]
            return rep[o + np.asarray(sel)]
        cons.append((nodes(U, su), U if U['kind'] == 'm' else None, su, nodes(Lp, sl), Lp if Lp['kind'] == 'm' else None, sl))
    y = np.where(free, target, fixv)
    beta = 0.004
    for it in range(6000):
        nb = np.zeros(tot); np.add.at(nb, ea, y[eb]); np.add.at(nb, eb, y[ea])
        avg = nb / np.maximum(deg, 1)
        yn = (1 - beta) * avg + beta * target
        y = np.where(free & (deg > 0), yn, np.where(free, y, fixv))
        for un, um, su, ln, lm, sl in cons:
            yu = y_at(um, su) if um is not None else float(np.min(y[un]))
            yl = y_at(lm, sl) if lm is not None else float(np.max(y[ln]))
            deficit = yl + 7.0 - yu
            if deficit <= 0: continue
            if un is not None and ln is not None:
                y[un] = np.maximum(y[un], yu + deficit / 2); y[ln] = np.minimum(y[ln], yl - deficit / 2)
            elif un is not None: y[un] = np.maximum(y[un], yu + deficit)
            elif ln is not None: y[ln] = np.minimum(y[ln], yl - deficit)
        y = np.where(free, y, fixv)
    for p in ramps:
        o, ks = offs[p['id']]
        p['y'] = np.interp(np.arange(len(p['y'])), ks, y[rep[o:o + len(ks)]])
        m = ~np.isnan(p['fix']); p['y'][m] = p['fix'][m]
        p.pop('fix')
    crossings = crossings

    # --- checks: clearance at every crossing, and height steps at junctions
    bad = 0; seps = []
    for c in crossings:
        u, su, l, sl, ang = upper_lower(c)
        sep = y_at(paths[u], su) - y_at(paths[l], sl); seps.append(sep)
        if sep < 6.5:
            bad += 1
            if bad <= 25: log('  bad', paths[u]['kind'], u, round(su), round(paths[u]['s'][-1]), '|', paths[l]['kind'], l, round(sl), round(paths[l]['s'][-1]), 'sep %.1f ang %.2f' % (sep, ang))
    log('crossing clearance: min %.2f, under 6.5 m: %d of %d' % (min(seps), bad, len(seps)))
    steps = []
    for n, lst in junctions.items():
        ys = [y_at(paths[pid], s) for pid, s in lst]
        steps.append(max(ys) - min(ys))
    steps = np.asarray(steps)
    log('junction height step: max %.2f m, >0.3 m: %d of %d' % (steps.max(), int((steps > 0.3).sum()), len(steps)))
    gr = []
    for p in paths:
        g = np.abs(np.diff(p['y'])) / STEP
        if len(g): gr.append(g.max())
    gk = [p['kind'] for p in paths]
    gr = np.asarray(gr); log('steep mains', [round(float(g), 3) for g, k in zip(gr, gk) if k == 'm' and g > 0.06])
    log('max grade: median %.3f, >8%%: %d of %d' % (np.median(gr), int((gr > 0.08).sum()), len(gr)))

    # --- destinations (sign text) at diverges
    seg_dest = {}
    for r in raw:
        for de in (r['destinations'] or []):
            labels = [l['value'] for l in (de['labels'] or []) if l.get('value')]
            if labels: seg_dest.setdefault((r['id'], de.get('to_segment_id')), labels)
    signs = []
    for p in mains:
        for idx, (a, b, k) in enumerate(p['edges']):
            if a not in junctions: continue
            for _, v, k2, e2 in G.out_edges(a, keys=True, data=True):
                if (a, v, k2) not in ramp_edges: continue
                e_main = G.edges[a, b, k]
                # the sign belongs to the main segment arriving at the node
                prev = p['edges'][idx - 1] if idx > 0 else None
                labels = None
                for src in ([G.edges[prev]['seg']] if prev else []) + [e_main['seg']]:
                    labels = seg_dest.get((src, e2['seg']))
                    if labels: break
                if not labels: labels = [e2['name']] if e2['name'] else None
                if not labels: continue
                s = p['node_s'][a]
                # which ramp path starts here, and on which side does it leave?
                rid = next((q['id'] for q in ramps if q['edges'] and q['edges'][0] == (a, v, k2)), None)
                if rid is None: continue
                q = paths[rid]
                hh = headings(p['xy'])[min(int(s / STEP), len(p['xy']) - 1)]
                probe = pos_at(q, min(q['s'][-1], 120.0)) - pos_at(p, s)
                right = np.array([-math.cos(hh), math.sin(hh)])
                side = 'R' if float(probe @ right) >= 0 else 'L'
                signs.append({'p': p['id'], 's': round(float(s), 1), 'ramp': rid, 'side': side, 'text': labels[:3]})
    log('signs', len(signs))

    # --- streets that bridge over the freeways: real overpasses
    streets = json.load(open(DATA + '/oc_streets_raw.json'))
    main_lines = [LineString(p['xy']) for p in mains]
    mtree = STRtree(main_lines)
    over = []
    for st in streets:
        xy = np.array([proj(lon, lat) for lon, lat in st['coords']])
        if len(xy) < 2: continue
        line = LineString(xy)
        hits = mtree.query(line, predicate='intersects')
        if len(hits) == 0: continue
        # street level at the crossing
        L = line.length
        for hi in hits:
            M = mains[hi]
            inter = line.intersection(main_lines[hi])
            for g in getattr(inter, 'geoms', [inter]):
                if g.geom_type != 'Point': continue
                f = line.project(g) / max(L, 1e-6)
                lv = 0
                for lr in (st['level_rules'] or []):
                    bt = lr.get('between')
                    if bt is None or bt[0] <= f <= bt[1]: lv = lr['value'] or 0
                sm = main_lines[hi].project(g)
                mlv = float(np.interp(sm, M['s'], M['lv']))
                over.append({'street': st['id'], 'name': st['name'], 'cls': st['class'], 'x': g.x, 'z': g.y, 'up': lv > mlv,
                             'main': M['id'], 'sm': sm, 'line': line, 'f': f})
    log('street crossings', len(over), 'over', sum(o['up'] for o in over))
    # one bridge per street per freeway: group crossings of the same street within 140 m
    bridges = []
    groups = collections.defaultdict(list)
    for o in over:
        if o['up']: groups[o['street']].append(o)
    for sid, lst in groups.items():
        lst.sort(key=lambda o: o['f'])
        cl = [[lst[0]]]
        for o in lst[1:]:
            if math.hypot(o['x'] - cl[-1][-1]['x'], o['z'] - cl[-1][-1]['z']) < 140: cl[-1].append(o)
            else: cl.append([o])
        for c in cl:
            line = c[0]['line']; L = line.length
            fs = [o['f'] * L for o in c]
            # reach out past the outermost carriageways: the main's half width plus a margin
            reach = max(half_w(paths[o['main']]) for o in c) + 14
            a, b = max(0, min(fs) - reach), min(L, max(fs) + reach)
            pts = [line.interpolate(t) for t in np.linspace(a, b, 2)]
            deck = max(y_at(paths[o['main']], o['sm']) for o in c) + 7.2
            bridges.append({'name': c[0]['name'], 'cls': c[0]['cls'], 'a': [round(pts[0].x, 1), round(pts[0].y, 1)],
                            'b': [round(pts[1].x, 1), round(pts[1].y, 1)], 'y': round(deck, 2),
                            'w': 22 if c[0]['cls'] == 'primary' else 18 if c[0]['cls'] == 'secondary' else 14})
    log('overpasses', len(bridges))

    # --- export paths: simplified control points, delta-coded decimetres
    out_paths = []
    jx = []
    for p in paths:
        xy, y = p['xy'], p['y']
        forced = [min(int(round(s / STEP)), len(xy) - 1) for n, s in p['node_s'].items() if n in junctions]
        keep = dp_keep(xy, 0.12 if p['kind'] == 'm' else 0.08, forced)
        # heights must survive too: add points where the height bends
        yk = np.interp(np.arange(len(y)), keep, y[keep])
        extra = np.where(np.abs(yk - y) > 0.08)[0]
        if len(extra):
            keep = np.unique(np.concatenate([keep, extra[::8]]))
        q = np.round(np.column_stack([xy[keep], y[keep]]) * 10).astype(np.int64)
        flat = np.concatenate([q[:1], np.diff(q, axis=0)]).ravel().tolist()
        idx_of = {k: i for i, k in enumerate(keep.tolist())}
        p['kidx'] = idx_of
        rec = {'k': p['kind'], 'n': len(keep), 'p': flat, 'lanes': p['lanes']}
        if p['kind'] == 'm': rec.update({'route': p['route'], 'dir': p['dir'], 'name': p['name']})
        if p.get('conn'): rec['conn'] = 1
        out_paths.append(rec)
    for n, lst in junctions.items():
        ent = []
        for pid, s in lst:
            p = paths[pid]
            i = min(int(round(s / STEP)), len(p['xy']) - 1)
            if i not in p['kidx']: continue
            ent.append([pid, p['kidx'][i]])
        if len(ent) > 1: jx.append(ent)
    for sg in signs:
        p = paths[sg['p']]; i = min(int(round(sg['s'] / STEP)), len(p['xy']) - 1)
        sg['i'] = p['kidx'].get(i)
    signs = [s for s in signs if s['i'] is not None]

    # --- terrain grid for the game: 60 m, int16 decimetres, row-delta coded, gzip, base64
    allxy = np.vstack([p['xy'] for p in mains])
    x0, x1 = allxy[:, 0].min() - 4000, allxy[:, 0].max() + 4000
    z0, z1 = allxy[:, 1].min() - 4000, allxy[:, 1].max() + 4000
    DX = 60.0
    nx_, nz_ = int((x1 - x0) / DX) + 1, int((z1 - z0) / DX) + 1
    gx, gz = np.meshgrid(x0 + np.arange(nx_) * DX, z0 + np.arange(nz_) * DX)
    u, v = dem.px(gx.ravel(), gz.ravel())
    big = gaussian_filter(dem.raw, 1.5)
    hgt = map_coordinates(big, [v, u], order=1, mode='nearest').reshape(nz_, nx_)
    hgt = np.maximum(hgt, -4.0)
    q = np.round(hgt * 4).astype(np.int32)       # quarter metres
    dq = np.concatenate([q[:, :1], np.diff(q, axis=1)], axis=1).astype('<i2')
    blob = base64.b64encode(gzip.compress(dq.tobytes(), 9)).decode()
    log('terrain grid', nx_, nz_, 'b64', len(blob))

    res = {'v': 1, 'origin': [LAT0, LON0], 'step': STEP,
           'attribution': 'Freeway geometry: Overture Maps Foundation, derived from OpenStreetMap contributors (ODbL). Elevation: AWS Terrain Tiles (USGS 3DEP/NED and others).',
           'paths': out_paths, 'junctions': jx,
           'signs': [{'p': s['p'], 'i': s['i'], 'side': s['side'], 'ramp': s['ramp'], 'text': s['text']} for s in signs],
           'overpasses': bridges,
           'terrain': {'x0': round(float(x0), 1), 'z0': round(float(z0), 1), 'dx': DX, 'q': 0.25, 'nx': nx_, 'nz': nz_, 'data': blob}}
    s = json.dumps(res, separators=(',', ':'))
    open(OUT, 'w').write(s)
    log('wrote', OUT, len(s), 'bytes; paths', len(out_paths), 'points', sum(p['n'] for p in out_paths))
    # keep a debug copy with dense geometry for plots
    np.savez_compressed(DATA + '/debug.npz', **{f"p{p['id']}": np.column_stack([p['xy'], p['y'], p['ground']]) for p in paths})
    json.dump([{'id': p['id'], 'k': p['kind'], 'route': p.get('route'), 'dir': p.get('dir'), 'lanes': p['lanes']} for p in paths], open(DATA + '/debug_paths.json', 'w'))

if __name__ == '__main__':
    main()

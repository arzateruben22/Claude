import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import networkx as nx

def interp(xy, cum, t):
    # point at arc length t
    import bisect
    i = max(0, min(len(xy) - 2, bisect.bisect_right(cum, t) - 1))
    L = cum[i+1] - cum[i]; f = 0 if L <= 0 else (t - cum[i]) / L
    return (xy[i][0] + (xy[i+1][0] - xy[i][0]) * f, xy[i][1] + (xy[i+1][1] - xy[i][1]) * f)

def sub(xy, cum, a, b):
    pts = [interp(xy, cum, a)]
    for i in range(len(xy)):
        if a < cum[i] < b: pts.append(xy[i])
    pts.append(interp(xy, cum, b))
    return pts

def level_at(r, f):
    for lr in (r['level_rules'] or []):
        bt = lr.get('between')
        if bt is None or bt[0] <= f <= bt[1]: return lr['value']
    return 0

def build():
    d = load()
    G = nx.MultiDiGraph()
    nodes = {}
    for r in d:
        xy = r['xy']; cum = [0.0]
        for i in range(len(xy) - 1): cum.append(cum[-1] + math.dist(xy[i], xy[i+1]))
        L = cum[-1]
        cons = sorted(r['connectors'] or [], key=lambda c: c['at'])
        for c in cons: nodes.setdefault(c['connector_id'], interp(xy, cum, c['at'] * L))
        for a, b in zip(cons, cons[1:]):
            ta, tb = a['at'] * L, b['at'] * L
            if tb - ta < 0.01: continue
            pts = sub(xy, cum, ta, tb)
            lv = [level_at(r, a['at']), level_at(r, (a['at'] + b['at']) / 2), level_at(r, b['at'])]
            G.add_edge(a['connector_id'], b['connector_id'], key=r['id'] + f":{a['at']:.4f}", seg=r['id'], cls=r['class'], sub=r['subclass'],
                       refs=r['refs'], routed=bool(r['routes']), lrules=r['level_rules'], flags=r['road_flags'], pts=pts, len=tb - ta, lv=lv, name=(r['names'] or {}).get('primary'), dest=r['destinations'], fa=a['at'], fb=b['at'])
    for n, p in nodes.items():
        if n in G: G.nodes[n]['p'] = p
    return G, d

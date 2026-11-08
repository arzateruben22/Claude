# Build src/data/anaheim/<prefix>slice.json: the walkable slice around one of our venue spots.
#   python3 build_slice.py [venue]     (default lot57 -> slice.json; sportsbar -> sportsbar-slice.json; see ana.VENUES)
# Input: data/<prefix>slice-*.parquet (fetch_slice.py) and the venue's point (venue.py).
# Coordinates: game metres (x east, z south from 33.72 N, 117.83 W), stored as decimetre integers, delta-coded per
# geometry (first point absolute). No business names are written; street names are kept.
import json, math, os, sys, collections as C
import shapely, pyarrow.parquet as pq
from shapely.geometry import box as sbox, Point
from shapely.ops import unary_union
from ana import DATA, OUT, RELEASE, jload, slice_box, to_xz, qpts, delta, Dict, street_name, venue, STREET_CLASSES

V = venue()
v = jload(V['json'])
X0, Z0, X1, Z1 = slice_box(V)
BOX = sbox(X0, Z0, X1, Z1)
D = {k: Dict() for k in ('seg', 'sub', 'name', 'bcls', 'btype', 'roof', 'lu', 'water', 'infra', 'cover', 'surf')}
DP = Dict()  # place categories (separate file)
stats = C.Counter()

LIC = C.defaultdict(C.Counter)  # theme/type -> (dataset, licence as Overture lists it) -> records used
def rd(t):
    rows = pq.read_table(V['raw'](t)).to_pylist()
    for r in rows:
        for s_ in r.get('sources') or []: LIC[t][f"{s_['dataset']} | {s_['license'] or 'no licence string'}"] += 1
    return rows
def parts(g):
    if g.is_empty: return []
    if hasattr(g, 'geoms'): return [p for p in g.geoms if not p.is_empty]
    return [g]

# ------------------------------------------------------------------ connectors
conn_xz = {}
for r in rd('connector'):
    p = to_xz(shapely.from_wkb(r['geometry']))
    conn_xz[r['id']] = (p.x, p.y)
conn_ix, conn_pts = {}, []
def conn_index(cid):
    if cid not in conn_ix:
        x, z = conn_xz[cid]; conn_ix[cid] = len(conn_pts); conn_pts.append((int(round(x * 10)), int(round(z * 10))))
    return conn_ix[cid]

# ------------------------------------------------------------------ segments
ROUTE = {('US:I', '5'): 'I-5', ('US:CA', '57'): 'CA-57', ('US:CA', '22'): 'CA-22', ('US:I', '405'): 'I-405'}
def ranges(rules, key, test, G, a0, a1):
    """'between' rules -> ranges as fractions of the clipped piece [a0,a1] (metres along the original G)."""
    out = []
    L = G.length
    for rr in rules or []:
        if not test(rr[key]): continue
        b = rr['between'] or [0.0, 1.0]
        s0, s1 = b[0] * L, b[1] * L
        lo, hi = max(s0, a0), min(s1, a1)
        if hi - lo < 0.05: continue
        out.append([round((lo - a0) / (a1 - a0), 3), round((hi - a0) / (a1 - a0), 3)])
    return out
def rng_or_whole(rs):
    if not rs: return None
    if len(rs) == 1 and rs[0][0] <= 0.001 and rs[0][1] >= 0.999: return 1
    return rs

segs = []
seg_geo = []  # each piece as a shapely line in metres (for the venue's site block)
conn_miss = 0
for r in rd('segment'):
    G = to_xz(shapely.from_wkb(r['geometry']))
    for piece in parts(G.intersection(BOX)):
        if piece.geom_type != 'LineString' or piece.length < 0.2: continue
        a0, a1 = G.project(Point(piece.coords[0])), G.project(Point(piece.coords[-1]))
        if a1 < a0:  # never expected for a clipped line, but keep fractions well-defined
            a0, a1 = a1, a0
        pts = qpts(piece.coords)
        if len(pts) < 2: continue
        s = {'c': D['seg'](r['class'] if r['subtype'] == 'road' else f"{r['subtype']}:{r['class']}")}
        sub = r['subclass']
        if not sub and r['subclass_rules'] and len(r['subclass_rules']) == 1 and not r['subclass_rules'][0]['between']:
            sub = r['subclass_rules'][0]['value']
        if sub: s['s'] = D['sub'](sub)
        # street names only on streets: service roads, aisles, footways and rail lines are often named after the
        # business or operator they serve (e.g. a driveway named after a taproom), so their names are dropped
        nm = street_name(r['names'], r['subtype'], r['class'])
        if nm: s['n'] = D['name'](nm)
        elif (r['names'] or {}).get('primary'): stats['names_dropped_nonstreet'] += 1
        for rt in r['routes'] or []:
            lab = ROUTE.get((rt['network'], rt['ref']))
            if lab: s['r'] = lab; break
        s['p'] = delta(pts)
        # connectors (intersections) that fall on this piece, as [vertex index, connector index, ...]
        k = []
        for c in r['connectors'] or []:
            cid = c['connector_id']
            if cid not in conn_xz: continue
            cx, cz = conn_xz[cid]
            if not (X0 <= cx <= X1 and Z0 <= cz <= Z1): continue
            if piece.distance(Point(cx, cz)) > 0.5: continue
            qx, qz = round(cx * 10), round(cz * 10)
            best = min(range(len(pts)), key=lambda i: (pts[i][0] - qx) ** 2 + (pts[i][1] - qz) ** 2)
            d = math.hypot(pts[best][0] - qx, pts[best][1] - qz) / 10
            if d > 0.3: conn_miss += 1; continue
            k += [best, conn_index(cid)]
        if k: s['k'] = k
        # speed limit (mph), width (m), one-way
        for sl in r['speed_limits'] or []:
            ms = sl['max_speed']
            if ms and not sl['when'] and ms['value']:
                s['sp'] = ms['value'] if ms['unit'] == 'mph' else round(ms['value'] / 1.609); break
        for w in r['width_rules'] or []:
            if not w['between'] and w['value']: s['w'] = w['value']; break
        for a in r['access_restrictions'] or []:
            wh = a['when'] or {}
            if a['access_type'] == 'denied' and wh.get('heading') and not wh.get('mode') and not wh.get('using') and not a['between']:
                s['ow'] = 1 if wh['heading'] == 'backward' else -1
            if a['access_type'] == 'denied' and 'foot' in (wh.get('mode') or []) and not a['between']:
                s['nf'] = 1
        # level (OSM layer), bridges, tunnels, links
        lv = [[*rg, rr['value']] for rr in (r['level_rules'] or []) if rr['value']
              for rg in ranges([rr], 'value', lambda x: True, G, a0, a1)]
        if lv:
            s['lv'] = lv[0][2] if len(lv) == 1 and lv[0][0] <= 0.001 and lv[0][1] >= 0.999 else lv
        for flag, key in (('is_bridge', 'br'), ('is_tunnel', 'tn'), ('is_link', 'lk'), ('is_covered', 'cv'),
                          ('is_under_construction', 'uc')):
            x = rng_or_whole(ranges(r['road_flags'], 'values', lambda vs, f=flag: f in (vs or []), G, a0, a1))
            if x: s[key] = x
        for sf in r['road_surface'] or []:
            if sf['value'] and sf['value'] != 'paved' and not sf['between']: s['sf'] = D['surf'](sf['value'])
        segs.append(s); seg_geo.append(piece)
        stats['seg:' + (r['class'] if r['subtype'] == 'road' else r['subtype'])] += 1
        if sub: stats['sub:' + sub] += 1

# ------------------------------------------------------------------ buildings and parts
bld, bld_ix = [], {}
def ring(pts): return delta(pts)
def enc_poly(P, tol):
    P = P.simplify(tol, preserve_topology=True)
    if P.is_empty or P.geom_type != 'Polygon': return None
    o = qpts(shapely.geometry.polygon.orient(P, 1.0).exterior.coords, ring=True)
    if len(o) < 3: return None
    e = {'p': delta(o)}
    hl = [delta(h) for h in (qpts(i.coords, ring=True) for i in P.interiors) if len(h) >= 3]
    if hl: e['hl'] = hl
    return e
SIGN = 0
for r in rd('building'):
    G = to_xz(shapely.from_wkb(r['geometry']))
    if not BOX.contains(G.centroid): continue
    for P in parts(G):
        e = enc_poly(P, 0.15)
        if not e: continue
        nm = ((r['names'] or {}).get('primary') or '').lower()
        cls = r['class']
        if not cls and nm.endswith(' sign'): cls = 'sign_structure'; SIGN += 1  # a tall sign mapped as a building
        if r['height']: e['h'] = round(r['height'], 1)
        if r['min_height']: e['mh'] = round(r['min_height'], 1)
        if r['num_floors']: e['f'] = r['num_floors']
        if cls: e['c'] = D['bcls'](cls)
        if r['subtype']: e['t'] = D['btype'](r['subtype'])
        if r['roof_shape']: e['r'] = D['roof'](r['roof_shape'])
        if r['is_underground']: e['ug'] = 1
        if any(s['dataset'] == 'USGS Lidar' and s['property'] and 'height' in s['property'] for s in r['sources']): e['lid'] = 1
        bld_ix[r['id']] = len(bld); bld.append(e)
        stats['bld'] += 1; stats['bld_h'] += 'h' in e; stats['bld_f'] += 'f' in e; stats['bld_roof'] += 'r' in e
        stats['bld_lidar_h'] += 'lid' in e
bparts = []
for r in rd('building_part'):
    if r['building_id'] not in bld_ix: continue
    G = to_xz(shapely.from_wkb(r['geometry']))
    for P in parts(G):
        e = enc_poly(P, 0.15)
        if not e: continue
        e['b'] = bld_ix[r['building_id']]
        if r['height']: e['h'] = round(r['height'], 1)
        if r['min_height']: e['mh'] = round(r['min_height'], 1)
        if r['roof_shape']: e['r'] = D['roof'](r['roof_shape'])
        if r['roof_height']: e['rh'] = round(r['roof_height'], 1)
        bparts.append(e)

# ------------------------------------------------------------------ places: category and point only (no names)
vx, vz = v['x'], v['z']
DROP_IDS = set(v.get('drop_place_ids', []))  # every record at the venue's address or under its real name (venue.py)
places = []
pl_cats = C.Counter()
for r in rd('place'):
    p = to_xz(shapely.from_wkb(r['geometry']))
    if not (X0 <= p.x <= X1 and Z0 <= p.y <= Z1): continue
    addr = ' '.join((a.get('freeform') or '') for a in (r['addresses'] or [])).lower()
    if (V['addr'][0] in addr and V['addr'][1] in addr) or r['id'] in DROP_IDS: stats['place_at_venue_dropped'] += 1; continue
    if (r['operating_status'] or 'open') != 'open': stats['place_not_open'] += 1; continue
    if (r['confidence'] or 0) < 0.5: stats['place_lowconf'] += 1; continue
    cat = r['basic_category'] or (r['taxonomy'] or {}).get('primary') or 'unknown'
    places += [DP(cat), int(round(p.x * 10)), int(round(p.y * 10))]
    pl_cats[cat] += 1

# ------------------------------------------------------------------ land use, water, infrastructure, land cover
def areas(tname, dname, tol, keyf):
    out, pts = [], []
    for r in rd(tname):
        G = to_xz(shapely.from_wkb(r['geometry'])).intersection(BOX)
        key = keyf(r)
        for P in parts(G):
            if P.geom_type == 'Polygon':
                e = enc_poly(P, tol)
                if e: e['c'] = D[dname](key); out.append(e)
            elif P.geom_type == 'LineString':
                q = qpts(P.simplify(tol).coords)
                if len(q) >= 2: out.append({'c': D[dname](key), 'l': delta(q)})
            elif P.geom_type == 'Point':
                pts += [D[dname](key), int(round(P.x * 10)), int(round(P.y * 10))]
    return out, pts
lu, _ = areas('land_use', 'lu', 0.3, lambda r: r['class'])
water, _ = areas('water', 'water', 0.3, lambda r: r['class'])
infra, infra_pts = areas('infrastructure', 'infra', 0.2, lambda r: f"{r['subtype']}:{r['class']}")
cover, _ = areas('land_cover', 'cover', 3.0, lambda r: r['subtype'])

# ------------------------------------------------------------------ the venue's building and nearest mapped parking area
def poly(e): return shapely.geometry.Polygon(_ud(e['p']))
def _ud(a):
    out, x, z = [], 0, 0
    for i in range(0, len(a), 2): x += a[i]; z += a[i + 1]; out.append((x / 10, z / 10))
    return out
VP = Point(vx, vz)
v_bld = next((i for i, b in enumerate(bld) if poly(b).buffer(0).contains(VP)), None)
lots = [(poly(e).distance(VP), i) for i, e in enumerate(infra) if 'p' in e and D['infra'].items[e['c']] == 'transit:parking']
v_lot = min(lots)[1] if lots else None

# The site block (venues with V['site']): the venue's footprint and its parking lot, identified and marked.
#   Footprint: the building the point stands in, else the nearest one.
#   Lot: a mapped parking area within 15 m of the footprint; when none is mapped there, the open ground the footprint
#   wraps round (its convex hull less the footprint), widened along the mapped service ways that cross it by 9 m
#   either side (an aisle and a row of stalls) up to 12 m out of it, and stopped at the street kerbs and the footprint;
#   strips under 6 m wide are dropped.
#   Kerbs use the class half-widths of PROJECT_OC_ON_FOOT.md (primary 22 m, secondary 18 m, tertiary 14 m,
#   residential 11 m wide), since widths are rarely mapped.
KERB = {'motorway': 12, 'trunk': 11, 'primary': 11, 'secondary': 9, 'tertiary': 7, 'residential': 5.5,
        'unclassified': 5.5, 'living_street': 5.5}
def seg_cls(i): return D['seg'].items[segs[i]['c']]
def seg_conns(i): return set(segs[i].get('k', [])[1::2])
def site_block():
    b_i = v_bld
    if b_i is None: b_i = min(range(len(bld)), key=lambda i: poly(bld[i]).buffer(0).distance(VP))
    B = poly(bld[b_i]).buffer(0)
    st = {'bld_how': 'contains' if B.contains(VP) else 'nearest', 'bld_m': round(B.distance(VP), 1),
          'bld_area_m2': round(B.area), 'bld_h': bld[b_i].get('h')}
    st['bld_places'] = sum(B.contains(Point(places[i + 1] / 10, places[i + 2] / 10)) for i in range(0, len(places), 3))
    near = min((poly(infra[i]).distance(B), i) for _, i in lots) if lots else None
    if near: st['nearest_mapped_parking'] = {'infra': near[1], 'm_from_bld': round(near[0], 1)}
    if near and near[0] <= 15:
        lot = poly(infra[near[1]]).buffer(0); st['lot_how'] = 'mapped'; st['lot_infra'] = near[1]
        ais = [i for i, g in enumerate(seg_geo) if seg_cls(i) == 'service' and g.intersection(lot.buffer(2)).length >= 5]
    else:
        C = B.convex_hull.difference(B)
        C = max(parts(C), key=lambda g: g.area) if not C.is_empty else B.buffer(12).difference(B)
        ais = [i for i, g in enumerate(seg_geo) if seg_cls(i) == 'service' and g.intersection(C.buffer(2)).length >= 5]
        A = unary_union([seg_geo[i] for i in ais]).intersection(C.buffer(12))
        road = unary_union([g.buffer(KERB[seg_cls(i)]) for i, g in enumerate(seg_geo) if seg_cls(i) in KERB and g.distance(B) < 100])
        lot = unary_union([C, A.buffer(9).intersection(unary_union([C, A]).convex_hull)])
        lot = max(parts(lot.difference(B.buffer(0.3)).difference(road)), key=lambda g: g.area)
        # close gaps under 3 m, then open: drop strips under 6 m wide (a lane curling round the building is not lot)
        lot = lot.buffer(1.5).buffer(-1.5).buffer(-3).buffer(3, join_style='mitre')
        lot = max(parts(lot.difference(B.buffer(0.3)).difference(road)), key=lambda g: g.area)
        st['lot_how'] = 'derived'
    e = enc_poly(lot, 0.3)
    st['lot_p'] = e['p']; st['lot_area_m2'] = round(lot.area)
    st['lot_aisles'] = ais
    # entries: where a lot aisle meets a public street, directly or by one short service way (a driveway, <= 40 m)
    street = set().union(*[seg_conns(i) for i in range(len(segs)) if seg_cls(i) in STREET_CLASSES]) if segs else set()
    ac = set().union(*[seg_conns(i) for i in ais]) if ais else set()
    ent = ac & street
    for i, g in enumerate(seg_geo):
        if seg_cls(i) == 'service' and i not in ais and g.length <= 40 and seg_conns(i) & ac: ent |= seg_conns(i) & street
    st['lot_entries'] = sorted(ent)
    names = set()
    for i in range(len(segs)):
        if seg_cls(i) in STREET_CLASSES and seg_conns(i) & ent and 'n' in segs[i]: names.add(D['name'].items[segs[i]['n']])
    st['lot_entry_streets'] = sorted(names)
    return b_i, st
SITE = site_block() if V.get('site') else None
if SITE: v_bld, v_lot = SITE[0], SITE[1].get('lot_infra')

# ------------------------------------------------------------------ write
WHAT = {'lot57': 'Anaheim stadium-district slice for the on-foot mode: streets, footways, buildings, land use, water, infrastructure.',
        'sportsbar': 'Anaheim slice (1.2 km box) round our own sports bar\'s spot on South Claudina Way, for the on-foot mode: '
                     'streets, footways, buildings, land use, water, infrastructure.'}[V['key']]
NOTE = {'lot57': 'Our own fictional hangout. The spot was located in Overture places (see tools/anaheim/README.md); no real name, sign or trade dress is used.',
        'sportsbar': 'Our own fictional sports bar. The spot was located in Overture places (see tools/anaheim/README.md); no real '
                     'name, logo, sign, menu or trade dress is used.'}[V['key']]
out = {
    'v': 1,
    'what': WHAT,
    'attribution': 'Overture Maps Foundation (release ' + RELEASE + '). Streets, connectors, buildings, land use, water and '
                   'infrastructure derived from OpenStreetMap contributors (ODbL 1.0; a few street records also list TomTom, '
                   'under ODbL 1.0); some buildings from Microsoft ML '
                   'Buildings (ODbL 1.0); building heights partly from USGS 3DEP lidar (US public domain); venue point '
                   'from Overture places (CDLA Permissive 2.0); land cover from ESA WorldCover (CC BY 4.0).',
    'licences': {k: dict(v) for k, v in LIC.items() if k != 'place'},
    'origin': [33.72, -117.83], 'units': 'decimetres; x east, z south (game coordinates); each geometry delta-coded, first point absolute',
    'box': [X0, Z0, X1, Z1],
    'venue': {'x': vx, 'z': vz, 'lon': round(v['lon'], 7), 'lat': round(v['lat'], 7), 'bld': v_bld, 'lot': v_lot,
              'note': NOTE, **({'site': SITE[1]} if SITE else {})},
    'dict': {k: d.items for k, d in D.items()},
    'conn': delta(conn_pts),
    'seg': segs,
    'bld': bld, 'bpart': bparts,
    'landuse': lu, 'water': water, 'infra': infra, 'infra_pts': infra_pts, 'cover': cover,
    'keys': {
        'seg': 'c class (dict.seg; rail as "rail:<class>"), s subclass (dict.sub), n street name (dict.name), r route, p points, '
               'k [vertex, connector index into conn, ...], sp max speed mph, w width m, ow one-way (1 along p, -1 against), '
               'nf foot denied, lv OSM level (int, or [[from,to,level]] as fractions of the piece), br/tn/lk/cv/uc '
               'bridge/tunnel/link/covered/under-construction (1 = whole, else [[from,to]]), sf surface (dict.surf)',
        'bld': 'p outer ring (counter-clockwise in x,z), hl holes, h height m, mh min height m, f floors, c class (dict.bcls), '
               't subtype (dict.btype), r roof shape (dict.roof), ug underground, lid 1 when Overture took the height from USGS lidar',
        'bpart': 'building parts: b index into bld, p, h, mh, r, rh roof height',
        'venue': 'x, z metres; bld index of the building it stands in; lot index into infra of the nearest mapped parking area'
                 if not SITE else
                 'x, z metres; bld index of the venue\'s building (the one the point stands in, else the nearest); lot index into '
                 'infra of its mapped parking area, null when none is mapped at the building; site: bld_how contains|nearest, '
                 'bld_m metres from the point, bld_area_m2, bld_h, bld_places other open place records inside the footprint '
                 '(it is shared), nearest_mapped_parking {infra, m_from_bld}, lot_how mapped|derived (derived: no parking area '
                 'is mapped there; the open ground the footprint wraps round, widened 9 m along the mapped service ways that '
                 'cross it, kept off the kerbs and the footprint; see tools/anaheim/build_slice.py), lot_p the lot ring '
                 '(delta-coded dm, counter-clockwise), lot_area_m2, lot_aisles seg indices of the service ways in it, '
                 'lot_entries conn indices where they meet a public street (directly or by a driveway up to 40 m), '
                 'lot_entry_streets those streets\' names',
        'licences': 'per Overture type: "dataset | licence" as listed in each record\'s sources, with record counts (fetched rows, before clipping)',
        'landuse/water/infra/cover': 'c class (dict.lu / dict.water / dict.infra "subtype:class" / dict.cover), p polygon ring (+hl) or l line',
        'infra_pts': 'flat [class (dict.infra), x, z, ...] for point features (crossings, signals, stops, benches, lamps...)',
    },
}
os.makedirs(OUT, exist_ok=True)
fn = V['slice']
with open(fn, 'w') as f: json.dump(out, f, separators=(',', ':'))
sz = {k: len(json.dumps(out[k], separators=(',', ':'))) for k in ('conn', 'seg', 'bld', 'bpart', 'landuse', 'water', 'infra', 'infra_pts', 'cover', 'dict')}
counts = {
    'bytes': os.path.getsize(fn), 'section_bytes': sz,
    'segments': len(segs), 'connectors': len(conn_pts), 'connector_vertex_misses': conn_miss,
    'named_streets': len(D['name'].items), 'buildings': len(bld), 'building_parts': len(bparts),
    'places': len(places) // 3, 'landuse': len(lu), 'water': len(water), 'infra': len(infra), 'infra_pts': len(infra_pts) // 3,
    'cover': len(cover), 'stats': dict(stats), 'sign_structures': SIGN, 'place_categories_top': pl_cats.most_common(15),
}
# places go to their own file (category and point only, no names), so the game can leave them out of the bundle
pl = {'v': 1, 'what': 'Places in the slice box: category and point only (no names). Open, confidence >= 0.5; the records at the venue address are left out.',
      'attribution': 'Overture Maps Foundation (release ' + RELEASE + ') places: CDLA Permissive 2.0 (Foursquare records Apache 2.0, AllThePlaces CC0 1.0).',
      'licences': dict(LIC['place']), 'origin': [33.72, -117.83], 'units': 'decimetres; x east, z south (game coordinates), absolute',
      'dict': DP.items, 'place': places, 'keys': {'place': 'flat [category (dict), x, z, ...]'}}
fp = V['places']
with open(fp, 'w') as f: json.dump(pl, f, separators=(',', ':'))
counts['places_bytes'] = os.path.getsize(fp)
if SITE: counts['site'] = {k: x for k, x in SITE[1].items() if k != 'lot_p'} | {'bld': v_bld}
with open(V['counts'], 'w') as f: json.dump(counts, f, indent=1)
print(json.dumps(counts, indent=1))

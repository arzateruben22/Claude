# What would all of Anaheim cost? Uses the city's own boundary (Overture divisions, locality "Anaheim", from OSM).
# Measures streets by tier and buildings (counts, KB raw and gzipped) with the same encoding as slice.json, and
# writes src/data/anaheim/streets-city.json (drivable street centrelines with class, name and intersections) when
# it is under 3 MB.
import json, os, gzip, collections as C
import shapely, pyarrow.parquet as pq
from ana import fetch, CITY_BB, DATA, OUT, RELEASE, to_xz, qpts, delta, Dict, jdump, street_name

# ---------------------------------------------------------------- boundary
t, _ = fetch('divisions', 'division_area', CITY_BB, ['id', 'names', 'subtype', 'region', 'geometry', 'bbox'])
city = [r for r in t.to_pylist() if (r['names'] or {}).get('primary') == 'Anaheim' and r['subtype'] == 'locality' and r['region'] == 'US-CA']
assert len(city) == 1, city
CITY = to_xz(shapely.from_wkb(city[0]['geometry']))
shapely.prepare(CITY)
b = city[0]['bbox']; BB = (b['xmin'], b['xmax'], b['ymin'], b['ymax'])
print('Anaheim boundary', city[0]['id'], CITY.geom_type, 'area km2', round(CITY.area / 1e6, 1), 'bbox', BB)

# ---------------------------------------------------------------- streets
path = f'{DATA}/city-segment.parquet'
if not os.path.exists(path):
    t, n = fetch('transportation', 'segment', BB, ['id', 'names', 'subtype', 'class', 'subclass', 'routes', 'connectors',
                                                     'road_flags', 'level_rules', 'access_restrictions', 'geometry', 'bbox'])
    pq.write_table(t, path); print('segments fetched', t.num_rows, 'row groups', n)
segs = pq.read_table(path).to_pylist()
cpath = f'{DATA}/city-connector.parquet'
if not os.path.exists(cpath):
    t, n = fetch('transportation', 'connector', BB, ['id', 'geometry', 'bbox']); pq.write_table(t, cpath)
conn_xz = {r['id']: to_xz(shapely.from_wkb(r['geometry'])) for r in pq.read_table(cpath).to_pylist()}

MAIN = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary'}
LOCAL = {'residential', 'unclassified', 'living_street'}
WALK = {'footway', 'steps', 'path', 'pedestrian', 'cycleway', 'bridleway', 'track'}
def tier(r):
    if r['subtype'] != 'road': return 'rail/water'
    c = r['class']
    if c in MAIN: return 'main'
    if c in LOCAL: return 'local'
    if c == 'service': return 'service'
    if c in WALK: return 'walk'
    return 'other'
ROUTE = {('US:I', '5'): 'I-5', ('US:CA', '57'): 'CA-57', ('US:CA', '91'): 'CA-91', ('US:CA', '22'): 'CA-22',
         ('US:CA', '55'): 'CA-55', ('US:CA', '241'): 'CA-241', ('US:CA', '261'): 'CA-261'}

KM = [0.0]
def encode(rows, with_conn, D, cix, cpts):
    out = []; KM[0] = 0.0
    for r in rows:
        G = to_xz(shapely.from_wkb(r['geometry']))
        pieces = [G] if CITY.contains(G) else [p for p in getattr(G.intersection(CITY), 'geoms', [G.intersection(CITY)])]
        for P in pieces:
            if P.is_empty or P.geom_type != 'LineString' or P.length < 0.2: continue
            pts = qpts(P.coords)
            if len(pts) < 2: continue
            KM[0] += P.length / 1000
            s = {'c': D['cls'](r['class'])}
            nm = street_name(r['names'], r['subtype'], r['class'])
            if nm: s['n'] = D['name'](nm)
            for rt in r['routes'] or []:
                lab = ROUTE.get((rt['network'], rt['ref']))
                if lab: s['r'] = lab; break
            s['p'] = delta(pts)
            if with_conn:
                k = []
                for c in r['connectors'] or []:
                    q = conn_xz.get(c['connector_id'])
                    if q is None or P.distance(q) > 0.5: continue
                    qx, qz = round(q.x * 10), round(q.y * 10)
                    i = min(range(len(pts)), key=lambda i: (pts[i][0] - qx) ** 2 + (pts[i][1] - qz) ** 2)
                    if abs(pts[i][0] - qx) + abs(pts[i][1] - qz) > 4: continue
                    if c['connector_id'] not in cix: cix[c['connector_id']] = len(cpts); cpts.append((qx, qz))
                    k += [i, cix[c['connector_id']]]
                if k: s['k'] = k
            for a in r['access_restrictions'] or []:
                wh = a['when'] or {}
                if a['access_type'] == 'denied' and wh.get('heading') and not wh.get('mode') and not wh.get('using') and not a['between']:
                    s['ow'] = 1 if wh['heading'] == 'backward' else -1
            for f in r['road_flags'] or []:
                if not f['between'] and 'is_bridge' in (f['values'] or []): s['br'] = 1
                if not f['between'] and 'is_tunnel' in (f['values'] or []): s['tn'] = 1
            lv = [x['value'] for x in (r['level_rules'] or []) if not x['between'] and x['value']]
            if lv: s['lv'] = lv[0]
            out.append(s)
    return out

inside = []
for r in segs:
    g = to_xz(shapely.from_wkb(r['geometry']))
    if CITY.intersects(g): inside.append(r)
cnt = C.Counter(tier(r) for r in inside)
cls = C.Counter((r['class'] if r['subtype'] == 'road' else r['subtype']) for r in inside)
sub = C.Counter(r['subclass'] for r in inside if r['subclass'])
print('segments in city', len(inside), dict(cnt))
def size(o):
    s = json.dumps(o, separators=(',', ':')).encode()
    return len(s), len(gzip.compress(s, 9))
measure = {}
for name, tiers in [('main', {'main'}), ('main+local', {'main', 'local'}), ('main+local+service', {'main', 'local', 'service', 'other'}),
                    ('all segments', {'main', 'local', 'service', 'other', 'walk', 'rail/water'})]:
    rows = [r for r in inside if tier(r) in tiers]
    D = {'cls': Dict(), 'name': Dict()}; cix, cpts = {}, []
    enc = encode(rows, True, D, cix, cpts)
    obj = {'dict': {k: d.items for k, d in D.items()}, 'conn': delta(cpts), 'seg': enc}
    raw, gz = size(obj)
    measure[name] = {'segments': len(rows), 'pieces': len(enc), 'connectors': len(cpts), 'names': len(D['name'].items),
                     'km_inside_city': round(KM[0], 1),
                     'kb': round(raw / 1024), 'kb_gzip': round(gz / 1024)}
    print(name, measure[name])
    if name == 'main+local':
        keep = (obj, D, cpts, enc)

# ---------------------------------------------------------------- buildings (measured, not written)
bpath = f'{DATA}/city-building.parquet'
if not os.path.exists(bpath):
    t, n = fetch('buildings', 'building', BB, ['id', 'height', 'num_floors', 'class', 'subtype', 'roof_shape', 'geometry', 'bbox'])
    pq.write_table(t, bpath); print('buildings fetched', t.num_rows, 'row groups', n)
bl = pq.read_table(bpath).to_pylist()
benc, bh = [], 0
for r in bl:
    G = to_xz(shapely.from_wkb(r['geometry']))
    if not CITY.contains(G.centroid): continue
    for P in getattr(G, 'geoms', [G]):
        P = P.simplify(0.15, preserve_topology=True)
        if P.is_empty or P.geom_type != 'Polygon': continue
        o = qpts(P.exterior.coords, ring=True)
        if len(o) < 3: continue
        e = {'p': delta(o)}
        if r['height']: e['h'] = round(r['height'], 1); bh += 1
        if r['num_floors']: e['f'] = r['num_floors']
        benc.append(e)
braw, bgz = size(benc)
measure['buildings'] = {'count': len(benc), 'with_height': bh, 'kb': round(braw / 1024), 'kb_gzip': round(bgz / 1024)}
sraw = measure['main+local']['kb']; sall = measure['all segments']['kb']
measure['streets main+local + buildings'] = {'kb': sraw + measure['buildings']['kb'], 'kb_gzip': measure['main+local']['kb_gzip'] + measure['buildings']['kb_gzip']}
measure['all segments + buildings'] = {'kb': sall + measure['buildings']['kb'], 'kb_gzip': measure['all segments']['kb_gzip'] + measure['buildings']['kb_gzip']}
measure['by_class'] = dict(cls.most_common()); measure['by_subclass'] = dict(sub.most_common())
measure['boundary'] = {'overture_division_area_id': city[0]['id'], 'area_km2': round(CITY.area / 1e6, 1), 'lonlat_bbox': BB}
print('buildings', measure['buildings'])
jdump(measure, f'{DATA}/city-measure.json', indent=1)

# ---------------------------------------------------------------- write streets-city.json (main + local streets)
obj, D, cpts, enc = keep
bnd = CITY.simplify(10)
rings = [g.exterior for g in getattr(bnd, 'geoms', [bnd])]
out = {
    'v': 1,
    'what': 'City of Anaheim street centrelines (motorway, trunk, primary, secondary, tertiary, residential, unclassified, '
            'living street), clipped to the city boundary, with names and intersections.',
    'attribution': f'Overture Maps Foundation (release {RELEASE}), derived from OpenStreetMap contributors (ODbL 1.0). '
                   'City boundary: Overture divisions, from OpenStreetMap (ODbL 1.0).',
    'origin': [33.72, -117.83], 'units': 'decimetres; x east, z south (game coordinates); each geometry delta-coded, first point absolute',
    'lanes': 'not available: Overture 2026-09-23.1 segments carry no lane counts',
    'boundary': [delta(qpts(r.coords, ring=True)) for r in rings],
    'dict': obj['dict'], 'conn': obj['conn'], 'seg': enc,
    'keys': {'seg': 'c class (dict.cls), n name (dict.name), r route, p points, k [vertex, connector index, ...], '
                    'ow one-way (1 along p, -1 against), br bridge, tn tunnel, lv OSM level', 'boundary': 'city limits, simplified 10 m'},
}
s = json.dumps(out, separators=(',', ':'))
print('streets-city.json bytes', len(s))
if len(s) < 3 * 1024 * 1024:
    with open(os.path.join(OUT, 'streets-city.json'), 'w') as f: f.write(s)
    print('written')

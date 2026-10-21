# Locate the real spot of one of our fictional venues in Overture places. The real business is used ONLY to place our
# own venue; its name is never written to the game data. Writes data/venue.json (Lot 57) or data/<prefix>venue.json.
#   python3 venue.py             Lot 57: the taproom at 2210 E Orangewood Ave (address match, brewery category)
#   python3 venue.py sportsbar   our sports bar: the bar at 1759 S Claudina Way (address match, confirmed by name)
import re
import shapely
from ana import fetch_local, proj, jdump, venue
V = venue()
COLS = ['id', 'geometry', 'names', 'addresses', 'basic_category', 'taxonomy', 'confidence', 'sources', 'bbox']
# search box (lon0, lon1, lat0, lat1); the sports bar's is about 1 km either way, so it also covers its 1.2 km slice
SEARCH = {'lot57': (-117.90, -117.87, 33.785, 33.805), 'sportsbar': (-117.912, -117.891, 33.795, 33.814)}[V['key']]
# The lookup key for the sports bar: the real business's name as Overture lists it. It is used here only, to confirm
# the record at the address; it is not written anywhere (venue.json keeps the point, the id and the category).
LOOKUP = {'sportsbar': "Lopez & Lefty's"}.get(V['key'])
def norm(s): return re.sub(r'[^a-z0-9]', '', (s or '').lower().replace('&', 'and'))
t, how_read = fetch_local('places', 'place', SEARCH, COLS)
t = t.select(COLS)
a0, a1 = V['addr']
cands, named = [], []
for r in t.to_pylist():
    addr = ' '.join((a.get('freeform') or '') for a in (r['addresses'] or [])).lower()
    by_name = LOOKUP is not None and norm((r['names'] or {}).get('primary')) == norm(LOOKUP)
    if (a0 in addr and a1 in addr) or by_name:
        g = shapely.from_wkb(r['geometry'])
        c = {'id': r['id'], 'category': (r['taxonomy'] or {}).get('primary') or r['basic_category'],
             'confidence': r['confidence'], 'lon': g.x, 'lat': g.y,
             'datasets': sorted({s['dataset'] for s in r['sources']})}
        if a0 in addr and a1 in addr: cands.append(c)
        if by_name: named.append(c)
for c in cands: print(c)
if V['key'] == 'lot57':
    # the taproom itself: the brewery-category record at that address (highest confidence)
    best = max((c for c in cands if 'brew' in (c['category'] or '')), key=lambda c: c['confidence'])
    how = ('Overture places 2026-09-23.1: records whose address freeform contains "2210" and "Orangewood"; '
           'took the brewery-category record (highest confidence). Point only; no name kept.')
else:
    # the bar: the bar-category record at the address that also carries the lookup name (highest confidence)
    ids = {c['id'] for c in named}
    best = max((c for c in cands if c['id'] in ids and 'bar' in (c['category'] or '')), key=lambda c: c['confidence'])
    how = ('Overture places 2026-09-23.1: records whose address freeform contains "1759" and "Claudina"; took the '
           'bar-category record whose name matches the lookup key in tools/anaheim/venue.py (highest confidence). '
           'Point, id and category only; no name kept.')
x, z = proj(best['lon'], best['lat'])
spread = max(((proj(c['lon'], c['lat'])[0] - x) ** 2 + (proj(c['lon'], c['lat'])[1] - z) ** 2) ** .5 for c in cands)
v = {'lon': best['lon'], 'lat': best['lat'], 'x': round(x, 1), 'z': round(z, 1), 'overture_place_id': best['id'],
     'category': best['category'], 'confidence': best['confidence'], 'records_at_address': len(cands),
     'spread_m': round(spread, 1), 'how': how}
if V['key'] != 'lot57':
    # every record at the address or under the lookup name, so build_slice.py can leave them all out of the places file
    v['drop_place_ids'] = sorted({c['id'] for c in cands + named})
    v['read'] = how_read
jdump(v, V['json'], indent=1)
print(how_read)
print(v)

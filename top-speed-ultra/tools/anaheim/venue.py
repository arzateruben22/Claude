# Locate the real taproom at 2210 E Orangewood Ave, Anaheim in Overture places (used ONLY to place our own
# fictional venue; its name is never written to the game data). Writes data/venue.json.
import shapely
from ana import fetch, proj, DATA, jdump
t, _ = fetch('places', 'place', (-117.90, -117.87, 33.785, 33.805),
             ['id', 'geometry', 'names', 'addresses', 'basic_category', 'taxonomy', 'confidence', 'sources', 'bbox'])
cands = []
for r in t.to_pylist():
    addr = ' '.join((a.get('freeform') or '') for a in (r['addresses'] or [])).lower()
    if '2210' in addr and 'orangewood' in addr:
        g = shapely.from_wkb(r['geometry'])
        cands.append({'id': r['id'], 'category': (r['taxonomy'] or {}).get('primary') or r['basic_category'],
                      'confidence': r['confidence'], 'lon': g.x, 'lat': g.y,
                      'datasets': sorted({s['dataset'] for s in r['sources']})})
for c in cands: print(c)
# the taproom itself: the brewery-category record at that address (highest confidence)
best = max((c for c in cands if 'brew' in (c['category'] or '')), key=lambda c: c['confidence'])
x, z = proj(best['lon'], best['lat'])
spread = max(((proj(c['lon'], c['lat'])[0] - x) ** 2 + (proj(c['lon'], c['lat'])[1] - z) ** 2) ** .5 for c in cands)
v = {'lon': best['lon'], 'lat': best['lat'], 'x': round(x, 1), 'z': round(z, 1), 'overture_place_id': best['id'],
     'category': best['category'], 'confidence': best['confidence'], 'records_at_address': len(cands),
     'spread_m': round(spread, 1),
     'how': 'Overture places 2026-09-23.1: records whose address freeform contains "2210" and "Orangewood"; '
            'took the brewery-category record (highest confidence). Point only; no name kept.'}
jdump(v, f'{DATA}/venue.json', indent=1)
print(v)

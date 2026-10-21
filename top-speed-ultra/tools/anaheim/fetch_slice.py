# Read every Overture theme the slice uses, for the slice box only. Raw parquet goes to data/<prefix>slice-*.parquet.
#   python3 fetch_slice.py [venue]     (default lot57; see ana.VENUES)
# Each type comes from a local extract in data/ when one holds every column build_slice.py reads and provably covers
# the box (ana.fetch_local), and is otherwise range-read from the release.
import time, pyarrow.parquet as pq
from ana import fetch, fetch_local, slice_box, box_lonlat, venue
V = venue()
box = slice_box(V); bb = box_lonlat(box, pad=50)
print(V['key'], 'slice box (game m)', box, 'lon/lat', [round(v, 5) for v in bb])
# the columns build_slice.py reads (sources for the licence counts, bbox for the box filter)
NEED = {
    'segment': ['id', 'geometry', 'subtype', 'class', 'subclass', 'subclass_rules', 'names', 'routes', 'connectors',
                'speed_limits', 'width_rules', 'access_restrictions', 'level_rules', 'road_flags', 'road_surface', 'sources', 'bbox'],
    'connector': ['id', 'geometry', 'sources', 'bbox'],
    'building': ['id', 'geometry', 'names', 'class', 'subtype', 'height', 'min_height', 'num_floors', 'roof_shape',
                 'is_underground', 'sources', 'bbox'],
    'place': ['id', 'geometry', 'addresses', 'operating_status', 'confidence', 'basic_category', 'taxonomy', 'sources', 'bbox'],
}
for theme, typ in [('transportation', 'segment'), ('transportation', 'connector'), ('buildings', 'building'),
                   ('buildings', 'building_part'), ('places', 'place'), ('base', 'land_use'), ('base', 'water'),
                   ('base', 'infrastructure'), ('base', 'land_cover')]:
    t0 = time.time()
    if V['key'] == 'lot57':  # Lot 57's caches were range-read in full; kept so a re-run reads exactly what it did
        t, n = fetch(theme, typ, bb, None); how = f'range read, {n} row groups'
    else:
        t, how = fetch_local(theme, typ, bb, NEED.get(typ, []))
    pq.write_table(t, V['raw'](typ))
    print(f'{typ:14s} rows {t.num_rows:6d} {how} {time.time() - t0:.1f}s')

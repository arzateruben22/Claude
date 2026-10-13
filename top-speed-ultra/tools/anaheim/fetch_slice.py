# Range-read every Overture theme the slice uses, for the slice box only. Raw parquet goes to data/slice-*.parquet.
import time, pyarrow.parquet as pq
from ana import fetch, slice_box, box_lonlat, DATA
box = slice_box(); bb = box_lonlat(box, pad=50)
print('slice box (game m)', box, 'lon/lat', [round(v, 5) for v in bb])
for theme, typ in [('transportation', 'segment'), ('transportation', 'connector'), ('buildings', 'building'),
                   ('buildings', 'building_part'), ('places', 'place'), ('base', 'land_use'), ('base', 'water'),
                   ('base', 'infrastructure'), ('base', 'land_cover')]:
    t0 = time.time()
    t, n = fetch(theme, typ, bb, None)
    pq.write_table(t, f'{DATA}/slice-{typ}.parquet')
    print(f'{typ:14s} rows {t.num_rows:6d} row groups read {n} {time.time() - t0:.1f}s')

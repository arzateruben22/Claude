import sys, os, json, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA, exist_ok=True)

import pyarrow.parquet as pq, pyarrow.compute as pc, pyarrow as pa
from rangefile import RangeFile
import shapely
B = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
BB = (-118.15, -117.40, 33.38, 33.97)
h = json.load(open(os.path.join(DATA, 'hits.json')))[0]
COLS = ['id','names','subtype','class','subclass','connectors','routes','level_rules','road_flags','destinations','speed_limits','geometry','bbox']
def rd(r):
    f = pq.ParquetFile(RangeFile(f"{B}/{h['key']}", h['size']))
    t = f.read_row_group(r, columns=COLS)
    m = pc.is_in(t['class'], value_set=pa.array(['motorway','trunk']))
    t = t.filter(m)
    bb = t['bbox']
    m = pc.and_(pc.and_(pc.greater_equal(pc.struct_field(bb,'xmax'), BB[0]), pc.less_equal(pc.struct_field(bb,'xmin'), BB[1])),
                pc.and_(pc.greater_equal(pc.struct_field(bb,'ymax'), BB[2]), pc.less_equal(pc.struct_field(bb,'ymin'), BB[3])))
    return t.filter(m)
tabs = []
with cf.ThreadPoolExecutor(8) as ex:
    for t in ex.map(rd, [r for r, *_ in h['rgs']]):
        tabs.append(t); print(len(t), flush=True)
t = pa.concat_tables(tabs)
rows = t.to_pylist()
out = []
for r in rows:
    g = shapely.from_wkb(r['geometry'])
    r['coords'] = [list(c) for c in g.coords]
    del r['geometry']; del r['bbox']
    out.append(r)
json.dump(out, open(os.path.join(DATA, 'oc_motorways_raw.json'), 'w'))
print('segments', len(out))

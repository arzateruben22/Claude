import sys, os, json, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pyarrow.parquet as pq, pyarrow.compute as pc, pyarrow as pa
from rangefile import RangeFile
import shapely
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
B = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
BB = (-118.15, -117.40, 33.38, 33.97)
h = json.load(open(DATA + '/hits.json'))[0]
COLS = ['id', 'names', 'class', 'subclass', 'connectors', 'level_rules', 'road_flags', 'geometry', 'bbox']
def rd(r):
    f = pq.ParquetFile(RangeFile(f"{B}/{h['key']}", h['size']))
    t = f.read_row_group(r, columns=COLS)
    t = t.filter(pc.is_in(t['class'], value_set=pa.array(['primary', 'secondary', 'tertiary'])))
    bb = t['bbox']
    m = pc.and_(pc.and_(pc.greater_equal(pc.struct_field(bb, 'xmax'), BB[0]), pc.less_equal(pc.struct_field(bb, 'xmin'), BB[1])),
                pc.and_(pc.greater_equal(pc.struct_field(bb, 'ymax'), BB[2]), pc.less_equal(pc.struct_field(bb, 'ymin'), BB[3])))
    return t.filter(m)
tabs = []
with cf.ThreadPoolExecutor(8) as ex:
    for t in ex.map(rd, [r for r, *_ in h['rgs']]): tabs.append(t)
t = pa.concat_tables(tabs)
out = []
for r in t.to_pylist():
    g = shapely.from_wkb(r['geometry'])
    out.append({'id': r['id'], 'name': (r['names'] or {}).get('primary'), 'class': r['class'], 'level_rules': r['level_rules'], 'road_flags': r['road_flags'],
                'coords': [[round(c[0], 7), round(c[1], 7)] for c in g.coords]})
json.dump(out, open(DATA + '/oc_streets_raw.json', 'w'))
print('streets', len(out))

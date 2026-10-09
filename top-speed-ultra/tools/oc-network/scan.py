import sys, os, json, re, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA, exist_ok=True)

import pyarrow.parquet as pq
from rangefile import RangeFile, S
import requests
B = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
PFX = "release/2026-09-23.1/theme=transportation/type=segment/"
BB = (-118.15, -117.40, 33.38, 33.97)
keys = []
tok = None
while True:
    u = f"{B}/?list-type=2&prefix={PFX}" + (f"&continuation-token={tok}" if tok else "")
    t = S.get(u, timeout=60).text
    keys += [(k, int(s)) for k, s in re.findall(r"<Key>([^<]+)</Key>.*?<Size>(\d+)</Size>", t)]
    m = re.search(r"<NextContinuationToken>([^<]+)</NextContinuationToken>", t)
    if not m: break
    tok = requests.utils.quote(m.group(1))
def scan(ks):
    k, size = ks
    f = pq.ParquetFile(RangeFile(f"{B}/{k}", size))
    md = f.metadata
    names = [md.schema.column(i).path for i in range(md.num_columns)]
    ix = {n: names.index(n) for n in ('bbox.xmin','bbox.xmax','bbox.ymin','bbox.ymax')}
    hits = []
    for r in range(md.num_row_groups):
        rg = md.row_group(r)
        st = {n: rg.column(i).statistics for n, i in ix.items()}
        xmin, xmax = st['bbox.xmin'].min, st['bbox.xmax'].max
        ymin, ymax = st['bbox.ymin'].min, st['bbox.ymax'].max
        if xmax >= BB[0] and xmin <= BB[1] and ymax >= BB[2] and ymin <= BB[3]:
            hits.append((r, rg.num_rows, rg.total_byte_size))
    return k, size, hits
out = []
with cf.ThreadPoolExecutor(16) as ex:
    for k, size, hits in ex.map(scan, keys):
        if hits: out.append({'key': k, 'size': size, 'rgs': hits}); print(k[-60:], hits, flush=True)
json.dump(out, open(os.path.join(DATA, 'hits.json'), 'w'))
print('files', len(keys), 'with hits', len(out))

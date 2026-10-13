# Find the parquet row groups of one Overture theme/type whose bbox statistics intersect CITY_BB.
# Reads only file footers (HTTP range reads). Writes data/hits-<theme>-<type>.json with each hit row group's bbox.
# usage: python3 scan.py transportation segment
import sys, re, concurrent.futures as cf, requests
from ana import B, prefix, CITY_BB, DATA, RangeFile, S, jdump
import pyarrow.parquet as pq
theme, typ = sys.argv[1], sys.argv[2]
BB = CITY_BB
keys, tok = [], None
while True:
    u = f'{B}/?list-type=2&prefix={prefix(theme, typ)}' + (f'&continuation-token={tok}' if tok else '')
    t = S.get(u, timeout=60).text
    keys += [(k, int(s)) for k, s in re.findall(r'<Key>([^<]+)</Key>.*?<Size>(\d+)</Size>', t)]
    m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', t)
    if not m: break
    tok = requests.utils.quote(m.group(1))
def scan(ks):
    k, size = ks
    for attempt in range(3):
        try:
            md = pq.ParquetFile(RangeFile(f'{B}/{k}', size)).metadata
            break
        except Exception:
            if attempt == 2: raise
    names = [md.schema.column(i).path for i in range(md.num_columns)]
    ix = {n: names.index(n) for n in ('bbox.xmin', 'bbox.xmax', 'bbox.ymin', 'bbox.ymax')}
    hits = []
    for r in range(md.num_row_groups):
        rg = md.row_group(r)
        st = {n: rg.column(i).statistics for n, i in ix.items()}
        xmin, xmax, ymin, ymax = st['bbox.xmin'].min, st['bbox.xmax'].max, st['bbox.ymin'].min, st['bbox.ymax'].max
        if xmax >= BB[0] and xmin <= BB[1] and ymax >= BB[2] and ymin <= BB[3]:
            hits.append([r, rg.num_rows, rg.total_byte_size, [xmin, ymin, xmax, ymax]])
    return k, size, hits
out = []
with cf.ThreadPoolExecutor(16) as ex:
    for k, size, hits in ex.map(scan, keys):
        if hits: out.append({'key': k, 'size': size, 'rgs': hits})
jdump(out, f'{DATA}/hits-{theme}-{typ}.json')
print(theme, typ, 'files', len(keys), 'with hits', len(out), 'row groups', sum(len(h['rgs']) for h in out),
      'MB', round(sum(r[2] for h in out for r in h['rgs']) / 1e6, 1))

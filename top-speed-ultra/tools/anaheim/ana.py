# Shared constants for the Anaheim pipeline. The projection is the game's own (tools/oc-network/common.py),
# so every coordinate here lines up with src/data/oc-network.json.
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
import importlib.util
_OCN = os.path.join(HERE, '..', 'oc-network')
def _load(name):
    spec = importlib.util.spec_from_file_location('ocn_' + name, os.path.join(_OCN, name + '.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
_c = _load('common')
proj, unproj, LAT0, LON0, KX, KZ = _c.proj, _c.unproj, _c.LAT0, _c.LON0, _c.KX, _c.KZ  # game projection: x east, z south, m
_r = _load('rangefile')
RangeFile, S = _r.RangeFile, _r.S  # HTTP range reads
DATA = os.path.join(HERE, 'data')
os.makedirs(DATA, exist_ok=True)
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'anaheim')
RELEASE = '2026-09-23.1'
B = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com'
def prefix(theme, typ): return f'release/{RELEASE}/theme={theme}/type={typ}/'
# Search box for the whole city of Anaheim (lon0, lon1, lat0, lat1), a little larger than the city limits.
CITY_BB = (-118.03, -117.65, 33.77, 33.91)
# The slice is set by slice_bbox() once the venue is known (see venue.py); default centre is a placeholder.
def jload(p): return json.load(open(p))
def jdump(o, p, **kw):
    with open(p, 'w') as f: json.dump(o, f, **kw)

import concurrent.futures as _cf
def fetch(theme, typ, bb, columns, workers=8, rowfilter=None):
    """Read only the row groups (found by scan.py) whose bbox stats intersect bb=(lon0,lon1,lat0,lat1),
    then keep the rows whose own bbox intersects bb. Returns one pyarrow Table."""
    import pyarrow as pa, pyarrow.compute as pc, pyarrow.parquet as pq
    hits = jload(f'{DATA}/hits-{theme}-{typ}.json')
    jobs = [(h['key'], h['size'], r[0]) for h in hits for r in h['rgs']
            if r[3][2] >= bb[0] and r[3][0] <= bb[1] and r[3][3] >= bb[2] and r[3][1] <= bb[3]]
    def rd(j):
        k, size, rg = j
        for attempt in range(3):
            try:
                t = pq.ParquetFile(RangeFile(f'{B}/{k}', size)).read_row_group(rg, columns=columns)
                break
            except Exception:
                if attempt == 2: raise
        b = t['bbox']
        m = pc.and_(pc.and_(pc.greater_equal(pc.struct_field(b, 'xmax'), bb[0]), pc.less_equal(pc.struct_field(b, 'xmin'), bb[1])),
                    pc.and_(pc.greater_equal(pc.struct_field(b, 'ymax'), bb[2]), pc.less_equal(pc.struct_field(b, 'ymin'), bb[3])))
        t = t.filter(m)
        return rowfilter(t) if rowfilter else t
    with _cf.ThreadPoolExecutor(workers) as ex:
        tabs = list(ex.map(rd, jobs))
    import pyarrow as pa
    return pa.concat_tables(tabs), len(jobs)

# The walkable slice: 3 km x 3 km around the venue (x east, z south, metres, game coordinates), reaching
# Katella Ave and the arena to the north, the CA-57 and Douglass Rd to the east, State College Blvd and the
# I-5 to the west and south-west.
SLICE_W, SLICE_E, SLICE_N, SLICE_S = 1500, 1500, 1800, 1200
def slice_box():
    v = jload(f'{DATA}/venue.json')
    return (round(v['x'] - SLICE_W), round(v['z'] - SLICE_N), round(v['x'] + SLICE_E), round(v['z'] + SLICE_S))
def box_lonlat(box, pad=0):
    lon0, lat1 = unproj(box[0] - pad, box[1] - pad); lon1, lat0 = unproj(box[2] + pad, box[3] + pad)
    return (lon0, lon1, lat0, lat1)

# ---- geometry helpers shared by the builders
import numpy as _np
def to_xz(geom):
    """shapely geometry in lon/lat -> the same geometry in game metres (x east, z south)."""
    import shapely
    def f(c):
        c = _np.asarray(c, dtype=float)
        return _np.column_stack(((c[:, 0] - LON0) * KX, -(c[:, 1] - LAT0) * KZ))
    return shapely.transform(geom, f)
def qpts(coords, ring=False):
    """quantise to decimetres and drop repeated points (and the closing point of a ring)."""
    out = []
    for x, z in coords:
        p = (int(round(x * 10)), int(round(z * 10)))
        if not out or out[-1] != p: out.append(p)
    if ring and len(out) > 1 and out[0] == out[-1]: out.pop()
    return out
def delta(pts):
    """[(x,z),...] dm -> flat [x0, z0, dx1, dz1, ...] (first point absolute game decimetres)."""
    flat, px, pz = [], 0, 0
    for x, z in pts:
        flat += [x - px, z - pz]; px, pz = x, z
    return flat
class Dict:
    def __init__(self): self.items, self.ix = [], {}
    def __call__(self, v):
        if v not in self.ix: self.ix[v] = len(self.items); self.items.append(v)
        return self.ix[v]

# ---- street names: public facts, but OSM sometimes names a way after the business or facility it serves
import re as _re
STREET_CLASSES = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street'}
_FACILITY = _re.compile(r'\b(school|hotels?|hub|entrance|enterance|estates|mobil|center|centre|mall|hospital|church|'
                        r'brewing|brewery|stadium|arena|lot|parking|garage|gate|office|campus|resort|inn)\b', _re.I)
def street_name(names, subtype, cls):
    """the primary name of a street, or None (non-street classes, or a name that reads as a facility/business)."""
    nm = (names or {}).get('primary')
    if not nm or subtype != 'road' or cls not in STREET_CLASSES: return None
    if _FACILITY.search(nm): return None
    return nm

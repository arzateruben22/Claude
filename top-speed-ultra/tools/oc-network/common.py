import os
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
import json, math
LAT0, LON0 = 33.72, -117.83
KX = 111320.0 * math.cos(math.radians(LAT0)); KZ = 110574.0
def proj(lon, lat): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)
def unproj(x, z): return (x / KX + LON0, -z / KZ + LAT0)
ROUTES = {  # key -> (network, ref)
  'I-5': ('US:I', '5'), 'I-405': ('US:I', '405'), 'SR-91': ('US:CA', '91'), 'SR-55': ('US:CA', '55'), 'SR-57': ('US:CA', '57'),
  'SR-22': ('US:CA', '22'), 'SR-73': ('US:CA', '73'), 'SR-133': ('US:CA', '133'), 'SR-241': ('US:CA', '241'), 'SR-261': ('US:CA', '261'),
}
def load():
    d = json.load(open(DATA + '/oc_motorways_raw.json'))
    for r in d:
        r['xy'] = [proj(lon, lat) for lon, lat in r['coords']]
        r['refs'] = set()
        for rt in (r['routes'] or []):
            for k, (net, ref) in ROUTES.items():
                if rt.get('network') == net and rt.get('ref') == ref: r['refs'].add(k)
    return d
def seglen(xy): return sum(math.dist(xy[i], xy[i+1]) for i in range(len(xy)-1))

import sys, os, math, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rangefile import S
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'dem13')
os.makedirs(DATA, exist_ok=True)
Z = 13
def tx(lon): return int((lon + 180) / 360 * 2 ** Z)
def ty(lat): r = math.radians(lat); return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** Z)
x0, x1 = tx(-118.16), tx(-117.39); y0, y1 = ty(33.98), ty(33.37)
jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
print('tiles', len(jobs), x0, x1, y0, y1, flush=True)
def get(xy):
    x, y = xy; p = f"{DATA}/{x}_{y}.png"
    if os.path.exists(p) and os.path.getsize(p) > 1000: return 0
    for i in range(4):
        try:
            r = S.get(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png", timeout=60); r.raise_for_status()
            open(p, 'wb').write(r.content); return len(r.content)
        except Exception as e:
            if i == 3: print('fail', x, y, e)
with cf.ThreadPoolExecutor(12) as ex: n = sum(v or 0 for v in ex.map(get, jobs))
print('bytes', n)

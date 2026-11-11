"""Season 3: rebuild <ep>/episode.json caps (+ the -y variant when given 'y') from film.json captions.  python3 set/s3_caps.py ep16 [y]"""
import json, re, sys
d = sys.argv[1]; src = "film-yt.json" if len(sys.argv) > 2 else "film.json"; dst = f"{d}{'y' if len(sys.argv) > 2 else ''}/episode.json"
film = json.load(open(f"{d}/{src}")); ep = json.load(open(dst))
def pages_for(ws):
    ph = []; cur = []
    for x in ws:
        cur.append(x)
        if re.search(r'[.?!…,]$', x['w']): ph.append(cur); cur = []
    if cur: ph.append(cur)
    out = []
    for p in ph:
        if out and (len(p) < 3 or len(out[-1]) < 3) and len(out[-1]) + len(p) <= 7: out[-1] += p
        else: out.append(p)
    return out
pages = []
for lid in film['lines']: pages += pages_for([x for x in film['captions'] if x['line'] == lid])
caps = []
for i, p in enumerate(pages):
    t0 = p[0]['t0'] - 0.05; t1 = p[-1]['t1'] + 0.45
    if i + 1 < len(pages): t1 = min(t1, pages[i + 1][0]['t0'] - 0.02)
    caps.append([round(t0, 3), round(t1, 3), ' '.join(x['w'] for x in p)])
ep['caps'] = caps; json.dump(ep, open(dst, 'w'), indent=1, ensure_ascii=False); print(len(caps), caps[1], caps[-3])

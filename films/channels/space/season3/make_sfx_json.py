"""make_sfx_json.py: epNN/sfx.json for the delivered parts (palette space; kits/cinema/sound/sfx.py): every visible change gets a sound. Times come from the part's timeline
(long01/out/part<n>.json: beats, counter keys, captions); cues after the CTA are anchored to the chapter's cliffhanger caption so they follow the 'subscribe' variant too."""
import json, os
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")); O = R + "/long01/out"
for n in range(1, 9):
    t = json.load(open(f"{O}/part{n}.json")); cues = []; seed = [n * 100]
    def add(at, kind, **kw): seed[0] += 1; cues.append({"at": at, "kind": kind, **kw, "seed": seed[0]})
    cta = t.get("cta_at", 1e9); loop = f"ch{n}_loop"; r = lambda x: round(x, 2)
    add(0.1, "mass", dur=6.0, gain=-3)                                                     # the opening: a heavy mass under the first hook
    for b in t["beats"]:
        t0, t1, k = b["t0"], b["t1"], b["kind"]; d = r(t1 - t0)
        if k == "approach":
            add(r(t0 - 0.2), "mass", dur=r(d + 1.8), gain=-2, f0=41); add(r(t0), "whoosh", dur=d, pan=[-0.4, 0.4], gain=-2)
            add(r(t1), "boom", dur=2.5, gain=-5); add(r(t1), "tick", gain=-2)
        elif k in ("grow", "pull"): add(r(t0), "whoosh", dur=d, pan=[0.3, -0.3], gain=-3); add(r(t0 + 0.2), "mass", dur=r(d + 0.8), gain=-4, f0=44)
        elif k in ("tide", "climb"): add(r(t0), "surge", dur=r(d + 0.5), gain=1); add(r(t0 + d * 0.5), "wave", dur=2.4, gain=-1)
        elif k == "bright": add(r(t0), "shimmer", dur=r(d + 0.5), gain=-2); add(r(t0), "tick", gain=-3)
        elif k == "eclipse": add(r(t0), "hush", dur=r(d + 1.0), gain=0); add(r(t0 + 0.3), "mass", dur=r(d + 0.5), gain=-5, f0=38)
        elif k == "flex": add(r(t0 + 0.4), "crack", dur=1.4, pan=0.2, gain=-1); add(r(t0), "mass", dur=r(d + 0.6), gain=-1, f0=36)
        elif k in ("rise", "slide"): add(r(t0), "whoosh", dur=d, pan=[0.5, -0.5], gain=-1); add(r(t0 + 0.3), "mass", dur=r(d), gain=-3, f0=40)
        elif k == "strain": add(r(t0 + 0.2), "creak", dur=2.2, pan=-0.3, gain=0); add(r(t0 + 1.3), "crack", dur=1.5, pan=0.2, gain=-1); add(r(t0), "mass", dur=r(d + 1), gain=0, f0=38)
        elif k == "drift": add(r(t0), "tick", gain=-3, repeat=int(d / 0.5), every=0.5)
        elif k == "sun": add(r(t0), "whoosh", dur=d, pan=[-0.5, 0.5], gain=-3)
        elif k == "sunbeam": add(r(t0), "shimmer", dur=d, gain=-3)
        elif k == "tick": add(r(t0), "tick", gain=-2, repeat=max(2, int(d / 0.5)), every=0.5)
    near = [b["t1"] for b in t["beats"] if b["kind"] == "approach"]                          # the counter's other milestones: a tick and a boom that grows as the Moon nears
    ks = [k for k in t["km"] if len(k) >= 2]; last = ks[0][1] if ks else 0
    for i, k in enumerate(ks[1:], 1):
        if k[1] != ks[i - 1][1] and not any(abs(k[0] - x) < 0.6 for x in near) and k[0] < cta:
            add(r(k[0]), "tick", gain=-2); add(r(k[0]), "boom", dur=2.2, gain=r(-8 + min(6, (1 - k[1] / 400000) * 7)))
    add(f"cap:{loop}-1.4", "riser", until=f"capend:{loop}+0.1", gain=2)                     # a riser into the cliffhanger, cut at its end
    add(f"capend:{loop}+0.1", "boom", dur=3.0, gain=0)
    if n == 8: add(f"capend:{loop}+0.1", "debris", dur=3.0, gain=-3)
    cues.sort(key=lambda c: (c["at"] if isinstance(c["at"], (int, float)) else 1e6))
    json.dump({"palette": "space", "cues": cues}, open(f"{R}/ep{12 + n}/sfx.json", "w"), indent=1); print(n, len(cues), "cues")

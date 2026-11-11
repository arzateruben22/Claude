"""The film's capsule mannequin as a transparent PNG for the cover variants (cover-options/<part>-capsule.jpg): rendered on black and on white by scene.mjs (hero pose, figure only),
the alpha recovered from the two renders. Output: art/capsule/<name>.png (RGBA, tight crop).
  python3 -I .../parts/capsule.py NAME ARMS TILT [LIFT]"""
import glob, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent; ES = HERE.parent; repo = HERE.parents[5]
name, arms, tilt = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); lift = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
OUT = ES / "art/capsule"; OUT.mkdir(parents=True, exist_ok=True)
imgs = []
for bg in (0.0, 1.0):
    f = json.loads((HERE / "part1/film.json").read_text())
    f.update(captions=[], badges=[], voice=[], thumb=True, hero={"arms": arms, "tilt": tilt, "lift": lift}, figOnly={"bg": bg}, cams=[{"t0": -1.0, "mode": "hero"}])
    f["title"] = {**f["title"], "t0": -20.0, "t1": -19.0, "sig": -18.0}; f["end"] = dict(f["end"]); f["endCard"] = 9999.0
    f["theme"] = "../../../../theme.json"; f["scene"] = "../../scene.mjs"
    D = HERE / "capsule-film"; D.mkdir(exist_ok=True); (D / "film.json").write_text(json.dumps(f, indent=1))
    b = f"/tmp/capsule-{name}-{int(bg)}"; subprocess.run(["rm", "-rf", b])
    subprocess.run(["node", str(repo / "kits/cinema/film/render.mjs"), "--film", str(D), "--tier", "final", "--aspect", "9x16", "--times", "28", "--build", b, "--share-cpu"], check=True, capture_output=True)
    imgs.append(np.asarray(Image.open(glob.glob(f"{b}/final/9x16/frames/*/*.png")[0]).convert("RGB")).astype(np.float32))
k, w = imgs
WB = float(w[5, 5].mean())                                                         # the grey backdrop's value (below the bloom threshold)
alpha = np.clip(1.0 - (w - k).mean(axis=2) / WB, 0, 1)                        # white-black difference = how much background shows through
rgb = np.where(alpha[..., None] > 0.02, k / np.maximum(alpha[..., None], 0.02), 0).clip(0, 255)       # premultiplied against black
ys, xs = np.where(alpha > 0.25); box = (xs.min() - 20, ys.min() - 20, xs.max() + 20, ys.max() + 20)
im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA").crop(box); im.save(OUT / f"{name}.png"); print(name, im.size)

"""Cut a part's 9:16 cover from the film's own scene: the figure in the setup, no readout, captions, badges or title (PACKAGING.md: image-only).

  python3 -I films/channels/whatif/longform/earth-spin/parts/cover.py N SECONDS       (then run render.mjs --times SECONDS on the printed folder, or pass --render)"""
import json, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
N, T = int(sys.argv[1]), float(sys.argv[2])
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
STREAK = float(arg("--streak", 0)); CAM = arg("--cam"); HERO = arg("--hero"); KEYS = arg("--keys"); TEXT = arg("--text", ""); TY = float(arg("--ty", 0.12))   # --streak S: lighten-blend 12 frames over S seconds (the Sun/air as streaks); --text: 1-4 words
D = HERE / f"part{N}"
f = json.loads((D / "film.json").read_text())
f.update(captions=[], badges=[], voice=[], thumb=True)
f["title"] = {**f["title"], "t0": -20.0, "t1": -19.0, "sig": -18.0}
if CAM: f["cams"] = [{"t0": -1.0, "mode": CAM}]
if HERO: h = [float(x) for x in HERO.split(",")]; f["hero"] = {"arms": h[0], "tilt": h[1], "lift": h[2] if len(h) > 2 else 0.0}   # the figure's pose on the cover
if KEYS: f["world"] = {**f["world"], "keys": [[0.0, float(KEYS)], [9999.0, float(KEYS)]]}
f["end"] = dict(f["end"]); f["endCard"] = 9999.0
C = HERE / f"cover{N}"; C.mkdir(exist_ok=True)
json.dump(f, open(C / "film.json", "w"), indent=1)
f2 = json.loads((C / "film.json").read_text()); f2["theme"] = "../../../../theme.json"; f2["scene"] = "../../scene.mjs"
(C / "film.json").write_text(json.dumps(f2, indent=1))
repo = HERE.parents[5]
subprocess.run(["node", str(repo / "kits/cinema/film/render.mjs"), "--film", str(C), "--tier", "final", "--aspect", "9x16", "--times", ",".join(f"{T + STREAK * i / 11:.3f}" for i in range(12)) if STREAK else str(T), "--build", f"/tmp/cover{N}", "--share-cpu"], check=True, capture_output=True)
import glob
from PIL import Image
from PIL import ImageChops, ImageDraw, ImageFont, ImageFilter
pngs = sorted(glob.glob(f"/tmp/cover{N}/final/9x16/frames/*/*.png"))
im = Image.open(pngs[0]).convert("RGB")
for p in pngs[1:]: im = ImageChops.lighter(im, Image.open(p).convert("RGB"))
if TEXT:
    f = ImageFont.truetype(str(HERE.parents[2] / "fonts/BricolageGrotesque-VF.ttf"), 150); f.set_variation_by_axes([96, 800, 100][:len(f.get_variation_axes())]) if False else None
    try: f.set_variation_by_name("ExtraBold")
    except Exception: pass
    words = TEXT.split(); lines = [" ".join(words)] if len(words) <= 2 else [" ".join(words[:2]), " ".join(words[2:])]
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh); y = int(im.height * TY)
    for ln in lines:
        w = d.textlength(ln, font=f); d.text(((im.width - w) / 2, y), ln, font=f, fill=(0, 0, 0, 235)); y += 170
    sh = sh.filter(ImageFilter.GaussianBlur(14)); im = Image.alpha_composite(im.convert("RGBA"), sh)
    d = ImageDraw.Draw(im); y = int(im.height * TY)
    for ln in lines:
        w = d.textlength(ln, font=f); d.text(((im.width - w) / 2, y), ln, font=f, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(12, 14, 18, 255)); y += 170
    im = im.convert("RGB")
out = D / "out"; out.mkdir(exist_ok=True)
im.save(out / f"possibility-lab-s3p{N}-cover.jpg", quality=92, subsampling=0)
im.resize((480, 853), Image.LANCZOS).save(out / f"possibility-lab-s3p{N}-cover-480.jpg", quality=90)
print("cover", N, "at", T, "s ->", out / f"possibility-lab-s3p{N}-cover.jpg")

"""Cut a part's 9:16 cover from the film's own scene: the figure in the setup, no readout, captions, badges or title (PACKAGING.md: image-only).

  python3 -I films/channels/whatif/longform/earth-spin/parts/cover.py N SECONDS       (then run render.mjs --times SECONDS on the printed folder, or pass --render)"""
import json, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
N, T = int(sys.argv[1]), float(sys.argv[2])
D = HERE / f"part{N}"
f = json.loads((D / "film.json").read_text())
f.update(captions=[], badges=[], voice=[], thumb=True)
f["title"] = {**f["title"], "t0": -20.0, "t1": -19.0, "sig": -18.0}
f["end"] = dict(f["end"]); f["endCard"] = 9999.0
C = HERE / f"cover{N}"; C.mkdir(exist_ok=True)
json.dump(f, open(C / "film.json", "w"), indent=1)
f2 = json.loads((C / "film.json").read_text()); f2["theme"] = "../../../../theme.json"; f2["scene"] = "../../scene.mjs"
(C / "film.json").write_text(json.dumps(f2, indent=1))
repo = HERE.parents[5]
subprocess.run(["node", str(repo / "kits/cinema/film/render.mjs"), "--film", str(C), "--tier", "final", "--aspect", "9x16", "--times", str(T), "--build", f"/tmp/cover{N}", "--share-cpu"], check=True, capture_output=True)
import glob
from PIL import Image
png = glob.glob(f"/tmp/cover{N}/final/9x16/frames/*/*.png")[0]
im = Image.open(png).convert("RGB")
out = D / "out"; out.mkdir(exist_ok=True)
im.save(out / f"possibility-lab-s3p{N}-cover.jpg", quality=92, subsampling=0)
im.resize((480, 853), Image.LANCZOS).save(out / f"possibility-lab-s3p{N}-cover-480.jpg", quality=90)
print("cover", N, "at", T, "s ->", out / f"possibility-lab-s3p{N}-cover.jpg")

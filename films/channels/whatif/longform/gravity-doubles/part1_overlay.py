"""The caption overlay for the finished picture, when the voice arrives: no 3-D, no second picture render, a few minutes of work.
  python3 -I part1_overlay.py --vo <dir with words.json for the takes (line ids l01..l11)> --picture <part1-picture.mp4> --out <result.mp4>
        [--audio <final mix>] [--y 0.70] [--span A,B   (seconds, a test cut)]
How: the word-lit captions (from words.json, each line placed at its window's speech start) only ever show a few dozen distinct looks (a page x which word is lit).
 1. the kit renders ONE still per distinct look, twice (over black and over white; overlay_scene.mjs, 1080x1920, no 3-D)
 2. a difference matte turns each pair into a transparent PNG (alpha = 1 - (white - black), colour = black / alpha)
 3. ffmpeg lays them over the picture frame by frame (a fade at each page's ends, the same 0.12 s as the picture's captions) and muxes the audio.
The thumbs-up + bell pop-up (cta.py) can go on as a second layer the same way."""
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[4]; D = HERE / "part1"; FPS = 30; FADE = 0.12
ap = argparse.ArgumentParser(); ap.add_argument("--vo", required=True); ap.add_argument("--picture", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--audio"); ap.add_argument("--y", type=float, default=0.70); ap.add_argument("--span"); ap.add_argument("--keep", action="store_true"); a = ap.parse_args()
film = json.loads((D / "film.json").read_text()); Wn = {l["id"]: l for l in json.loads((D / "windows.json").read_text())["lines"]}
words = {l["id"]: l["words"] for l in json.loads((Path(a.vo) / "words.json").read_text())["lines"]}
W_, H_ = 1080, 1920; span = [float(x) for x in a.span.split(",")] if a.span else [0.0, film["dur"]]
# ── captions: pages of up to 8 words, two rows of up to 4 ──
pages = []
for lid, W in Wn.items():
    ws = [(w["w"], round(W["speech_t0"] + w["start"], 3), round(W["speech_t0"] + w["end"], 3)) for w in words[lid]]; cur = []
    def flush():
        global cur
        if not cur: return
        rows = [cur[i:i + 4] for i in range(0, len(cur), 4)] if len(cur) > 4 else [cur]
        if len(rows) == 2 and len(rows[1]) == 1: rows = [cur[:len(cur) - 2], cur[len(cur) - 2:]]
        pages.append({"t0": round(cur[0][1] - 0.08, 3), "t1": round(cur[-1][2] + 0.3, 3), "lines": [[[w, t] for w, t, _ in r] for r in rows]}); cur = []
    for w in ws:
        cur.append(w)
        if w[0].rstrip().endswith((".", "?", "!", ":", "…")) or len(cur) >= 8: flush()
    flush()
for i in range(len(pages) - 1): pages[i]["t1"] = round(min(pages[i]["t1"], pages[i + 1]["t0"] - 0.02), 3)
(D / "captions.json").write_text(json.dumps(pages, indent=1, ensure_ascii=False))
# ── which look is on screen at every frame (the kit's own rule: the page whose [t0, t1) holds t, the last word with start <= t) ──
def look(t):
    k = -1
    for j, p in enumerate(pages):
        if p["t0"] <= t < p["t1"]: k = j
    if k < 0: return None, 0.0
    p = pages[k]; on = -1
    for j, (_, wt) in enumerate([w for r in p["lines"] for w in r]):
        if t >= wt: on = j
    return (k, on), max(0.0, min(1.0, (t - p["t0"]) / FADE, (p["t1"] - t) / FADE))
f0, f1 = int(round(span[0] * FPS)), int(round(span[1] * FPS)); per_frame = [look(n / FPS) for n in range(f0, f1)]
rep = {}
for n, (st, op) in zip(range(f0, f1), per_frame):
    if st is not None and (st not in rep or (op >= 1 and rep[st][1] < 1)): rep[st] = (n, op)
print(len(rep), "distinct looks over", f1 - f0, "frames")
# ── the two still passes ──
env = dict(os.environ, PLAYWRIGHT_DIR=subprocess.run("dirname $(npm root -g)", shell=True, capture_output=True, text=True).stdout.strip(), CHROMIUM="/opt/pw-browsers/chromium")
times = ",".join(f"{n / FPS:.4f}" for n, _ in sorted(rep.values()))
for col in ("black", "white"):
    F = HERE / f"part1-overlay-{col}"; F.mkdir(exist_ok=True)
    of = {"id": f"gravity-doubles-part1-overlay-{col}", "theme": "../../../theme.json", "scene": "../overlay_scene.mjs", "fps": 30, "dur": film["dur"], "v2": True, "overlay": col, "poster": 1.0,
          "shots": [{"at": 0.0, "name": "eye", "beat": "l01"}], "beats": film["beats"], "world": film["world"], "cue": film["cue"], "badges": [], "title": {"series": "", "title": "", "t0": -20, "t1": -19, "sig": -18},
          "endCard": 9999, "end": {"title": "", "follow": "", "next": ""}, "cams": [], "robot": [], "fx": {}, "chips": [], "voice": [], "captions": pages, "captionOpts": {"y": a.y, "fade": 1e-6}}
    (F / "film.json").write_text(json.dumps(of, indent=1, ensure_ascii=False))
    B = Path(f"/tmp/gd-overlay-{col}"); shutil.rmtree(B, ignore_errors=True)
    r = subprocess.run(["node", str(REPO / "kits/cinema/film/render.mjs"), "--film", str(F), "--tier", "final", "--aspect", "9x16", "--build", str(B), "--times", times, "--share-cpu"], env=env, capture_output=True, text=True)
    if r.returncode: sys.exit(f"{col} pass failed: {r.stdout[-500:]} {r.stderr[-500:]}")
# ── the mattes (cropped to the caption band) ──
Y0 = max(0, int(a.y * H_) - 60); BH = 400; band = (0, Y0, W_, min(H_, Y0 + BH)); O = Path("/tmp/gd-overlay-rgba"); shutil.rmtree(O, ignore_errors=True); O.mkdir()
def still(col, n): return next(Path(f"/tmp/gd-overlay-{col}/final/9x16/frames").rglob(f"{n:05d}.png"))
mat = {}
for st, (n, _) in rep.items():
    K = np.asarray(Image.open(still("black", n)).convert("RGB").crop(band), np.float32); Wt = np.asarray(Image.open(still("white", n)).convert("RGB").crop(band), np.float32)
    al = np.clip(1.0 - (Wt - K).mean(axis=2) / 255.0, 0, 1); col = np.where(al[..., None] > 0.004, K / np.maximum(al[..., None], 0.004), 0)
    rgba = np.dstack([np.clip(col, 0, 255), al * 255]).astype(np.uint8); mat[st] = rgba; Image.fromarray(rgba, "RGBA").save(O / f"s{st[0]:02d}_{st[1] + 1:02d}.png")
blank = np.zeros((band[3] - band[1], W_, 4), np.uint8); Image.fromarray(blank, "RGBA").save(O / "blank.png")
lst, prev, cnt = [], None, 0
def emit(name, c):
    if c: lst.append((name, c / FPS))
for (st, op) in per_frame:
    if st is None: name = "blank.png"
    elif op >= 0.995: name = f"s{st[0]:02d}_{st[1] + 1:02d}.png"
    else:
        name = f"s{st[0]:02d}_{st[1] + 1:02d}_o{int(round(op * 20)):02d}.png"
        if not (O / name).exists(): x = mat[st].copy(); x[..., 3] = (x[..., 3] * op).astype(np.uint8); Image.fromarray(x, "RGBA").save(O / name)
    if name == prev: cnt += 1
    else: emit(prev, cnt); prev, cnt = name, 1
emit(prev, cnt)
with open(O / "list.txt", "w") as fh:
    for name, d in lst: fh.write(f"file '{O / name}'\nduration {d:.6f}\n")
    fh.write(f"file '{O / lst[-1][0]}'\n")
# ── composite ──
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(span[0]), "-t", str(span[1] - span[0]), "-i", a.picture, "-f", "concat", "-safe", "0", "-i", str(O / "list.txt")]
if a.audio: cmd += ["-ss", str(span[0]), "-t", str(span[1] - span[0]), "-i", a.audio]
cmd += ["-filter_complex", f"[1:v]fps={FPS},format=rgba[o];[0:v][o]overlay=0:{Y0}:format=auto:shortest=1,format=yuv420p[v]", "-map", "[v]"] + (["-map", "2:a"] if a.audio else []) + ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p"] + (["-c:a", "aac", "-b:a", "256k"] if a.audio else []) + ["-shortest", a.out]
subprocess.run(cmd, check=True)
print("overlay done", a.out)

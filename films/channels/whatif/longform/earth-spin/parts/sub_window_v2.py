"""Build the YouTube version of a part with "subscribe" on screen where the audio says it: re-render ONLY the chunk(s) holding the like/follow line with its caption
changed, splice them into the finished chunks, assemble with the "subscribe" mix, and upscale to 1440p.

  python3 -I films/channels/whatif/longform/earth-spin/parts/sub_window.py N      (after the 9:16 final is rendered and delivered to ep{12+N})
Writes ep{12+N}/out/possibility-lab-s3pN-9x16-youtube.mp4."""
import json, shutil, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ES = HERE.parent
REPO = ES.parents[4]
N = int(sys.argv[1])
D = HERE / f"part{N}v2"
EPD = ES.parents[1] / f"ep{12 + N}"
film = json.loads((D / "film.json").read_text())
items = json.loads((D / "items.json").read_text())
cta = next(i for i in items if i["kind"] == "cta")
v = next(x for x in film["voice"] if x["id"] == cta["vo"])
t0, t1 = v["t"], v["t"] + v["dur"]
CH = 10.0
c0, c1 = int((t0 - 0.5) // CH), int((t1 + 0.5) // CH)
alt = json.loads(json.dumps(film))
n = 0
for pg in alt["captions"]:
    for ln in pg["lines"]:
        for w in ln:
            if w[0].strip(".,").lower() == "follow": w[0] = w[0].replace("follow", "subscribe"); n += 1
assert n >= 1, "no 'follow' caption word found"
S = HERE / f"part{N}v2-sub"; S.mkdir(exist_ok=True)
(S / "film.json").write_text(json.dumps(alt, indent=1, ensure_ascii=False))
B = Path(f"/tmp/sub{N}")
if B.exists(): shutil.rmtree(B)
shutil.copytree(D / "build/final", B / "final")
for c in range(c0, c1 + 1):
    (B / f"final/9x16/chunks/{c:03d}.mp4").unlink(missing_ok=True)
    shutil.rmtree(B / f"final/9x16/frames/{c:03d}", ignore_errors=True)
node = ["node", str(REPO / "kits/cinema/film/render.mjs"), "--film", str(S), "--tier", "final", "--aspect", "9x16", "--build", str(B), "--force-mixed", "--share-cpu"]
subprocess.run(node + ["--from", str(c0 * CH), "--to", str(min(film["dur"], (c1 + 1) * CH))], check=True, capture_output=True)
out = Path(f"/tmp/sub{N}-out"); out.mkdir(exist_ok=True)
subprocess.run(node + ["--assemble", "--audio", str(D / "build/audio-sub/mix-sfx.m4a"), "--name", f"possibility-lab-s3p{N}-v2-9x16", "--out", str(out)], check=True, capture_output=True)
# YouTube 1440p from the spliced master
T = Path(f"/tmp/subep{N}"); (T / "out").mkdir(parents=True, exist_ok=True)
shutil.copy2(out / f"possibility-lab-s3p{N}-v2-9x16.mp4", T / "out" / f"possibility-lab-s3p{N}-v2-9x16.mp4")
shutil.copy2(D / "film.json", T / "film.json")
subprocess.run(["python3", "-I", str(REPO / "kits/cinema/film/youtube1440.py"), str(T), "--force"], check=True, capture_output=True)
shutil.copy2(T / "out" / f"possibility-lab-s3p{N}-v2-9x16-youtube.mp4", EPD / "out/v2" / f"possibility-lab-s3p{N}-v2-9x16-youtube.mp4")
print(f"ep{12 + N}: YouTube file re-spliced ({c0}..{c1} chunks), {n} caption word(s) now say subscribe")

"""assemble_s3.py <name> [--audio-only]: the mix for one timeline (long, part1..8): the voice clips placed on the timeline (the chapter file is cut at the
like/follow insertion), the channel's music under them (studio mix, ducked, mastered to -14 LUFS), then the rendered picture + mix -> out/<name>.mp4.
Voice swap: lines.json is the only input that changes; run build_timeline.py, then this."""
import json, os, subprocess, sys, shutil
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; OUT = L1 + "/out"; name = sys.argv[1]; tl = json.load(open(f"{OUT}/{name}.json"))
cut = f"{L1}/voice/cut/{name}"; shutil.rmtree(cut, ignore_errors=True); os.makedirs(cut)
voice = []
for i, c in enumerate(tl["clips"]):
    src = f"{L1}/{c['file']}"; dst = f"voice/cut/{name}/{i:02d}.wav"
    if c.get("from") or abs(c["dur"] - json.load(open(f"{L1}/voice/lines.json"))["lines"][0]["dur"]) < 0:   # (always cut: exact per-clip trims with 8 ms fades)
        pass
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(c.get("from", 0.0)), "-t", str(c["dur"]), "-i", src, "-af", f"afade=t=in:st=0:d=0.008,afade=t=out:st={max(c['dur'] - 0.012, 0):.3f}:d=0.012", f"{L1}/{dst}"], check=True)
    voice.append({"id": f"c{i}", "t": c["t"], "file": dst})
sheet0 = json.load(open(f"{ROOT}/films/channels/space/ep12/sheet.json")); dur = tl["dur"]
if name == "long":
    secs, ch = [], {}
    for c in tl["clips"]:
        k = c["id"].split("_")[0]
        if k.startswith("ch") or k == "close": ch.setdefault(k, [c["t"], c["t"] + c["dur"]]); ch[k][1] = c["t"] + c["dur"]
    order = sorted(ch.items(), key=lambda kv: kv[1][0]); bounds = [0.0] + [round((order[i][1][1] + order[i + 1][1][0]) / 2, 3) for i in range(len(order) - 1)] + [dur]
    for i, (k, _) in enumerate(order): secs.append({"id": k, "t0": bounds[i], "t1": bounds[i + 1], "energy": round(0.30 + 0.06 * i, 2) if k != "close" else 0.62})
else:
    secs = [{"id": name, "t0": 0.0, "t1": dur, "energy": 0.42}]
sheet = {"duration": dur, "fps": 30, "preset": sheet0["preset"], "sections": secs, "events": [{"t": s["t0"], "kind": "section", "id": s["id"], "t1": s["t1"]} for s in secs], "voice": voice}
sp = f"{OUT}/{name}-sheet.json"; json.dump(sheet, open(sp, "w"), indent=1); ad = f"{OUT}/{name}-audio"
r = subprocess.run(["python3", "-I", f"{ROOT}/kits/cinema/studio/render.py", "--root", L1, sp, ad], capture_output=True, text=True)
assert os.path.exists(f"{ad}/mix.m4a"), r.stdout[-800:] + r.stderr[-800:]
print("mix:", f"{ad}/mix.m4a")
if "--audio-only" not in sys.argv:
    vid = f"{OUT}/{name}-picture.mp4"; fin = f"{OUT}/{name}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", f"{ad}/mix.m4a", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-t", str(dur), "-movflags", "+faststart", fin], check=True); print("final:", fin)

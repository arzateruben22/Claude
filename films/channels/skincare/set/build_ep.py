"""Generic build for a Skin Sense episode in the new art direction: film.json (lines, word times, length) and mix.m4a (voice only).
  python3 -I films/channels/skincare/set/build_ep.py ep05 [poster_seconds]
Beat layout follows the script directions (pre: lead-in, picture-only N s / end card held >= N s: the hold after the line)."""
import json, re, subprocess, sys
from pathlib import Path
d = Path(__file__).resolve().parent.parent / sys.argv[1]
lines = json.load(open(d / "vo/lines.json"))["lines"]
real = {l["id"]: l["words"] for l in json.load(open(d / "vo/words.json"))["lines"]}
heads = {m.group(1): m.group(2) for m in re.finditer(r"^## (\w+) \{(.*?)\} \(", (d / "script.md").read_text(), re.M)}
def hold(beat):
    dr = heads.get(beat, ""); m = re.search(r"picture-only ([\d.]+) s", dr); e = re.search(r"end card held ≥ ([\d.]+) s", dr)
    return float(m.group(1)) if m else float(e.group(1)) if e else 0.4
def pre(beat): return 0.05 if "pre: 0.05" in heads.get(beat, "") else 0.3
T, START, END, caps = 0.0, {}, {}, []
for L in lines:
    s = T + pre(L["beat"]); START[L["id"]] = round(s, 3); END[L["id"]] = round(s + L["dur"], 3)
    for w in real[L["id"]]:
        caps.append({"w": w["w"], "t0": round(s + w["start"], 3), "t1": round(s + w["end"], 3), "line": L["id"], "beat": L["beat"]})
    T = END[L["id"]] + (hold(L["beat"]) if L["beat"] != "tease" else 0.0)
DUR = round(round((END[lines[-1]["id"]] + hold("tease")) * 15) / 15, 3)
EPJ = json.load(open(d / "episode.json"))
film = {"id": f"skin-sense-{sys.argv[1][2:].zfill(3)}", "title": {"series": f"Skin Sense · No. {sys.argv[1][2:].zfill(3)}", "title": EPJ.get("name") or re.sub(r"<br>", " ", EPJ["title"]).replace("*", "").capitalize()}, "fps": 30, "dur": DUR, "poster": float(sys.argv[2]) if len(sys.argv) > 2 else round(DUR * 0.55, 2),
        "theme": "../theme.json", "shots": [{"at": 0.0, "name": "main"}], "captions": caps, "lines": {l["id"]: [START[l["id"]], END[l["id"]], l["beat"]] for l in lines}}
json.dump(film, open(d / "film.json", "w"), indent=1)
cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for L in lines: cmd += ["-i", str(d / "vo" / L["file"])]
fl = ";".join(f"[{i}:a]adelay={int(START[L['id']]*1000)}|{int(START[L['id']]*1000)}[a{i}]" for i, L in enumerate(lines))
fl += ";" + "".join(f"[a{i}]" for i in range(len(lines))) + f"amix=inputs={len(lines)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR-0.05},loudnorm=I=-14:TP=-1.5:LRA=7[o]"
subprocess.run(cmd + ["-filter_complex", fl, "-map", "[o]", "-c:a", "aac", "-b:a", "192k", str(d / "mix.m4a")], check=True)
print(sys.argv[1], "dur", DUR, {k: v[:2] for k, v in film["lines"].items()})

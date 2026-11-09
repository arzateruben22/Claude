"""Build film.json and mix.m4a for Skin Sense No. 004, "The Message Behind a Frown" (new art direction, Standards v2).
Beat layout follows the script's directions: lead-in (hook 0.05 s, others 0.3 s), the voiced line, then its picture-only hold.
Word times come from vo/words.json (align.py, Parakeet). The mix is voice only for now (no score or effects yet)."""
import json, re, subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
lines = json.load(open(HERE / "vo/lines.json"))["lines"]
real = {l["id"]: l["words"] for l in json.load(open(HERE / "vo/words.json"))["lines"]}
HOLD = {"hook": 0.4, "normal": 0.5, "change": 0.6, "why": 2.2, "whoa": 3.1, "takeaway": 0.5}
END_CARD = 2.2
T, START, END, caps = 0.05, {}, {}, []
for L in lines:
    START[L["id"]] = round(T, 3); END[L["id"]] = round(T + L["dur"], 3)
    for w in real[L["id"]]:
        caps.append({"w": w["w"], "t0": round(START[L["id"]] + w["start"], 3), "t1": round(START[L["id"]] + w["end"], 3), "line": L["id"], "beat": L["beat"]})
    T = END[L["id"]] + HOLD.get(L["beat"], 0.0) + 0.3
DUR = round(END[lines[-1]["id"]] + END_CARD, 2)
# a 15 fps draft and a 30 fps final both land on whole frames when the length is a multiple of 2/30 s
DUR = round(round(DUR * 15) / 15, 3)
film = {"id": "skin-sense-004", "fps": 30, "dur": DUR, "poster": round(START["vo03"] + 5.2, 2), "theme": "../theme.json",
        "shots": [{"at": 0.0, "name": "main"}], "captions": caps,
        "lines": {l["id"]: [START[l["id"]], END[l["id"]], l["beat"]] for l in lines}}
json.dump(film, open(HERE / "film.json", "w"), indent=1)
cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for L in lines: cmd += ["-i", str(HERE / "vo" / L["file"])]
fl = ";".join(f"[{i}:a]adelay={int(START[L['id']]*1000)}|{int(START[L['id']]*1000)}[a{i}]" for i, L in enumerate(lines))
fl += ";" + "".join(f"[a{i}]" for i in range(len(lines))) + f"amix=inputs={len(lines)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR-0.05},loudnorm=I=-14:TP=-1.5:LRA=7[o]"
cmd += ["-filter_complex", fl, "-map", "[o]", "-c:a", "aac", "-b:a", "192k", str(HERE / "mix.m4a")]
subprocess.run(cmd, check=True); print("dur", DUR, "lines", film["lines"])

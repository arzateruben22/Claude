"""Reality Rulebook S3 Parts 5-8, the Possibility Lab way (picture first, no captions, no narration in the deliverable).
Builds epNv3/film.json from the part's existing code-kitchen film (epN/film.json) retimed to the line windows, plus windows.json.
  python3 -I mk.py N            -> films/channels/physics/ep{12+N}v3/{film.json, windows.json}"""
import json, sys, copy
from pathlib import Path
HERE = Path(__file__).resolve().parent; CH = HERE.parents[1]
sys.path.insert(0, str(HERE)); from lines import LINES
N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
OLD = CH / f"ep{12 + N}"; NEW = CH / f"ep{12 + N}v3"; NEW.mkdir(exist_ok=True)
dur = json.loads((HERE / f"work/p{N}/vo/lines.json").read_text())["lines"]
GAP, LEAD = 0.45, 0.4
win, t = [], LEAD
for i, ((text, role), d) in enumerate(zip(LINES[N], dur)):
    w = round(d["dur"] * 1.15 + 0.3, 2)                 # the owner reads a little slower than the stand-in
    win.append({"id": f"L{i+1}", "text": text, "role": role, "t0": round(t, 2), "t1": round(t + w, 2), "stand_in_s": round(d["dur"], 2)})
    t += w + GAP + (3.0 if role == "payoff" and N in (5, 7) else 0.0)   # odd parts: 3 s of picture after the payoff for the spoken ask
END = round(t + 2.5, 2)                                   # the last line is followed by 2.5 s of picture (room for the closer on even parts)
if N in (6, 8): END = round(t + 3.5, 2)
S = lambda k: win[k - 1]["t0"]                            # start of line k
E = lambda k: win[k - 1]["t1"]
f = json.loads((OLD / "film.json").read_text())
from spec import SPEC
SPEC[N](f, win, S, E, END)
f["dur"] = END; f["id"] = f"reality-rulebook-s3p{N}v3"; f["captions"] = []; f["labels"] = None
f["spine"] = [{"t0": 1e6, "t1": 2e6, "label": ""}]; f["endShow"] = 1e6; f["endCard"] = 1e6
f["voice"] = []; f["disclosures"] = {"aiVoice": False, "aiVisuals": True}
f["beats"] = [{"id": "body", "t0": 0.0, "t1": END, "line": "vo01", "energy": 0.7}]; f["shots"] = [{"at": 0.0, "name": "hook"}]; f["cue"] = {"cuts": {"hook": 0.0}}
(NEW / "film.json").write_text(json.dumps(f, indent=1))
(NEW / "windows.json").write_text(json.dumps({"part": N, "note": "STAND-IN timing only: windows are the stand-in voice's duration x 1.15 + 0.3 s; the owner's takes are cut into them. No narration in the deliverable.", "end": END, "lines": win, "counter": f.get("_ladder")}, indent=1))
print(END, [(w["id"], w["t0"], w["t1"]) for w in win])

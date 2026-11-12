"""make_sample_v4.py: the v4 pacing sample (16:9): the counter glides to half the distance, line 6 with its time-lapse hold (the waterline climbs, the camera tilts up), line 7, line 8.
Writes long01/out/sample_v4.json; render with render_s3.mjs and mix with assemble_s3.py sample_v4."""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; sys.path.insert(0, f"{ROOT}/kits/cinema/film"); from numerals import to_display
lines = {x["id"]: x for x in json.load(open(L1 + "/voice4/lines.json"))["lines"]}
clips, caps, chips, beats = [], [], [], []; t = 0.6
def say(i, gap=0.35):
    global t
    l = lines[i]; clips.append({"id": i, "file": l["file"], "t": round(t, 3), "dur": l["dur"]})
    for s in l["sentences"]: caps.append({"t0": round(t + s["t0"], 3), "t1": round(t + s["t1"] + 0.25, 3), "text": to_display(s["text"]), "spoken": s["text"], "line": i})
    t0 = t; t += l["dur"] + gap; return t0
def beat(kind, d): 
    global t
    beats.append({"kind": kind, "t0": round(t, 3), "t1": round(t + d, 3)}); t += d; return t
say("L5", 0.1)
a0 = t; t_ap = beat("approach", 3.2)                      # the counter glides 288,300 -> 192,200 and the Moon swells
t6 = say("L6", 0.0)
for w in lines["L6"]["words"]:
    ww = w["w"].strip(".,").lower()
    if ww == "twice": chips.append({"t0": round(t6 + w["start"], 3), "t1": round(t6 + w["start"] + 1.9, 3), "text": "2× wider"})
    if ww == "eight": chips.append({"t0": round(t6 + w["start"], 3), "t1": round(t6 + w["start"] + 9.5, 3), "text": "8× pull"})
t += 0.2; beat("climb", 5.5)                              # hours squeezed into seconds: the waterline climbs, then the camera tilts up
say("L7"); say("L8", 0.0); dur = round(t + 1.6, 3)
tl = {"name": "sample_v4", "mode": "land", "dur": dur, "clips": clips, "captions": caps, "chips": chips, "beats": beats,
      "km": [[0.0, 288300], [round(t_ap, 3), 192200, 3.2]], "tracks": {"eclipse": [[0, 0]], "moon": [[0, 1]], "brk": [[0, 0]], "ring": [[0, 0]], "tonight": [[0, 0]]}}
json.dump(tl, open(L1 + "/out/sample_v4.json", "w"), indent=1, ensure_ascii=False); print("sample", dur, "s;", [(b["kind"], b["t0"], b["t1"]) for b in beats]); print([(c["t0"], c["text"]) for c in caps])

"""Build the film.json and the audio for the Skin Sense No. 004 sample (new art direction).
Word times are ESTIMATED from the voice's own line lengths (character-weighted): the word-timing model
(Parakeet) could not be fetched in this session. Replace with align.py output when available."""
import json, re, subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
lines = json.load(open(HERE / "vo/lines.json"))["lines"]
GAP, T = 0.28, 0.3
START = {}
for L in lines:
    START[L["id"]] = round(T, 3); T += L["dur"] + GAP
DUR = round(T + 1.4, 2)          # the last line, then a held end frame
caps, words_at = [], {}
for L in lines:
    t0, d = START[L["id"]], L["dur"]
    toks = L["text"].replace("*", "").split()
    wts = [len(w) + (3 if w[-1] in ",.?" else 0) + 1 for w in toks]
    tot = sum(wts); t = t0
    for w, k in zip(toks, wts):
        dt = d * k / tot
        words_at[(L["id"], w)] = (round(t, 3), round(t + dt, 3)); caps.append({"w": w, "t0": round(t, 3), "t1": round(t + dt, 3), "line": L["id"]}); t += dt
def at(line, word):
    k = [x for x in words_at if x[0] == line and x[1].strip(",.?!").lower() == word.strip(",.?!").lower()]
    return words_at[k[0]][0]
END = {L["id"]: round(START[L["id"]] + L["dur"], 3) for L in lines}
cue = {"lines": {k: [START[k], END[k]] for k in START}, "ach": at("vo03", "acetylcholine"), "toxin": at("vo05", "Botulinum"), "cuts": at("vo06", "cuts"),
       "never": at("vo07", "never"), "skin": at("vo08", "skin"), "message": at("vo08", "message")}
film = {"id": "skin-sense-004-sample", "fps": 30, "dur": DUR, "poster": round(START["vo06"] + 1.2, 2), "theme": "../theme.json", "shots": [{"at": 0.0, "name": "main"}], "cue": cue, "captions": caps, "lines": START}
json.dump(film, open(HERE / "film.json", "w"), indent=1)
# audio: each line at its start, summed, normalised to -14 LUFS / -1.5 dBTP (voice only; the sample has no score yet)
cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for L in lines: cmd += ["-i", str(HERE / "vo" / L["file"])]
fl = ";".join(f"[{i}:a]adelay={int(START[L['id']]*1000)}|{int(START[L['id']]*1000)}[a{i}]" for i, L in enumerate(lines))
fl += ";" + "".join(f"[a{i}]" for i in range(len(lines))) + f"amix=inputs={len(lines)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR-0.05},loudnorm=I=-14:TP=-1.5:LRA=7[o]"
cmd += ["-filter_complex", fl, "-map", "[o]", "-c:a", "aac", "-b:a", "192k", str(HERE / "mix.m4a")]
subprocess.run(cmd, check=True); print("film.json + mix.m4a", cue)

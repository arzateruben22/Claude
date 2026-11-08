"""Build the film.json and the audio for the Skin Sense No. 004 sample (new art direction).
Word times are ESTIMATED from the voice's own line lengths (character-weighted): the word-timing model
(Parakeet) could not be fetched in this session. Replace with align.py output when available."""
import json, re, subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
lines = json.load(open(HERE / "vo/lines.json"))["lines"]
START = {"vo01": 0.45, "vo02": 2.35, "vo03": 9.30, "vo04": 15.85}   # film seconds each line starts
DUR = 21.5
caps, words_at = [], {}
for L in lines:
    t0, d = START[L["id"]], L["dur"]
    toks = L["text"].replace("*", "").split()
    wts = [len(w) + (3 if w[-1] in ",.?" else 0) + 1 for w in toks]
    tot = sum(wts); t = t0
    for w, k in zip(toks, wts):
        dt = d * k / tot
        words_at[(L["id"], w)] = (round(t, 3), round(t + dt, 3)); caps.append({"w": w, "t0": round(t, 3), "t1": round(t + dt, 3), "line": L["id"]}); t += dt
def at(line, word): return words_at[(line, word)][0]
cue = {"nerve": at("vo02", "nerve"), "ach": at("vo02", "acetylcholine,"), "fibre": at("vo02", "fibre"), "pull": at("vo02", "pulling."),
       "toxin": at("vo03", "Botulinum"), "cuts": at("vo03", "cuts"), "never": at("vo03", "never"), "sent": at("vo03", "sent."),
       "skin": at("vo04", "skin"), "message": at("vo04", "message")}
film = {"id": "skin-sense-004-sample", "fps": 30, "dur": DUR, "poster": 12.2, "theme": "../theme.json", "shots": [{"at": 0.0, "name": "main"}], "cue": cue, "captions": caps, "lines": START}
json.dump(film, open(HERE / "film.json", "w"), indent=1)
# audio: each line at its start, summed, normalised to -14 LUFS / -1.5 dBTP (voice only; the sample has no score yet)
cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for L in lines: cmd += ["-i", str(HERE / "vo" / L["file"])]
fl = ";".join(f"[{i}:a]adelay={int(START[L['id']]*1000)}|{int(START[L['id']]*1000)}[a{i}]" for i, L in enumerate(lines))
fl += ";" + "".join(f"[a{i}]" for i in range(len(lines))) + f"amix=inputs={len(lines)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR},loudnorm=I=-14:TP=-1.5:LRA=7[o]"
cmd += ["-filter_complex", fl, "-map", "[o]", "-c:a", "aac", "-b:a", "192k", str(HERE / "mix.m4a")]
subprocess.run(cmd, check=True); print("film.json + mix.m4a", cue)

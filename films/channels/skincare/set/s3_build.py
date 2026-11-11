"""Season 3 episode build (ASMR, one real recorded voice): film.json (+ film-yt.json, the YouTube take), the timeline and the sound.
  ~/.cache/cinema-voice/venv/bin/python -I films/channels/skincare/set/s3_build.py ep13
Lines are laid on a timeline with their own (recorded) pauses inside them and a breath of silence between them (GAPS, config below);
the like/follow line (vo09, 'follow'; the YouTube take 'subscribe') follows the payoff. Sound: her recording over a very quiet ASMR bed
(low warm drone, soft air and brush swells, no hits), about -16 LUFS."""
import json, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf
d = Path(__file__).resolve().parent.parent / sys.argv[1]
cfg = json.loads((d / "s3.json").read_text())
LEAD, GAPS, CTA_GAP, TAIL = cfg["lead"], cfg["gaps"], cfg["cta_gap"], cfg["tail"]
SR = 48000
def layout(lines, cta_dur):
    T, start, end = LEAD, {}, {}
    for i, L in enumerate(lines):
        start[L["id"]] = round(T, 3); end[L["id"]] = round(T + L["dur"], 3); T = end[L["id"]] + (GAPS[i] if i < len(GAPS) else CTA_GAP)
    return start, end, T
lines = json.loads((d / "vo/lines.json").read_text())["lines"]
words = {l["id"]: l["words"] for l in json.loads((d / "vo/words.json").read_text())["lines"]}
ytl = json.loads((d / "vo/yt/lines.json").read_text())["lines"][0]; ytw = json.loads((d / "vo/yt/words.json").read_text())["lines"][0]["words"]
def build(lines, words, suffix, cta_file):
    start, end, T = layout(lines, 0)
    dur = round(round((end[lines[-1]["id"]] + TAIL) * 15) / 15, 3)
    caps = [{"w": w["w"], "t0": round(start[L["id"]] + w["start"], 3), "t1": round(start[L["id"]] + w["end"], 3), "line": L["id"], "beat": L["beat"]} for L in lines for w in words[L["id"]]]
    film = {"id": f"skin-sense-{sys.argv[1][2:].zfill(3)}", "title": {"series": "Skin Sense · Season 3", "title": cfg.get("final_title", cfg["title"])}, "fps": 30, "dur": dur, "poster": cfg["poster"], "theme": "../theme.json", "shots": [{"at": 0.0, "name": "main"}],
            "qaProfile": "asmr", "disclosures": {"aiVoice": False, "realVoice": True, "aiVisuals": True}, "captions": caps, "lines": {L["id"]: [start[L["id"]], end[L["id"]], L["beat"]] for L in lines}}
    (d / f"film{suffix}.json").write_text(json.dumps(film, indent=1))
    # the sound
    n = int(dur * SR); t = np.arange(n) / SR; rng = np.random.default_rng(13); bump = lambda c, w, a: a * np.exp(-((t - c) / w) ** 2)
    def bp(x, lo, hi):
        X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); m = np.clip((f - lo) / (lo * 0.5 + 1), 0, 1) * np.clip((hi - f) / (hi * 0.4 + 1), 0, 1); return np.fft.irfft(X * m, len(x))
    heat = bump(start["vo06"] + 4.5, 5.0, 1.0)
    dr = np.zeros((n, 2))
    for k, (f, g) in enumerate([(55.0, 1.0), (82.4, 0.6), (110.3, 0.35 + 0.25 * heat.max()), (164.8, 0.12)]):
        for ch, dt in ((0, 0.0), (1, 0.35)): dr[:, ch] += g * np.sin(2 * np.pi * (f + dt * (k + 1) * 0.1) * t + k) * (0.75 + 0.25 * np.sin(2 * np.pi * (0.06 + 0.011 * k) * t + ch))
    dr /= np.abs(dr).max(); dr *= 10 ** (-31 / 20)
    env = 0.14 + sum(bump(start[i] + 1.5, 1.2, a) for i, a in (("vo01", 0.4), ("vo02", 0.7), ("vo04", 0.35), ("vo05", 0.5), ("vo07", 0.7), ("vo08", 0.3))) + bump(start["vo06"] + 4.5, 4.0, 0.3)
    air = np.stack([bp(rng.standard_normal(n), 1400, 6500) for _ in range(2)], 1) * env[:, None]; air /= np.abs(air).max(); air *= 10 ** (-33 / 20)
    br = np.stack([bp(rng.standard_normal(n), 180, 900) for _ in range(2)], 1) * (0.1 + bump(start["vo05"] + 3, 4.0, 0.7) + bump(start["vo07"] + 2.5, 2.0, 0.5))[:, None]; br /= np.abs(br).max(); br *= 10 ** (-38 / 20)
    bed = (dr + air + br) * (np.clip(t / 1.2, 0, 1) * np.clip((dur - t) / 2.0, 0, 1))[:, None]
    sf.write(d / f"bed{suffix}.wav", bed.astype(np.float32), SR, subtype="FLOAT")
    ins, fl = ["-i", str(d / f"bed{suffix}.wav")], ["[0:a]aformat=sample_rates=48000:channel_layouts=stereo[b]"]
    names = []
    for i, L in enumerate(lines):
        ins += ["-i", str(d / "vo" / (cta_file if L["id"] == "vo09" and cta_file else L["file"]))]; ms = int(start[L["id"]] * 1000)
        fl.append(f"[{i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-17:TP=-3:LRA=7,adelay={ms}|{ms}[v{i}]"); names.append(f"[v{i}]")
    fl.append("[b]" + "".join(names) + f"amix=inputs={len(lines) + 1}:normalize=0,atrim=0:{dur},loudnorm=I=-15.2:TP=-1.6:LRA=7,alimiter=limit=-1.6dB:level=disabled,atrim=0:{dur}[o]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(fl), "-map", "[o]", "-ar", "48000", "-c:a", "aac", "-b:a", "256k", str(d / f"mix{suffix}.m4a")], check=True)
    print(sys.argv[1], suffix or "(follow)", "dur", dur, {k: v for k, v in film["lines"].items()})
build(lines, words, "", None)
ytlines = [dict(L) for L in lines[:-1]] + [{**lines[-1], "dur": ytl["dur"], "text": ytl["text"]}]
ytwords = {**words, "vo09": ytw}
build(ytlines, ytwords, "-yt", "yt/09y.wav")

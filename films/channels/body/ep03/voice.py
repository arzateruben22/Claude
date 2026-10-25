"""Voice Meanwhile, Inside No. 03 with bf_emma: one Kokoro call per sentence, a speed per sentence and
a measured pause between sentences (an episode-local wrapper around kits/cinema/voice/tts.py, which
voices a whole line in one call at one --speed for the whole script).

  $CINEMA_VOICE/venv/bin/python -I films/channels/body/ep03/voice.py --models $CINEMA_VOICE/models
  $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/body/ep03/vo $CINEMA_VOICE/models
  $CINEMA_VOICE/venv/bin/python -I films/channels/body/ep03/voice.py --clamp        # after align.py: no word runs into an inserted pause

Why: tts.py at speed 1.0 failed lint.py's 2.2–3.0 words/s gate on seven of eight lines (hook 3.62,
change 3.41, why 3.22, whoa 3.27, takeaway 3.04, meanwhile 3.30, tease 3.02). bf_emma runs her
sentences together with no breath between them ("folded?" ends at 1.68 s and "Because" starts at
1.69 s), which is most of why she reads fast. Slowing the whole script to 0.83 would fix the pace but
push the hook's question past 2.0 s. So each sentence is voiced on its own, trimmed, and joined with a
pause (GAP after a full stop or colon-free sentence, GAP_Q after a question): the question stays
brisk, the line breathes, and every line lands at 2.6–3.0 words/s.

Everything else is tts.py's own code, imported, not copied: the same phonemes() (pron.json swapped
in), the same trim(), the same 24-bit WAVs and the same lines.json fields, plus each line's
"speeds", "gaps" and "silences" (where each inserted pause sits in the line, in seconds). The phonemes
field is the sentences' phonemes joined by a space.

--clamp (after align.py): the recognizer's word END runs to the next token, so the last word before an
inserted pause is stretched over the silence ("folded?" measured 0.985–2.0 s while its sound ends at
1.524 s, where the digital silence starts). align.py snaps word starts to the audio but not ends. The
pauses are exact zeros written here, so a word cannot sound inside one: --clamp moves any end that
runs into a silence back to the silence's start, keeps the recognizer's value as "end_asr", and marks
the line "clamped". Starts are never touched.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
VOICE = HERE.parents[3] / "kits/cinema/voice"
sys.path.insert(0, str(VOICE))
from scriptfile import script_lines   # noqa: E402

spec = importlib.util.spec_from_file_location("tts", VOICE / "tts.py")
tts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tts)

NARRATOR = "bf_emma"             # DECISIONS.md: Meanwhile, Inside's narrator (British English)
LANG = "en-gb"
# Kokoro speed per sentence of each line, chosen from measured durations (README.md, "Voice"). The
# hook's question stays near natural speed so it is spoken by 2.0 s; its answer slows a little.
SPEEDS = {
    "vo01": [1.0, 0.95],
    "vo02": [0.92, 0.92, 0.95],
    "vo03": [0.92, 0.92, 0.9],
    "vo04": [0.95, 0.95, 0.94],
    "vo05": [0.86, 0.86, 0.88],
    "vo06": [0.84, 0.84],
    "vo07": [0.9, 0.9],
    "vo08": [0.88, 0.84],
}
GAP, GAP_Q = 0.30, 0.45          # seconds of silence after a sentence, after a question
# per-line pauses where a line wants more air (episode 2: the whoa breathes before its number)
GAPS = {"vo08": [0.4]}


def split(text):
    """The sentences of a spoken line, each with its closing punctuation."""
    return [s for s in re.split(r"(?<=[.?!])\s+", text.strip()) if s]


def clamp(vo):
    lines = {ln["id"]: ln for ln in json.loads((vo / "lines.json").read_text())["lines"]}
    W = json.loads((vo / "words.json").read_text())
    n = 0
    for wl in W["lines"]:
        sils = lines[wl["id"]].get("silences", [])
        for w in wl["words"]:
            for s0, s1 in sils:
                if w["start"] < s0 < w["end"]:
                    w.setdefault("end_asr", w["end"])
                    w["end"] = round(s0, 3)
                    wl["clamped"] = True
                    n += 1
                    print(f"{wl['id']}: {w['w']!r} end {w['end_asr']} → {w['end']} (the pause starts there)")
    W["clamped_by"] = "films/channels/body/ep03/voice.py --clamp: word ends cut back to the start of an inserted pause"
    (vo / "words.json").write_text(json.dumps(W, indent=1, ensure_ascii=False))
    print(f"{n} word end(s) clamped")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice")) + "/models")
    ap.add_argument("--out", default=str(HERE / "vo"))
    ap.add_argument("--clamp", action="store_true", help="after align.py: cut word ends back to the inserted pauses")
    a = ap.parse_args()
    if a.clamp:
        return clamp(Path(a.out))
    from kokoro_onnx import Kokoro
    from kokoro_onnx.tokenizer import Tokenizer
    import onnxruntime
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    model, voices = Path(a.models) / "kokoro-v1.0.onnx", Path(a.models) / "voices-v1.0.bin"
    k, tok = Kokoro(str(model), str(voices)), Tokenizer()
    lex = {w.lower(): p for w, p in json.loads((HERE / "pron.json").read_text()).items()}
    meta = {"voice": NARRATOR, "speed": "per sentence", "lang": LANG, "model_sha256": tts.sha256(model), "voices_sha256": tts.sha256(voices),
            "kokoro_onnx": "0.6.1", "onnxruntime": onnxruntime.__version__, "python": sys.version.split()[0],
            "made_by": "films/channels/body/ep03/voice.py (tts.py's phonemes and trim, one call and speed per sentence, measured pauses)",
            "gap": GAP, "gap_question": GAP_Q, "lines": []}
    for i, (beat, text, stars) in enumerate(script_lines(HERE / "script.md"), 1):
        lid = f"vo{i:02d}"
        sents, speeds = split(text), SPEEDS[lid]
        assert len(sents) == len(speeds), f"{lid}: {len(sents)} sentences but {len(speeds)} speeds"
        parts, phs, gaps, sils, sr = [], [], [], [], 24000
        for j, (s, sp) in enumerate(zip(sents, speeds)):
            ph = tts.phonemes(tok, s, lex, LANG)
            audio, sr = k.create(ph, voice=NARRATOR, speed=sp, lang=LANG, is_phonemes=True)
            parts.append(tts.trim(np.asarray(audio, np.float32), sr))
            phs.append(ph)
            if j < len(sents) - 1:
                g = GAPS[lid][j] if lid in GAPS else (GAP_Q if s.endswith("?") else GAP)
                gaps.append(g)
                at = sum(len(x) for x in parts) / sr
                sils.append([round(at, 4), round(at + int(round(g * sr)) / sr, 4)])
                parts.append(np.zeros(int(round(g * sr)), np.float32))
        audio = np.concatenate(parts)
        f = out / f"{i:02d}.wav"
        sf.write(f, audio, sr, subtype="PCM_24")
        dur = round(len(audio) / sr, 3)
        meta["lines"].append({"id": lid, "beat": beat, "text": text, "stars": stars, "phonemes": " ".join(phs), "speeds": speeds, "gaps": gaps, "silences": sils,
                              "file": f.name, "dur": dur, "sha256": tts.sha256(f)})
        print(f"{lid} {beat:<9} {dur:5.2f} s  {len(text.split()) / dur:.2f} words/s  speeds {speeds}  {text[:44]}")
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()

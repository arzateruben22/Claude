"""Voice Outer Layer No. 001 with one Kokoro speed per line (an episode-local wrapper around
kits/cinema/voice/tts.py, which takes one --speed for the whole script).

  $CINEMA_VOICE/venv/bin/python -I films/channels/skincare/ep01/voice.py --models $CINEMA_VOICE/models
  $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/skincare/ep01/vo $CINEMA_VOICE/models

Why: at one speed (0.9), bf_isabella read the short lines fast and the long ones slower (hook 3.65,
takeaway 3.55, to-scale 3.14, why 3.09, change 3.04 words/s against normal 2.79 and whoa 2.63), so
lint.py's 2.2–3.0 words/s gate failed on five lines. One speed per line evens the pace inside 75 s.

Everything else is tts.py's own code, imported, not copied: the same phonemes() (pron.json swapped
in), the same trim(), the same 24-bit WAVs and the same lines.json fields, plus each line's "speed".
"""
import argparse
import importlib.util
import json
import os
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

NARRATOR = "bf_isabella"         # bible §4 / auditions/README.md: Outer Layer's narrator
# Kokoro speed per line: a touch below the first cut (the Flow standard, 29 Oct), the short lines slower so they land.
SPEEDS = {"vo01": 0.78, "vo02": 0.86, "vo03": 0.86, "vo04": 0.84, "vo05": 0.86, "vo06": 0.82, "vo07": 0.8, "vo08": 0.8}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice")) + "/models")
    ap.add_argument("--out", default=str(HERE / "vo"))
    a = ap.parse_args()
    from kokoro_onnx import Kokoro
    from kokoro_onnx.tokenizer import Tokenizer
    import onnxruntime
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    lang = "en-gb"
    model, voices = Path(a.models) / "kokoro-v1.0.onnx", Path(a.models) / "voices-v1.0.bin"
    k, tok = Kokoro(str(model), str(voices)), Tokenizer()
    lex = {w.lower(): p for w, p in json.loads((HERE / "pron.json").read_text()).items()}
    meta = {"voice": NARRATOR, "speed": "per line", "lang": lang, "model_sha256": tts.sha256(model), "voices_sha256": tts.sha256(voices),
            "kokoro_onnx": "0.6.1", "onnxruntime": onnxruntime.__version__, "python": sys.version.split()[0],
            "made_by": "films/channels/skincare/ep01/voice.py (tts.py's phonemes and trim, one speed per line)", "lines": []}
    for i, (beat, text, stars) in enumerate(script_lines(HERE / "script.md"), 1):
        lid = f"vo{i:02d}"
        ph = tts.phonemes(tok, text, lex, lang)
        audio, sr = k.create(ph, voice=NARRATOR, speed=SPEEDS[lid], lang=lang, is_phonemes=True)
        audio = tts.trim(np.asarray(audio, np.float32), sr)
        f = out / f"{i:02d}.wav"
        sf.write(f, audio, sr, subtype="PCM_24")
        dur = round(len(audio) / sr, 3)
        meta["lines"].append({"id": lid, "beat": beat, "text": text, "stars": stars, "phonemes": ph, "speed": SPEEDS[lid],
                              "file": f.name, "dur": dur, "sha256": tts.sha256(f)})
        print(f"{lid} {beat:<8} speed {SPEEDS[lid]:.2f}  {dur:5.2f} s  {len(text.split()) / dur:.2f} words/s  {text[:50]}")
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()

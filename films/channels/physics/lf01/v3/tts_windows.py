"""Scratch stand-in voice (Kokoro af_bella, labelled STAND-IN, never the owner's voice) used only to time the line windows.
  $CINEMA_VOICE/venv/bin/python -I tts_windows.py N      -> v3/work/pN/{lines.json, 01.wav...}"""
import json, subprocess, sys, tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[4]
sys.path.insert(0, str(HERE)); from lines import LINES
n = int(sys.argv[1]); out = HERE / "work" / f"p{n}"; out.mkdir(parents=True, exist_ok=True)
txt = "# stand-in\n\n" + "".join(f"## l{i+1} {{chapter: x}} (0.0-5.0 s)\nvo: {t}\n\n" for i, (t, _) in enumerate(LINES[n]))
(out / "script.md").write_text(txt)
subprocess.run([sys.executable, "-I", str(ROOT / "kits/cinema/voice/tts.py"), str(out / "script.md"), str(out / "vo"), "--voice", "af_bella", "--speed", "0.9"], check=True, capture_output=True)
lj = json.loads((out / "vo/lines.json").read_text())["lines"]
print(json.dumps([round(x["dur"], 2) for x in lj]))

"""Season 3 v2: take the breaths out of every stem with kits/cinema/voice/debreath.py (replaces s3_duck.py). Run after s3_cut.py v2 and align.py.
  ~/.cache/cinema-voice/venv/bin/python -I films/channels/skincare/set/s3_debreath.py ep16
Reads <ep>v2/vo/NN.raw.wav (the untouched original, kept by the first run) and writes NN.wav, for vo/ and vo/yt/."""
import json, shutil, subprocess, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent; d = R / (sys.argv[1] + "v2"); DB = R.parent.parent.parent / "kits/cinema/voice/debreath.py"
for sub in ("vo", "vo/yt"):
    lj, wj = d / sub / "lines.json", d / sub / "words.json"
    if not (lj.exists() and wj.exists()): continue
    for L in json.loads(lj.read_text())["lines"]:
        wav = d / sub / L["file"]; raw = wav.with_suffix(".raw.wav")
        if not raw.exists(): shutil.copy(wav, raw)
        r = subprocess.run([sys.executable, "-I", str(DB), str(raw), str(wj), str(wav), "--line", L["id"]], capture_output=True, text=True)
        print(sub, wav.name, (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1])

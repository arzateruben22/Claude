"""Render a film's sound from its cue sheet, master it, deliver it, and measure it.

  # a cue sheet written by the film's compiler
  python3 -I kits/cinema/studio/render.py SHEET.json OUTDIR
  # an adopted scene: its own event table (render.mjs --cues) + a preset
  python3 -I kits/cinema/studio/render.py --from-scene build/cues-8-2-9x16.json --preset lumevina-dew OUTDIR

Writes OUTDIR/sheet.json (what was rendered), mix.wav, mix.m4a (AAC 256k), stems/{dialog,music,
effects}.wav (they sum to the mix), master.json, cues-placed.json, qa.json and spectrogram.png.
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))   # run as a script under -I

from studio import compose, qa                                      # noqa: E402
from studio.master import deliver                                    # noqa: E402
from studio.review import spectrogram                                 # noqa: E402


def from_scene(cues, preset, energy=None):
    """A cue sheet from a scene's own event table: its shots become sections, the rest events."""
    secs = [e for e in cues["events"] if e["kind"] == "section"]
    energy = energy or [0.5] * len(secs)
    return {"duration": cues["dur"], "fps": cues.get("fps", 30), "preset": preset,
            "sections": [{"id": s["id"], "t0": s["t"], "t1": s["t1"], "energy": energy[i % len(energy)]} for i, s in enumerate(secs)],
            "events": cues["events"], "voice": [], "shown": cues.get("shown", {})}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet", nargs="?")
    ap.add_argument("out")
    ap.add_argument("--from-scene")
    ap.add_argument("--preset")
    ap.add_argument("--energy", help="per-section energy, comma separated")
    ap.add_argument("--root", default=".", help="where voice files resolve from")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if a.from_scene:
        sheet = from_scene(json.loads(Path(a.from_scene).read_text()), a.preset, [float(x) for x in a.energy.split(",")] if a.energy else None)
    else:
        sheet = json.loads(Path(a.sheet).read_text())
    (out / "sheet.json").write_text(json.dumps(sheet, indent=1))
    t0 = time.time()
    stems, placed, spans = compose.build(sheet, a.root)
    t1 = time.time()
    P = compose.load_preset(sheet["preset"])
    mix, ms, rep = deliver(stems, out, P["master"]["lufs"], tag=sheet["preset"])
    t2 = time.time()
    report = {"compose_s": round(t1 - t0, 1), "master_s": round(t2 - t1, 1), "master": rep,
              "sync": qa.sync(placed, ms["effects"], sheet["fps"]),
              "picture_sync": qa.picture_sync(placed, sheet.get("shown", {})),
              "under_voice": qa.under_voice(ms, spans), "phone": qa.phone(mix, ms)}
    (out / "cues-placed.json").write_text(json.dumps([{k: v for k, v in p.items() if k != "sig"} for p in placed], indent=1))
    (out / "qa.json").write_text(json.dumps(report, indent=1))
    spectrogram(out)
    s = report["sync"]
    print(f"{sheet['preset']}: {len(placed)} cues · compose {report['compose_s']} s · master {report['master_s']} s")
    print(f"  WAV {rep['lufs']} LUFS / {rep['true_peak_db']} dBTP (ceiling {rep['ceiling_db']}) · AAC {rep['aac']['lufs']} LUFS / {rep['aac']['true_peak_db']} dBTP, LRA {rep['aac']['lra']}")
    print(f"  stems sum to the mix within {rep['stems_sum_error_db']} dB · phone {report['phone']}")
    print(f"  sync {'PASS' if s['pass'] else 'FAIL'}: " + ", ".join(f"{k} {v['median_ms']}/{v['max_ms']} ms" for k, v in s["per_kind"].items()))
    if report["picture_sync"]:
        errs = [abs(r["err_ms"]) for r in report["picture_sync"]]
        print(f"  against the picture (DOM): {len(errs)} labels, max {max(errs)} ms")
    if report["under_voice"]:
        print(f"  music under voice: {report['under_voice']}")


if __name__ == "__main__":
    main()

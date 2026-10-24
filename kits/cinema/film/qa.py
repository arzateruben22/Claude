"""Measure a delivered episode file: format, lengths, loudness, phone-speaker safety, flashing.

    python3 -I kits/cinema/film/qa.py <film dir> [--file out/x.mp4] [--json build/qa-delivery.json]

Everything is read from the delivered mp4 itself (the audio is decoded from its AAC), plus the
render's own text audit (build/<tier>/<aspect>/audit.json). Exit 1 if a gate fails.

Flashing follows WCAG 2.3.1's general-flash rule, measured on relative luminance: a transition is
a frame-to-frame change of ≥ 0.1 where the darker side is < 0.8, over ≥ 25% of the frame in the
same direction (a phone held at reading distance fills more of the view than WCAG's desktop
quarter-field, so the area threshold is conservative). A flash is a pair of opposite transitions;
the gate is ≤ 3 flashes in any one-second window.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from studio import meter  # noqa: E402
from studio.master import measure_file  # noqa: E402

GATES = {"lufs": (-15.0, -13.0), "true_peak_db": -1.0, "corr": 0.3, "mono_loss_db": 3.0, "flashes_per_s": 3}


def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(f)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def audio(f):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-map", "0:a:0", "-f", "f32le", "-ac", "2", "-ar", str(meter.SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2)


def lum_frames(f, w=216, h=384):
    """Relative luminance per pixel (linear BT.709) for every frame, at a reduced size."""
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(f), "-map", "0:v:0", "-vf", f"scale={w}:{h}:flags=area,format=rgb24", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    lut = np.array([(c / 255) / 12.92 if c <= 10 else (((c / 255) + 0.055) / 1.055) ** 2.4 for c in range(256)], np.float32)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        rgb = lut[np.frombuffer(b, np.uint8).reshape(h, w, 3)]
        yield rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    p.wait()


def flashing(f, fps):
    prev, trans = None, []          # trans: (frame index, +1 brighter / −1 darker) for large-area transitions
    big = 0.0
    for i, y in enumerate(lum_frames(f)):
        if prev is not None:
            d = y - prev
            dark = np.minimum(y, prev) < 0.8
            up = ((d >= 0.1) & dark).mean()
            down = ((d <= -0.1) & dark).mean()
            big = max(big, up, down)
            if up >= 0.25:
                trans.append((i, 1))
            if down >= 0.25:
                trans.append((i, -1))
        prev = y
    flashes = [b[0] for a, b in zip(trans, trans[1:]) if a[1] != b[1]]   # a flash ends at its second transition
    worst = max((sum(1 for g in flashes if t <= g < t + fps) for t in flashes), default=0)
    return {"large_transitions": len(trans), "transition_frames": [t[0] for t in trans], "flashes": len(flashes),
            "max_flashes_per_s": worst, "largest_changed_area": round(float(big), 3)}


def main(argv):
    film = Path(argv[0])
    opt = dict(zip(argv[1::2], argv[2::2]))
    fj = json.loads((film / "film.json").read_text())
    f = Path(opt["--file"]) if "--file" in opt else sorted((film / "out").glob("*-9x16.mp4"))[0]
    j = probe(f)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    num, den = map(int, v["r_frame_rate"].split("/"))
    fps = num / den
    rep = {"file": str(f), "size_mb": round(f.stat().st_size / 1e6, 1),
           "video": {"codec": v["codec_name"], "profile": v.get("profile"), "w": v["width"], "h": v["height"], "fps": fps,
                     "frames": int(v.get("nb_frames", 0)), "dur": float(v["duration"]), "pix_fmt": v["pix_fmt"],
                     "color": v.get("color_primaries"), "mbps": round(int(v.get("bit_rate", 0)) / 1e6, 2)},
           "film_dur": fj["dur"]}
    fails = []
    if (v["width"], v["height"]) != (1080, 1920):
        fails.append("not 1080x1920")
    if a:
        x = audio(f)
        rep["audio"] = {"codec": a["codec_name"], "sr": int(a["sample_rate"]), "ch": a["channels"], "kbps": round(int(a.get("bit_rate", 0)) / 1e3),
                        "dur": float(a["duration"]), **measure_file(f),
                        "corr": round(meter.correlation(x), 2), "mono_loss_db": round(meter.mono_loss_db(x), 2)}
        A = rep["audio"]
        if abs(A["dur"] - rep["video"]["dur"]) > 1 / fps + 1e-6:
            fails.append(f"picture {rep['video']['dur']:.3f} s vs sound {A['dur']:.3f} s")
        if not GATES["lufs"][0] <= A["lufs"] <= GATES["lufs"][1]:
            fails.append(f"loudness {A['lufs']} LUFS")
        if A["true_peak_db"] > GATES["true_peak_db"]:
            fails.append(f"true peak {A['true_peak_db']} dBTP")
        if A["corr"] < GATES["corr"] or A["mono_loss_db"] > GATES["mono_loss_db"]:
            fails.append("not mono-safe")
    else:
        fails.append("no audio")
    if not 60 <= rep["video"]["dur"] <= 75.5:
        fails.append(f"length {rep['video']['dur']:.2f} s outside 60–75 s")
    rep["flashing"] = flashing(f, round(fps))
    if rep["flashing"]["max_flashes_per_s"] > GATES["flashes_per_s"]:
        fails.append(f"{rep['flashing']['max_flashes_per_s']} flashes in one second")
    audit = next(iter(sorted((film / "build").glob("final/*/audit.json"))), None)
    if audit:
        au = json.loads(audit.read_text())
        rep["text_audit"] = {"range": au.get("range"), "warnings": len(au.get("warnings", [])), "first": au.get("warnings", [])[:5]}
        if au.get("warnings"):
            fails.append(f"{len(au['warnings'])} text-audit warnings")
    rep["fails"] = fails
    out = Path(opt.get("--json", film / "build" / "qa-delivery.json"))
    out.write_text(json.dumps(rep, indent=1))
    V, A, F = rep["video"], rep.get("audio", {}), rep["flashing"]
    print(f"{f.name}: {V['w']}x{V['h']} {V['fps']:g} fps {V['frames']} frames {V['dur']:.3f} s, {V['codec']} {V['profile']} {V['mbps']} Mbps, {rep['size_mb']} MB")
    if A:
        print(f"  sound: {A['codec']} {A['sr']} Hz {A['ch']} ch {A['kbps']}k {A['dur']:.3f} s · {A['lufs']} LUFS, {A['true_peak_db']} dBTP, LRA {A['lra']} · corr {A['corr']}, mono loss {A['mono_loss_db']} dB")
    print(f"  flashing: {F['large_transitions']} large-area transitions, {F['flashes']} flashes, worst {F['max_flashes_per_s']}/s (largest changed area {F['largest_changed_area']:.0%})")
    if "text_audit" in rep:
        print(f"  text audit: {rep['text_audit']['warnings']} warnings over {rep['text_audit']['range']}")
    print("  PASS" if not fails else "  FAIL: " + "; ".join(fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""La Noche — measured review: hook, readability, continuity, motion, sound sync.

Run after a full render and `render.cjs --qa`:
    python3 -I films/los-gueros-la-noche/scripts/qa.py [label]
Writes film/build/qa-<label>.json and prints a markdown summary.
Scores are 1–10 from explicit deductions (listed in the output), so a
re-run after fixes is comparable with the first pass.
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image

FILM = Path(__file__).resolve().parent.parent
BUILD = FILM / "build"
OUT = FILM / "out"
TL = json.loads((FILM / "src" / "timeline.json").read_text())
FPS, FRAMES = TL["fps"], round(TL["duration"] * TL["fps"])
SAFE = {"16x9": (96, 54, 1824, 1026), "9x16": (110, 250, 970, 1500)}   # x0, y0, x1, y1
COVERED = []                                                         # frames hidden by curtain / bloom
for tr in TL["transitions"]:
    if tr["type"] in ("curtain", "bloom"):
        mid = tr.get("cover") or tr.get("peak") or tr["end"]
        COVERED.append((mid - 0.12, mid + 0.12))


def lum(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def contrast(l1, l2):
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def parse_rgb(s):
    return np.array([float(v) for v in re.findall(r"[\d.]+", s)[:3]])


def planned(t):
    for tr in TL["transitions"]:
        if tr["start"] - 1 / FPS <= t <= tr["end"] + 1 / FPS:
            return tr["id"] + ":" + tr["type"]
    for k in TL["camera"]["16x9"]:
        if "cut" in k and abs(k["t"] - t) < 1.5 / FPS:
            return "cut"
    return None


def load_small(fmt, f, w=240):
    im = Image.open(BUILD / "frames" / fmt / f"{f:04d}.png").convert("RGB")
    return np.asarray(im.resize((w, round(w * im.height / im.width)), Image.BILINEAR)).astype(np.float32)


# ─── per-format picture metrics ───

def picture(fmt):
    qa = json.loads((BUILD / "qa" / fmt / "qa.json").read_text())
    res = {"deductions": {k: [] for k in ("hook", "readability", "continuity", "motion", "sync")}}
    D = res["deductions"]

    # frames → luminance + diff profile
    frames = [load_small(fmt, f) for f in range(FRAMES)]
    L = np.array([lum(fr).mean() for fr in frames])
    diff = np.array([0.0] + [np.abs(frames[i] - frames[i - 1]).mean() for i in range(1, FRAMES)])
    res["frame0_luma"] = round(float(L[0]), 4)
    res["first_second_motion"] = round(float(diff[1:FPS].mean()), 2)

    # ── hook
    hook_curve = next(s for s in qa["sync"] if s["el"] == "#hook .l1")["curve"]
    first_word = next(f for f, o in hook_curve if o >= 0.5) / FPS
    res["first_word_s"] = round(first_word, 3)
    if L[0] < 0.03:
        D["hook"].append((-3, "frame 0 is near-black"))
    if first_word > 1.0:
        D["hook"].append((-2, f"first word legible at {first_word:.2f}s (>1.0s)"))
    brand_t = min(e["t"] for e in TL["events"] if "#reveal .eyebrow" in e["el"])
    res["brand_named_s"] = brand_t
    if brand_t > 3.0:
        D["hook"].append((-1, f"brand not named until {brand_t:.2f}s; the hook carries the line, not the name"))
    if res["first_second_motion"] < 1.0:
        D["hook"].append((-1, "little motion in the first second"))

    # ── readability: contrast, size, safe zone, reading pace
    cards = []
    for p in qa["probes"]:
        bg = np.asarray(Image.open(BUILD / "qa" / fmt / f"{p['id']}-bg.png").convert("RGB")).astype(np.float32)
        H, W = bg.shape[:2]
        worst, min_px, unsafe = 99.0, 999, []
        for el in p["layout"]:
            x0, y0 = max(0, int(el["x"])), max(0, int(el["y"]))
            x1, y1 = min(W, int(el["x"] + el["w"])), min(H, int(el["y"] + el["h"]))
            if x1 <= x0 or y1 <= y0:
                continue
            patch = lum(bg[y0:y1, x0:x1]).ravel()
            text_l = lum(parse_rgb(el["color"]))
            # worst case: the brightest 10% of the background behind the glyph box
            c = contrast(text_l, float(np.percentile(patch, 90)))
            worst = min(worst, c)
            min_px = min(min_px, el["fontSize"])
            sx0, sy0, sx1, sy1 = SAFE[fmt]
            if el["x"] < sx0 - 1 or el["y"] < sy0 - 1 or el["x"] + el["w"] > sx1 + 1 or el["y"] + el["h"] > sy1 + 1:
                unsafe.append(el["text"][:24])
        words = sum(1 if el["cls"] == "w" else len(re.findall(r"\w+", el["text"])) for el in p["layout"])
        first_in = min(e["t"] for e in TL["events"] if e["el"].startswith("#" + p["id"]) and e["anim"] not in ("out", "to"))
        hold = p["out"] - first_in
        cards.append({"card": p["id"], "contrast_min": round(worst, 2), "min_font_px": min_px,
                      "unsafe": unsafe, "words": words, "on_screen_s": round(hold, 2),
                      "wps": round(words / hold, 2)})
        if worst < 4.5:
            D["readability"].append((-2 if worst < 3 else -1, f"{p['id']}: worst-case contrast {worst:.2f}:1 (<4.5)"))
        if unsafe:
            D["readability"].append((-1, f"{p['id']}: outside safe zone: {', '.join(unsafe)}"))
        if words / hold > 4.0:
            D["readability"].append((-1, f"{p['id']}: {words} words in {hold:.2f}s = {words / hold:.1f} w/s (>4)"))
        floor = 22 if fmt == "16x9" else 26
        if min_px < floor:
            D["readability"].append((-1, f"{p['id']}: {min_px}px type (<{floor})"))
    res["cards"] = cards

    # ── continuity: unplanned spikes, flashes, loop seam
    med = np.median(diff[1:])
    spikes = []
    for f in range(1, FRAMES):
        local = np.median(diff[max(1, f - 6):f + 7])
        if diff[f] > max(3 * local, 2.5 * med) and diff[f] > 6:
            spikes.append({"t": round(f / FPS, 3), "f": f, "diff": round(float(diff[f]), 1), "planned": planned(f / FPS)})
    res["spikes"] = spikes
    for s in spikes:
        if not s["planned"]:
            D["continuity"].append((-2, f"unplanned jump at {s['t']:.2f}s (f{s['f']}, Δ{s['diff']})"))
    src = [c[3] for c in qa["cam"]]
    seams = []
    for f in range(1, FRAMES):
        if src[f] != (src[f - 1] + 1) % TL["source"]["loopFrames"]:
            seams.append(round(f / FPS, 3))
    res["source_jumps_s"] = seams
    for t in seams:
        if not any(a <= t <= b for a, b in COVERED):
            D["continuity"].append((-2, f"footage source jumps at {t:.2f}s while visible"))
    xfade = [round(f / FPS, 2) for f in range(FRAMES) if src[f] >= TL["source"]["loopFrames"] - TL["source"]["crossfade"]]
    res["crossfade_visible_s"] = [t for t in xfade if not any(a <= t <= b for a, b in COVERED) and t < 15.1]
    shots = {}
    for t in res["crossfade_visible_s"]:
        sid = next(s["id"] for s in reversed(TL["shots"]) if t >= s["start"])
        shots.setdefault(sid, []).append(t)
    for sid, ts in shots.items():
        D["continuity"].append((-1, f"loop cross-fade (ghosting) on screen in {sid} {ts[0]:.2f}–{ts[-1]:.2f}s"))
    dl = np.abs(np.diff(L))
    res["max_luma_step"] = round(float(dl.max()), 4)
    if dl.max() > 0.1:
        D["continuity"].append((-1, f"luminance step {dl.max():.3f} at {np.argmax(dl) / FPS:.2f}s"))

    # ── motion: camera speed, jerk, judder band without blur
    cam = np.array([[c[0], c[1], c[2]] for c in qa["cam"]])
    vel = np.zeros(FRAMES)
    jerk = []
    for f in range(1, FRAMES):
        if planned(f / FPS) == "cut" or any("cut" in k and abs(k["t"] * FPS - f) < 1 for k in TL["camera"][fmt]):
            continue
        vel[f] = np.hypot(cam[f, 0] - cam[f - 1, 0], cam[f, 1] - cam[f - 1, 1])
    for f in range(2, FRAMES):
        if vel[f] and vel[f - 1] and abs(vel[f] - vel[f - 1]) > 25:
            jerk.append(round(f / FPS, 2))
    res["camera_peak_px_per_frame"] = round(float(vel.max()), 1)
    res["camera_jerk_s"] = jerk
    # strobing band at 24 fps: 4–20 px/frame of travel shows stepping unless blurred (blur kicks in at >1.5 px per half frame)
    band = [f for f in range(FRAMES) if 4 <= vel[f] <= 20]
    res["judder_band_frames"] = len(band)
    if jerk:
        D["motion"].append((-1, f"camera velocity discontinuities at {jerk[:4]}"))
    if len(band) > 12:
        D["motion"].append((-1, f"{len(band)} frames of camera travel in the 4–20 px/frame strobe band"))
    zooms = cam[:, 2]
    # cam scale is relative to the pre-upscaled plate; × upscale = magnification of the original footage
    up = zooms * TL["source"]["upscale"]
    res["max_effective_upscale"] = round(float(up.max()), 2)
    soft = [f for f in range(FRAMES) if up[f] > 2.2 and not any(a <= f / FPS <= b for a, b in COVERED) and f / FPS < 15.1]
    if soft:
        D["motion"].append((-1, f"footage magnified up to {up.max():.2f}x of source ({len(soft)} frames >2.2x, soft)"))

    # ── sync: visual onset vs measured audio onset
    cues = json.loads((BUILD / "audio-raw-cues.json").read_text())
    stem = read_wav(BUILD / "audio-raw-cues.wav")
    env = np.abs(stem).max(axis=0)
    sr = TL["audio"]["sampleRate"]
    offsets = []
    for s in qa["sync"]:
        curve = s["curve"]
        vis = None
        for (f0, o0), (f1, o1) in zip(curve, curve[1:]):
            if o0 < 0.5 <= o1:
                vis = (f0 + (0.5 - o0) / (o1 - o0)) / FPS
                break
        if vis is None:
            continue
        cue = min((c for c in cues if c.get("el") == s["el"]), key=lambda c: c["t"], default=None)
        if not cue:
            continue
        a, b = int((cue["t"] - 0.15) * sr), int((cue["t"] + 0.3) * sr)
        seg = env[a:b]
        floor = np.median(np.abs(env[a - int(0.2 * sr):a])) if a > int(0.2 * sr) else 0
        thresh = floor + 0.25 * (seg.max() - floor)
        onset = (a + int(np.argmax(seg > thresh))) / sr
        offsets.append({"el": s["el"], "visual_s": round(vis, 3), "audio_s": round(onset, 3),
                        "offset_ms": round((onset - vis) * 1000, 1)})
    res["sync"] = offsets
    for o in offsets:
        if o["offset_ms"] < -40 or o["offset_ms"] > 60:
            side = "early" if o["offset_ms"] < 0 else "late"
            D["sync"].append((-1, f"{o['el']}: sound {abs(o['offset_ms']):.0f} ms {side} of the visual"))
    return res


def read_wav(p):
    with wave.open(str(p)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels()).T


def mux(fmt):
    """Audio in the delivered mp4 vs the master: offset (samples) and loudness."""
    mp4 = OUT / f"los-gueros-la-noche-{fmt}.mp4"
    if not mp4.exists():
        return None
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp4), "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(dec, "<i2").astype(np.float32)
    ref = read_wav(BUILD / "audio.wav").mean(axis=0) * 32768
    n = min(len(a), len(ref), 48000 * 6)
    seg_a, seg_r = a[:n], ref[:n]
    best, lag = -1, 0
    for k in range(-2048, 2049, 1):
        c = np.dot(seg_a[max(0, k):n + min(0, k)], seg_r[max(0, -k):n - max(0, k)])
        if c > best:
            best, lag = c, k
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(mp4), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,nb_frames,duration",
                                       "-of", "json", str(mp4)], capture_output=True, text=True).stdout)
    return {"av_offset_samples": lag, "lufs": lufs, "true_peak_dbfs": tp, "streams": probe["streams"]}


def score(ded):
    return max(1, 10 + sum(d for d, _ in ded))


def main():
    label = sys.argv[1] if len(sys.argv) > 1 else "pass"
    report = {}
    for fmt in TL["formats"]:
        r = picture(fmt)
        r["mux"] = mux(fmt)
        if r["mux"]:
            if abs(r["mux"]["av_offset_samples"]) > 480:
                r["deductions"]["sync"].append((-2, f"mux offset {r['mux']['av_offset_samples']} samples"))
            if abs(r["mux"]["lufs"] - TL["audio"]["loudness"]) > 1:
                r["deductions"]["sync"].append((-1, f"loudness {r['mux']['lufs']} LUFS"))
        r["scores"] = {k: score(v) for k, v in r["deductions"].items()}
        report[fmt] = r
    (BUILD / f"qa-{label}.json").write_text(json.dumps(report, indent=1, default=float))
    for fmt, r in report.items():
        print(f"\n## {fmt} — {label}")
        print(" | ".join(f"{k} {v}/10" for k, v in r["scores"].items()))
        for k, ded in r["deductions"].items():
            for d, why in ded:
                print(f"  {k:12s} {d:+d}  {why}")
        print(f"  frame0 luma {r['frame0_luma']} · first word {r['first_word_s']}s · peak camera {r['camera_peak_px_per_frame']} px/f · max upscale {r['max_effective_upscale']}x")
        for c in r["cards"]:
            print(f"  card {c['card']:9s} contrast≥{c['contrast_min']:5.2f}  min {c['min_font_px']:.0f}px  {c['words']} words/{c['on_screen_s']}s = {c['wps']} w/s  unsafe={c['unsafe']}")
        print("  sync ms:", [(o["el"].split()[0] + " " + " ".join(o["el"].split()[1:]), o["offset_ms"]) for o in r["sync"]])
        print("  spikes:", [(s["t"], s["diff"], s["planned"]) for s in r["spikes"]])
        if r["mux"]:
            print(f"  mux offset {r['mux']['av_offset_samples']} samples · {r['mux']['lufs']} LUFS · TP {r['mux']['true_peak_dbfs']} dBFS")


if __name__ == "__main__":
    main()

"""Made with Claude — Breakout · measured review.

Scores hook, readability, continuity, motion and sound sync (1–10, from
explicit deductions) using the rendered frames, the geometry probe
(scripts/probe.cjs) and the audio stems/cues written by src/audio.py.

python3 -I films/made-with-claude/scripts/qa.py LABEL [FRAMES_ROOT]
→ build/qa/qa-LABEL.json + markdown summary on stdout
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

FILM = Path(__file__).resolve().parent.parent
BUILD = FILM / "build"
OUT = FILM / "out"
J = json.loads((FILM / "src" / "timeline.json").read_text())
FPS, FRAMES = J["fps"], round(J["duration"] * J["fps"])
BEAT = 60 / J["bpm"]
SAFE = {"16x9": (0.04, 0.04, 0.96, 0.96), "9x16": (0.06, 0.08, 0.94, 0.80)}   # x0 y0 x1 y1 (fractions)


def lum(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def small(path, w=320):
    im = Image.open(path).convert("RGB")
    return np.asarray(im.resize((w, round(w * im.height / im.width)), Image.BILINEAR)).astype(np.float32)


def read_wav(p):
    with wave.open(str(p)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels()).T, w.getframerate()


def whips():
    """Intentional fast camera moves: the big jumps (the camera rides them)."""
    return [(m["t0"], m["t1"]) for m in J["mascot"] if m["type"] == "jump"]


def in_any(t, spans, pad=0.0):
    return any(a - pad <= t <= b + pad for a, b in spans)


def picture(fmt, frames_dir):
    probe = json.loads((BUILD / "qa" / f"{fmt}-probe.json").read_text())
    W, H, rows = probe["width"], probe["height"], probe["rows"]
    D = {k: [] for k in ("hook", "readability", "continuity", "motion", "sync")}
    r = {"deductions": D}

    # frames → luminance + diff profile
    fr = [small(frames_dir / f"{f:04d}.png") for f in range(FRAMES)]
    L = np.array([lum(x).mean() for x in fr])
    diff = np.array([0.0] + [np.abs(fr[i] - fr[i - 1]).mean() for i in range(1, FRAMES)])
    r["frame0_luma"] = round(float(L[0]), 4)
    r["motion_first_half_second"] = round(float(diff[1:FPS // 2].mean()), 2)

    # ── HOOK
    if L[0] < 0.02:
        D["hook"].append((-2, f"frame 0 is very dark (mean luminance {L[0]:.3f})"))
    if r["motion_first_half_second"] < 0.8:
        D["hook"].append((-1, f"little motion in the first 0.5 s (Δ {r['motion_first_half_second']})"))
    first_beat = min(m["t0"] for m in J["mascot"] if m["type"] == "extrude")
    r["first_transformation_s"] = first_beat
    if first_beat > 2.0:
        D["hook"].append((-1, f"first transformation at {first_beat}s"))
    # how big is the character before the breakout? (sprite: 144×96 UI px on the slab)
    sprite_h = []
    for row in rows[: int(first_beat * FPS)]:
        c = row["copy"]
        sprite_h.append(c["sprite"]["h"] / H if "sprite" in c else c["title"]["h"] * 96 / 84 / H)   # old probes: title-box proxy
    r["sprite_height_frac_at_0"] = round(sprite_h[0], 3)
    r["sprite_height_frac_at_1s"] = round(sprite_h[FPS], 3)
    if sprite_h[0] < 0.04:
        D["hook"].append((-1, f"character is tiny on frame 0 ({100 * sprite_h[0]:.1f}% of frame height) — hook relies on camera motion"))
    title_first = None
    for row in rows:
        c, cap = row["copy"]["title"], row["copy"].get("titleCap", row["copy"]["title"])
        t = row["frame"] / FPS
        if t >= J["viewer"]["typeEnd"] and c["inFrame"] and c["coc"] < 3 and cap["h"] / H > 0.025:
            title_first = t
            break
    r["brand_first_legible_s"] = title_first
    if title_first is None or title_first > 6:
        D["hook"].append((-1, f"'MADE WITH CLAUDE' first sharp and legible at {title_first}s"))

    # ── READABILITY: final card + the search beat
    last = rows[-1]["copy"]
    ti, op, tc = last["title"], last["opus"], last.get("titleCap", last["title"])
    sx0, sy0, sx1, sy1 = SAFE[fmt]
    r["final_title"] = {"h_px": tc["h"], "coc_px": ti["coc"], "x0": ti["x0"] / W, "x1": ti["x1"] / W, "y0": ti["y0"] / H, "y1": ti["y1"] / H}
    if not ti["inFrame"] or ti["x0"] / W < sx0 or ti["x1"] / W > sx1:
        D["readability"].append((-3, "final title runs outside the safe frame"))
    if ti["y1"] / H > sy1 or ti["y0"] / H < sy0:
        D["readability"].append((-1, "final title outside vertical safe zone"))
    if tc["h"] / H < 0.035:
        D["readability"].append((-1, f"final title capitals {tc['h']:.0f}px tall ({100 * tc['h'] / H:.1f}% of height)"))
    if op["h"] / H < 0.02:
        D["readability"].append((-1, f"'OPUS 5.5' only {op['h']:.0f}px tall"))
    if ti["coc"] > 2.0:
        D["readability"].append((-1, f"final title defocused (CoC {ti['coc']:.1f}px)"))
    # contrast of the final card (title glyph pixels vs the comp background)
    img = np.asarray(Image.open(frames_dir / f"{FRAMES - 1:04d}.png").convert("RGB")).astype(np.float32)
    x0, x1 = int(max(0, ti["x0"])), int(min(W, ti["x1"]))
    y0, y1 = int(max(0, ti["y0"])), int(min(H, ti["y1"]))
    # glyph core (L > 0.6 inside the title box) against the background outside a 20-px dilation of the glyphs,
    # and against the letter gaps (non-glyph pixels inside the box: what a heavy halo floods)
    pad = 24
    X0, X1, Y0, Y1 = max(0, x0 - 4 * pad), min(W, x1 + 4 * pad), max(0, y0 - 4 * pad), min(H, y1 + 4 * pad)
    Lt = lum(img[Y0:Y1, X0:X1])
    inbox = np.zeros(Lt.shape, bool); inbox[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = True
    core = (Lt > 0.6) & inbox
    if core.sum() > 20:
        dil = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(41))) > 0
        glyph, bg = float(np.median(Lt[core])), float(np.median(Lt[~dil])) if (~dil).sum() else 0.0
        near = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        gap = float(np.median(Lt[inbox & ~near])) if (inbox & ~near).sum() else bg
    else:
        glyph, bg, gap = 0.0, 0.0, 0.0
    r["final_title_contrast"] = round((glyph + 0.05) / (bg + 0.05), 2)
    r["final_title_glyph_to_gap"] = round((glyph + 0.05) / (gap + 0.05), 2)
    if r["final_title_glyph_to_gap"] < 2.0:
        D["readability"].append((-1, f"title halo floods the letter gaps (glyph:gap {r['final_title_glyph_to_gap']}:1)"))
    if r["final_title_contrast"] < 4.5:
        D["readability"].append((-1, f"final title contrast {r['final_title_contrast']}:1"))
    # hold: frames where the title is sharp, in frame and big enough
    hold = [row["frame"] for row in rows if row["copy"]["title"]["inFrame"] and row["copy"]["title"]["coc"] < 2.5 and row["copy"].get("titleCap", row["copy"]["title"])["h"] / H > 0.03]
    tail = 0
    for f in range(FRAMES - 1, -1, -1):
        if f in hold: tail += 1
        else: break
    r["final_hold_s"] = round(tail / FPS, 2)
    if tail / FPS < 1.5:
        D["readability"].append((-2, f"final card readable for only {tail / FPS:.2f}s"))
    # the search word: legible while it is typed and applied (4.0–4.6)? sharp, big enough, and not smeared:
    # its own screen motion (half a frame of travel at a 180° shutter) and its CoC must stay under a quarter of its height
    seg = rows[int(4.0 * FPS) - 1: int(4.6 * FPS)]
    gl, ok = [], []
    for a, b in zip(seg, seg[1:]):
        g, h0 = b["copy"]["glow"], a["copy"]["glow"]
        mv = np.hypot((g["x0"] + g["x1"] - h0["x0"] - h0["x1"]) / 2, (g["y0"] + g["y1"] - h0["y0"] - h0["y1"]) / 2)
        gl.append(g)
        if g["inFrame"] and g["h"] >= 14 and g["coc"] < 0.25 * g["h"] and 0.5 * mv < 0.25 * g["h"]:
            ok.append(g)
    r["glow_word_legible_frac"] = round(len(ok) / max(1, len(gl)), 2)
    r["glow_word_px"] = round(float(np.median([g["h"] for g in gl])), 1)
    r["glow_word_coc"] = round(float(np.median([g["coc"] for g in gl])), 2)
    if len(ok) / max(1, len(gl)) < 0.6:
        D["readability"].append((-1, f"typed 'glow' legible in only {100 * len(ok) / max(1, len(gl)):.0f}% of its beat (median {r['glow_word_px']}px, CoC {r['glow_word_coc']}px)"))

    # ── CONTINUITY
    spans = whips()
    med = np.median(diff[1:])
    spikes = []
    for f in range(1, FRAMES):
        local = np.median(diff[max(1, f - 5): f + 6])
        if diff[f] > max(2.6 * local, 2.4 * med) and diff[f] > 5:
            t = f / FPS
            spikes.append({"t": round(t, 3), "diff": round(float(diff[f]), 1), "planned": in_any(t, spans, 0.05) or abs(t - J["shards"]["t"]) < 0.1})
    r["spikes"] = spikes
    for s in spikes:
        if not s["planned"]:
            D["continuity"].append((-2, f"unplanned visual jump at {s['t']:.2f}s (Δ{s['diff']})"))
    # mascot teleport check (world units per frame)
    pos = [row["mascot"] for row in rows]
    jumps = []
    for f in range(1, FRAMES):
        if pos[f] and pos[f - 1]:
            d = float(np.linalg.norm(np.array(pos[f]) - np.array(pos[f - 1])))
            if d > 0.9:
                jumps.append((round(f / FPS, 2), round(d, 2)))
    r["mascot_max_step"] = max([d for _, d in jumps], default=0)
    for t, d in jumps:
        D["continuity"].append((-1, f"mascot moves {d} units in one frame at {t}s"))
    dl = np.abs(np.diff(L))
    r["max_luma_step"] = round(float(dl.max()), 4)
    r["max_luma_step_t"] = round(float(np.argmax(dl) + 1) / FPS, 2)
    if dl.max() > 0.08 and not abs(r["max_luma_step_t"] - J["shards"]["t"]) < 0.15:
        D["continuity"].append((-1, f"exposure step {dl.max():.3f} at {r['max_luma_step_t']}s"))
    # handoff sprite → voxels → mascot: is there a frame with nothing on screen at the sprite spot?
    ex = next(m for m in J["mascot"] if m["type"] == "extrude")
    vis = [row["mascot"] is not None for row in rows]
    gap = [f for f in range(int(ex["t0"] * FPS), int((ex["t1"] + 0.2) * FPS)) if not vis[f] and f / FPS >= ex["t1"]]
    if gap:
        D["continuity"].append((-1, f"mascot missing after the voxel handoff at {gap[0] / FPS:.2f}s"))

    # ── MOTION
    cam = np.array([row["cam"] for row in rows])
    look = np.array([row["look"] for row in rows])
    v = np.linalg.norm(np.diff(cam, axis=0), axis=1) * FPS            # world units / s
    a = np.abs(np.diff(v)) * FPS
    lv = np.linalg.norm(np.diff(look, axis=0), axis=1) * FPS
    la = np.abs(np.diff(lv)) * FPS
    r["camera_peak_speed"] = round(float(v.max()), 2)
    r["camera_peak_accel"] = round(float(a.max()), 1)
    jerks = []
    for f in range(1, len(a)):
        t = (f + 1) / FPS
        if (a[f] > 220 or la[f] > 260) and not in_any(t, spans, 0.0):
            jerks.append(round(t, 2))
    r["camera_jerk_frames"] = jerks
    if jerks:
        D["motion"].append((-1, f"camera acceleration spikes outside whips at {jerks[:6]}{'…' if len(jerks) > 6 else ''}"))
    # strobing: big screen motion with too few sub-frames
    if "K" in rows[0]:                                   # sample counts come from the probe (same rule as the renderer)
        strobe = [row["frame"] for row in rows if row["motionPx"] / max(1, row["K"]) > 6]
        r["strobe_frames"] = len(strobe)
        r["max_motion_px"] = max(row["motionPx"] for row in rows)
        r["mean_K"] = round(float(np.mean([row["K"] for row in rows])), 2)
        if len(strobe) > 4:
            D["motion"].append((-1, f"{len(strobe)} frames move > 6 px per sub-frame (visible stepping in blur)"))
    # framing: visible mascot outside safe frame outside whips
    off = []
    for row in rows:
        fm = row["framing"]
        if not fm.get("visible"):
            continue
        t = row["frame"] / FPS
        if in_any(t, spans, 0.12) or 4.55 <= t <= 5.3:      # whips + the deliberate pan to the viewer
            continue
        if not (sx0 <= fm["cx"] <= sx1 and sy0 <= fm["cy"] <= sy1):
            off.append(round(t, 2))
    r["mascot_offframe_s"] = off
    if off:
        D["motion"].append((-1 if len(off) < 8 else -2, f"mascot leaves the safe frame outside whips ({len(off)} frames, first {off[:4]})"))

    return r


def _instruments():
    import importlib.util
    spec = importlib.util.spec_from_file_location("audiosrc", FILM / "src" / "audio.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def sync(fmt):
    """Matched filter: find each cue's own waveform in the mixed foley stem, compare to the picture event."""
    D = []
    res = {}
    A = _instruments()
    cues = json.loads((BUILD / "audio-raw-cues.json").read_text())
    x, sr = read_wav(BUILD / "audio-raw-sfx.wav")
    mono = x.mean(axis=0)
    keys_seen = 0
    templ = {
        "land": lambda c: A.thud(1.6 if any(m["type"] == "jump" and abs(m["t1"] - c["t"]) < 1e-6 for m in J["mascot"]) else 1.0),
        "zap": lambda c: A.zap(),
        "impact": lambda c: A.impact(),
        "coo": lambda c: A.coo(),
    }
    # where audio.py places each kind relative to its cue time (deliberate anticipation)
    lead = {"zap": -0.03, "land": 0.0, "impact": 0.0, "coo": 0.0}
    # picture event for each kind: the first frame on which it shows
    def pic(t):
        return np.ceil(t * FPS - 1e-6) / FPS
    rows = []
    for c in cues:
        if c["kind"] == "key":
            tpl = A.key_click(keys_seen); keys_seen += 1; lead_s = 0.0
        elif c["kind"] in templ:
            tpl = templ[c["kind"]](c); lead_s = lead[c["kind"]]
        else:
            continue
        tpl = tpl[: int(0.12 * sr)]
        exp = c["t"] + lead_s
        win = 0.05 if c["kind"] == "key" else 0.15        # key clicks are 125 ms apart: keep the matcher off the neighbours
        a, b = int((exp - win) * sr), int((exp + win) * sr) + len(tpl)
        seg = mono[max(0, a):b]
        if len(seg) < len(tpl):
            continue
        # normalized cross-correlation
        corr = np.correlate(seg, tpl, mode="valid")
        energy = np.sqrt(np.convolve(seg ** 2, np.ones(len(tpl)), mode="valid")) + 1e-9
        k = int(np.argmax(corr / energy))
        found = (max(0, a) + k) / sr
        picture = pic(c["t"]) + (-0.08 if c["kind"] == "zap" else 0.0)   # the beam fires 80 ms before the key lands
        off = (found - picture) * 1000
        rows.append({"kind": c["kind"], "t": c["t"], "audio_s": round(found, 4), "picture_s": round(float(picture), 4), "offset_ms": round(off, 1), "placement_err_ms": round((found - exp) * 1000, 2)})
    res["cues"] = rows
    bad = [r for r in rows if r["offset_ms"] < -45 or r["offset_ms"] > 60]
    for r in bad:
        D.append((-1, f"{r['kind']} @ {r['t']}s: sound {abs(r['offset_ms']):.0f} ms {'early' if r['offset_ms'] < 0 else 'late'} of the picture"))
    res["max_abs_offset_ms"] = float(max([abs(r["offset_ms"]) for r in rows], default=0))
    res["max_placement_err_ms"] = float(max([abs(r["placement_err_ms"]) for r in rows], default=0))
    # grid: every story beat on the 120 BPM 16th grid?
    beats = [m["t1"] for m in J["mascot"] if m["type"] in ("jump", "hop")] + [k["t"] for k in J["keyframes"]] + J["search"]["keys"]
    grid_err = [abs(b / (BEAT / 4) - round(b / (BEAT / 4))) * (BEAT / 4) * 1000 for b in beats]
    res["grid_max_err_ms"] = round(max(grid_err), 2)
    if max(grid_err) > 5:
        D.append((-1, f"story beats off the 16th-note grid by up to {max(grid_err):.0f} ms"))
    # mux + loudness of the delivered file
    mp4 = OUT / f"made-with-claude-{fmt}.mp4"
    if mp4.exists():
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp4), "-f", "s16le", "-ac", "1", "-ar", "48000", "-"], capture_output=True, check=True).stdout
        a_ = np.frombuffer(dec, "<i2").astype(np.float32)
        ref, _ = read_wav(BUILD / "audio.wav")
        ref = ref.mean(axis=0) * 32768
        n = min(len(a_), len(ref), 48000 * 4)
        best, lag = -1, 0
        for k in range(-1024, 1025, 2):
            c = float(np.dot(a_[max(0, k):n + min(0, k)], ref[max(0, -k):n - max(0, k)]))
            if c > best:
                best, lag = c, k
        e = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(mp4), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
        summary = e[e.rfind("Summary"):]
        res["mux_offset_samples"] = lag
        res["lufs"] = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", summary)[-1])
        res["true_peak"] = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", summary)[-1])
        if abs(lag) > 480:
            D.append((-2, f"mux offset {lag} samples"))
        if abs(res["lufs"] - J["music"]["loudness"]) > 1.0:
            D.append((-1, f"loudness {res['lufs']} LUFS (target {J['music']['loudness']})"))
        if res["true_peak"] > J["music"]["truePeak"] + 0.3:
            D.append((-1, f"true peak {res['true_peak']} dBFS"))
    return res, D


def main():
    label = sys.argv[1] if len(sys.argv) > 1 else "pass"
    root = Path(sys.argv[2]) if len(sys.argv) > 2 else BUILD / "frames"
    report = {}
    for fmt in J["formats"]:
        if not (root / fmt / f"{FRAMES - 1:04d}.png").exists():
            continue
        r = picture(fmt, root / fmt)
        s, sd = sync(fmt)
        r["sync"] = s
        r["deductions"]["sync"] += sd
        r["scores"] = {k: max(1, 10 + sum(d for d, _ in v)) for k, v in r["deductions"].items()}
        report[fmt] = r
    (BUILD / "qa").mkdir(parents=True, exist_ok=True)
    (BUILD / "qa" / f"qa-{label}.json").write_text(json.dumps(report, indent=1, default=float))
    for fmt, r in report.items():
        print(f"\n## {fmt} — {label}")
        print(" | ".join(f"{k} **{v}**/10" for k, v in r["scores"].items()))
        for k, ded in r["deductions"].items():
            for d, why in ded:
                print(f"- {k}: {d:+d} {why}")
        keys = ["frame0_luma", "motion_first_half_second", "sprite_height_frac_at_0", "brand_first_legible_s", "final_title", "final_title_contrast", "final_title_glyph_to_gap", "final_hold_s",
                "glow_word_px", "glow_word_coc", "glow_word_legible_frac", "max_luma_step", "camera_peak_speed", "strobe_frames", "max_motion_px"]
        print("  " + " · ".join(f"{k}={r.get(k)}" for k in keys if k in r))
        print("  sync:", {k: v for k, v in r["sync"].items() if k != "cues"})


if __name__ == "__main__":
    main()

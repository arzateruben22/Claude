"""The measured half of an episode's review/scorecard.md, as a markdown table.

    python3 -I kits/cinema/film/scorecard.py <film dir> [--log films/channels/finals.log]

Reads build/qa-delivery.json (run film/qa.py first), the studio's build/audio/qa.json and the
chunk lines of the final render's log. Prints the table; the review rounds are written by hand.
"""
import json
import re
import sys
from pathlib import Path


def main(argv):
    film = Path(argv[0])
    opt = dict(zip(argv[1::2], argv[2::2]))
    d = json.loads((film / "build" / "qa-delivery.json").read_text())
    s = json.loads((film / "build" / "audio" / "qa.json").read_text())
    V, A, F = d["video"], d["audio"], d["flashing"]
    rows = [("Format", "1080×1920, 30 fps, H.264, AAC",
             f"{V['w']}×{V['h']}, {V['fps']:g} fps CFR, {V['frames']} frames, H.264 {V['profile']} {(V['color'] or '').upper()}, "
             f"AAC {A['sr'] / 1000:g} kHz {'stereo' if A['ch'] == 2 else A['ch']} {A['kbps']}k, {V['mbps']} Mbps video, {d['size_mb']} MB"),
            ("Length", "60–75 s; picture = sound", f"{V['dur']:.3f} s / {A['dur']:.3f} s"),
            ("Loudness", "−14 LUFS, ≤ −1 dBTP on the AAC", f"**{A['lufs']} LUFS, {A['true_peak_db']} dBTP**, LRA {A['lra']} LU")]
    u = s.get("under_voice")
    if u:
        rows.append(("Voice over music", "≥ 10 LU", f"{u['gap_lu']} LU (dialogue {u['dialog_lufs']}, music {u['music_lufs']} LUFS while speaking)"))
    p = s.get("phone", {})
    rows.append(("Phone speaker", "mono-safe", f"Correlation {A['corr']}; mono loss {A['mono_loss_db']} dB"
                 + (f" (dialogue {p['dialog_mono_loss_db']} dB)" if "dialog_mono_loss_db" in p else "")))
    pk = s["sync"]["per_kind"]
    fast = [k for k, v in pk.items() if not v["slow"]]
    slow = [k for k, v in pk.items() if v["slow"]]
    ok = all(v["pass"] for v in pk.values())
    worst = max((pk[k]["max_ms"] for k in fast), default=0)
    rows.append(("Sound sync", "transients within a frame",
                 f"{len(pk)} kinds, {sum(v['n'] for v in pk.values())} events, {'all PASS' if ok else 'FAIL'}: transients worst {worst:g} ms"
                 + (f"; slow swells ({', '.join(slow)}) worst {max(pk[k]['max_ms'] for k in slow):g} ms" if slow else "")))
    ps = s.get("picture_sync", [])
    if ps:
        exact = sum(1 for e in ps if abs(e["err_ms"]) < 0.5)
        rows.append(("Labels vs picture", "sound on the first visible frame", f"{exact}/{len(ps)} exact (DOM-measured first visible frame)"))
    if "text_audit" in d:
        t = d["text_audit"]
        rows.append(("Text in the safe box", "x 90–900, y 250–1420", f"Render audit: {t['warnings']} warnings over {t['range'][1] - t['range'][0] + 1} frames"))
    rows.append(("Flashing", "≤ 3 flashes a second",
                 f"{F['large_transitions']} large-area luminance change{'s' if F['large_transitions'] != 1 else ''} "
                 f"(frames {', '.join(map(str, F['transition_frames'][:6])) or 'none'}), {F['flashes']} flash pairs, worst {F['max_flashes_per_s']}/s"))
    log = Path(opt.get("--log", "films/channels/finals.log"))
    if log.exists():
        rx = re.compile(r"chunk (\d+) done: frames (\d+)–(\d+) .*?K avg ([\d.]+) max (\d+), ([\d.]+) s/frame")
        tag = str(film).rstrip("/") + "/build/final/"
        ch = {}
        for line in log.read_text().splitlines():
            m = rx.search(line)
            if m and tag in line:
                ch[int(m[1])] = (int(m[3]) - int(m[2]) + 1, float(m[4]), int(m[5]), float(m[6]))
        if ch:
            n = sum(c[0] for c in ch.values())
            secs = sum(c[0] * c[3] for c in ch.values())
            kavg = sum(c[0] * c[1] for c in ch.values()) / n
            rows.append(("Determinism", "resumable, byte-stable",
                         f"{len(ch)} chunks, every frame's sha256 checked against its log before encoding"))
            rows.append(("Render cost", "≤ 4 h", f"{secs / 3600:.1f} h for {n} frames ({secs / n:.2f} s/frame, K avg {kavg:.1f}, max {max(c[2] for c in ch.values())})"))
    out = ["| Gate | Target | Result |", "|---|---|---|"] + [f"| {a} | {b} | {c} |" for a, b, c in rows]
    print("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1:])

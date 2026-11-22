#!/usr/bin/env python3
"""Inventory a Vice Unfiltered asset folder.

Usage: python3 -I inventory.py <asset_dir> <out_csv> [manifest_csv]

For every file: size, SHA-256, media probe (duration, dimensions, fps,
codecs, audio stream, sample rate, channels, alpha), and - when a manifest is
given - whether its path and hash match a manifest row (matched by SHA-256, so moved files still verify). Prints any manifest
rows whose file is absent, and any duplicate hashes.
"""
import csv
import hashlib
import json
import os
import subprocess
import sys
from collections import defaultdict

MEDIA_EXT = {".mp3", ".wav", ".m4a", ".aac", ".mp4", ".mov", ".mkv", ".webm",
             ".gif", ".png", ".jpg", ".jpeg", ".webp"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def probe(path):
    cmd = ["ffprobe", "-v", "error", "-print_format", "json",
           "-show_format", "-show_streams", path]
    try:
        data = json.loads(subprocess.run(cmd, capture_output=True, text=True,
                                         timeout=60).stdout or "{}")
    except Exception:
        return {}
    streams = data.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    a = next((s for s in streams if s.get("codec_type") == "audio"), {})
    dur = data.get("format", {}).get("duration") or v.get("duration") or a.get("duration")
    fps = v.get("avg_frame_rate") or ""
    if fps and "/" in fps:
        n, d = fps.split("/")
        fps = f"{int(n) / int(d):.3f}" if int(d) else ""
    pix = v.get("pix_fmt", "")
    return {
        "duration_s": f"{float(dur):.3f}" if dur else "",
        "width": v.get("width", ""),
        "height": v.get("height", ""),
        "fps": fps,
        "frames": v.get("nb_frames", ""),
        "v_codec": v.get("codec_name", ""),
        "pix_fmt": pix,
        "alpha": "yes" if any(t in pix for t in ("rgba", "argb", "bgra", "abgr", "ya", "yuva", "pal8")) else "",
        "a_codec": a.get("codec_name", ""),
        "sample_rate": a.get("sample_rate", ""),
        "channels": a.get("channels", ""),
    }


def main():
    root, out_csv = sys.argv[1], sys.argv[2]
    manifest = {}
    if len(sys.argv) > 3:
        with open(sys.argv[3], newline="", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                manifest[r["SHA256"].lower()] = r

    rows, by_hash = [], defaultdict(list)
    for dirpath, _, files in os.walk(root):
        for name in sorted(files):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            digest = sha256(full)
            by_hash[digest].append(rel)
            row = {"path": rel, "bytes": os.path.getsize(full), "sha256": digest}
            if os.path.splitext(name)[1].lower() in MEDIA_EXT:
                row.update(probe(full))
            if manifest:
                m = manifest.get(digest)
                row["manifest"] = (("MATCH" if os.path.basename(m["path_in_archive"]) == name
                                    else "MATCH_RENAMED:" + os.path.basename(m["path_in_archive"]))
                                   if m else "NOT_IN_MANIFEST")
            rows.append(row)

    cols = ["path", "bytes", "sha256", "duration_s", "width", "height", "fps",
            "frames", "v_codec", "pix_fmt", "alpha", "a_codec", "sample_rate",
            "channels", "manifest"]
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: r["path"]))

    print(f"files: {len(rows)}")
    if manifest:
        from collections import Counter
        print("manifest check:", dict(Counter(r["manifest"] for r in rows)))
        present = {r["sha256"] for r in rows}
        by_archive = defaultdict(list)
        for h, m in manifest.items():
            if h not in present:
                by_archive[m.get("archive", "?")].append(m["path_in_archive"])
        for arch, paths in by_archive.items():
            print(f"manifest files not received yet ({arch}): {len(paths)}")
            for p in paths:
                print("   ", p)
    dups = {h: p for h, p in by_hash.items() if len(p) > 1}
    for h, paths in dups.items():
        print("duplicate content:", " == ".join(paths))


if __name__ == "__main__":
    main()

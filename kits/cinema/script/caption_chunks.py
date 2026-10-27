"""Which 10 s render chunks show different captions after a caption change, so only those are rendered again.

    python3 -I kits/cinema/script/caption_chunks.py <git rev> <episode dir> [...]

Compares the captions in <rev>:<episode>/film.json (what the delivered film was rendered from) with the working
tree's, frame by frame: the page on screen, its rows and how many words are lit. A frame that differs marks half a
second either side (the plate fades in and out), and the chunks those frames fall in are printed with the
render.mjs ranges that redo them:

    node kits/cinema/film/render.mjs --film <episode> --tier final --from 10 --to 20 --fresh --force-mixed
"""
import json
import subprocess
import sys
from pathlib import Path

CHUNK_S, MARGIN_S = 10, 0.5


def state(caps, t):
    for pg in caps:
        if pg["t0"] <= t < pg["t1"]:
            words = [w for ln in pg["lines"] for w in ln]
            return tuple(" ".join(w for w, _ in ln) for ln in pg["lines"]), pg["t0"], sum(1 for _, s in words if s <= t)
    return None


def changed_chunks(rev, ep):
    p = (Path(ep) / "film.json").as_posix()
    shown = subprocess.run(["git", "show", f"{rev}:{p}"], capture_output=True, text=True, check=True).stdout
    old, new = json.loads(shown), json.loads(Path(p).read_text())
    fps = new.get("fps", 30)
    frames, margin = round(new["dur"] * fps), round(MARGIN_S * fps)
    diff = set()
    for f in range(frames):
        if state(old["captions"], f / fps) != state(new["captions"], f / fps):
            diff.update(range(max(0, f - margin), min(frames, f + margin + 1)))
    per = CHUNK_S * fps
    return sorted({f // per for f in diff}), (frames + per - 1) // per, new["dur"]


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    rev, total = argv[0], 0
    for ep in argv[1:]:
        chunks, n, dur = changed_chunks(rev, ep)
        total += len(chunks)
        ranges = " ".join(f"{k * CHUNK_S}-{min(dur, (k + 1) * CHUNK_S):g}" for k in chunks)
        print(f"{ep}: chunks {chunks} of {n}" + (f"  (--from/--to {ranges})" if chunks else ""))
    print(f"{total} chunks to render again")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

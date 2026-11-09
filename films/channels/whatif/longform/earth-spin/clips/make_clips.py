"""Split clips/script.md into five clip folders (clip1 ... clip5), each a film of its own: script.md (hook, the reused beats, outro, end card), voice.py
(the pilot's, writing into the clip's vo/), pron.json. Run:  python3 -I films/channels/whatif/longform/earth-spin/clips/make_clips.py"""
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
src = (HERE / "script.md").read_text()
long_ = (HERE.parent / "script.md").read_text()
PARTS = re.split(r"(?m)^## clip (\d): ([^\n]*)\n", src)
NAMES = {"1": ("twelve", None), "2": ("wind", None), "3": ("oceans", None), "4": ("two", None), "5": ("float", "break")}
for i in range(1, len(PARTS), 3):
    n, title, body = PARTS[i], PARTS[i + 1], PARTS[i + 2]
    lines = [ln for ln in body.strip().split("\n") if re.match(r"^[NR][:(]", ln)]
    out = ["# Earth-spin pilot, clip %s of 5: %s (vertical cut-down; verbatim lines from the long script)\n" % (n, title.split("(")[0].strip()),
           "9:16, 1080x1920/30, native vertical framing. Hook, one milestone, a cliffhanger; end card names the full video.\n"]
    beats = []
    for ln in lines:
        m = re.match(r"^([NR])(?:\(([^)]*)\))?: (.*)$", ln)
        kind, beat, text = m.group(1), m.group(2), m.group(3)
        beats.append((kind, beat, text))
    k = 0
    for kind, beat, text in beats:
        bid = ("hook" if k == 0 else "outro") if kind == "N" else beat
        out.append("\n## %s {shot: see compile.py · picture-only 0.2 s · energy: 0.6}\nvo: %s\n" % (bid, text))
        k += 1
    out.append('\n## tease {end card held ≥ 3 s · signature: plucks A4, E5, D♯5 · energy: 0.4}\nvo: Full video on YouTube.\nend card: "Full video on YouTube: *What If Earth Spun Faster…*" · "Part %s of 5" · footnote: "Narration: synthetic voice (AI). Possibility Lab."\n' % n)
    d = HERE / f"clip{n}"
    (d / "vo").mkdir(parents=True, exist_ok=True)
    (d / "script.md").write_text("".join(out))
    shutil.copy(HERE.parent / "voice.py", d / "voice.py")
    (d / "pron.json").write_text("{}\n")
    print(d.name, [b[1] or b[0] for b in beats])

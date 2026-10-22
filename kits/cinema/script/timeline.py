"""From a script and its voice to one clock: when each beat starts, when each line and word is
spoken, the captions, and anchors that a film's direction can hang camera keys and events on.

    from timeline import Film
    f = Film("films/x/script.md", "films/x/vo", fps=30, bpm=90)
    f.layout({"hook": {"pre": 0.3, "hold": 0.6}, ...}, end_hold=3.0, total=60.0)
    f.at("vo02:hair")            # when "hair" starts in line vo02 (first match), in film seconds
    f.at("vo02:hair:end", 0.2)   # its end, plus 0.2 s
    f.at("beat:clog")            # when the clog beat starts ("beat:clog:end" for its end)
    f.captions()                 # pages of ≤ 2 lines, ≤ 32 characters, every word timed

Beat starts land on the music grid (an eighth note by default), so a cut is always on the beat.
The voice sets the clock: each beat is its line plus a lead-in (pre) and a picture-only hold.
"""
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "voice"))
from scriptfile import norm, script_lines   # noqa: E402  (the same parsing and word matching as the voice tools)


class Film:
    def __init__(self, script, vodir, fps=30, bpm=90, grid=0.5):
        self.fps, self.bpm = fps, bpm
        self.step = 60.0 / bpm * grid                     # the grid a beat start snaps to (seconds)
        vodir = Path(vodir)
        meta = json.loads((vodir / "lines.json").read_text())
        words = {ln["id"]: ln["words"] for ln in json.loads((vodir / "words.json").read_text())["lines"]}
        self.lines = []
        for (beat, text, stars), ln in zip(script_lines(script), meta["lines"]):
            assert ln["text"] == text, f"{ln['id']}: the voice is stale, re-run tts.py ({ln['text']!r} vs {text!r})"
            self.lines.append({"id": ln["id"], "beat": beat, "text": text, "stars": stars, "file": f"{vodir.name}/{ln['file']}",
                               "dur": ln["dur"], "words": words[ln["id"]]})
        self.beats = []

    def snap(self, t):
        return math.ceil(t / self.step - 1e-9) * self.step

    def frame(self, t):
        return round(t * self.fps) / self.fps

    def layout(self, plan, end_hold=3.0, total=None):
        """plan: {beat: {"pre": s, "hold": s}}. Beat k starts where beat k−1 ends (on the grid);
        its line starts `pre` later; it ends `hold` after the line, snapped up to the grid. The last
        beat also holds `end_hold` for the end card; `total` pads or trims that hold to land exactly."""
        t, self.beats = 0.0, []
        for k, ln in enumerate(self.lines):
            p = plan.get(ln["beat"], {})
            start = self.frame(t + p.get("pre", 0.3))
            end = start + ln["dur"]
            t1 = self.snap(end + p.get("hold", 0.4))
            ln["t"] = start
            self.beats.append({"id": ln["beat"], "t0": round(t, 4), "t1": round(t1, 4), "line": ln["id"], "energy": p.get("energy", 0.5)})
            t = t1
        last = self.beats[-1]
        last["t1"] = round(total if total else self.snap(last["t1"] + end_hold), 4)
        self.end_card = round(last["t1"] - end_hold, 4)
        self.duration = last["t1"]
        return self.beats

    # ── anchors ───────────────────────────────────────────────────────
    def at(self, spec, dt=0.0):
        """'vo02:hair' (first word matching, from the line's start), 'vo02:hair#2' (second match),
        ':end' for the word's end, 'beat:clog' / 'beat:clog:end', 'line:vo03' / 'line:vo03:end',
        'end_card', or a number. Returns film seconds, rounded to the frame."""
        if isinstance(spec, (int, float)):
            return self.frame(spec + dt)
        parts = spec.split(":")
        if parts[0] == "beat":
            b = next(b for b in self.beats if b["id"] == parts[1])
            return self.frame((b["t1"] if parts[-1] == "end" else b["t0"]) + dt)
        if parts[0] == "line":
            ln = self._line(parts[1])
            return self.frame(ln["t"] + (ln["dur"] if parts[-1] == "end" else 0) + dt)
        if parts[0] == "end_card":
            return self.frame(self.end_card + dt)
        ln = self._line(parts[0])
        word, nth = (parts[1].split("#") + ["1"])[:2]
        hits = [w for w in ln["words"] if norm(w["w"]) == norm(word)]
        if len(hits) < int(nth):
            raise KeyError(f"{spec}: '{word}' is not in {ln['id']} ({ln['text']!r})")
        w = hits[int(nth) - 1]
        return self.frame(ln["t"] + (w["end"] if parts[-1] == "end" else w["start"]) + dt)

    def _line(self, lid):
        return next(ln for ln in self.lines if ln["id"] == lid)

    # ── captions ──────────────────────────────────────────────────────
    def captions(self, max_chars=32, linger=0.3):
        """One page per sentence, at most two balanced lines of at most max_chars characters
        (a longer sentence takes several pages, broken after punctuation where it can be). Every
        word keeps its spoken time for the highlight. A page shows from its first word until the
        next page starts, or `linger` after its last word."""
        def width(ws):
            return len(" ".join(w["w"] for w in ws))

        def two_rows(ws):
            """The split into ≤ 2 rows with the shortest longest row; ties go to punctuation."""
            if width(ws) <= max_chars:
                return [ws]
            best = None
            for k in range(1, len(ws)):
                a, b = ws[:k], ws[k:]
                score = max(width(a), width(b)) - (8 if re.search(r"[,:;]$", a[-1]["w"]) else 0)
                if width(a) <= max_chars and width(b) <= max_chars and (best is None or score < best[0]):
                    best = (score, [a, b])
            return best[1] if best else None

        pages = []
        for ln in self.lines:
            words = [{"w": w["w"], "t": round(ln["t"] + w["start"], 3)} for w in ln["words"]]
            sent, sentences = [], []
            for w in words:
                sent.append(w)
                if re.search(r"[.?!]$", w["w"]):
                    sentences.append(sent)
                    sent = []
            if sent:
                sentences.append(sent)
            for sent in sentences:
                rest = sent
                while rest:
                    rows = two_rows(rest)
                    if rows:
                        pages.append(rows)
                        break
                    # too long for one page: take the longest head that fits two rows, preferring a comma
                    cut = max(k for k in range(1, len(rest)) if two_rows(rest[:k]))
                    for k in range(cut, max(1, cut // 2), -1):
                        if re.search(r"[,:;]$", rest[k - 1]["w"]):
                            cut = k
                            break
                    pages.append(two_rows(rest[:cut]))
                    rest = rest[cut:]
        out = []
        for k, p in enumerate(pages):
            t0 = p[0][0]["t"]
            nxt = pages[k + 1][0][0]["t"] if k + 1 < len(pages) else None
            t1 = p[-1][-1]["t"] + 0.45 + linger
            out.append({"t0": round(t0, 3), "t1": round(min(t1, nxt) if nxt else t1, 3), "lines": [[[w["w"], w["t"]] for w in r] for r in p]})
        return out

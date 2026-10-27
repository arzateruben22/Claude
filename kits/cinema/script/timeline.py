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
from scriptfile import direction_plan, norm, script_beats, script_lines   # noqa: E402  (the same parsing and word matching as the voice tools)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from numerals import numerals   # noqa: E402  (captions show "1906" where the voice says "nineteen oh six")


# words a caption page or row should not end on (a reader waits for what they introduce)
WEAK_ENDS = {"the", "a", "an", "of", "to", "and", "or", "in", "on", "at", "by", "as", "so", "your", "his", "her", "its",
             "their", "my", "our", "than", "that", "it", "it's", "they'd", "you've", "about", "from", "with", "for", "is", "are", "was", "were", "be",
             "can", "can't", "doesn't", "might", "could", "would", "will", "should", "must", "may", "into", "through", "this", "these", "those", "one", "what", "where", "how"}


class Film:
    def __init__(self, script, vodir, fps=30, bpm=90, grid=0.5):
        self.script = Path(script)
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

    def script_plan(self, **over):
        """The layout plan the script's own directions ask for, as (plan, end_hold): 'pre: 0.1',
        'picture-only 2.5 s' (the beat's hold) and 'energy: 0.7' per beat, and the last beat's
        'end card held ≥ 2 s' as end_hold (its hold is then 0, so the card follows the line).
        lint.py reads the same directions. Override a beat with f.script_plan(hook={"pre": 0.2}).

            plan, end_hold = f.script_plan()
            f.layout(plan, end_hold=end_hold, total=DUR)
        """
        beats = [b for b in script_beats(self.script) if b["vo"] is not None]
        plan, end_hold = {}, 3.0
        for k, b in enumerate(beats):
            d = direction_plan(b["direction"])
            p = {key: d[key] for key in ("pre", "hold", "energy") if key in d}
            if k == len(beats) - 1 and "end_card" in d:
                end_hold = d["end_card"]
                p.setdefault("hold", 0.0)
            plan[b["id"]] = {**p, **over.get(b["id"], {})}
        return plan, end_hold

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
    def captions(self, max_chars=32, linger=0.3, balance=False, keep=(), written=True):
        """One page per sentence, at most two balanced lines of at most max_chars characters
        (a longer sentence takes several pages, broken after punctuation where it can be). Every
        word keeps its spoken time for the highlight. A page shows from its first word until the
        next page starts, or `linger` after its last word.

        balance=True (opt-in; the default keeps every existing film's pages exactly): a sentence that
        needs several pages is split by a search over every set of cut points, not the greedy longest
        head: the fewest pages, then no page or row ending on a weak word (the, a, of, your, …), no
        page under 10 characters (no one-word tails flashing past), cuts after a comma preferred, and
        pages of even length. keep: phrases ("Formula One", "white cells") never split across rows or
        pages in balance mode.

        written=True (the default): numbers read as people read them, not as the voice says them: "nineteen oh six"
        shows as "1906", "point four five seconds" as "0.45 seconds", "twenty times" as "20 times" (numerals.py: years,
        decimals, 10 and over, and any number before a unit of measure; small counts stay words). A merged number
        lights from its first spoken word, a page ending on one holds until its last word is said, and a numeral never
        ends a row its unit starts ("20 / centimeters")."""
        def width(ws):
            return len(" ".join(w["w"] for w in ws))

        def weak(w):
            """What ending a row or page on this word costs: an article most, other weak words less."""
            if re.search(r"[,:;.?!]$", w["w"]):
                return 0                                         # punctuation closes the phrase ("re-fires it,")
            x = re.sub(r"[^a-z']", "", w["w"].lower())
            return 30 if x in ("a", "an", "the") else 20 if x in WEAK_ENDS else 0

        def norm_w(x):
            return re.sub(r"[^a-z0-9'-]", "", x.lower())

        KEEP = [[norm_w(x) for x in ph.split()] for ph in keep]

        def mark_keep(ws):
            """Flag each word that a break before would split a keep phrase (nb)."""
            n = [norm_w(w["w"]) for w in ws]
            for ph in KEEP:
                for i in range(len(n) - len(ph) + 1):
                    if n[i:i + len(ph)] == ph:
                        for j in range(i + 1, i + len(ph)):
                            ws[j]["nb"] = True
            return ws

        def two_rows(ws):
            """The split into ≤ 2 rows with the shortest longest row; ties go to punctuation."""
            if width(ws) <= max_chars:
                return [ws]
            best = None
            for k in range(1, len(ws)):
                a, b = ws[:k], ws[k:]
                score = max(width(a), width(b)) - (8 if re.search(r"[,:;]$", a[-1]["w"]) else 0) + (weak(a[-1]) if balance else 0) + (60 if b[0].get("nb") else 0)
                if width(a) <= max_chars and width(b) <= max_chars and (best is None or score < best[0]):
                    best = (score, [a, b])
            return best[1] if best else None

        def page_cost(ws, last, nxt):
            c = 0.006 * (2 * max_chars - width(ws)) ** 2
            rows = two_rows(ws)
            if len(rows) == 2:                                      # the rows' own break
                c += weak(rows[0][-1]) + (60 if rows[1][0].get("nb") else 0)
            if not last:
                c += weak(ws[-1]) + (60 if nxt.get("nb") else 0)
            if not last and re.search(r"[,:;]$", ws[-1]["w"]):
                c -= 8
            if width(ws) < 10:
                c += 40
            return c

        def split_balanced(sent):
            """The pages for one sentence: the lowest summed page cost, each page after the first costing 25 (a
            third page is worth it to keep a phrase whole, not to shave a little imbalance)."""
            n, best = len(sent), {len(sent): (0, 0.0, None)}
            for i in range(n - 1, -1, -1):
                for j in range(i + 1, n + 1):
                    if j not in best or not two_rows(sent[i:j]):
                        continue
                    np_, cost, _ = best[j]
                    cand = (np_ + 1, cost + page_cost(sent[i:j], j == n, sent[j] if j < n else {}) + (25 if j < n else 0), j)
                    if i not in best or cand[1] < best[i][1]:
                        best[i] = cand
            out, i = [], 0
            while i < n:
                j = best[i][2]
                out.append(two_rows(sent[i:j]))
                i = j
            return out

        pages = []
        for ln in self.lines:
            words = [{"w": w["w"], "t": round(ln["t"] + w["start"], 3)} for w in ln["words"]]
            if balance:
                mark_keep(words)                             # on the spoken words: a merged number keeps its first word's mark
            if written:
                words = numerals(words)                      # (and marks a unit after a numeral nb: "20 / centimeters" never splits)
            sent, sentences = [], []
            for w in words:
                sent.append(w)
                if re.search(r"[.?!]$", w["w"]):
                    sentences.append(sent)
                    sent = []
            if sent:
                sentences.append(sent)
            for sent in sentences:
                if balance:
                    pages += split_balanced(sent)
                    continue
                rest = sent
                while rest:
                    rows = two_rows(rest)
                    if rows:
                        pages.append(rows)
                        break
                    # too long for one page: take the longest head that fits two rows, preferring a comma
                    cut = max(k for k in range(1, len(rest)) if two_rows(rest[:k]))
                    while cut > 1 and rest[cut].get("nb"):
                        cut -= 1
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
            t1 = p[-1][-1].get("tl", p[-1][-1]["t"]) + 0.45 + linger   # tl: a written number's last spoken word
            out.append({"t0": round(t0, 3), "t1": round(min(t1, nxt) if nxt else t1, 3), "lines": [[[w["w"], w["t"]] for w in r] for r in p]})
        return out

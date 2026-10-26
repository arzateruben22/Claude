"""captions_py.py — Rest Frame's caption pager (films/channels/physics/set): the kit's `Film.captions` pages, broken at
phrases instead of at the character limit (WRITING.md "The picture" 5: one idea per caption line).

    from captions_py import phrase_captions
    film["captions"] = phrase_captions(f, max_chars=24, fix=["Ghosts every tenth / of a second | bunch up at the turns."])

Same output as `Film.captions` ([{t0, t1, lines: [[[word, t], ...], ...]}], one or more pages per sentence, at most
two rows, every word keeping its spoken time). The difference is where a long sentence breaks: a small dynamic
program splits each sentence into pages and rows, preferring breaks at punctuation and before a phrase ("at the
turns", "and the water"), never after a word that leans on the next one ("the", "a", "is", "two"), and otherwise
few pages with balanced rows and no one-word orphan rows. Rows may run two characters past max_chars at a cost.

`fix` overrides the pager for whole sentences: the sentence's words exactly, with " / " for a row break and " | "
for a page break. Every fix must match a spoken sentence (or the compile fails), so a script edit can't leave a stale
fix behind silently.
"""
import re

# words that lean on the next one: a row or page should not end on them
LEAN = set("""a an the of at to in on by for from with into onto than as and or but nor so if is are was were be been
it's its every each your you're my his her their our this these those just not no nearly about almost only very
how what why where when who which that's there's here's let's does do did can can't won't""".split())
ARTICLE = {"a", "an", "the", "every", "each", "your", "its", "my", "his", "her", "their", "our"}
# words a phrase starts with: a break just before one is a good break (not "of", which binds to the noun before it)
START = set("""at to in on by for from with into onto than as and or but so because while that which who where
until after before past over under""".split())
NUM = set("""one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen
eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million half""".split())


def _width(ws):
    return len(" ".join(w["w"] for w in ws))


def _bare(w):
    return re.sub(r"[^a-z'\-]", "", w["w"].lower().replace("’", "'"))


def _break_cost(x, y):
    """The cost of a break between word x and the word y after it (y None: the sentence ends)."""
    if y is None or re.search(r"[.?!]$", x["w"]):
        return 0.0
    if re.search(r"[,:;]$|—$|…$", x["w"]):
        return 1.0
    bx, by = _bare(x), _bare(y)
    if bx in ARTICLE:
        return 50.0
    if bx in LEAN:
        return 30.0
    if bx.split("-")[0] in NUM and by not in LEAN and by not in START:
        return 20.0                                     # "two / thousandths": a number leans on its noun
    if by in START:
        return 2.0
    return 8.0


def _row_split(ws, cap):
    """The best ≤ 2-row layout of one page and its cost; (None, None) if it can't fit."""
    over = lambda w: max(0, w - cap) * 4.0 if w <= cap + 2 else None
    one = over(_width(ws))
    best = ([ws], one) if one is not None else None
    for k in range(1, len(ws)):
        a, b = ws[:k], ws[k:]
        wa, wb = _width(a), _width(b)
        oa, ob = over(wa), over(wb)
        if oa is None or ob is None:
            continue
        cost = 3.0 + oa + ob + _break_cost(a[-1], b[0]) + 0.25 * abs(wa - wb)
        if min(len(a), len(b)) == 1 and min(wa, wb) <= 7:
            cost += 10.0                                # an orphan: "clock." alone on its row
        if best is None or cost < best[1]:
            best = ([a, b], cost)
    return best if best else (None, None)


def _pages(sent, cap):
    """Split one sentence into pages, minimising the total cost (a dynamic program over break points)."""
    n = len(sent)
    best = [None] * (n + 1)
    best[n] = (0.0, [])
    for i in range(n - 1, -1, -1):
        for j in range(i + 1, n + 1):
            rows, rc = _row_split(sent[i:j], cap)
            if rows is None:
                break                                   # longer pages from i won't fit either
            if best[j] is None:
                continue
            brk = 1.5 * _break_cost(sent[j - 1], sent[j] if j < n else None)   # a page break mid-phrase costs more than a row break
            short = 6.0 if (j - i) <= 2 and j < n else 0.0                       # a one- or two-word page mid-sentence flashes by
            cost = 6.0 + rc + brk + short + best[j][0]
            if best[i] is None or cost < best[i][0]:
                best[i] = (cost, [rows] + best[j][1])
    if best[0] is None:                                 # a word wider than the cap: one word per page
        return [[[w]] for w in sent]
    return best[0][1]


def _fixed(sent, fixes, used):
    """The sentence laid out by a matching fix, or None."""
    key = " ".join(w["w"] for w in sent)
    for k, fx in enumerate(fixes):
        if re.sub(r"\s*[|/]\s*", " ", fx).strip() != key:
            continue
        used.add(k)
        pages, i = [], 0
        for pg in fx.split("|"):
            rows = []
            for r in pg.split("/"):
                n = len(r.split())
                rows.append(sent[i:i + n])
                i += n
            pages.append(rows)
        return pages
    return None


def phrase_captions(f, max_chars=24, linger=0.3, fix=(), until=None):
    """Caption pages for the Film `f` (kits/cinema/script/timeline.py, after f.layout), broken at phrases.
    until: no page shows past this time (pass the end card's arrival, so the last line never sits on the card)."""
    return paginate([[{"w": w["w"], "t": round(ln["t"] + w["start"], 3)} for w in ln["words"]] for ln in f.lines], max_chars, linger, fix, until)


def paginate(lines, max_chars=24, linger=0.3, fix=(), until=None):
    """lines: [[{w, t}, ...], ...], one list of timed words per spoken line → caption pages."""
    pages, used = [], set()
    for words in lines:
        sent, sentences = [], []
        for w in words:
            sent.append(w)
            if re.search(r"[.?!]$", w["w"]):
                sentences.append(sent)
                sent = []
        if sent:
            sentences.append(sent)
        for s in sentences:
            pages.extend(_fixed(s, list(fix), used) or _pages(s, max_chars))
    stale = [fx for k, fx in enumerate(fix) if k not in used]
    assert not stale, f"caption fixes that match no spoken sentence: {stale}"
    out = []
    for k, p in enumerate(pages):
        t0 = p[0][0]["t"]
        nxt = pages[k + 1][0][0]["t"] if k + 1 < len(pages) else None
        t1 = p[-1][-1]["t"] + 0.45 + linger
        if until is not None:
            t1 = min(t1, max(until, p[-1][-1]["t"] + 0.3))
        out.append({"t0": round(t0, 3), "t1": round(min(t1, nxt) if nxt else t1, 3), "lines": [[[w["w"], w["t"]] for w in r] for r in p]})
    return out


if __name__ == "__main__":     # re-page a compiled film.json and compare: python3 captions_py.py <episode dir> [max_chars]
    import json
    import sys
    from pathlib import Path
    film = json.loads((Path(sys.argv[1]) / "film.json").read_text())
    mc = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    words = [{"w": w, "t": t} for p in film["captions"] for r in p["lines"] for w, t in r]
    show = lambda ps: [" / ".join(" ".join(w for w, _ in r) for r in p["lines"]) for p in ps]
    old, new = show(film["captions"]), show(paginate([words], mc))
    print(f"film.json {len(old)} pages · phrase {len(new)} pages")
    for s in new:
        print("  ", s, "" if s in old else "   ← new")

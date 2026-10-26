"""capglue.py (films/channels/space/set): keep number phrases and fixed phrases on one caption line.

timeline.Film.captions() breaks pages and lines between word tokens, so "nineteen / seventy-seven" can land on
two lines. glue() merges each named run of words in a voice line into one token (joined with a figure space, which
doesn't break and matches the captions' word gap; timed from its first word to its last), so the caption breaker can't split it. Call it after the last f.at()
lookup (the anchors still see the separate words) and before f.captions().

    from capglue import glue, hold
    glue(f, {"vo02": ["nineteen seventy-seven", "the Moon"]})
    captions = hold(f, f.captions(max_chars=24))

timeline.Film.captions() ends a page `linger` after its last word's start plus 0.45 s (a word's usual length), so a
glued phrase at a page's end ("the day after tomorrow.") would leave before it has been spoken. hold() keeps every
page up until its last word or phrase has ended (plus `linger`), never past the next page's start.
"""
import re

NBSP = "\u2007"   # a figure space: non-breaking, and as wide (0.55 em in Lexend) as the captions' word gap (0.28 em + 0.2 em padding)


def _key(w):
    return re.sub(r"[^\w'-]", "", w.lower())


def glue(film, runs):
    """runs: {line id: [phrase, ...]}; each phrase is matched word by word (case and punctuation ignored).
    A phrase that isn't found raises, so a re-voiced line can't silently drop a glue."""
    lines = {ln["id"]: ln for ln in film.lines}
    for lid, phrases in runs.items():
        ws = lines[lid]["words"]
        for ph in phrases:
            want = [_key(p) for p in ph.split()]
            for i in range(len(ws) - len(want) + 1):
                if [_key(w["w"]) for w in ws[i:i + len(want)]] == want:
                    run = ws[i:i + len(want)]
                    merged = dict(run[0], w=NBSP.join(w["w"] for w in run), end=run[-1]["end"])
                    ws[i:i + len(want)] = [merged]
                    break
            else:
                raise ValueError(f"capglue: {ph!r} not found in {lid}")


def hold(film, pages, linger=0.3):
    """pages: film.captions()'s output, changed in place and returned. Each page's t1 becomes at least the spoken end
    of its last token plus `linger`, and never later than the next page's t0."""
    ends = {}
    for ln in film.lines:
        for w in ln["words"]:
            ends[(w["w"], round(ln["t"] + w["start"], 3))] = ln["t"] + w.get("end", w["start"] + 0.45)
    for k, pg in enumerate(pages):
        w, t = pg["lines"][-1][-1]
        end = ends.get((w, round(t, 3)))
        if end is None:
            raise ValueError(f"capglue.hold: no spoken end for {w!r} at {t}")
        t1 = max(pg["t1"], end + linger)
        if k + 1 < len(pages):
            t1 = min(t1, pages[k + 1]["t0"])
        pg["t1"] = round(t1, 3)
    return pages


UNITS = ("kilometers", "kilometer", "meters", "years", "days", "hours", "minutes", "seconds", "light-days", "light-years")


def keep_units(pages, units=UNITS, max_chars=24):
    """pages: film.captions()'s output, changed in place and returned. Where a sentence's page break falls between a
    number and its unit (a two-row page, then a one-row page starting with the unit: "about thirty" / "kilometers every
    second."), the number's row moves onto the next page, so the number and its unit are read together."""
    for a, b in zip(pages, pages[1:]):
        if len(a["lines"]) != 2 or len(b["lines"]) != 1:
            continue
        first = b["lines"][0][0][0].replace(NBSP, " ").split(" ")[0].lower()
        last = a["lines"][-1][-1][0]
        if first not in units or last.rstrip()[-1:] in ".?!":
            continue
        if len(" ".join(w for w, _ in a["lines"][-1])) > max_chars:
            continue
        row = a["lines"].pop()
        b["lines"].insert(0, row)
        a["t1"] = b["t0"] = row[0][1]
    return pages

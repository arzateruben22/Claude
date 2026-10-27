"""Numbers in captions as people read them: the voice says "nineteen oh six", the caption shows "1906".

The narration is written in words so the voice says it right; on screen, that reads as a spelling mistake. The
caption rule (the common subtitle style, e.g. Netflix's timed-text guide): years and decades, decimals, every number
of 10 and over, and a number of any size before a unit of measure become numerals; a small count stays a word ("nine
gaps", "one thrown sideways", "day one", "Formula One", "one day", "half a billion").

  1906 · the 1950s · 0.45 seconds · 7.5 micrometers · 3 micrometers · 20 times · 130 million · 1,500 · a 1-meter fall

numerals(tokens) takes caption tokens ({"w": word with its punctuation, "t": its spoken start, ...}) and merges each
converted run of number words into one token timed from the run's first word, so the word-by-word highlight still
lands when the number begins; "tl" is its last spoken word's start (a page ending on "150." holds until "fifty" is
said). The unit after a numeral ("20 centimeters", "1 square centimeter", "80 times") gets "nb" (no break before it),
which the caption pagers honour. numerals_text(text) does the same to a plain sentence (for checks and tests).
"""
import re

UNIT = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
                                    "fifteen sixteen seventeen eighteen nineteen".split())}
TENS = {w: 10 * i for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()) if w != "_"}
SCALE = {"hundred": 100, "thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000, "trillion": 1_000_000_000_000}
DECADE = {w: 10 * i for i, w in enumerate("_ _ twenties thirties forties fifties sixties seventies eighties nineties".split()) if w != "_"}
UNITS = set("""second seconds minute minutes hour hours day days week weeks month months year years decade decades century centuries
metre metres meter meters centimetre centimetres centimeter centimeters millimetre millimetres millimeter millimeters
micrometre micrometres micrometer micrometers nanometre nanometres nanometer nanometers kilometre kilometres kilometer
kilometers mile miles light-year light-years light-day light-days light-minute light-minutes light-second light-seconds
percent degree degrees kilogram kilograms gram grams tonne tonnes litre litres liter liters kph mph""".split())
CALENDAR = set("day days week weeks month months year years decade decades century centuries".split())   # small counts stay words
YEAR_LEAD = {"in", "since", "by", "until", "till", "from", "of", "around", "circa", "before", "after", "during"}   # the pair forms
YEAR_LEAD_VALUE = {"in", "since", "by", "until", "till", "circa"}     # "in two thousand and twelve"; "day one of fifteen hundred" is a count


def core(w):
    """A token's word without the punctuation around it, lower case."""
    return re.sub(r"^[^\w]+|[^\w]+$", "", w).lower()


def num_word(c):
    if c in UNIT or c in TENS or c in SCALE:
        return True
    if "-" in c:
        a, _, b = c.partition("-")
        return a in TENS and b in UNIT and 0 < UNIT[b] < 10
    return False


def small(c):
    """0–99 from one word ("seventeen", "forty-four"), else None."""
    if c in UNIT:
        return UNIT[c]
    if c in TENS:
        return TENS[c]
    if "-" in c:
        a, _, b = c.partition("-")
        if a in TENS and b in UNIT and 0 < UNIT[b] < 10:
            return TENS[a] + UNIT[b]
    return None


def value(cs):
    """The value of number words ("one hundred and fifty", "one point three million", "seven and a half"), or None."""
    total, cur, i, dec, seen = 0, 0, 0, None, False
    while i < len(cs):
        c = cs[i]
        if c == "and" and seen:
            if cs[i + 1:i + 3] == ["a", "half"]:
                return (total + cur) + 0.5 if dec is None else None
            i += 1
            continue
        if c == "a" and not seen:
            cur, seen = 1, True
            i += 1
            continue
        if c == "point" and dec is None:
            digits = []
            i += 1
            while i < len(cs) and cs[i] in UNIT and UNIT[cs[i]] < 10:
                digits.append(str(UNIT[cs[i]]))
                i += 1
            if not digits:
                return None
            dec, seen = "".join(digits), True
            continue
        s = small(c)
        if s is not None and dec is None:
            if cur % 100 and not (cur % 100 >= 20 and cur % 10 == 0 and s < 10):
                return None                                   # "four five" is two digits, not a sum
            cur += s
            seen = True
        elif c in SCALE:
            if not seen and c != "hundred":
                return None                                   # (a bare "hundred and seventeen" is 117)
            seen = True
            if c == "hundred":
                cur = (cur or 1) * 100
            else:
                base = (cur or 1) + (float("0." + dec) if dec else 0)
                total, cur, dec = total + base * SCALE[c], 0, None
        else:
            return None
        i += 1
    if dec is not None:
        return float(f"{total + cur}.{dec}")
    return total + cur if seen else None


def fmt(v, cs):
    """Digits with thousands separators; a run that ends on million/billion/trillion keeps that word (130 million)."""
    last = cs[-1]
    if last in ("million", "billion", "trillion") and v >= SCALE[last]:
        m = v / SCALE[last]
        return f"{m:g} {last}" if m < 1000 else f"{v:,.0f}"
    if isinstance(v, float) and v != int(v):
        return f"{v:g}"
    return f"{int(v):,}"


def runs(tokens):
    """Spans [i, j) of number words, with the "a", "and", "point", "oh" and "and a half" that belong to them."""
    cs = [core(t["w"]) for t in tokens]
    out, i = [], 0
    while i < len(cs):
        starts_a = cs[i] == "a" and i + 1 < len(cs) and cs[i + 1] in ("hundred", "thousand", "million", "billion", "trillion")
        starts_point = cs[i] == "point" and i + 1 < len(cs) and cs[i + 1] in UNIT and UNIT[cs[i + 1]] < 10
        if not (num_word(cs[i]) or starts_a or starts_point):
            i += 1
            continue
        j = i + 1
        while j < len(cs):
            c, prev_ends = cs[j], re.search(r"[,.;:!?]$", tokens[j - 1]["w"])
            if prev_ends:
                break                                         # "forty centimeters, then sixty": a comma ends the number
            if num_word(c) or (c == "oh" and j + 1 < len(cs) and cs[j + 1] in UNIT and 0 < UNIT[cs[j + 1]] < 10):
                j += 1
            elif c == "and" and j + 1 < len(cs) and (num_word(cs[j + 1]) or cs[j + 1:j + 3] == ["a", "half"]) and cs[j - 1] in ("hundred", "thousand", *UNIT, *TENS):
                j += 3 if cs[j + 1:j + 3] == ["a", "half"] else 1
            elif c == "point" and j + 1 < len(cs) and cs[j + 1] in UNIT:
                j += 1
            elif c in DECADE and j == i + 1 and small(cs[i]) and 10 <= small(cs[i]) <= 20:
                j += 1
                break
            else:
                break
        out.append((i, j))
        i = j
    return out


def convert(tokens, i, j):
    """The written form of tokens[i:j], or None to leave the words as spoken."""
    cs = [core(t["w"]) for t in tokens[i:j]]
    words = [t["w"] for t in tokens[i:j]]
    before = core(tokens[i - 1]["w"]) if i > 0 else ""
    after = core(tokens[j]["w"]) if j < len(tokens) else ""
    if words[0][:1].isupper() and i > 0 and not re.search(r"[.?!:]$", tokens[i - 1]["w"]):
        return None                                           # "Formula One": a capitalised number mid-sentence is a name
    if cs[-1] in DECADE:                                      # "the nineteen fifties" → the 1950s
        return f"{small(cs[0]) * 100 + DECADE[cs[-1]]}s" if len(cs) == 2 else None
    if "oh" in cs:                                            # "nineteen oh six" → 1906
        if len(cs) == 3 and cs[1] == "oh" and small(cs[0]) and 10 <= small(cs[0]) <= 20:
            return str(small(cs[0]) * 100 + UNIT[cs[2]])
        return None
    if before in YEAR_LEAD and len(cs) == 2 and all(small(c) is not None for c in cs) and 10 <= small(cs[0]) <= 20 and small(cs[1]) >= 10:
        return str(small(cs[0]) * 100 + small(cs[1]))        # "in sixteen forty-four" → 1644
    if len(cs) >= 2 and cs[-1] in ("million", "billion", "trillion") and cs[-2] in SCALE and cs[-2] != "hundred":
        return None                                           # "a million billion": an idiom, not a figure
    if cs[0] == "a" and before == "half":
        return None                                           # "half a billion" reads as written
    v = value(cs)
    if v is None:
        return None
    if before in YEAR_LEAD_VALUE and isinstance(v, int) and 1000 <= v <= 2100 and cs[0] != "a":
        return str(v)                                         # "in two thousand and twelve" → 2012 (no comma)
    after2 = core(tokens[j + 1]["w"]) if j + 1 < len(tokens) else ""
    unit = after2 if after in ("square", "cubic") else after       # "one square centimeter"
    unit_next = (unit in UNITS or unit.split("-")[0] in UNITS or bool(tokens[j - 1].get("_glue"))) and unit not in CALENDAR
    if isinstance(v, float) or v >= 10 or unit_next:
        return fmt(v, cs)
    return None


GLUE = "\u2007"   # a figure space: films/channels/space/set/capglue.py joins a phrase that must not break with it


def numerals(tokens):
    """Caption tokens with number runs merged into their written form (see the module notes). A glued token
    ("in nineteen seventy-seven.", words joined by figure spaces so the pager keeps them on one row) is converted
    word by word together with the words around it, then glued again; a number that runs across two glued phrases
    ("about seventy-five" + "thousand years.") joins them into one."""
    flat = []
    for k, t in enumerate(tokens):
        for p, w in enumerate(t["w"].split(GLUE)):
            flat.append({**t, "w": w, "_g": k} if p == 0 else {"w": w, "t": t["t"], "_g": k})
    merged = _merge(flat)
    root = list(range(len(tokens)))                            # the glued groups a written number joined
    def find(g):
        while root[g] != g:
            g = root[g]
        return g
    for t in merged:
        for g in t.pop("_gs", ()):
            root[find(g)] = find(t["_g"])
    out = []
    for t in merged:
        g = find(t.pop("_g"))
        if out and out[-1][0] == g:
            prev = out[-1][1]
            prev["w"] += GLUE + t["w"]
            if "tl" in t or "tl" in prev:
                prev["tl"] = max(prev.get("tl", prev["t"]), t.get("tl", t["t"]))
        else:
            out.append((g, t))
    for g, t in out:
        if GLUE in t["w"]:
            t["w"] = t["w"].replace(" ", GLUE)                   # "75 thousand" inside a glued phrase stays unbroken
    return [t for g, t in out]


def _merge(tokens):
    """numerals() on single words: each converted run becomes one token (with "_gs", the glued groups it covers)."""
    out, last = [], 0
    toks = []
    for t in tokens:                                          # "one-meter": the number part of a number-unit compound
        w = t["w"]
        m = re.match(r"^([^\w]*)([a-z]+(?:-[a-z]+)?)-((?:light-)?[a-z]+)([^\w]*)$", w, re.I)
        if m and num_word(m.group(2).lower()) and (m.group(3).lower() in UNITS or m.group(3).lower().rstrip("s") in UNITS):
            toks.append({**t, "w": m.group(1) + m.group(2), "_glue": "-" + m.group(3) + m.group(4)})
        else:
            toks.append(dict(t))
    for i, j in runs(toks):
        written = convert(toks, i, j)
        if written is None:
            continue
        out += toks[last:i]
        lead = re.match(r"^[^\w]*", toks[i]["w"]).group(0)
        tail = re.search(r"[^\w]*$", toks[j - 1]["w"]).group(0)
        merged = {**toks[i], "w": lead + written + tail + toks[j - 1].get("_glue", "")}
        merged.pop("_glue", None)
        if j - i > 1:
            merged["tl"] = toks[j - 1].get("tl", toks[j - 1]["t"])   # its last spoken word: the page holds until it is said
        gs = {x["_g"] for x in toks[i:j] if "_g" in x}
        if len(gs) > 1:
            merged["_gs"] = gs
        out.append(merged)
        last = j
        if not tail and "-" not in merged["w"][len(lead):]:
            k = j                                             # "20 / centimeters": a numeral and its unit share a row
            while k < len(toks) and k - j < 2:
                c = core(toks[k]["w"])
                if c in ("square", "cubic") and k == j:
                    toks[k]["nb"] = True
                    k += 1
                    continue
                if c in UNITS or c.split("-")[0] in UNITS or (c == "times" and k == j):
                    toks[k]["nb"] = True
                break
    out += toks[last:]
    for t in out:
        if "_glue" in t:
            t["w"] += t.pop("_glue")
    return out


def numerals_text(text):
    toks = [{"w": w, "t": k} for k, w in enumerate(text.split())]
    return " ".join(t["w"] for t in numerals(toks))

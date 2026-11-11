"""On-screen captions show numbers as numerals and units as symbols; the voice still says them in words.

    from numerals import to_display, display_tokens
    to_display("eighty-four thousand kilometers away")        -> "84,000 km away"
    to_display("about three point eight centimeters a year")  -> "about 3.8 cm a year"
    to_display("at about 1,670 kilometers an hour")           -> "at about 1,670 km/h"
    to_display("Part three of eight.")                        -> "Part 3 of 8."
    to_display("one more orbit")                              -> "one more orbit"   (a lone "one" stays a word)

    python3 -I kits/cinema/film/numerals.py "text …"           prints the display form
    python3 -I kits/cinema/film/numerals.py --test             runs the self-test

Rules (the owner's, 11 Nov 2026: "numbers read as actual numbers, km for kilometers"):
  - spelled-out cardinals become numerals with thousands separators (384,400); decimals with "point" (3.8);
    "a hundred/thousand/million" become 100 / 1,000 / 1 million; whole millions, billions and trillions read "1 million"
  - a lone "one" stays a word unless a unit, "point", a scale word or "of <number>" follows it ("one thing" stays)
  - units after a number: km, m, cm, mm, kg, g, %, °, km/h, m/s ("kilometers an hour", "meters a second", "per")
  - time words stay words (hours, minutes, seconds, days, years): they read better and the readouts already abbreviate
  - nothing else changes: punctuation, capitals and spacing are kept

display_tokens(words) maps spoken word tokens (with times) to display tokens, so karaoke highlighting still works:
each display token gets the time span of the spoken words it came from.
"""
import re
import sys

UNITS = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
         "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
         "seventeen": 17, "eighteen": 18, "nineteen": 19}
TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
SCALES = {"hundred": 100, "thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000, "trillion": 1_000_000_000_000}
BIG = {1_000_000: "million", 1_000_000_000: "billion", 1_000_000_000_000: "trillion"}
UNIT_WORDS = [  # longest first; (spoken pattern, symbol)
    (r"kilomet(?:er|re)s? (?:an|per|a) hour", "km/h"), (r"met(?:er|re)s? (?:a|per) second", "m/s"),
    (r"kilomet(?:er|re)s?", "km"), (r"centimet(?:er|re)s?", "cm"), (r"millimet(?:er|re)s?", "mm"),
    (r"met(?:er|re)s?", "m"), (r"kilograms?", "kg"), (r"grams?", "g"), (r"percent", "%"),
    (r"degrees? celsius", "°C"), (r"degrees? fahrenheit", "°F"), (r"degrees?", "°"),
]
WORD = re.compile(r"[A-Za-z]+(?:-[A-Za-z]+)?|\d[\d,]*(?:\.\d+)?|\S")


def _num_word(w):
    w = w.lower()
    if w in UNITS or w in TENS or w in SCALES:
        return True
    if "-" in w:
        a, b = w.split("-", 1)
        return a in TENS and b in UNITS and 0 < UNITS[b] < 10
    return False


def _value(words):
    """value of a run of number words ("three hundred eighty-four thousand four hundred"), or None"""
    total = cur = 0
    seen = False
    for w in words:
        w = w.lower()
        if w == "and":
            continue
        if w in UNITS:
            cur += UNITS[w]; seen = True
        elif w in TENS:
            cur += TENS[w]; seen = True
        elif "-" in w:
            a, b = w.split("-", 1); cur += TENS[a] + UNITS[b]; seen = True
        elif w == "hundred":
            cur = (cur or 1) * 100; seen = True
        elif w in SCALES:
            total += (cur or 1) * SCALES[w]; cur = 0; seen = True
        else:
            return None
    return total + cur if seen else None


def _fmt(v):
    if isinstance(v, float) and not v.is_integer():
        return f"{v:,.10f}".rstrip("0").rstrip(".")
    v = int(v)
    for scale in sorted(BIG, reverse=True):
        if v >= scale and v % scale == 0:
            return f"{v // scale:,} {BIG[scale]}"
        if v >= scale and (v * 10) % scale == 0:
            return f"{v / scale:g} {BIG[scale]}"
    return f"{v:,}"


def to_display(text):
    return " ".join(t for t, _ in display_tokens([(w, None) for w in text.split(" ")])) if text else text


def display_tokens(words):
    """words: [(spoken_token, time_or_None), …] as split on spaces (punctuation attached).
    Returns [(display_token, [times of the spoken tokens it covers]), …]."""
    out, i, n = [], 0, len(words)
    core = lambda s: re.sub(r"^[^\w]+|[^\w%°/]+$", "", s)   # trailing "." is punctuation (a decimal never ends in one)
    while i < n:
        tok, t = words[i]
        lead = re.match(r"^[^\w]*", tok).group(0)
        c = core(tok).lower()
        # "a hundred / a thousand / a million"
        idiom = i >= 2 and core(words[i - 1][0]).lower() == "in" and core(words[i - 2][0]).lower() == "one"
        if c == "a" and not idiom and i + 1 < n and core(words[i + 1][0]).lower() in SCALES and not re.search(r"[,.;:!?]$", tok):
            j = i + 1
            run = ["one", core(words[j][0]).lower()]
            k = j + 1
            while k < n and _num_word(core(words[k][0])) and not re.search(r"[,.;:!?]$", words[k - 1][0]):
                run.append(core(words[k][0]).lower()); k += 1
            i, start_lead, idx = k, lead, list(range(j - 1, k))
            v = _value(run)
        elif _num_word(c) or re.fullmatch(r"\d[\d,]*(?:\.\d+)?", c):
            j = i
            run = []
            while j < n:
                cj = core(words[j][0]).lower()
                if _num_word(cj) or (cj == "and" and run and j + 1 < n and _num_word(core(words[j + 1][0]))):
                    run.append(cj); j += 1
                    if re.search(r"[,.;:!?]$", words[j - 1][0]):
                        break
                else:
                    break
            if not run:                                  # an existing numeral: keep it, maybe abbreviate a unit after it
                i, idx, v, start_lead = i + 1, [i], None, lead
                disp = tok
                out_tail = _unit_after(words, i, disp)
                if out_tail:
                    disp2, used = out_tail
                    out.append((disp2, [words[x][1] for x in [*idx, *range(i, i + used)]])); i += used
                else:
                    out.append((tok, [t]))
                continue
            if run[0] in SCALES:                         # a bare "thousand" / "hundred" with no number before it stays a word
                for x in range(i, j):
                    out.append((words[x][0], [words[x][1]]))
                i = j
                continue
            v = _value(run)
            # "two and a half (thousand)": N.5, times a scale word if one follows
            if v is not None and j + 2 < n and [core(words[x][0]).lower() for x in (j, j + 1, j + 2)] == ["and", "a", "half"] \
                    and not re.search(r"[,.;:!?]$", words[j - 1][0]):
                v = v + 0.5; j += 3
                if j < n and core(words[j][0]).lower() in SCALES and not re.search(r"[,.;:!?]$", words[j - 1][0]):
                    v = v * SCALES[core(words[j][0]).lower()]; j += 1
                    v = int(v) if float(v).is_integer() else v
            # decimals: "three point eight"
            k = j
            if v is not None and k + 1 < n and core(words[k][0]).lower() == "point" and not re.search(r"[,.;:!?]$", words[k - 1][0]):
                digits, m = [], k + 1
                while m < n and core(words[m][0]).lower() in UNITS and UNITS[core(words[m][0]).lower()] < 10:
                    digits.append(str(UNITS[core(words[m][0]).lower()])); m += 1
                    if re.search(r"[,.;:!?]$", words[m - 1][0]):
                        break
                if digits:
                    v = float(f"{v}.{''.join(digits)}"); j = m
            idx, start_lead = list(range(i, j)), lead
            # a lone "one" stays a word unless a unit, a scale or "of <number>" follows
            if run == ["one"] and isinstance(v, int):
                nxt = core(words[j][0]).lower() if j < n else ""
                unit_next = any(re.fullmatch(p.split(" ")[0], nxt) for p, _ in UNIT_WORDS)
                of_num = nxt == "of" and j + 1 < n and _num_word(core(words[j + 1][0]))
                if not (unit_next or of_num):
                    out.append((tok, [t])); i += 1
                    continue
            i = j
        else:
            out.append((tok, [t])); i += 1
            continue
        if v is None:
            for x in idx:
                out.append((words[x][0], [words[x][1]]))
            continue
        last = words[idx[-1]][0]
        trail = re.search(r"[^\w%°/]*$", last).group(0)
        disp = start_lead + _fmt(v)
        tail = _unit_after(words, i, disp) if not re.search(r"[,.;:!?]$", last) else None
        if tail:
            disp2, used = tail
            out.append((disp2, [words[x][1] for x in [*idx, *range(i, i + used)]])); i += used
        else:
            out.append((disp + trail, [words[x][1] for x in idx]))
    return out


def _unit_after(words, i, disp):
    """if the spoken words from i start with a unit, return (display with symbol and trailing punctuation, words used)"""
    n = len(words)
    for pat, sym in UNIT_WORDS:
        parts = pat.split(" ")
        if i + len(parts) > n:
            continue
        seg = words[i:i + len(parts)]
        text = " ".join(re.sub(r"[^\w]+$", "", w) for w, _ in seg).lower()
        if re.fullmatch(pat, text):
            trail = re.search(r"[^\w]*$", seg[-1][0]).group(0)
            sep = "" if sym in ("%", "°", "°C", "°F") else " "
            return disp.rstrip() + sep + sym + trail, len(parts)
    return None


TESTS = [
    ("eighty-four thousand kilometers away.", "84,000 km away."),
    ("About three point eight centimeters a year.", "About 3.8 cm a year."),
    ("you around at about 1,670 kilometers an hour.", "you around at about 1,670 km/h."),
    ("Part three of eight.", "Part 3 of 8."),
    ("Part one of eight.", "Part 1 of 8."),
    ("One more orbit.", "One more orbit."),
    ("Only one thing will change.", "Only one thing will change."),
    ("Half the distance: about one hundred ninety-two thousand kilometers.", "Half the distance: about 192,000 km."),
    ("Around nine and a half thousand, if it is perfectly rigid.", "Around 9,500, if it is perfectly rigid."),
    ("The Moon is now about two and a half times wider.", "The Moon is now about 2.5 times wider."),
    ("a chance of one in a million", "a chance of one in a million"),
    ("It moves about 340 meters a second.", "It moves about 340 m/s."),
    ("losing fifty to a hundred hairs a day", "losing 50 to 100 hairs a day"),
    ("at most around eighty percent as strong", "at most around 80% as strong"),
    ("Its tidal pull is more than a hundred sixty times today's.", "Its tidal pull is more than 160 times today's."),
    ("one million times slower", "1 million times slower"),
    ("three hundred eighty-four thousand four hundred kilometers", "384,400 km"),
    ("Your brain answers in two soft steps.", "Your brain answers in 2 soft steps."),
    ("half a degree wide", "half a degree wide"),
    ("about one point two five seconds", "about 1.25 seconds"),
    ("the oil reaches one hundred eighty degrees Celsius.", "the oil reaches 180°C."),
]

if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        bad = [(a, to_display(a), b) for a, b in TESTS if to_display(a) != b]
        for a, got, want in bad:
            print(f"FAIL {a!r}\n  got  {got!r}\n  want {want!r}")
        print(f"{len(TESTS) - len(bad)}/{len(TESTS)} pass")
        sys.exit(1 if bad else 0)
    print(to_display(" ".join(sys.argv[1:])))

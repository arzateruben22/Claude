"""Reading a film's script.md, and matching spoken words to script words. No audio libraries, so
the compiler can use it with the system Python.

A script is a list of beats. Each beat is a heading, `## id {direction} (a–b s)`, then one `vo:`
line, then optionally an `end card:` line. In a vo line, `*stars*` mark words that get a camera
landing or a sound hit, and every `{…}` group is left unspoken. A `{…}` group whose contents are
claim ids, `{c1}` or `{c1,c2}` (lower case, ending in a number), ties the sentence it follows to
the episode's claims.json; `{-}` says the sentence states nothing outside the film. Any other
`{…}` group is direction for the compiler.
"""
import re
from pathlib import Path

# one item of a script: a beat heading (id, rest of the line), a vo line, or an end card line
ITEM = re.compile(r"^## (\S+)([^\n]*)$|^vo: (.*?)(?=\n\s*\n|\nend card|\n## |\Z)|^end card: ([^\n]*)$", re.S | re.M)
TAG = re.compile(r"\s*\{([^}]*)\}")
CLAIM_IDS = re.compile(r"^\s*(-|[a-z][a-z0-9-]*\d(?:\s*,\s*[a-z][a-z0-9-]*\d)*)\s*$")
WINDOW = re.compile(r"\((\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*s\)\s*$")
# a sentence ends at . ? or ! (plus closing quotes), then any {…} groups, then a space or the end
SENTENCE_END = re.compile(r"[.?!][\"'”’)]*(?:\s*\{[^}]*\})*(?=\s|$)")


def spoken(raw):
    """The words the voice says: every {…} group and the *stars* removed, spaces collapsed."""
    return re.sub(r"\s+", " ", TAG.sub("", raw).replace("*", "")).strip()


def claim_tag(group):
    """The claim ids in one {…} group's contents: ['c1', 'c2'], ['-'] for {-}, or None for direction."""
    m = CLAIM_IDS.match(group)
    return [i.strip() for i in m.group(1).split(",")] if m else None


def sentences(raw):
    """[{text, claims, raw}] for a vo line: each sentence as spoken, and the claim ids tagged on it
    (None when it carries no claim tag, ['-'] for {-}). A tag belongs to the sentence it follows."""
    out, start = [], 0
    raw = re.sub(r"\s+", " ", raw).strip()
    ends = [m.end() for m in SENTENCE_END.finditer(raw)]
    if not ends or ends[-1] < len(raw.rstrip()):
        ends.append(len(raw))
    for end in ends:
        chunk = raw[start:end].strip()
        start = end
        if not spoken(chunk):
            continue
        ids = None
        for g in TAG.findall(chunk):
            t = claim_tag(g)
            if t is not None:
                ids = (ids or []) + t
        out.append({"text": spoken(chunk), "claims": ids, "raw": chunk})
    return out


def script_beats(path):
    """Every beat of a script.md, in order: {id, direction, window, vo, text, stars, end_card}.
    direction is the heading's {…} contents ('' if none); window is the heading's planned (a, b)
    seconds or None; vo is the raw vo line (None if the beat has none) and text what is spoken."""
    beats = []
    for m in ITEM.finditer(Path(path).read_text()):
        if m.group(1):
            rest = m.group(2)
            d = re.search(r"\{(.*)\}", rest)
            w = WINDOW.search(rest)
            beats.append({"id": m.group(1), "direction": d.group(1).strip() if d else "",
                          "window": (float(w.group(1)), float(w.group(2))) if w else None,
                          "vo": None, "text": None, "stars": [], "end_card": None})
        elif m.group(3) is not None and beats:
            raw = re.sub(r"\s+", " ", m.group(3)).strip()
            b = beats[-1]
            if b["vo"] is not None:            # a second vo line in one beat: keep it as its own beat
                b = dict(b, end_card=None)
                beats.append(b)
            b.update(vo=raw, text=spoken(raw), stars=re.findall(r"\*([^*]+)\*", raw))
        elif m.group(4) is not None and beats:
            beats[-1]["end_card"] = m.group(4).strip()
    return beats


def direction_plan(direction):
    """Timing the direction asks for, as numbers: {pre, hold, end_card, energy, segment} for the
    keys it mentions. 'pre: 0.1', 'picture-only 2.5 s' (or '2 s picture-only'), 'end card held
    ≥ 2 s', 'energy: 0.7', 'segment: meanwhile'."""
    out = {}
    pats = {"pre": r"\bpre:\s*(\d+(?:\.\d+)?)",
            "hold": r"picture[- ]only\s*(\d+(?:\.\d+)?)\s*s\b|(\d+(?:\.\d+)?)\s*s\s+(?:of\s+)?picture[- ]only",
            "end_card": r"end card(?:\s+held)?\s*(?:≥|>=|for)?\s*(\d+(?:\.\d+)?)\s*s\b",
            "energy": r"\benergy:\s*(\d+(?:\.\d+)?)"}
    for k, p in pats.items():
        m = re.search(p, direction)
        if m:
            out[k] = float(next(g for g in m.groups() if g))
    m = re.search(r"\bsegment:\s*([\w-]+)", direction)
    if m:
        out["segment"] = m.group(1)
    return out


def script_lines(path):
    """[(beat id, spoken text, starred words)] from a script.md."""
    out, beat = [], None
    text = Path(path).read_text()
    for m in ITEM.finditer(text):
        if m.group(1):
            beat = m.group(1)
            continue
        if m.group(3) is None:
            continue
        raw = re.sub(r"\s+", " ", m.group(3)).strip()
        stars = re.findall(r"\*([^*]+)\*", raw)
        out.append((beat, spoken(raw), stars))
    return out


NUM = dict(zip("0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 30 40 50 60 70 80 90 100".split(),
               ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
                "sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred").split()))


def norm(w):
    """Lower-case, letters only, and digits as words (the recognizer writes "12", scripts "twelve")."""
    w = re.sub(r"[^a-z0-9']", "", w.lower())
    return NUM.get(w, w)

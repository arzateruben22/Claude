"""capglue.py (films/channels/space/set): keep number phrases and fixed phrases on one caption line.

timeline.Film.captions() breaks pages and lines between word tokens, so "nineteen / seventy-seven" can land on
two lines. glue() merges each named run of words in a voice line into one token (joined with a no-break space,
timed from its first word to its last), so the caption breaker can't split it. Call it after the last f.at()
lookup (the anchors still see the separate words) and before f.captions().

    from capglue import glue
    glue(f, {"vo02": ["nineteen seventy-seven", "the Moon"]})
"""
import re

NBSP = " "


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

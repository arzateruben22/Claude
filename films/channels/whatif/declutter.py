"""Owner rule (Season 2 re-render): one text element per idea on screen, at most two text blocks besides the series line, badges and
disclaimers. Each episode's compile.py lists, in a DECL dict, what to drop; this applies it to film.json and the cue events.

  DECL = {"spineHide": [[t0, t1], ...],        # windows where the spine plate is hidden (it only restates the caption, or a card is up)
          "labels": {"l-id": None | t1},       # None drops a label, a number ends it earlier
          "counters": {"c-id": None | t1},
          "dropEndCaptions": True,             # no caption copy of the end card's line while the card shows it
          "noEndAnswer": True}                 # no second "≈ answer" box on the end card
"""


def apply(film, d):
    film["spineHide"] = d.get("spineHide", [])
    for key, field in (("labels", "labels"), ("counters", "counters")):
        edits, out = d.get(key, {}), []
        for it in film[field]:
            if it["id"] in edits:
                if edits[it["id"]] is None:
                    continue
                it = {**it, "t1": round(edits[it["id"]], 4)}
            out.append(it)
        film[field] = out
    if d.get("dropEndCaptions"):
        film["captions"] = [p for p in film["captions"] if p["t0"] < film["endCard"] - 0.3]
    if d.get("noEndAnswer"):
        film["endAnswer"] = ""
    return film


def keep_event(ev, spine, hide):
    """False for a spine cue that would sound while the plate is hidden."""
    tag = ev.get("tag", "")
    if not tag.startswith("spine-"):
        return True
    i = int(tag.split("-")[1])
    return not any(a <= spine[i]["t"] < b for a, b in hide)

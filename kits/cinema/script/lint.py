"""Lint a channel episode's script.md against the beat template: once before it is voiced, and again
after, when the voice's own timings replace the estimates.

    python3 -I kits/cinema/script/lint.py films/channels/body/ep01 --segment meanwhile
    python3 -I kits/cinema/script/lint.py films/channels/body/ep01 --json       # the result as JSON
    python3 -I kits/cinema/script/lint.py films/channels/body/ep01 --sources    # the post's source list

The argument is the episode folder (or its script.md). Next to the script it reads claims.json (the
claims ledger, required), pron.json, and vo/lines.json + vo/words.json once tts.py and align.py have
run. What it checks:

- **Template.** The hook comes first and the tease last; the whoa, the takeaway and the channel's
  recurring segment (a beat whose direction says `segment: <name>`) are there; words per beat sit
  in the template's range (a warning, not an error).
- **Pace.** 2.2–3.0 words a second in every beat. Before voicing, a beat's speaking time is its
  planned window `(a–b s)` less its lead-in and its hold; after, it is the voice's measured line.
- **Length.** 150–180 words; 60–75 s planned (the last window's end), estimated at 2.5 words a
  second overall, and, once voiced, laid out from the measured lines (with `--bpm`, by
  timeline.py itself, beat starts snapped to the music grid; without, before snapping).
- **Hook.** The first beat asks a question, spoken by 2.0 s. Before voicing this is estimated from
  syllables at 3.8 a second (the median of the Skin School voice's first sentences, measured); after,
  it is read from words.json.
- **Holds.** `picture-only N s` in why (≥ 2 s) and whoa (≥ 3 s); `end card ≥ N s` (≥ 1.5 s) and
  an `end card:` line on the last beat.
- **Stars.** Balanced, around spoken words, at least one in the hook and the whoa; once voiced,
  every starred word is found in words.json, and the ones inside a phrase are listed for a check
  by eye and ear at T0 (voice/README.md, "How accurate").
- **Claims.** Every factual-looking sentence carries `{c1}` / `{c1,c2}` (or `{-}`: states nothing
  outside the film); every id is in claims.json with the sentence exactly as spoken, a source, an
  access date, how it was verified and a status. "needs-wording" fails; "TODO open link" warns.

Exit status 1 when there are errors. Warnings never fail the lint.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "voice"))
sys.path.insert(0, str(HERE))
from scriptfile import direction_plan, norm, script_beats, sentences, spoken   # noqa: E402

# The shared episode template: the three bibles' §6 tables, merged. words: the range per beat;
# hold: the picture-only seconds the beat must plan; end_card: the last beat's minimum hold.
TEMPLATE = {
    "hook":     {"words": (8, 14)},
    "normal":   {"words": (22, 34)},
    "change":   {"words": (20, 32)},
    "why":      {"words": (24, 44), "hold": 2.0},
    "whoa":     {"words": (16, 28), "hold": 3.0},
    "takeaway": {"words": (12, 20)},
    "tease":    {"words": (8, 14), "end_card": 1.5},
}
SEGMENT_WORDS = (6, 28)
REQUIRED = ("hook", "whoa", "takeaway", "tease")
NEED_STAR = ("hook", "whoa")
WORDS, DUR, WPS = (150, 180), (60.0, 75.0), (2.2, 3.0)
OVERALL_WPS = 2.5        # words a second over the whole film, for the quick length estimate
HOOK_BY = 2.0            # the hook's question is spoken by this time (STUDIO-PLAN: "Hook")
SYL_RATE = 3.8           # syllables a second for the estimate: median of Skin School's first sentences
PRE, HOLD = 0.3, 0.4     # timeline.layout's defaults: lead-in before a line, hold after it

FIELDS = ("id", "sentence", "claim", "source_url", "source_title", "accessed", "verified_via", "status")
STATUS = ("ok", "needs-wording", "TODO open link")
VIA = ("search excerpt", "page")

NUMBER_WORDS = set("""zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen
sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred hundreds thousand
thousands million millions billion billions trillion trillions half halves twice double triple quarter third
thirds twentieth twentieths hundredth hundredths percent dozen""".split())
UNITS = set("""meter meters metre metres centimeter centimeters millimeter millimeters micrometer micrometers
micrometre micrometres nanometer nanometers kilometer kilometers kilometre kilometres second seconds minute minutes
hour hours day days week weeks year years light-year light-years kilogram kilograms gram grams degree degrees
mph""".split())
SIGNALS = set("""always never every all most only none than because faster slower bigger smaller narrower wider
farther further longer shorter heavier lighter""".split())


# WRITING.md "Never write": phrases that announce wonder instead of earning it, or talk like an ad
FORCED = [
    (r"\byou won'?t believe\b", "promises a shock instead of delivering one"),
    (r"\b(mind[- ]?blowing|insane|crazy|unbelievable|jaw[- ]dropping|epic)\b", "announces the wonder"),
    (r"\bdid you know\b", "is a quiz-book opener"),
    (r"\bhave you ever wondered\b", "is a throat-clear; ask the question itself"),
    (r"\bhere'?s the thing\b", "is filler"),
    (r"\blet that sink in\b", "tells the viewer how to feel"),
    (r"\b(the answer|this) (may|will|might) (surprise|shock) you\b", "promises a shock instead of delivering one"),
    (r"\bscience says\b", "hides the source; name what was measured"),
    (r"\b(in this video|today we|stick around|wait for it|smash that|like and subscribe)\b", "talks about the video, not the subject"),
    (r"\bliterally\b", "is a filler intensifier"),
    (r"\bbut there'?s a catch\b", "is a fake cliffhanger unless a real catch follows in the next line"),
    (r"!", "an exclamation mark: the voice and the picture carry the energy"),
]


def syllables(word):
    """A rough English syllable count (vowel groups, less a silent final e or -ed). Good enough to
    estimate how long a short phrase takes; the voice's own timings replace it once voiced."""
    total = 0
    for part in re.split(r"[-–]", word.lower()):
        w = re.sub(r"[^a-z]", "", part)
        if not w:
            total += 2 if re.search(r"\d", part) else 0
            continue
        n = len(re.findall(r"[aeiouy]+", w))
        if n > 1 and w.endswith("e") and not w.endswith(("le", "ee", "ye")):
            n -= 1
        elif n > 1 and w.endswith("ed") and not w.endswith(("ted", "ded")):
            n -= 1
        total += max(1, n)
    return total


def looks_factual(text):
    """Why a sentence looks like a claim about the world (a number, a unit, a proper noun, an
    absolute or a comparison), or None. Questions are never claims."""
    if text.rstrip("\"'”’)").endswith("?"):
        return None
    words = text.split()
    for i, raw in enumerate(words):
        w = re.sub(r"[^a-z0-9-]", "", raw.lower())
        if re.search(r"\d", w):
            return f"the number '{raw}'"
        parts = w.split("-")
        if any(p in NUMBER_WORDS for p in parts):
            return f"the number word '{raw}'"
        if w in UNITS:
            return f"the unit '{raw}'"
        if w in SIGNALS:
            return f"'{raw}'"
        if i and raw[:1].isupper() and raw.strip("\"'“‘(") != "I" and not re.search(r"[.?!:]$", words[i - 1]):
            return f"the name '{raw}'"
    return None


class Report:
    def __init__(self):
        self.errors, self.warnings, self.notes = [], [], []

    def error(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")

    def note(self, msg):
        self.notes.append(msg)


def word_count(text):
    return len(text.split())


def phrase_at(words, star):
    """Index of the first run of line words that matches a starred phrase, or None."""
    target = [norm(w) for w in star.split()]
    have = [norm(w["w"]) for w in words]
    for i in range(len(have) - len(target) + 1):
        if have[i:i + len(target)] == target:
            return i
    return None


def lint(path, segment=None, overall_wps=OVERALL_WPS, bpm=None):
    path = Path(path)
    script = path / "script.md" if path.is_dir() else path
    ep = script.parent
    r = Report()
    beats = [b for b in script_beats(script) if b["vo"] is not None]
    if not beats:
        r.error("script", "no vo: lines found")
        return r, {}
    plans = [direction_plan(b["direction"]) for b in beats]

    # ── template ────────────────────────────────────────────────────
    ids = [b["id"] for b in beats]
    if ids[0] != "hook":
        r.error(ids[0], "the first beat must be the hook")
    if ids[-1] != "tease":
        r.error(ids[-1], "the last beat must be the tease")
    for need in REQUIRED:
        if need not in ids:
            r.error("template", f"no '{need}' beat")
    if "whoa" in ids and "takeaway" in ids and ids.index("whoa") > ids.index("takeaway"):
        r.warn("template", "the whoa comes after the takeaway")
    segs = [(b["id"], p["segment"]) for b, p in zip(beats, plans) if "segment" in p]
    if segment and segment not in [s for _, s in segs]:
        r.error("template", f"no beat with 'segment: {segment}' (the channel's recurring segment)")
    if len(segs) > 1:
        r.warn("template", f"{len(segs)} segment beats: {segs}")

    # ── per beat: words, pace, holds, stars ─────────────────────────
    rows, total_words = [], 0
    for k, (b, p) in enumerate(zip(beats, plans)):
        n = word_count(b["text"])
        total_words += n
        tmpl = TEMPLATE.get(b["id"], {"words": SEGMENT_WORDS} if "segment" in p else {})
        lo_hi = tmpl.get("words")
        if lo_hi and not lo_hi[0] <= n <= lo_hi[1]:
            r.warn(b["id"], f"{n} words; the template asks {lo_hi[0]}–{lo_hi[1]}")
        if not tmpl:
            r.note(f"{b['id']}: not a template beat and not a segment; no word range checked")
        pre = p.get("pre", PRE)
        hold = p.get("hold", 0.0) + p.get("end_card", 0.0) if ("hold" in p or "end_card" in p) else HOLD
        pace = None
        if b["window"]:
            a, z = b["window"]
            speech = z - a - pre - hold
            if speech <= 0:
                r.error(b["id"], f"the window {a:g}–{z:g} s leaves no time to speak after {pre:g} s lead-in and {hold:g} s hold")
            else:
                pace = n / speech
                if not WPS[0] <= round(pace, 2) <= WPS[1]:
                    r.error(b["id"], f"{n} words in {speech:.1f} s of speaking time is {pace:.2f} words/s "
                                     f"(window {a:g}–{z:g} s less {pre:g} s lead-in and {hold:g} s hold); keep {WPS[0]}–{WPS[1]}")
            if k and beats[k - 1]["window"] and abs(beats[k - 1]["window"][1] - a) > 0.05:
                r.warn(b["id"], f"its window starts at {a:g} s but the previous beat ends at {beats[k - 1]['window'][1]:g} s")
        else:
            r.warn(b["id"], "no planned window '(a–b s)' in the heading; pace not checked before voicing")
        need = tmpl.get("hold")
        if need and p.get("hold", 0.0) < need:
            r.error(b["id"], f"plan at least {need:g} s picture-only (direction: 'picture-only {need:g} s'); found {p.get('hold', 0):g} s")
        if k == len(beats) - 1:
            if p.get("end_card", 0.0) < TEMPLATE["tease"]["end_card"]:
                r.error(b["id"], f"the last beat must hold the end card ≥ {TEMPLATE['tease']['end_card']:g} s (direction: 'end card held ≥ 2 s')")
            if not b["end_card"]:
                r.warn(b["id"], "no 'end card:' line after the last vo line")
        # stars
        if b["vo"].count("*") % 2:
            r.error(b["id"], "unbalanced *stars*")
        for s in b["stars"]:
            if "{" in s or "}" in s:
                r.error(b["id"], f"a {{tag}} inside the starred '{s}'")
            elif spoken(s) not in b["text"]:
                r.error(b["id"], f"the starred '{s}' is not in the spoken line")
        if not b["stars"]:
            (r.error if b["id"] in NEED_STAR else r.warn)(b["id"], "no *starred* word (a camera landing or a sound hit)")
        if "..." in b["vo"]:
            r.warn(b["id"], "'...' ends a sentence here; use '…' for a pause inside one")
        for pat, why in FORCED:
            m = re.search(pat, b["text"], re.I)
            if m:
                r.warn(b["id"], f"'{m.group(0)}' {why} (WRITING.md, 'Never write')")
        if b["id"] != "hook" and len(re.findall(r"\?", b["text"])) >= 2:
            r.warn(b["id"], "two questions in one beat outside the hook: answer one, or cut one (WRITING.md)")
        if re.search(r"\d", b["text"]):
            r.warn(b["id"], "digits in the spoken line; spell numbers out (the voice reads digits its own way, "
                            "and align.py maps digits to words only up to 100)")
        rows.append({"id": b["id"], "window": b["window"], "words": n, "template": lo_hi, "pace": pace and round(pace, 2),
                     "pre": pre, "hold": hold, "stars": b["stars"], "segment": p.get("segment")})

    # ── length ──────────────────────────────────────────────────────
    if not WORDS[0] <= total_words <= WORDS[1]:
        r.error("length", f"{total_words} words; keep {WORDS[0]}–{WORDS[1]}")
    planned = beats[-1]["window"][1] if all(b["window"] for b in beats) else None
    if planned is not None and not DUR[0] <= planned <= DUR[1]:
        r.error("length", f"the plan runs {planned:g} s; keep {DUR[0]:g}–{DUR[1]:g} s")
    estimate = total_words / overall_wps
    if not DUR[0] <= estimate <= DUR[1]:
        r.error("length", f"{total_words} words at {overall_wps} words/s is {estimate:.1f} s; keep {DUR[0]:g}–{DUR[1]:g} s")

    # ── hook question, estimated ────────────────────────────────────
    hook_sents = sentences(beats[0]["vo"])
    q = next((i for i, s in enumerate(hook_sents) if s["text"].rstrip("\"'”’)").endswith("?")), None)
    hook = {}
    if q is None:
        r.error("hook", "the first beat asks no question")
    else:
        upto = hook_sents[:q + 1]
        syl = sum(syllables(w) for s in upto for w in s["text"].split())
        pauses = 0.25 * q + 0.12 * sum(len(re.findall(r"[,:;—]", s["text"])) for s in upto)
        t = plans[0].get("pre", PRE) + syl / SYL_RATE + pauses
        hook = {"question": hook_sents[q]["text"], "syllables": syl, "estimated_end": round(t, 2)}
        if t > HOOK_BY:
            r.error("hook", f"'{hook_sents[q]['text']}' ends about {t:.2f} s in (estimated: {syl} syllables at {SYL_RATE}/s "
                            f"after a {plans[0].get('pre', PRE):g} s lead-in); it must be spoken by {HOOK_BY:g} s")

    # ── claims ──────────────────────────────────────────────────────
    ledger, cited, no_claim = {}, {}, []
    cpath = ep / "claims.json"
    if not cpath.exists():
        r.error("claims", f"no claims ledger at {cpath}")
    else:
        try:
            entries = json.loads(cpath.read_text())
        except json.JSONDecodeError as e:
            entries = []
            r.error("claims", f"claims.json is not JSON: {e}")
        if not isinstance(entries, list):
            r.error("claims", "claims.json must be a list of claims")
            entries = []
        for c in entries:
            cid = c.get("id", "?")
            missing = [f for f in FIELDS if not str(c.get(f, "")).strip()]
            if missing:
                r.error(f"claim {cid}", f"missing {', '.join(missing)}")
            if not re.fullmatch(r"[a-z][a-z0-9-]*\d", cid):
                r.error(f"claim {cid}", "ids are lower case and end in a number (c1, rbc2)")
            if cid in ledger:
                r.error(f"claim {cid}", "duplicate id")
            ledger[cid] = c
            if c.get("status") not in STATUS:
                r.error(f"claim {cid}", f"status must be one of {STATUS}")
            elif c["status"] == "needs-wording":
                r.error(f"claim {cid}", "status 'needs-wording': fix the sentence, re-check, then mark it ok")
            elif c["status"] == "TODO open link":
                r.warn(f"claim {cid}", f"TODO open link: {c.get('source_url')}")
            if c.get("verified_via") not in VIA:
                r.error(f"claim {cid}", f"verified_via must be one of {VIA}")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(c.get("accessed", ""))):
                r.error(f"claim {cid}", "accessed must be a date, YYYY-MM-DD")
            if not str(c.get("source_url", "")).startswith(("https://", "http://")):
                r.error(f"claim {cid}", "source_url must be a web address")
    for b in beats:
        for s in sentences(b["vo"]):
            ids_ = s["claims"]
            if ids_ is None:
                why = looks_factual(s["text"])
                if why:
                    r.error(b["id"], f"\"{s['text']}\" looks factual ({why}) but has no claim tag; add {{cN}}, "
                                     f"or {{-}} if it states nothing outside the film")
                continue
            if "-" in ids_:
                if len(ids_) > 1:
                    r.error(b["id"], f"\"{s['text']}\" is tagged both {{-}} and with claims")
                no_claim.append(s["text"])
                continue
            for cid in ids_:
                cited.setdefault(cid, []).append(s["text"])
                c = ledger.get(cid)
                if cpath.exists() and c is None:
                    r.error(b["id"], f"claim {cid} is not in claims.json")
                elif c is not None and c.get("sentence") != s["text"]:
                    r.error(f"claim {cid}", f"its sentence differs from the script:\n      ledger: {c.get('sentence')!r}\n      script: {s['text']!r}")
    for cid in ledger:
        if cid not in cited:
            r.warn(f"claim {cid}", "in claims.json but no sentence cites it")
        elif len(cited[cid]) > 1:
            r.warn(f"claim {cid}", f"cited by {len(cited[cid])} sentences; a claim ties to one sentence")

    # ── pronunciation ───────────────────────────────────────────────
    listen = []
    ppath = ep / "pron.json"
    if ppath.exists():
        pron = json.loads(ppath.read_text())
        everything = " ".join(b["text"] for b in beats)
        for word, ph in pron.items():
            if not re.search(r"\b" + re.escape(word) + r"\b", everything, re.I):
                r.warn("pron", f"'{word}' is not in the script")
            else:
                listen.append(word)
            if "ˈ" not in ph:
                r.warn("pron", f"'{word}' has no primary stress mark (ˈ)")
    else:
        r.warn("pron", "no pron.json")

    # ── once voiced: the voice's own timings ────────────────────────
    measured = {}
    vo = ep / "vo"
    if (vo / "lines.json").exists():
        lines = json.loads((vo / "lines.json").read_text())["lines"]
        if len(lines) != len(beats):
            r.error("voice", f"{len(lines)} voiced lines for {len(beats)} beats; re-run tts.py")
        total = 0.0
        for k, (b, p, ln) in enumerate(zip(beats, plans, lines)):
            if ln["text"] != b["text"]:
                r.error(ln["id"], f"the voice is stale: it says {ln['text']!r}; re-run tts.py")
            if ln.get("stars") != b["stars"]:
                r.warn(ln["id"], "stars changed since voicing; re-run tts.py so lines.json records them")
            pace = word_count(ln["text"]) / ln["dur"]
            rows[k]["measured_pace"] = round(pace, 2)
            if not WPS[0] <= round(pace, 2) <= WPS[1]:
                r.error(ln["id"], f"spoken at {pace:.2f} words/s ({ln['dur']:.2f} s); keep {WPS[0]}–{WPS[1]} "
                                  f"(re-voice with a different --speed, or rewrite the line)")
            total += rows[k]["pre"] + ln["dur"] + rows[k]["hold"]
        if bpm and len(lines) == len(beats) and all(ln["text"] == b["text"] for ln, b in zip(lines, beats)):
            from timeline import Film       # the compiler's own layout: beat starts snapped to the music grid
            f = Film(script, vo, bpm=bpm)
            plan, end_hold = f.script_plan()
            f.layout(plan, end_hold=end_hold)
            total = f.duration
            measured["grid"] = f"eighth notes at {bpm:g} BPM"
        measured["duration"] = round(total, 2)
        if not DUR[0] <= total <= DUR[1]:
            r.error("voice", f"laid out from the voice the film runs {total:.1f} s; keep {DUR[0]:g}–{DUR[1]:g} s")
        if (vo / "words.json").exists():
            wl = {w["id"]: w["words"] for w in json.loads((vo / "words.json").read_text())["lines"]}
            first = wl.get(lines[0]["id"], [])
            qw = next((w for w in first if w["w"].rstrip("\"'”’)").endswith("?")), None)
            if qw:
                t = plans[0].get("pre", PRE) + qw["end"]
                measured["hook_end"] = round(t, 2)
                if t > HOOK_BY:
                    r.error("hook", f"the question ends at {t:.2f} s in the voice; it must be spoken by {HOOK_BY:g} s")
            inside = []
            for b, ln in zip(beats, lines):
                words = wl.get(ln["id"], [])
                for s in b["stars"]:
                    i = phrase_at(words, spoken(s))
                    if i is None:
                        r.error(ln["id"], f"the starred '{s}' is not in words.json; re-run align.py")
                        continue
                    run = words[i:i + len(s.split())]
                    if not all(w["heard"] for w in run):
                        r.warn(ln["id"], f"the recognizer did not hear '{s}'; its time is interpolated")
                    if i and not re.search(r"[,.:;?!—…]$", words[i - 1]["w"]):
                        inside.append(f"{ln['id']}:{s}")
            if inside:
                r.note("starred words inside a phrase (check the landing by eye and ear at T0): " + ", ".join(inside))

    result = {"script": str(script), "beats": rows, "words": total_words, "planned": planned,
              "estimate": round(estimate, 1), "overall_wps": planned and round(total_words / planned, 2),
              "hook": hook, "measured": measured, "claims": {"ledger": len(ledger), "cited": len(cited)},
              "no_claim": no_claim, "listen": listen, "segments": segs,
              "errors": r.errors, "warnings": r.warnings, "notes": r.notes}
    return r, result


def sources(path):
    """The post description's source list: each source once, in order of first use."""
    path = Path(path)
    ep = path if path.is_dir() else path.parent
    script = ep / "script.md" if path.is_dir() else path
    ledger = {c["id"]: c for c in json.loads((ep / "claims.json").read_text())}
    seen, out = set(), []
    for b in script_beats(script):
        for s in sentences(b["vo"] or ""):
            for cid in s["claims"] or []:
                c = ledger.get(cid)
                if c and c["source_url"] not in seen:
                    seen.add(c["source_url"])
                    out.append(f"{c['source_title']}: {c['source_url']}")
    return out


def main():
    ap = argparse.ArgumentParser(description="Lint an episode's script.md against the beat template.")
    ap.add_argument("episode", help="the episode folder, or its script.md")
    ap.add_argument("--segment", help="the channel's recurring segment, which a beat must carry ('segment: <name>')")
    ap.add_argument("--wps", type=float, default=OVERALL_WPS, help="overall words a second for the length estimate")
    ap.add_argument("--bpm", type=float, help="the channel's tempo: once voiced, lay the film out on its grid with timeline.py")
    ap.add_argument("--json", action="store_true", help="print the result as JSON")
    ap.add_argument("--sources", action="store_true", help="print the source list for the post and stop")
    a = ap.parse_args()
    if a.sources:
        print("\n".join(sources(a.episode)))
        return 0
    r, res = lint(a.episode, a.segment, a.wps, a.bpm)
    if a.json:
        print(json.dumps(res, indent=1, ensure_ascii=False))
        return 1 if r.errors else 0
    print(f"lint {res.get('script', a.episode)}" + (f"  (segment: {a.segment})" if a.segment else ""))
    print(f"  {'beat':<10}{'window':>12}{'words':>7}{'range':>8}{'pace':>7}{'voice':>7}{'hold':>6}  stars")
    for row in res.get("beats", []):
        w = f"{row['window'][0]:g}–{row['window'][1]:g} s" if row["window"] else "-"
        rng = f"{row['template'][0]}–{row['template'][1]}" if row["template"] else "-"
        print(f"  {row['id']:<10}{w:>12}{row['words']:>7}{rng:>8}{row['pace'] or '-':>7}{row.get('measured_pace', '-'):>7}"
              f"{row['hold']:>6g}  {', '.join(row['stars'])}")
    if res:
        plan = f"planned {res['planned']:g} s ({res['overall_wps']} words/s overall)" if res["planned"] else "no plan"
        print(f"  total {res['words']} words · {plan} · at {a.wps} words/s ≈ {res['estimate']} s"
              + (f" · voiced {res['measured']['duration']} s" if res["measured"].get("duration") else "")
              + (f" ({res['measured']['grid']})" if res["measured"].get("grid") else ""))
        if res["hook"]:
            h = res["hook"]
            m = f", voiced {res['measured']['hook_end']} s" if "hook_end" in res["measured"] else ""
            print(f"  hook: \"{h['question']}\" ends ≈ {h['estimated_end']} s (estimated, {h['syllables']} syllables{m})")
        print(f"  claims: {res['claims']['cited']} cited, {res['claims']['ledger']} in the ledger"
              + (f" · {{-}} (no claim): {len(res['no_claim'])}" if res["no_claim"] else ""))
        for s in res["no_claim"]:
            print(f"      {{-}} {s}")
        if res["listen"]:
            print(f"  listen at T0 (pron.json): {', '.join(res['listen'])}")
    for n in r.notes:
        print(f"  note: {n}")
    for w in r.warnings:
        print(f"  WARN  {w}")
    for e in r.errors:
        print(f"  ERROR {e}")
    print(f"  {len(r.errors)} errors, {len(r.warnings)} warnings")
    return 1 if r.errors else 0


if __name__ == "__main__":
    sys.exit(main())

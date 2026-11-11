#!/usr/bin/env python3
"""Check an episode's plan before anything is built: episode.json and shots.json against the studio
schemas, then the cross-checks a schema cannot make.

    python3 -I films/channels/studio/tools/validate.py <episode folder or episode.json>
    python3 -I films/channels/studio/tools/validate.py films/channels/studio/templates/episode.example.json

Options:
    --identities DIR   where the channel identity files live (default: films/channels/studio/identities)
    --shots FILE       use this shot manifest instead of the one named in episode.json "files"
    --claims FILE      use this claims ledger instead of the one named in episode.json "files"
    --builtin          use the built-in schema checker even when the jsonschema package is installed
    --strict           treat warnings as failures

What it checks:
  1. episode.json against schema/episode.schema.json and shots.json against schema/shot.schema.json
     (the jsonschema package when it can be imported, else a built-in checker for the same keywords).
  2. The channel identity exists and agrees (slug, id prefix, format, colours).
  3. Story beats and shot windows: start at 0, in order, no gap, no overlap, the same end.
  4. The planned length sits inside format.durationS, and that window is no wider than the channel
     identity's. A long video is never under 510 s (8:30), a premium lesson never under 60 s. A forced
     length (durationForced) is a plan only: it fails from stage "editing" on.
  5. Every claim id used in a shot is in claims.json, every entry has an id, and a claim marked "ok"
     is marked honestly (a page a person opened, or a calc.py sum).
  6. Transitions use the vocabulary in SHOTS.md and each join is named the same from both sides.
  7. The like/follow moment obeys films/channels/CTA.md (never in the first 20 s).
  8. Disclosures: a synthetic voice or an AI image in the picture is declared. A guest's voice is never
     synthesised, and a guest-voiced episode is not edited into a final before the real recording is in.
  9. Human gates: no full render (stage "editing") before the owner approves the look, and nothing
     reaches export with sources, title or recording still open.

Exit status: 0 when there is no failure, 1 when there is at least one (one line per problem),
2 when the files cannot be found or read. Standard library only.

A file named episode.<tag>.json (the templates' episode.example.json) looks for shots.<tag>.json and
claims.<tag>.json beside it.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent                                   # films/channels/studio
SCHEMAS = STUDIO / "schema"
IDENTITIES = STUDIO / "identities"

# What the renderer's final tier really draws today (kits/cinema/film/render.mjs, TIERS).
WIRED = {"9:16": [1080, 1920], "16:9": [1920, 1080]}
LONG_MIN_S = 510.0                                     # 8:30 (films/channels/SEASON-FORMAT.md)
PREMIUM_MIN_S = 60.0                                   # "never under 60 s" (SEASON-FORMAT.md, Skin Sense Season 3)
CTA_NOT_BEFORE_S = 20.0                                # films/channels/CTA.md
CTA_BAND = (0.70, 0.85)
LONG_SHOT_S = 20.0                                     # a longer planned shot is asked to be split
STAGES = ["concept", "research", "narrative", "script", "storyboard", "visual", "motion", "sound",
          "editing", "qa", "export", "archive"]
# How a claim may be verified and still be marked ok (QA.md, section 3B). qa_episode.py carries the same lists.
VIA_PAGE = ("page", "owner opened the page")            # a person read the source itself; needs a source link
VIA_DERIVED = ("calculation", "derivation", "own model")  # no outside page: the sum is in calc.py, and the row says so
VIA_ASSUMED = ("assumption (no source)",)                # a stated assumption or hedge; the note says what is assumed
TRANSITION = re.compile(r"^(open|hold|motivated push|scale change|through-the-surface|match cut|cut on sound|"
                        r"dissolve|loop|close)(: .+)?$")


# ── the built-in schema checker ─────────────────────────────────────────────────────────────────
# Covers the keywords the two studio schemas use: type, enum, const, required, properties,
# patternProperties, additionalProperties, items, prefixItems, minItems, maxItems, uniqueItems,
# minLength, maxLength, pattern, minimum, maximum, exclusiveMinimum, exclusiveMaximum, allOf, anyOf,
# oneOf, not, if/then/else and local $ref.

def _is_type(v, t):
    if t == "object":
        return isinstance(v, dict)
    if t == "array":
        return isinstance(v, list)
    if t == "string":
        return isinstance(v, str)
    if t == "boolean":
        return isinstance(v, bool)
    if t == "null":
        return v is None
    if t == "number":
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    if t == "integer":
        return (isinstance(v, int) and not isinstance(v, bool)) or (isinstance(v, float) and v.is_integer())
    return True


def _type_name(v):
    for t in ("object", "array", "string", "boolean", "null", "integer", "number"):
        if _is_type(v, t):
            return t
    return type(v).__name__


def _same(a, b):
    """JSON equality: true is not 1, and lists and objects compare by content."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_same(a[k], b[k]) for k in a)
    if isinstance(a, (list, dict)) or isinstance(b, (list, dict)):
        return False
    return a == b


def _resolve(root, ref):
    if not ref.startswith("#"):
        raise ValueError(f"only local $ref is supported by the built-in checker: {ref}")
    node = root
    for part in ref[1:].split("/"):
        if part:
            node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def _short(v, n=60):
    s = json.dumps(v, ensure_ascii=False)
    return s if len(s) <= n else s[: n - 1] + "…"


def _check(schema, v, root, at, out):
    if schema is True:
        return
    if schema is False:
        out.append((at, "is not allowed here"))
        return
    if "$ref" in schema:
        _check(_resolve(root, schema["$ref"]), v, root, at, out)
    t = schema.get("type")
    if t is not None:
        kinds = t if isinstance(t, list) else [t]
        if not any(_is_type(v, k) for k in kinds):
            out.append((at, f"should be {' or '.join(kinds)}, not {_type_name(v)}"))
            return
    if "const" in schema and not _same(v, schema["const"]):
        out.append((at, f"should be {_short(schema['const'])}, not {_short(v)}"))
    if "enum" in schema and not any(_same(v, e) for e in schema["enum"]):
        out.append((at, f"{_short(v)} is not one of {_short(schema['enum'], 160)}"))
    if isinstance(v, str):
        if "minLength" in schema and len(v) < schema["minLength"]:
            out.append((at, f"is too short ({len(v)} characters; at least {schema['minLength']})"))
        if "maxLength" in schema and len(v) > schema["maxLength"]:
            out.append((at, f"is too long ({len(v)} characters; at most {schema['maxLength']})"))
        if "pattern" in schema and not re.search(schema["pattern"], v):
            out.append((at, f"{_short(v)} does not match {schema['pattern']}"))
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if "minimum" in schema and v < schema["minimum"]:
            out.append((at, f"{v} is less than the minimum of {schema['minimum']}"))
        if "maximum" in schema and v > schema["maximum"]:
            out.append((at, f"{v} is more than the maximum of {schema['maximum']}"))
        if "exclusiveMinimum" in schema and v <= schema["exclusiveMinimum"]:
            out.append((at, f"{v} must be more than {schema['exclusiveMinimum']}"))
        if "exclusiveMaximum" in schema and v >= schema["exclusiveMaximum"]:
            out.append((at, f"{v} must be less than {schema['exclusiveMaximum']}"))
    if isinstance(v, list):
        if "minItems" in schema and len(v) < schema["minItems"]:
            out.append((at, f"has {len(v)} items; at least {schema['minItems']}"))
        if "maxItems" in schema and len(v) > schema["maxItems"]:
            out.append((at, f"has {len(v)} items; at most {schema['maxItems']}"))
        if schema.get("uniqueItems") and any(_same(a, b) for i, a in enumerate(v) for b in v[:i]):
            out.append((at, "has repeated items"))
        prefix = schema.get("prefixItems", [])
        for i, (sub, item) in enumerate(zip(prefix, v)):
            _check(sub, item, root, f"{at}/{i}", out)
        if "items" in schema:
            for i in range(len(prefix), len(v)):
                _check(schema["items"], v[i], root, f"{at}/{i}", out)
    if isinstance(v, dict):
        for k in schema.get("required", []):
            if k not in v:
                out.append((at, f"is missing \"{k}\""))
        props, pats = schema.get("properties", {}), schema.get("patternProperties", {})
        for k, val in v.items():
            known = False
            if k in props:
                known = True
                _check(props[k], val, root, f"{at}/{k}", out)
            for pat, sub in pats.items():
                if re.search(pat, k):
                    known = True
                    _check(sub, val, root, f"{at}/{k}", out)
            if not known and "additionalProperties" in schema:
                extra = schema["additionalProperties"]
                if extra is False:
                    out.append((at, f"has an unknown key \"{k}\""))
                else:
                    _check(extra, val, root, f"{at}/{k}", out)
    for sub in schema.get("allOf", []):
        _check(sub, v, root, at, out)
    if "anyOf" in schema and not any(_passes(sub, v, root) for sub in schema["anyOf"]):
        out.append((at, "matches none of the allowed forms (anyOf)"))
    if "oneOf" in schema and sum(_passes(sub, v, root) for sub in schema["oneOf"]) != 1:
        out.append((at, "must match exactly one of the allowed forms (oneOf)"))
    if "not" in schema and _passes(schema["not"], v, root):
        out.append((at, "matches a form that is not allowed (not)"))
    if "if" in schema:
        branch = "then" if _passes(schema["if"], v, root) else "else"
        if branch in schema:
            _check(schema[branch], v, root, at, out)


def _passes(schema, v, root):
    out = []
    _check(schema, v, root, "", out)
    return not out


def builtin_errors(schema, instance):
    out = []
    _check(schema, instance, schema, "", out)
    return [(at or "/", msg) for at, msg in out]


def schema_errors(schema, instance, builtin=False):
    """[(json pointer, message)] and the name of the checker that ran."""
    if not builtin:
        try:
            from jsonschema import Draft202012Validator
        except Exception:                                # not installed, or broken: fall back
            Draft202012Validator = None
        if Draft202012Validator is not None:
            errs = sorted(Draft202012Validator(schema).iter_errors(instance), key=lambda e: [str(p) for p in e.absolute_path])
            out = []
            for e in errs:
                at = "/" + "/".join(str(p) for p in e.absolute_path)
                msg = " ".join(str(e.message).split())
                out.append((at, msg if len(msg) <= 220 else msg[:219] + "…"))
            return out, "jsonschema"
    return builtin_errors(schema, instance), "built-in"


# ── reading the files ───────────────────────────────────────────────────────────────────────────

class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def fail(self, file, where, msg):
        self.errors.append(f"FAIL {file}: {where}: {msg}")

    def warn(self, file, where, msg):
        self.warnings.append(f"warn {file}: {where}: {msg}")


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8")), None
    except FileNotFoundError:
        return None, f"not found: {path}"
    except (OSError, ValueError) as e:
        return None, f"cannot read {path}: {' '.join(str(e).split())}"


def sibling(folder, name, tag):
    """The file an episode names, or its tagged twin beside a tagged spec (shots.example.json)."""
    p = Path(name)
    if tag:
        p = p.with_name(f"{p.stem}.{tag}{p.suffix}")
    return folder / p


def todo_paths(node, at=""):
    """JSON pointers of every string that still holds a TODO placeholder."""
    if isinstance(node, str):
        return [at or "/"] if "TODO" in node else []
    if isinstance(node, list):
        return [p for i, x in enumerate(node) for p in todo_paths(x, f"{at}/{i}")]
    if isinstance(node, dict):
        return [p for k, x in node.items() for p in todo_paths(x, f"{at}/{k}")]
    return []


def listed(items, n=6):
    items = [str(x) for x in items]
    return ", ".join(items[:n]) + (f" and {len(items) - n} more" if len(items) > n else "")


def windows(items, label, fps, file, r):
    """Check [(id, [a, b])] run from 0 with no gap or overlap. Returns the end, or None."""
    tol = 0.5 / fps
    end = None
    for i, (name, w) in enumerate(items):
        if not is_window(w):
            if isinstance(w, list) and any(isinstance(x, float) and not math.isfinite(x) for x in w):
                r.fail(file, f"{label} {name}", "its window holds a number that is not finite")
            return None                                   # otherwise the schema check has already said so
        a, b = w
        if b <= a:
            r.fail(file, f"{label} {name}", f"ends at {b} s, not after its start at {a} s")
        if i == 0 and abs(a) > tol:
            r.fail(file, f"{label} {name}", f"the first {label} starts at {a} s, not 0")
        if end is not None:
            if a - end > tol:
                r.fail(file, f"{label} {name}", f"a gap of {a - end:.2f} s after {items[i - 1][0]} (it ends at {end} s, this starts at {a} s)")
            elif end - a > tol:
                r.fail(file, f"{label} {name}", f"overlaps {items[i - 1][0]} by {end - a:.2f} s (it ends at {end} s, this starts at {a} s)")
        for x in (a, b):
            if abs(x * fps - round(x * fps)) > 1e-3:
                r.warn(file, f"{label} {name}", f"{x} s is not on a frame at {fps} fps")
        end = b
    return end


def term(s):
    m = TRANSITION.match(s) if isinstance(s, str) else None
    return m.group(1) if m else None


def name_of(value, fallback):
    """An id as text. A missing or wrong-typed id (the schema check has already said so) gets a stand-in."""
    return value if isinstance(value, str) and value else fallback


def is_window(w):
    """[start, end] as two finite numbers."""
    return isinstance(w, list) and len(w) == 2 and all(
        isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in w)


def claim_problem(c):
    """Why a claim marked ok is not honestly marked, else None. The rule is QA.md section 3B: ok needs a page a
    person opened (with its link), a derivation that names calc.py, or an assumption that says what it assumes."""
    via = str(c.get("verified_via", "")).strip().lower()
    named = (str(c.get("note", "")) + " " + str(c.get("source_title", ""))).lower()
    if via in VIA_PAGE:
        return None if str(c.get("source_url", "")).strip() else "no source link"
    if via in VIA_DERIVED:
        return None if "calc.py" in named else "a derivation that does not name calc.py"
    if via in VIA_ASSUMED:
        return None if str(c.get("note", "")).strip() else "an assumption with no note"
    return f"verified_via is \"{str(c.get('verified_via', '')).strip()}\""


# ── the cross-checks ────────────────────────────────────────────────────────────────────────────

def cross_check(ep, shots, claims, identity, names, r, shots_ok=True):
    E, S = names["episode"], names["shots"]
    fmt = ep.get("format", {}) if isinstance(ep.get("format"), dict) else {}
    fps = fmt.get("fps") if isinstance(fmt.get("fps"), int) and not isinstance(fmt.get("fps"), bool) and fmt.get("fps") > 0 else 30
    kind = fmt.get("kind") if isinstance(fmt.get("kind"), str) else None
    aspect = fmt.get("aspect") if isinstance(fmt.get("aspect"), str) else None
    status = ep.get("status", {}) if isinstance(ep.get("status"), dict) else {}
    stage = status.get("stage") if isinstance(status.get("stage"), str) else None
    stage_i = STAGES.index(stage) if stage in STAGES else 0
    voice = ep.get("voice", {}) if isinstance(ep.get("voice"), dict) else {}

    # 2. the channel identity
    if identity is not None:
        if identity.get("slug") not in (None, ep.get("channel")):
            r.fail(E, "/channel", f"the identity file says slug \"{identity.get('slug')}\", the episode says \"{ep.get('channel')}\"")
        prefix = identity.get("prefix")
        if prefix and isinstance(ep.get("id"), str) and not ep["id"].startswith(prefix + "-"):
            r.fail(E, "/id", f"\"{ep['id']}\" does not start with this channel's prefix \"{prefix}-\"")
        formats = identity.get("formats") if isinstance(identity.get("formats"), dict) else {}
        if kind and formats and kind not in formats:
            r.warn(E, "/format/kind", f"the identity for {ep.get('channel')} lists no \"{kind}\" format (it has {listed(sorted(formats))})")
        elif kind in formats and isinstance(formats[kind], dict):
            for key in ("aspect", "size", "fps", "durationS"):
                if key in formats[kind] and key in fmt and not _same(formats[kind][key], fmt[key]):
                    mine, theirs = fmt[key], formats[kind][key]
                    if key == "durationS" and is_window(mine) and is_window(theirs) and (mine[0] < theirs[0] or mine[1] > theirs[1]):
                        r.fail(E, "/format/durationS", f"{_short(mine)} is wider than the identity's {_short(theirs)} for \"{kind}\": "
                                                       "the length window is the channel's, not the episode's")
                    else:
                        r.warn(E, f"/format/{key}", f"{_short(mine)} differs from the identity's {_short(theirs)} for \"{kind}\"")
        known = set()
        ident = identity.get("identity") if isinstance(identity.get("identity"), dict) else {}
        looks = identity.get("seasonLooks") if isinstance(identity.get("seasonLooks"), dict) else {}
        for pal in [ident.get("palette")] + [v.get("palette") for v in looks.values() if isinstance(v, dict)]:
            if isinstance(pal, dict):
                known |= {str(c).upper() for c in pal.values()}
        look = ep.get("look") if isinstance(ep.get("look"), dict) else {}
        if known and isinstance(look.get("palette"), dict):
            for tok, colour in look["palette"].items():
                if isinstance(colour, str) and colour.upper() not in known:
                    r.warn(E, f"/look/palette/{tok}", f"{colour} is not a colour in this channel's identity (each channel keeps its own palette)")
        iv = identity.get("voice") if isinstance(identity.get("voice"), dict) else {}
        if iv.get("kind") and voice.get("kind") and iv["kind"] != voice["kind"]:
            r.warn(E, "/voice/kind", f"\"{voice['kind']}\" differs from the identity's \"{iv['kind']}\"")

    # 3. beats and shots as one clock
    story = ep.get("story") if isinstance(ep.get("story"), dict) else {}
    beats = story.get("beats") if isinstance(story.get("beats"), list) else []
    beat_items = [(name_of(b.get("id"), f"#{i + 1}"), b.get("seconds")) for i, b in enumerate(beats) if isinstance(b, dict)]
    beat_end = windows(beat_items, "beat", fps, E, r) if beat_items else None
    shot_list = shots.get("shots", []) if isinstance(shots, dict) and isinstance(shots.get("shots"), list) else []
    shot_list = [s for s in shot_list if isinstance(s, dict)]
    shot_items = [(name_of(s.get("id"), f"#{i + 1}"), s.get("seconds")) for i, s in enumerate(shot_list)]
    shot_end = windows(shot_items, "shot", fps, S, r) if shot_items else None
    total = shot_end if shot_end is not None else beat_end
    if beat_end is not None and shot_end is not None and abs(beat_end - shot_end) > 0.5 / fps:
        r.fail(S, "shots", f"the shots end at {shot_end} s but the story beats end at {beat_end} s: they must cover the same episode")

    # 4. length
    dur = fmt.get("durationS")
    forced = fmt.get("durationForced") is True
    if isinstance(dur, list) and any(isinstance(x, float) and not math.isfinite(x) for x in dur):
        r.fail(E, "/format/durationS", "holds a number that is not finite")
    if total is not None and is_window(dur):
        if not dur[0] <= total <= dur[1]:
            msg = f"the plan runs {total} s, outside this format's {dur[0]} to {dur[1]} s"
            if forced and stage_i < STAGES.index("editing"):
                r.warn(E, "/format/durationS", msg + " (durationForced: a plan only, it never ships)")
            else:
                r.fail(E, "/format/durationS", msg + (f" (durationForced covers planning only; at stage \"{stage}\" the length must be inside the window)" if forced else ""))
        target = fmt.get("targetS")
        if isinstance(target, (int, float)) and not isinstance(target, bool) and abs(total - target) > 0.5:
            r.warn(E, "/format/targetS", f"the plan runs {total} s but the target is {target} s")
    if kind == "long" and total is not None and total < LONG_MIN_S:
        r.fail(E, "/format", f"a long video runs at least {LONG_MIN_S:.0f} s (8:30); this plan runs {total} s. Add real content, never padding (films/channels/SEASON-FORMAT.md)")
    if kind == "premium" and total is not None and total < PREMIUM_MIN_S:
        r.fail(E, "/format", f"a premium lesson is never under {PREMIUM_MIN_S:.0f} s, forced or not; this plan runs {total} s (films/channels/SEASON-FORMAT.md)")

    # what the renderer really draws
    wired = WIRED.get(aspect) if aspect else None
    native, size = fmt.get("nativeSize"), fmt.get("size")
    joined = kind == "long" and fmt.get("shape") == "joined"       # built by compilation.mjs from finished episodes: no single render size
    if "shape" in fmt and kind != "long":
        r.warn(E, "/format/shape", "shape is for a long video only (film or joined)")
    if joined and native is not None:
        r.warn(E, "/format/nativeSize", "a joined long video is not rendered as one picture: leave nativeSize out and say in format.deliveries how the file is made")
    if wired and not joined:
        if native is None and size is not None and not _same(size, wired):
            r.warn(E, "/format/size", f"{_short(size)} is not a size the renderer draws today ({wired[0]}x{wired[1]}); add nativeSize and label the file an upscale")
        if native is not None and not _same(native, wired):
            r.warn(E, "/format/nativeSize", f"{_short(native)} is not wired in kits/cinema/film/render.mjs today (its final tier draws {wired[0]}x{wired[1]}): Roadmap")

    # shots against the episode
    if isinstance(shots, dict) and shots and isinstance(ep.get("id"), str) and shots.get("episode") != ep["id"]:
        r.fail(S, "/episode", f"{_short(shots.get('episode'))} is not this episode's id \"{ep['id']}\"")
    seen, beat_ids = set(), {b for b, _ in beat_items}
    for s in shot_list:
        sid = name_of(s.get("id"), "?")
        if sid in seen and sid != "?":
            r.fail(S, f"shot {sid}", "this id is used twice")
        seen.add(sid)
        if aspect and isinstance(s.get("aspect"), str) and s["aspect"] != aspect:
            r.fail(S, f"shot {sid}", f"aspect {s['aspect']} is not the episode's {aspect} (each aspect gets its own manifest)")
        if isinstance(s.get("beat"), str) and s["beat"] and beat_ids and s["beat"] not in beat_ids:
            r.warn(S, f"shot {sid}", f"beat \"{s['beat']}\" is not a story beat in episode.json")
    long_shots = [name_of(s.get("id"), "?") for s in shot_list if is_window(s.get("seconds")) and s["seconds"][1] - s["seconds"][0] > LONG_SHOT_S]
    if long_shots:
        r.warn(S, "shots", f"{len(long_shots)} planned longer than {LONG_SHOT_S:.0f} s ({listed(long_shots)}): split them into real shots during storyboard")

    # 6. transitions: one vocabulary, each join named the same from both sides
    if shot_list and shots_ok:
        first, last = shot_list[0], shot_list[-1]
        sid = lambda s: name_of(s.get("id"), "?")
        if term(first.get("transitionIn")) != "open":
            r.fail(S, f"shot {sid(first)}", "the first shot's transitionIn is \"open\" (frame 0 is already composed)")
        if term(last.get("transitionOut")) not in ("loop", "close"):
            r.fail(S, f"shot {sid(last)}", "the last shot's transitionOut is \"loop\" or \"close\"")
        for a, b in zip(shot_list, shot_list[1:]):
            out_t, in_t = term(a.get("transitionOut")), term(b.get("transitionIn"))
            if out_t and in_t and out_t != in_t:
                r.fail(S, f"shot {sid(b)}", f"transitionIn is \"{in_t}\" but {sid(a)} leaves with \"{out_t}\": one join, one name")
            if out_t in ("open", "loop", "close") and in_t == out_t:
                r.fail(S, f"shot {sid(b)}", f"\"{out_t}\" is only for the first or last frame of the episode, not a join between shots")

    # 5. claims
    ledger = None
    if claims is not None:
        if not isinstance(claims, list) or not all(isinstance(c, dict) for c in claims):
            r.fail(names["claims"], "/", "the claims ledger is a list of objects, one per claim (kits/cinema/script/README.md)")
        else:
            nameless = [f"entry {i + 1}" for i, c in enumerate(claims) if not (isinstance(c.get("id"), str) and c["id"].strip())]
            if nameless:
                r.fail(names["claims"], "claims", f"{len(nameless)} with no id, or an id that is not text ({listed(nameless)}): every claim has an id such as c1")
            ledger = {c["id"]: c for c in claims if isinstance(c.get("id"), str) and c["id"].strip()}
            used = set()
            for s in shot_list:
                for cid in s.get("claims", []) if isinstance(s.get("claims"), list) else []:
                    if not isinstance(cid, str):
                        continue                          # the schema check has already said so
                    used.add(cid)
                    if cid not in ledger:
                        r.fail(S, f"shot {name_of(s.get('id'), '?')}", f"claim \"{cid}\" is not in {names['claims']}")
            unused = [c for c in ledger if c not in used]
            if unused and used:
                r.warn(names["claims"], "claims", f"never shown in a shot: {listed(unused)}")
            at_export = stage_i >= STAGES.index("export")
            is_ok = lambda c: str(c.get("status", "")).strip().lower() == "ok"
            not_ok = [cid for cid, c in ledger.items() if not is_ok(c)]
            if not_ok:
                msg = f"{len(not_ok)} of {len(ledger)} claims are not \"ok\" yet ({listed(not_ok)}): a person opens each source before the episode posts"
                (r.fail if at_export else r.warn)(names["claims"], "claims", msg)
            dishonest = [f"{cid} ({claim_problem(c)})" for cid, c in ledger.items() if is_ok(c) and claim_problem(c)]
            if dishonest:
                msg = (f"{len(dishonest)} marked \"ok\" without a page a person opened or a calc.py sum ({listed(dishonest)}): "
                       "ok needs verified_via \"page\" or \"owner opened the page\" with a source link, or a derivation that names calc.py "
                       "(films/channels/studio/QA.md, section 3B)")
                (r.fail if at_export else r.warn)(names["claims"], "claims", msg)

    # 7. the like/follow moment
    cta = ep.get("cta") if isinstance(ep.get("cta"), dict) else {}
    if total and kind in ("short", "premium", "part") and is_window(cta.get("seconds")):
        a, b = cta["seconds"]
        if a < CTA_NOT_BEFORE_S:
            r.fail(E, "/cta/seconds", f"the like/follow moment starts at {a} s: never in the first {CTA_NOT_BEFORE_S:.0f} s (films/channels/CTA.md)")
        if round(a / total, 3) < CTA_BAND[0] or round(b / total, 3) > CTA_BAND[1]:
            r.warn(E, "/cta/seconds", f"the like/follow moment sits at {100 * a / total:.0f} to {100 * b / total:.0f}% of the runtime; CTA.md asks for about {100 * CTA_BAND[0]:.0f} to {100 * CTA_BAND[1]:.0f}%, right after the payoff")
    if kind == "long" and len(cta.get("moments", []) if isinstance(cta.get("moments"), list) else []) != 2:
        r.warn(E, "/cta/moments", "a long video has two like/follow moments (films/channels/CTA.md): list both")

    # 8. disclosures
    disc = ep.get("disclosures")
    synthetic = voice.get("kind") == "tts" or voice.get("synthetic") is True
    if not isinstance(disc, dict):
        r.warn(E, "/disclosures", "missing: say whether the voice or any picture is AI-made, so the compile step can copy it to film.json")
        if synthetic:
            r.fail(E, "/disclosures", "the voice is synthetic, so disclosures.aiVoice must be true")
    else:
        if synthetic and disc.get("aiVoice") is not True:
            r.fail(E, "/disclosures/aiVoice", "the voice is synthetic, so this must be true")
        if not synthetic and voice.get("standIn") and status.get("recording") == "waiting" and disc.get("aiVoice") is not True:
            r.warn(E, "/disclosures/aiVoice", "drafts use an AI stand-in until the recording arrives: label them as AI")
        ai_shots = [name_of(s.get("id"), "?") for s in shot_list if s.get("aiArt") is True]
        if ai_shots and disc.get("aiVisuals") is not True:
            r.fail(E, "/disclosures/aiVisuals", f"AI-made art appears in {listed(ai_shots)}, so this must be true (SHOTS.md, owner-made AI art)")
    ai_voice = isinstance(disc, dict) and disc.get("aiVoice") is True
    if voice.get("kind") == "guest":
        # Skin Sense Season 3: Evelyn's real recordings only, never an AI copy; finals wait for her recording
        if voice.get("synthetic") is True:
            r.fail(E, "/voice/synthetic", "a guest's voice is never synthesised: use the real recording, or the labelled AI stand-in for drafts only")
        if stage_i >= STAGES.index("editing"):
            if ai_voice:
                r.fail(E, "/disclosures/aiVoice", f"stage is \"{stage}\" and an AI voice is still in the file: a guest-voiced final holds the real recording only, and waits for it")
            if status.get("recording") != "received":
                r.fail(E, "/status/recording", f"stage is \"{stage}\" but the recording is {_short(status.get('recording'))}: a guest-voiced final waits for the real recording")
    if voice.get("kind") == "owner" and ai_voice and stage_i >= STAGES.index("export"):
        consent = voice.get("consent")
        if not (voice.get("synthetic") is True and isinstance(consent, str) and consent.strip() and "TODO" not in consent):
            r.fail(E, "/disclosures/aiVoice", "the owner's voice is labelled AI at export. Either the AI stand-in is still in the file (wait for the recording), "
                                              "or it is the owner's cloned voice: then set voice.synthetic true and record his consent in voice.consent (no TODO)")
    if voice.get("kind") == "guest" and not voice.get("consent"):
        r.warn(E, "/voice/consent", "a guest voice needs the person's written OK on record; the owner gets it")
    if voice.get("kind") in ("owner", "guest") and "recording" not in status:
        r.warn(E, "/status/recording", "say whether the real recording is waiting or received")

    # placeholders
    ep_todos = todo_paths(ep)
    if ep_todos:
        msg = f"{len(ep_todos)} TODO placeholder{'s' if len(ep_todos) != 1 else ''}: {listed(ep_todos)}"
        (r.fail if stage_i >= STAGES.index("qa") else r.warn)(E, "TODO", msg)
    for s in shot_list:
        t = todo_paths(s)
        if t and s.get("status") in ("built", "approved"):
            r.fail(S, f"shot {name_of(s.get('id'), '?')}", f"is marked {s['status']} but still holds {len(t)} TODO placeholder{'s' if len(t) != 1 else ''} ({listed(t, 4)})")
    planned_todos = sum(1 for s in shot_list if s.get("status") == "planned" and todo_paths(s))
    if planned_todos:
        r.warn(S, "TODO", f"{planned_todos} of {len(shot_list)} planned shots still hold TODO placeholders")

    # 9. the human gates
    gate = status.get("lookGate")
    if stage_i >= STAGES.index("motion") and gate != "approved":
        msg = f"stage is \"{stage}\" but the look gate is \"{gate}\": the owner approves stills before the full render"
        (r.fail if stage_i >= STAGES.index("editing") else r.warn)(E, "/status/lookGate", msg)
    if stage_i >= STAGES.index("export"):
        if status.get("sources") != "ok":
            r.fail(E, "/status/sources", "nothing is exported while sources are open: a person opens every source first")
        if status.get("title") != "chosen":
            r.fail(E, "/status/title", "the owner chooses the title (the packaging winner) before export")
        if status.get("recording") == "waiting" and voice.get("kind") != "guest":      # a guest voice is checked from "editing" on, above
            r.fail(E, "/status/recording", "the final waits for the real recording")
        unapproved = [name_of(s.get("id"), "?") for s in shot_list if s.get("status") != "approved"]
        if unapproved:
            r.fail(S, "shots", f"not approved yet: {listed(unapproved)}")


def run(path, identities=None, shots=None, claims=None, builtin=False):
    """Validate one episode. Returns {errors, warnings, info, fatal}; fatal is a message when the
    files could not be read at all."""
    r = Report()
    path = Path(path)
    spec = path / "episode.json" if path.is_dir() else path
    ep, err = read_json(spec)
    if err:
        return {"errors": [], "warnings": [], "info": "", "fatal": err}
    folder = spec.parent
    m = re.match(r"^episode\.(.+)\.json$", spec.name)
    tag = m.group(1) if m else None
    names = {"episode": spec.name}

    ep_schema, err = read_json(SCHEMAS / "episode.schema.json")
    shot_schema, err2 = read_json(SCHEMAS / "shot.schema.json")
    if err or err2:
        return {"errors": [], "warnings": [], "info": "", "fatal": err or err2}

    errs, checker = schema_errors(ep_schema, ep, builtin)
    for at, msg in errs:
        r.fail(names["episode"], at, msg)
    if not isinstance(ep, dict):
        return {"errors": r.errors, "warnings": r.warnings, "info": f"checker: {checker}", "fatal": None}

    files = ep.get("files") if isinstance(ep.get("files"), dict) else {}
    named = lambda key, default: files[key] if isinstance(files.get(key), str) and files[key].strip() else default
    shots_path = Path(shots) if shots else sibling(folder, named("shots", "shots.json"), tag)
    claims_path = Path(claims) if claims else sibling(folder, named("claims", "claims.json"), tag)
    names["shots"], names["claims"] = shots_path.name, claims_path.name

    shots_doc, err = read_json(shots_path)
    shots_ok = False
    if err:
        r.fail(names["shots"], "/", err)
    else:
        errs, _ = schema_errors(shot_schema, shots_doc, builtin)
        shots_ok = not errs
        for at, msg in errs:
            r.fail(names["shots"], at, msg)

    claims_doc, err = read_json(claims_path)
    if err:
        r.fail(names["claims"], "/", err + " (an empty ledger is the file [])")

    script = named("script", None)
    if script and not tag and not (folder / script).exists():
        r.warn(names["episode"], "/files/script", f"{script} is not in the episode folder yet")

    identity = None
    channel = ep.get("channel")
    if isinstance(channel, str) and re.match(r"^[a-z][a-z0-9-]*$", channel):
        id_path = Path(identities or IDENTITIES) / f"{channel}.json"
        identity, err = read_json(id_path)
        if err:
            r.fail(names["episode"], "/channel", f"no channel identity for \"{channel}\": {err}. The blueprint keeps one file per channel in films/channels/studio/identities/; pass --identities DIR if they live elsewhere")
            identity = None
        elif not isinstance(identity, dict):
            r.fail(names["episode"], "/channel", f"{id_path} is not a JSON object")
            identity = None

    try:
        cross_check(ep, shots_doc if isinstance(shots_doc, dict) else {}, claims_doc, identity, names, r, shots_ok)
    except Exception as err:                             # a value of a type no check expected: report it, never a traceback
        r.fail(names["episode"], "cross-checks", f"stopped ({type(err).__name__}: {' '.join(str(err).split())}); fix the schema failures above first")

    n_shots = len(shots_doc.get("shots", [])) if isinstance(shots_doc, dict) and isinstance(shots_doc.get("shots"), list) else 0
    story = ep.get("story") if isinstance(ep.get("story"), dict) else {}
    beats = story.get("beats") if isinstance(story.get("beats"), list) else []
    end = None
    for seq in ((shots_doc or {}).get("shots") if isinstance(shots_doc, dict) else None, beats):
        if isinstance(seq, list) and seq and isinstance(seq[-1], dict) and is_window(seq[-1].get("seconds")):
            end = seq[-1]["seconds"][1]
            break
    info = f"{name_of(ep.get('id'), '?')}, {len(beats)} beats, {n_shots} shots" + (f", {end} s" if end is not None else "") + f", checker: {checker}"
    return {"errors": r.errors, "warnings": r.warnings, "info": info, "fatal": None}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Validate an episode's episode.json and shots.json against the studio schemas and cross-checks.")
    ap.add_argument("path", help="an episode folder, or its episode.json")
    ap.add_argument("--identities", help="folder of channel identity files (default: films/channels/studio/identities)")
    ap.add_argument("--shots", help="shot manifest to use instead of the one named in episode.json")
    ap.add_argument("--claims", help="claims ledger to use instead of the one named in episode.json")
    ap.add_argument("--builtin", action="store_true", help="use the built-in schema checker even if jsonschema is installed")
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    a = ap.parse_args(argv)

    res = run(a.path, a.identities, a.shots, a.claims, a.builtin)
    if res["fatal"]:
        print(f"validate: {res['fatal']}", file=sys.stderr)
        return 2
    for line in res["errors"]:
        print(line)
    for line in res["warnings"]:
        print(line)
    bad = len(res["errors"]) + (len(res["warnings"]) if a.strict else 0)
    verdict = "OK" if not bad else f"{len(res['errors'])} problem{'s' if len(res['errors']) != 1 else ''}"
    strict = " counted as failures (--strict)" if a.strict and res["warnings"] else ""
    print(f"validate: {verdict}, {len(res['warnings'])} warning{'s' if len(res['warnings']) != 1 else ''}{strict} ({res['info']})")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

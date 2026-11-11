#!/usr/bin/env python3
"""Start a new episode from four inputs: the channel, the topic, the target length and the format.

    python3 -I films/channels/studio/tools/new_episode.py --channel <slug|name> --topic "..." \
        --duration <seconds or m:ss> --format <short|premium|part|long> \
        [--season N] [--number N] [--title "..."] [--out DIR] [--identities DIR] [--force] [--overwrite]

It reads the channel identity (films/channels/studio/identities/<slug>.json), resolves the format's
defaults and the season's look, and writes a folder (default ./new-episodes/<prefix>-<topic>/) with:

    episode.json    the master spec, valid against schema/episode.schema.json, with every default it
                    chose listed under "assumptions"
    script.md       a skeleton in the kit's script format (kits/cinema/script/README.md): one heading
                    per beat, windows sized to the target length, a word budget at the channel's pace,
                    vo: placeholders, and the like/follow moment where films/channels/CTA.md puts it
    shots.json      one planned shot per beat (schema/shot.schema.json), to be split and filled in
    claims.json     []
    out/.gitkeep
    NEXT-STEPS.md   the ordered checklist for this episode, with who does each step

It refuses a length outside the format's window unless --force, and a format the channel's identity
does not list unless --force. A long video under 510 s (8:30) is refused even with --force. It prints
what it assumed, then runs validate.py on what it wrote. No network. Standard library only.

The folder is a starting point, not a build: move it into the channel's folder on the channel's own
branch (the identity's "branch" and "filmsPath") before building. Full guide:
films/channels/studio/NEW-EPISODE.md.
"""
import argparse
import datetime
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))                          # python3 -I does not add the script's folder
sys.dont_write_bytecode = True                         # leave no __pycache__ beside the tools
import validate as V  # noqa: E402

STUDIO = HERE.parent                                   # films/channels/studio
CHANNELS = STUDIO.parent                               # films/channels
IDENTITIES = STUDIO / "identities"
CTA_FILE = CHANNELS / "CTA.md"

KINDS = ("short", "premium", "part", "long")
LONG_MIN_S = 510.0

# Used only when a channel's identity lists no such format and --force is given.
STUDIO_FORMATS = {
    "short":   {"aspect": "9:16", "size": [1080, 1920], "fps": 30, "durationS": [61, 75]},
    "premium": {"aspect": "9:16", "size": [1080, 1920], "fps": 30, "durationS": [70, 90]},
    "part":    {"aspect": "9:16", "size": [1080, 1920], "fps": 30, "durationS": [61, 75]},
    "long":    {"aspect": "16:9", "size": [2560, 1440], "fps": 30, "durationS": [510, 570]},
}
WIRED = {"9:16": [1080, 1920], "16:9": [1920, 1080]}  # what kits/cinema/film/render.mjs draws today

# The share of the runtime the voice speaks. Shorts and parts: the lint estimates length as words at
# the overall pace, so 1. Premium: the Skin Sense Season 3 lessons run about 0.8 (122 words in an
# 80 s plan at 115 words a minute). Long: a working figure, not a measurement.
TALK_SHARE = {"short": 1.0, "part": 1.0, "premium": 0.8, "long": 0.9}

# The channel's recurring segment beat in a short (kits/cinema/script/README.md and the channels'
# build logs). An identity may override it with a top-level "segment".
SEGMENTS = {"physics": "measure", "space": "readout", "whatif": "work"}

# Episodes per season so far, for the default folder number. Seasons 1 and 2 had six episodes on
# every channel; Season 3 has eight parts on the film channels and six lessons on Skin Sense.
SEASON_SIZES = {"skincare": [6, 6, 6], "*": [6, 6, 8]}

# Which long-video shape a channel uses (films/channels/SEASON-FORMAT.md).
LONG_STYLE = {"skincare": "joined"}                    # the others: "film"

# Season 2 build order on each channel's own branch, as audited on 11 Nov 2026.
BUILD_ORDER = {
    "physics": "lint.py --segment measure, voice/tts.py, voice/align.py, lint.py --bpm 112.5, the episode's compile.py, "
               "render.mjs --cues, compile.py again, studio/render.py, film/run.sh <folder> --tier final, "
               "render.mjs --assemble --audio, film/qa.py, film/scorecard.py, film/youtube1440.py",
    "space": "lint.py --segment readout, the episode's voice.py, voice/align.py, lint.py --bpm 56.25, compile.py, "
             "render.mjs --cues, compile.py again, studio/render.py, season2/gaps.py, a draft, render.mjs --tier final --resume, "
             "render.mjs --assemble, film/qa.py, film/youtube1440.py, season2/make_cover.py, season2/pack.py, season2/make_posting.py",
    "whatif": "the episode's calc.py, voice.py, voice/align.py, voice.py --clamp, lint.py --segment work, compile.py, "
              "studio/render.py, film/run.sh <folder> --tier final, render.mjs --assemble, film/qa.py, film/youtube1440.py, "
              "covers.py, srt.py, posting_pack.py",
    "skincare": "the episode's voice.py, voice/align.py, set/build_ep.py <folder>, set/final.sh <folder> (make_sheet.py, "
                "studio/render.py, render.mjs --tier final --plain, assemble, film/qa.py, film/youtube1440.py), set/cta_line.py, set/covers.mjs",
}


class Stop(Exception):
    """A clear message for the person running the tool; exit status 2."""


# ── small helpers ───────────────────────────────────────────────────────────────────────────────

def slugify(text, limit=48):
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if len(s) > limit:
        s = s[:limit].rsplit("-", 1)[0] if "-" in s[:limit] else s[:limit]
    return s.strip("-") or "episode"


def parse_duration(text):
    m = re.match(r"^(\d+):([0-5]?\d(?:\.\d+)?)$", text.strip())
    try:
        value = int(m.group(1)) * 60 + float(m.group(2)) if m else float(text)
    except ValueError:
        raise Stop(f"--duration \"{text}\" is not a number of seconds or m:ss (examples: 68, 80, 1:10, 9:00)")
    if value <= 0:
        raise Stop("--duration must be more than 0")
    return value


def key(text):
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def mmss(s):
    return f"{int(s // 60)}:{int(round(s % 60)):02d}"


def num(x):
    """A window number for JSON and headings: 4.0 stays 4.0, 4.50 becomes 4.5."""
    return round(float(x), 2)


def words_in(text):
    return len(re.findall(r"[A-Za-z0-9'’-]+", text))


# ── the channel identity ────────────────────────────────────────────────────────────────────────

def load_identities(folder):
    folder = Path(folder)
    if not folder.is_dir():
        raise Stop(f"No channel identities found: the folder {folder} does not exist.\n"
                   f"The blueprint keeps one identity file per channel there (skincare.json, physics.json, whatif.json, space.json).\n"
                   f"Pass --identities DIR if they live somewhere else.")
    out, broken = {}, []
    for f in sorted(folder.glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            broken.append(f"{f.name}: {' '.join(str(e).split())}")
            continue
        if isinstance(d, dict):
            d.setdefault("slug", f.stem)
            out[d["slug"]] = d
    if not out:
        raise Stop(f"No channel identity files in {folder}" + (f" (unreadable: {'; '.join(broken)})" if broken else "") +
                   ".\nExpected <slug>.json files written to the blueprint's identity contract.")
    return out, broken


def resolve_channel(arg, identities, folder):
    want = key(arg)
    for slug, d in identities.items():
        if want in (key(slug), key(d.get("name", "")), key(d.get("prefix", ""))):
            return d
    have = ", ".join(f"{s} ({d.get('name', '?')})" for s, d in identities.items())
    raise Stop(f"No channel identity for \"{arg}\". Looked in {folder} for a file whose slug, name or prefix matches.\n"
               f"Channels found: {have}.\nExpected file: {Path(folder) / (slugify(arg) + '.json')}")


def require(identity, path):
    node = identity
    for part in path.split("."):
        node = node.get(part) if isinstance(node, dict) else None
    return node


# ── the like/follow lines ───────────────────────────────────────────────────────────────────────

def cta_lines(section, cta_file=CTA_FILE):
    """The numbered lines under a bold heading of films/channels/CTA.md, e.g. **Reality Rulebook**."""
    try:
        text = Path(cta_file).read_text(encoding="utf-8")
    except OSError:
        return [], None
    heads = [(m.start(), m.group(1).strip()) for m in re.finditer(r"^\*\*([^*\n]+)\*\*.*$", text, re.M)]
    want = key(section)
    pick = next((h for h in heads if key(h[1]) == want), None) or next((h for h in heads if key(h[1]).startswith(want) and want), None)
    if not pick:
        return [], None
    after = [h[0] for h in heads if h[0] > pick[0]]
    block = text[pick[0]: after[0] if after else len(text)]
    return [m.group(1).strip() for m in re.finditer(r"^\d+\.\s+(.+)$", block, re.M)], pick[1]


# ── laying out the beats ────────────────────────────────────────────────────────────────────────

def lay(specs, start, end, grid):
    """Give each spec a window between start and end, in proportion to its weight (or its fixed
    seconds), snapped to the grid. Returns [(spec, a, b)]."""
    fixed = sum(s["fixed"] for s in specs if "fixed" in s)
    weight = sum(s.get("weight", 0) for s in specs if "fixed" not in s) or 1.0
    room = max(0.0, (end - start) - fixed)
    out, t, ideal = [], start, start
    for i, s in enumerate(specs):
        ideal += s["fixed"] if "fixed" in s else room * s.get("weight", 0) / weight
        b = end if i == len(specs) - 1 else round(ideal / grid) * grid
        b = max(b, t + grid)
        out.append((s, t, b))
        t = b
    return out


def B(id, purpose, weight=None, fixed=None, energy=0.5, extra=""):
    d = {"id": id, "purpose": purpose, "energy": energy, "extra": extra}
    if fixed is not None:
        d["fixed"] = fixed
    else:
        d["weight"] = weight
    return d


def plan_beats(kind, D, grid, cta_s, segment, long_style, part_of):
    """[(spec, a, b)] for the whole episode, with the like/follow moment placed by CTA.md's rule."""
    cta = lambda i="cta", why="The like/follow moment: one soft line in the narrator's voice, right after the payoff.": \
        B(i, why, fixed=cta_s, energy=0.4, extra="like/follow moment")
    if kind in ("short", "premium", "part"):
        c0 = round(0.71 * D / grid) * grid              # CTA.md: about 70 to 85% through, after the payoff
        c0 = max(c0, 20.0)                               # and never in the first 20 s
        if c0 + cta_s > 0.85 * D:
            c0 = max(20.0, round((0.85 * D - cta_s) / grid) * grid)
        if kind == "short":
            pre = [B("hook", "A question about the picture on screen that the viewer cannot answer yet, spoken by 2.0 s.", fixed=4.0, energy=0.6, extra="pre: 0.1"),
                   B("normal", "The rule of this little world, fast, with one number made human.", 11, energy=0.45),
                   B("change", "The picture breaks the expectation. Say less; let the picture land.", 10, energy=0.55),
                   B("why", "The reason, through a person, a wrong idea or stakes. One mechanism, in plain words.", 14, energy=0.5, extra="picture-only 2 s"),
                   B("whoa", "The payoff: the same idea, bigger. The escalation the hook promised.", 10, energy=0.8, extra="picture-only 3 s")]
            post = ([B(segment, f"The channel's recurring segment, woven into the story's last turn.", 5, energy=0.5, extra=f"segment: {segment}")] if segment else []) + \
                   [B("takeaway", "A reframe the viewer could repeat to a friend. It calls back to the hook.", 5, energy=0.35),
                    B("tease", "A real question for next time, then the end card.", 4.5, energy=0.35, extra="end card held ≥ 2 s")]
        elif kind == "premium":
            pre = [B("hook", "A feeling or sight everyone knows, on a frame that is already composed.", 4.5, energy=0.4, extra="pre: 0.3"),
                   B("enter", "Go from the familiar surface into the hidden machinery, in one unbroken move.", 9.5, energy=0.4),
                   B("mechanism", "The first step of how it works. One mechanism, shown before it is named.", 14, energy=0.45),
                   B("deeper", "The second step, further in. It raises the question the payoff answers.", 14, energy=0.5),
                   B("payoff", "The one true twist. The single on-screen word or number appears here, then the picture holds.", 14.5, energy=0.6, extra="picture-only 3 s")]
            post = [B("return", "The way back out. It answers something the first frame showed.", 9, energy=0.4),
                    B("close", "Back where it started, seen differently. The last frame matches frame 0.", 9.5, energy=0.3, extra="final hold ≥ 1.5 s")]
        else:
            n, of = part_of
            pre = [B("hook", "The part's own 2 s hook line, in place of the long film's bridge line.", fixed=3.0, energy=0.6, extra="part hook · pre: 0.1"),
                   B("setup", "The chapter opens: where the long film's escalating question stands now.", 15, energy=0.5),
                   B("turn", "The chapter's new step. The live number moves.", 15, energy=0.6),
                   B("peak", "The chapter's high point. In the last part it stops just before the film's payoff.", 14, energy=0.75, extra="picture-only 2 s")]
            post = [B("cliff", "The cliffhanger line: an open loop that the next part answers.", 7.5, energy=0.6),
                    B("tease", f"The closer: \"Part {n} of {of}. Full video on YouTube.\" Said once, at the end.", 6, energy=0.4, extra="end card held ≥ 1.5 s")]
        return lay(pre, 0.0, c0, grid) + lay([cta()], c0, c0 + cta_s, grid) + lay(post, c0 + cta_s, D, grid)

    cta1 = cta("cta1", "First like/follow moment: a quick interruption after the first big payoff, then back to the story.")
    cta2 = cta("cta2", "Second like/follow moment: in the finale, before the end card.")
    if long_style == "joined":
        lessons, bridge_s, open_s, finale_s, close_s = 6, 8.0, 20.0, 36.0, 8.0
        each = (D - open_s - (lessons - 1) * bridge_s - finale_s - close_s - 2 * cta_s) / lessons
        specs = [B("open", "The opening: states the thread that connects the whole video (15 to 25 s).", fixed=open_s, energy=0.4)]
        for i in range(1, lessons + 1):
            specs.append(B(f"lesson{i}", f"Lesson {i} of {lessons}, as delivered in its own episode.", fixed=each, energy=0.5))
            if i == 2:
                specs.append(cta1)
            if i < lessons:
                specs.append(B(f"bridge{i}", f"Bridge {i}: one line that links lesson {i} to lesson {i + 1} (6 to 12 s).", fixed=bridge_s, energy=0.4))
        specs += [B("finale", "The finale: pays the thread off (25 to 45 s). Real content, never a recap.", fixed=finale_s, energy=0.5), cta2,
                  B("close", "The close: the last picture hands back to the first; the end card.", fixed=close_s, energy=0.3, extra="end card held ≥ 2 s")]
    else:
        chapters, open_s, payoff_s, close_s = 8, 20.0, 36.0, 10.0
        each = (D - open_s - payoff_s - close_s - 2 * cta_s) / chapters
        specs = [B("open", "The cold open: the one question that escalates and never resets (15 to 25 s).", fixed=open_s, energy=0.5, extra="chapter: cold open · pre: 0.1")]
        t = open_s
        for i in range(1, chapters + 1):
            why = f"Chapter {i} of {chapters}: one step of the escalation, ending on an open loop that chapter {i + 1} answers." if i < chapters \
                else f"Chapter {chapters} of {chapters}: the last step before the payoff. The part cut from it stops here."
            if t <= 0.6 * D < t + each:
                why += " The 'wait, what?' twist lands in this chapter (about 60% through)."
            specs.append(B(f"ch{i}", why, fixed=each, energy=round(0.5 + 0.04 * i, 2), extra=f"chapter: {i} · part hook: TODO the 2 s hook for part {i}"))
            t += each
            if i == 2:
                specs.append(cta1)
                t += cta_s
        specs += [B("payoff", "The payoff, in the last minute. It belongs to the long film only (25 to 45 s).", fixed=payoff_s, energy=0.8, extra="chapter: close · picture-only 3 s"), cta2,
                  B("close", "The last shot loops back to the first; the end card.", fixed=close_s, energy=0.4, extra="chapter: close · end card held ≥ 2 s")]
    return lay(specs, 0.0, D, grid)


# ── the files ───────────────────────────────────────────────────────────────────────────────────

def build(a):
    assumptions = []
    id_dir = Path(a.identities) if a.identities else IDENTITIES
    identities, broken = load_identities(id_dir)
    identity = resolve_channel(a.channel, identities, id_dir)
    slug, name, prefix = identity.get("slug"), identity.get("name"), identity.get("prefix")
    missing = [k for k in ("slug", "name", "prefix") if not identity.get(k)]
    if missing:
        raise Stop(f"The identity file for \"{a.channel}\" in {id_dir} is missing: {', '.join(missing)} (see the blueprint's identity contract).")
    if a.identities:
        assumptions.append(f"The channel identity was read from {id_dir}, not the studio's own folder. Pass the same --identities to validate.py.")

    kind = a.format
    D = parse_duration(a.duration)

    # the format
    formats = identity.get("formats") if isinstance(identity.get("formats"), dict) else {}
    if kind in formats and isinstance(formats[kind], dict):
        fmt_src = {**STUDIO_FORMATS[kind], **{k: v for k, v in formats[kind].items() if k in ("aspect", "size", "fps", "durationS")}}
    elif a.force:
        fmt_src = dict(STUDIO_FORMATS[kind])
        assumptions.append(f"{name}'s identity lists no \"{kind}\" format. The studio default was used ({fmt_src['aspect']}, "
                           f"{fmt_src['durationS'][0]:g} to {fmt_src['durationS'][1]:g} s) because of --force. Add the format to the identity file if the channel adopts it.")
    else:
        have = ", ".join(sorted(formats)) or "none"
        raise Stop(f"{name}'s identity lists no \"{kind}\" format (it has: {have}).\n"
                   f"Pick one of those, or pass --force to use the studio default for \"{kind}\" and record it as an assumption.")
    lo, hi = fmt_src["durationS"]
    forced = False
    if kind == "long" and D < LONG_MIN_S:
        raise Stop(f"A long video runs at least {LONG_MIN_S:.0f} s (8:30); {D:g} s was asked for. "
                   f"--force cannot override this: every long video is at least 8:30, by real content, never padding (films/channels/SEASON-FORMAT.md).")
    if not lo <= D <= hi:
        if not a.force:
            raise Stop(f"{D:g} s is outside {name}'s window for \"{kind}\": {lo:g} to {hi:g} s ({mmss(lo)} to {mmss(hi)}).\n"
                       f"Pick a length inside it, or pass --force to plan it anyway (it is recorded, and validate.py will warn).")
        forced = True
        assumptions.append(f"The target of {D:g} s is outside the format's {lo:g} to {hi:g} s. It was accepted because of --force (format.durationForced).")
    fps = int(fmt_src["fps"])
    grid = 0.5 if fps % 2 == 0 else 1.0
    if abs(D / grid - round(D / grid)) > 1e-9:
        snapped = round(D / grid) * grid
        assumptions.append(f"The target {D:g} s was rounded to {snapped:g} s so every window sits on a whole frame.")
        D = snapped
    aspect, size = fmt_src["aspect"], list(fmt_src["size"])
    native = WIRED[aspect]
    fmt = {"kind": kind, "aspect": aspect, "size": size, "nativeSize": native, "fps": fps, "durationS": [lo, hi], "targetS": num(D)}
    if forced:
        fmt["durationForced"] = True
    deliveries = [{"name": "master" if size == native else "native render", "size": native, "native": True, "how": "kits/cinema/film/render.mjs, final tier"}]
    if size != native:
        deliveries.append({"name": "master (the file Prism imports)", "size": size, "native": False,
                           "how": "Upscaled from the native render; only cards are drawn at this size (kits/cinema/film/compilation.mjs). Never label it native."})
        assumptions.append(f"The picture renders at {native[0]}x{native[1]}; the {size[0]}x{size[1]} master is an upscale and is labelled as one.")
    if aspect == "9:16":
        deliveries.append({"name": "YouTube file", "size": [1440, 2560], "native": False,
                           "how": "Lanczos upscale by kits/cinema/film/youtube1440.py. Label it '1440 upscale'."})
    fmt["deliveries"] = deliveries
    if isinstance(formats.get(kind), dict) and formats[kind].get("notes"):
        fmt["notes"] = formats[kind]["notes"]

    # season, number, folder
    looks = identity.get("seasonLooks") if isinstance(identity.get("seasonLooks"), dict) else {}
    look_seasons = sorted(int(k[1:]) for k in looks if re.match(r"^s[1-9]\d*$", k))
    if a.season is not None:
        season = a.season
    elif look_seasons:
        season = look_seasons[-1]
        assumptions.append(f"Season {season}: the newest season look in the identity file. Pass --season to change it.")
    else:
        season = 1
        assumptions.append("Season 1: the identity file names no season look. Pass --season to change it.")
    if a.number is not None:
        number = a.number
    else:
        number = 0 if kind == "long" else 1
        assumptions.append("Number 0: a season's long film takes 00 in its id." if kind == "long"
                           else "Number 1: no --number was given. Set the episode's real place in the season.")
    if kind == "long" and number != 0:
        assumptions.append(f"A long film normally takes number 0; --number {number} was kept as asked.")
    ep_id = f"{prefix}-s{season}e{number:02d}"

    title = (a.title or a.topic).strip()
    if len(title) > 100:
        title = title[:100].rstrip()
        assumptions.append("The title was cut to 100 characters (Prism's limit).")
    if not a.title:
        assumptions.append("The title is the topic as typed. The real title is the winner in packaging.json, which the owner picks (films/channels/PACKAGING.md).")

    films_path = identity.get("filmsPath", "films/channels/" + slug)
    deliver = None
    if kind == "long":
        joined = LONG_STYLE.get(slug, "film") == "joined"
        folder = f"s{season}" if joined else slugify(title)
        where = f"{films_path}/longform/{folder}/"
        deliver = f"{films_path}/compilations/{folder}/"
        assumptions.append((f"Folder \"{folder}\": a season's joined long video is named after its season." if joined
                            else f"Folder \"{folder}\" is the title in lower case with hyphens.") +
                           f" Work in longform/{folder}/; the finished video goes to compilations/{folder}/{folder}-16x9.mp4, or Prism ignores it (films/channels/studio/STRUCTURE.md).")
    else:
        sizes = SEASON_SIZES.get(slug, SEASON_SIZES["*"])
        before = sum(sizes[: season - 1]) + sizes[-1] * max(0, season - 1 - len(sizes))
        folder = f"ep{before + max(number, 1):02d}"
        where = f"{films_path}/{folder}/"
        note = (f"Folder {folder} assumes the seasons before Season {season} used ep01 to ep{before:02d}"
                f" ({', '.join(str(sizes[min(i, len(sizes) - 1)]) for i in range(season - 1))} episodes)." if season > 1
                else f"Folder {folder}: a first season starts at ep01.")
        assumptions.append(note + f" Check the next free epNN on the branch {identity.get('branch', '?')} before moving the folder in.")

    # voice and pace
    iv = identity.get("voice") if isinstance(identity.get("voice"), dict) else {}
    vkind = iv.get("kind") if iv.get("kind") in ("tts", "owner", "guest") else "tts"
    wpm = iv.get("wpm") if isinstance(iv.get("wpm"), (int, float)) else 150
    if not iv:
        assumptions.append("The identity file has no voice. A synthetic voice at 150 words a minute was assumed.")
    share = TALK_SHARE[kind]
    voice = {"kind": vkind, "id": str(iv.get("id") or "TODO: voice id"), "tone": str(iv.get("tone") or "TODO: tone"), "wpm": wpm, "talkShare": share}
    if vkind == "tts":
        voice["synthetic"] = True
    else:
        voice["standIn"] = "An AI voice stands in until the recording arrives, and every draft with it is labelled as AI (films/channels/SEASON-FORMAT.md)."
        if vkind == "guest":
            voice["consent"] = "TODO (owner): the guest's written OK for this use is not on record here."
    total_words = int(round(D * wpm / 60.0 * share))
    assumptions.append(f"Word budget: {D:g} s at {wpm:g} words a minute, with the voice speaking {share:g} of the runtime, is about {total_words} words."
                       + ("" if share == 1 else f" The {share:g} is a working figure for this format, not a measurement."))

    # the look
    look_key = f"s{season}"
    if isinstance(looks.get(look_key), dict):
        L = looks[look_key]
        palette = L.get("palette") if isinstance(L.get("palette"), dict) and L.get("palette") else require(identity, "identity.palette") or {}
        look = {"season": look_key, "summary": str(L.get("summary") or "TODO: the season look"), "palette": palette}
        if L.get("notes"):
            look["notes"] = str(L["notes"])
        if L.get("status"):
            look["status"] = str(L["status"])
        if not (isinstance(L.get("palette"), dict) and L.get("palette")):
            assumptions.append(f"The Season {season} look lists no colours of its own, so the channel's base palette was used.")
        if str(L.get("status", "")).lower() != "approved":
            assumptions.append(f"The Season {season} look is \"{L.get('status', 'not approved')}\" in the identity file. The owner approves stills before any build.")
    else:
        look = {"season": "base", "summary": str(require(identity, "identity.look") or "TODO: the channel's look"),
                "palette": require(identity, "identity.palette") or {}}
        assumptions.append(f"The identity file has no look for Season {season}. The channel's base identity was used.")
    look_text = " ".join(str(look.get(k, "")) for k in ("summary", "notes"))
    ai_visuals = bool(re.search(r"\bAI[- ](?:illustration|image|painting|picture|art)", look_text, re.I))

    # the like/follow line
    section = require(identity, "cta.section") or name
    lines, found = cta_lines(section)
    segment = identity.get("segment") or SEGMENTS.get(slug) if kind == "short" else None
    rate = wpm / 60.0 * 1.15                            # inside a line the voice runs a little above its overall pace
    if lines:
        pick = (number - 1) % len(lines) if number > 0 else (season - 1) % len(lines)
        line_t = lines[pick]
        second_t = lines[(pick + 1) % len(lines)]
        assumptions.append(f"Like/follow line {pick + 1} of {len(lines)} under \"{found}\" in films/channels/CTA.md, chosen by rotation. Check it differs from the previous episode's.")
    else:
        line_t = second_t = "TODO: pick this channel's like/follow line from films/channels/CTA.md, with {follow}."
        assumptions.append(f"No like/follow lines were found under \"{section}\" in films/channels/CTA.md. A TODO was left in their place.")
    follow = lambda s: s.replace("{follow}", "follow")
    subscribe = lambda s: s.replace("{follow}", "subscribe")
    cta_s = max(3.0, round((words_in(follow(line_t)) / rate + 0.5) / grid + 0.4999) * grid)
    if cta_s > 3.0 and lines:
        assumptions.append(f"The like/follow line needs about {cta_s:g} s at this pace. CTA.md asks for about 2 to 3 s: shorten the line or accept the longer moment.")

    long_style = LONG_STYLE.get(slug, "film") if kind == "long" else None
    if kind == "long":
        assumptions.append("Long-video shape: " + ("six lessons joined with an opening, bridges and a finale (Skin Sense, SEASON-FORMAT.md). Lesson lengths here are equal placeholders; the real ones come from the six episodes."
                           if long_style == "joined" else "one story in a cold open, eight chapters, a payoff and a close (SEASON-FORMAT.md). The eight parts are cut from the eight chapters."))
    part_of = (max(number, 1), 8)
    if kind == "part":
        assumptions.append("Part of 8: the season format is one long film and eight parts. Set partOf.film to the long film's id or folder.")
    plan = plan_beats(kind, D, grid, cta_s, segment, long_style, part_of)

    # beats, script, shots
    cta_ids = [s["id"] for s, _, _ in plan if s["id"].startswith("cta")]
    speech_s = sum(b - x for s, x, b in plan if not s["id"].startswith("cta")) or 1.0
    cta_words = words_in(follow(line_t)) + (words_in(follow(second_t)) if len(cta_ids) > 1 else 0)
    beats, vo_n, shots, script = [], 0, [], []
    channel_label = f"{name} · Season {season}"
    what = {"short": f"Episode {number}", "premium": f"Episode {number}", "part": f"Part {part_of[0]} of {part_of[1]}", "long": "Long video"}[kind]
    label_ai = "narrated by a synthetic voice (labelled as AI)" if vkind == "tts" else \
        f"narrated by {'the owner' if vkind == 'owner' else 'a guest'} (an AI voice stands in, labelled as AI, until the recording arrives)"
    script += [f"# {channel_label} · {what}: \"{title}\" (skeleton: every vo line is a TODO; fact-check before any render)", "",
               f"About {D:g} s ({mmss(D)}), {aspect} ({native[0]}x{native[1]} native), {label_ai}. Pace: {wpm:g} words a minute, so about {total_words} words in all.",
               f"One question: {a.topic.strip()}",
               f"Written by films/channels/studio/tools/new_episode.py on {a.today}. The master spec is episode.json; the shots are in shots.json.",
               "Format: kits/cinema/script/README.md (one heading per beat, one `vo:` line per beat, `*stars*` on the words that get a camera landing or a sound,",
               "a claim tag after every factual sentence, a dash tag after a sentence that states nothing outside the film). Story: kits/cinema/script/WRITING.md.",
               "The windows are the plan. The measured voice replaces them.", ""]
    for i, (s, x, b) in enumerate(plan):
        is_cta = s["id"].startswith("cta")
        text = follow(line_t if s["id"] != "cta2" else second_t)
        n_words = words_in(text) if is_cta else max(1, int(round((total_words - cta_words) * (b - x) / speech_s)))
        vo_n += 1
        line_id = f"vo{vo_n:02d}"
        sid = f"S{i + 1:02d}"
        beats.append({"id": s["id"], "purpose": s["purpose"], "seconds": [num(x), num(b)], "words": n_words, "lines": [line_id]})
        direction = " · ".join(p for p in (f"shot {sid}: TODO what the picture shows", s["extra"], f"energy: {s['energy']:g}", f"about {n_words} words") if p)
        script.append(f"## {s['id']} {{{direction}}} ({num(x):.1f}–{num(b):.1f} s)")
        if is_cta:
            script.append(f"vo: {text} {{-}}")
        elif kind == "part" and s["id"] == "tease":
            script.append(f"vo: Part {part_of[0]} of {part_of[1]}. {{-}} Full video on YouTube. {{-}}")
            script.append(f"end card: \"Part {part_of[0]} of {part_of[1]}\" · \"Full video on YouTube\" · footnote: \"{channel_label}\"")
        else:
            script.append(f"vo: TODO {s['purpose']} {{-}}")
            if i == len(plan) - 1 and "end card" in s["extra"]:
                foot = "Narration: synthetic voice (AI)." if vkind == "tts" else "TODO (owner): the narrator's credit, or leave it out"
                script.append(f"end card: \"TODO the next question\" · \"{channel_label}\" · footnote: \"{foot}\"")
        script.append("")
        first, last = i == 0, i == len(plan) - 1
        ident = identity.get("identity") if isinstance(identity.get("identity"), dict) else {}
        qa = ["The subject stays inside the safe box on every frame.", "Captions read at 4.5:1 or better over this shot.",
              "At most 3 flashes a second.", "The first frame matches the previous shot's last frame." if not first else "Frame 0 is already composed and works as the poster."]
        if is_cta:
            qa.append("The like/follow line shows as a normal caption: no button graphic, no arrow, no like-button sound.")
        shots.append({
            "id": sid, "beat": s["id"], "purpose": s["purpose"], "seconds": [num(x), num(b)], "aspect": aspect,
            "camera": {"preset": "TODO: pick a camera preset from films/channels/studio/SHOTS.md",
                       "from": "TODO: where the camera is and what it looks at on the first frame",
                       "to": "TODO: the same for the last frame",
                       "lens": "TODO: field of view in degrees, and what is in focus"},
            "subject": "TODO: the one thing the eye is on",
            "motion": "TODO: what moves in the world, and on which spoken word it lands",
            "lighting": f"TODO. Channel lighting: {ident.get('lighting', 'see the identity file')}",
            "environment": f"TODO. Look: {look['summary']}",
            "materials": f"TODO. Channel materials: {ident.get('materials', 'see the identity file')}",
            "principle": "TODO: the science this shot shows, matching the claims listed",
            "startState": "TODO: the first frame" if not first else "TODO: frame 0, already composed",
            "endState": "TODO: the last frame; the next shot starts here",
            "transitionIn": "open" if first else "motivated push: TODO choose the join from SHOTS.md and say what motivates it",
            "transitionOut": ("close: TODO say how the last frame ends (use loop when it returns to frame 0)" if last
                              else "motivated push: TODO choose the join from SHOTS.md and say what motivates it"),
            "narration": [line_id],
            "sound": f"TODO. Channel sound: {require(identity, 'sound.foley') or 'see the identity file'}",
            "assets": [], "claims": [], "qa": qa, "status": "planned",
        })

    first_cta = next(bt for bt in beats if bt["id"].startswith("cta"))
    cta = {"line": follow(line_t), "at": {"long": "After the first big payoff (about 2 to 3 minutes in), and again in the finale before the end card."}.get(
               kind, "Right after the payoff, about 70 to 85% through; never in the first 20 s."),
           "seconds": first_cta["seconds"], "section": found or section,
           "variants": {"follow": follow(line_t), "subscribe": subscribe(line_t)}}
    if kind == "long":
        cta["moments"] = [{"line": follow(t), "at": at, "seconds": bt["seconds"]} for t, at, bt in zip(
            (line_t, second_t), ("After the first big payoff, then back to the story.", "In the finale, before the end card."),
            [bt for bt in beats if bt["id"].startswith("cta")])]

    recording = "not needed" if vkind == "tts" else "waiting"
    ai_voice = True
    if vkind != "tts":
        assumptions.append("disclosures.aiVoice starts true because an AI voice stands in until the recording arrives. Set it false once the real recording is in every line.")
    assumptions.append("disclosures.aiVisuals is " + ("true because the season look's notes mention AI illustrations." if ai_visuals
                       else "false. Set it true as soon as any AI-made image appears in the picture (SHOTS.md, owner-made AI art)."))
    question = a.topic.strip() if a.topic.strip().endswith("?") else f"TODO: the one question this episode answers (topic: {a.topic.strip()})"
    if a.topic.strip().endswith("?"):
        assumptions.append("The question is the topic as typed, because it ends in a question mark.")
    sound = dict(identity.get("sound")) if isinstance(identity.get("sound"), dict) else {}

    episode = {
        "version": 1, "id": ep_id, "channel": slug, "season": season, "number": number, "folder": folder,
        "title": title, "topic": a.topic.strip(), "question": question,
        "hook": "TODO: the first line and the first picture", "payoff": "TODO: what the viewer knows or feels at the end",
        "format": fmt, "voice": voice, "look": look, "sound": sound,
        "story": {"beats": beats},
        "files": {"script": "script.md", "claims": "claims.json", "shots": "shots.json",
                  "packaging": "packaging.json" if kind == "long" else "out/packaging.json"},
        "cta": cta,
        "status": {"stage": "concept", "lookGate": "pending", "sources": "open", "title": "working", "recording": recording},
        "disclosures": {"aiVoice": ai_voice, "aiVisuals": ai_visuals},
        "assumptions": assumptions,
        "created": a.today,
        "generatedBy": f"new_episode.py --channel {slug} --topic \"{a.topic.strip()}\" --duration {a.duration} --format {kind}",
    }
    if kind == "part":
        episode["partOf"] = {"film": "TODO: the long film's id or its compilations/ folder name", "part": part_of[0], "of": part_of[1]}
    shots_doc = {"version": 1, "episode": ep_id,
                 "journey": "TODO: one or two sentences: the whole camera path, start to end.",
                 "continuity": ["TODO: what stays the same in every shot (light direction, the readout's place, the direction of travel)."],
                 "shots": shots}
    ctx = dict(identity=identity, name=name, slug=slug, kind=kind, D=D, where=where, deliver=deliver, folder=folder, vkind=vkind, segment=segment,
               season=season, number=number, title=title, part_of=part_of, long_style=long_style, id_dir=a.identities, ep_id=ep_id)
    return episode, shots_doc, "\n".join(script).rstrip() + "\n", ctx, broken


def next_steps(ep, ctx):
    I, kind, name, slug, folder = ctx["identity"], ctx["kind"], ctx["name"], ctx["slug"], ctx["folder"]
    idf = f" --identities {ctx['id_dir']}" if ctx["id_dir"] else ""
    seg = f" --segment {ctx['segment']}" if ctx["segment"] else ""
    person = ctx["vkind"] != "tts"
    docs = sorted(p.name for p in STUDIO.glob("*.md"))
    L = [f"# Next steps: {ep['id']} · {name} · \"{ep['title']}\"", "",
         f"{kind.capitalize()}, {ep['format']['aspect']}, target {ctx['D']:g} s. Written by new_episode.py on {ep['created']}.",
         f"Where it goes: `{ctx['where']}` on the branch `{I.get('branch', '?')}`. Move this folder there before building; the copies of the channel folders on other branches are old.",
         "", "Who: **Agent** = a builder or coordinator agent. **Owner** = the channel owner. **Reviewer** = the channel's expert reviewer.",
         "Work top to bottom. A step is done only when its check passes.", "",
         "## Read first", "",
         "- `episode.json`, section \"assumptions\": everything this tool guessed. Fix what is wrong before anything else.",
         "- Channel rules: `films/channels/studio/identities/" + slug + ".json` (\"rules\" and \"never\" are binding).",
         "- The blueprint: `films/channels/studio/`" + (" (" + ", ".join(docs) + ")" if docs else "") + ".",
         "- Shared rules: `films/channels/SEASON-FORMAT.md`, `films/channels/PACKAGING.md`, `films/channels/CTA.md`, `kits/cinema/script/WRITING.md`.", "",
         "## 1. Concept (Agent, then Owner)", "",
         "- [ ] Replace the TODOs in `episode.json`: `question`, `hook`, `payoff`. One story, one question.",
         "- [ ] Owner confirms the topic and the working title. The final title is chosen at the packaging step.", "",
         "## 2. Research and claims (Agent, then a person)", "",
         "- [ ] Write `claims.json`: one entry per fact, in the fields of `kits/cinema/script/README.md` (\"claims.json\").",
         "- [ ] Record `verified_via` honestly. A claim checked from a search excerpt stays open (`TODO open link`).",
         "- [ ] Every number that is computed gets its arithmetic in a `calc.py` beside the script" + (" (the channel's rule: every number on screen comes from calc.py)." if slug == "whatif" or kind == "long" else "."),
         "- [ ] A person opens every source. Only then set `status.sources` to `ok`. Never invent a statistic, a study or a quote.", "",
         "## 3. Script and lint (Agent)", "",
         "- [ ] Write the `vo:` lines in `script.md`, inside each beat's word budget. Tag every factual sentence with its claim id.",
         f"- [ ] `python3 -I kits/cinema/script/lint.py <this folder>{seg}`",
         ]
    if kind != "short":
        L.append(f"  The lint is built for 60 to 75 s shorts. For a {kind} it reports the length, pace and template differently from what this format needs; fix what applies to the words and the claims, and list the rest in the handoff. Per-format lint profiles are on the roadmap.")
    L += ["  The lint also warns on the like/follow line's wording; that line comes from CTA.md and stays.",
          "- [ ] Read it aloud at the narrator's pace (WRITING.md, \"The read-aloud test\").", ""]
    n = 4
    if person:
        who = "the owner" if ctx["vkind"] == "owner" else "the guest"
        L += [f"## {n}. Recording script (Agent, then Owner)", "",
              f"The voice is {who}'s. Do this as soon as the script passes fact-check, so the build never waits on it.", "",
              "- [ ] Make the season's recording script with `films/channels/voice-scripts/make_recording_script.py` (one session per season, 7 to 10 minutes of reading).",
              "- [ ] The coordinator passes it to the owner. The studio never contacts a guest directly; the owner gets their written OK.",
              "- [ ] Until the recording arrives, an AI voice stands in and every draft is labelled as AI. Never an AI copy of a guest's voice.",
              "- [ ] When it arrives: cut it into lines, rebuild the captions from it, set `status.recording` to `received` and `disclosures.aiVoice` to match what is in the file.", ""]
        n += 1
    look_status = str(ep["look"].get("status") or "not recorded")
    L += [f"## {n}. Look gate (Owner)", "",
          f"- [ ] The season look is \"{look_status}\" in the identity file. If it is not approved, nothing else is built: make one still in the look"
          + (" and a 10 s test clip" if slug == "skincare" else "") + " and get the owner's yes. The coordinator then updates the identity file.",
          "- [ ] Any reference picture the owner makes by hand follows `films/channels/studio/SHOTS.md` (\"Reference frames\" and \"Owner-made AI art\").",
          "- [ ] This episode's own gate comes at the build step: the owner sees its stills before the full render, and only the owner sets `status.lookGate` to `approved`.", ""]
    n += 1
    L += [f"## {n}. Shots (Agent)", "",
          "- [ ] Plan the film as one continuous journey: `films/channels/studio/SHOTS.md`. Split each beat's placeholder shot into real shots and fill every field.",
          f"- [ ] `python3 -I films/channels/studio/tools/validate.py <this folder>{idf}` passes with no problem.", ""]
    n += 1
    L += [f"## {n}. Build (Agent, on the channel's branch)", "",
          "- [ ] Stills first: render the hook, the payoff and the last frame with the final finish, and show them to the owner."
          + (" Skin Sense: plus a 10 s test clip." if slug == "skincare" else ""),
          "- [ ] No full render until the owner has set `status.lookGate` to `approved`. `changes-requested` means revise and show again.",
          f"- [ ] In `{ctx['where']}`: the compile step writes `film.json` from the script and the measured voice; nothing in it is a hand-typed time.",
          f"- [ ] Copy `disclosures` from `episode.json` into `film.json` (`disclosures.aiVisuals`, `disclosures.aiVoice`).",
          f"- [ ] Season 2 build order on this channel, as audited on 11 Nov 2026 (a new season may differ; check the branch):",
          f"  {BUILD_ORDER.get(slug, 'see kits/cinema/script/README.md and kits/cinema/film/README.md')}.",
          "- [ ] One render job per machine. Long renders resume with `kits/cinema/film/run.sh <folder>`.", ""]
    if kind == "long":
        L += ["Long video:", "",
              f"- [ ] Work in `{ctx['where']}` (Prism's push skips it). Finished files go to `{ctx['deliver']}`: `{folder}-16x9.mp4`, `thumbnail.jpg`, `chapters.txt`, `description.md`, `qa.json` and a copy of `packaging.json`.",
              "- [ ] One video file in the delivery folder: the 2560x1440 upload. Its picture is rendered at 1920x1080 and upscaled; say so, never call it native.",
              "- [ ] Every line of `chapters.txt` equals one part's title exactly, or Prism links nothing.",
              "- [ ] At least 8:30, by real content: an opening, bridges, a finale. Never slowed footage, silence, long holds or recaps.", ""]
    if kind == "part":
        L += ["Part:", "",
              "- [ ] It is cut from the long film's own 9:16 render, never a crop of the 16:9.",
              "- [ ] Its title equals its line in the long film's `chapters.txt` exactly. Set `partOf.film` in `episode.json`.",
              "- [ ] The last part stops just before the payoff. The payoff belongs to the long film.", ""]
    n += 1
    L += [f"## {n}. QA (Agent, then Reviewer)", "",
          "- [ ] `python3 -I kits/cinema/film/qa.py <folder>` on the delivered file (format, sync, length, loudness, true peak, flashes).",
          ]
    if kind == "premium":
        L.append("  Its 60 to 75 s length gate fails a 70 to 90 s lesson until a per-format profile exists; report that failure, do not hide it.")
    if kind == "long":
        L.append("  A long video is measured by `kits/cinema/film/compilation.mjs` into `qa.json` instead.")
    L += ["- [ ] The quality gate (a) to (h) in `films/channels/STUDIO-STYLE.md`: nothing under 3; (a), (g) and (h) at 4 or more; nothing factual or ethical open.",
          "- [ ] The internal 100-point rubric in `films/channels/studio/QA.md` (target 95). It is an internal assessment: never public, never a prediction.",
          f"- [ ] `validate.py` again, with `status.stage` set to `qa`: it now fails on any TODO left in `episode.json`.",
          "- [ ] Report only what was measured. Never claim a technique, a resolution or a number the engine did not deliver.", ""]
    n += 1
    L += [f"## {n}. Packaging (Agent, then Owner)", "",
          f"- [ ] Write `{ep['files']['packaging']}`: five titles, three thumbnails, three pairings, every check true (`films/channels/PACKAGING.md`).",
          "- [ ] The title and the thumbnail claim no more than the script. Scores are judgments, not predictions.",
          "- [ ] The owner picks the title. Then set `title` in `episode.json` and `status.title` to `chosen`.", ""]
    n += 1
    L += [f"## {n}. Push and post (Agent, then Owner)", "",
          "- [ ] Check Prism has this season's slate, or the folder imports nothing (`prism-studio/scripts/import-episodes.ts`).",
          f"- [ ] From the channel's own branch checkout: `node prism-studio/scripts/push-media.mjs {slug}` (see `prism-studio/RUNBOOK.md`). The cover must be newer than the mp4.",
          "- [ ] The owner reviews in Prism and posts by hand. Nothing posts without the owner." + (" The long film goes up first, then one part a day." if kind in ("part", "long") else ""),
          "- [ ] List every TODO and every open claim in the handoff.", ""]
    n += 1
    L += [f"## {n}. After it posts (Agent)", "",
          "- [ ] Write the Episode Intelligence Report in `review/intelligence-report.md` (`films/channels/studio/STRUCTURE.md`, section 9): measured results kept apart from hypotheses, no invented numbers.",
          "- [ ] Set `status.stage` to `archive` once the files are stored.", ""]
    rules = [str(x) for x in I.get("rules", []) if isinstance(x, str)]
    never = [str(x) for x in I.get("never", []) if isinstance(x, str)]
    if rules or never:
        L += [f"## {name}: binding rules (from the identity file)", ""]
        L += [f"- {x}" for x in rules]
        L += [f"- Never: {x}" for x in never]
        L.append("")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Create a new episode folder from a channel, a topic, a target length and a format.")
    ap.add_argument("--channel", required=True, help="channel slug, name or prefix (skincare, \"Skin Sense\", ss)")
    ap.add_argument("--topic", required=True, help="the subject, in plain words")
    ap.add_argument("--duration", required=True, help="target length in seconds, or m:ss")
    ap.add_argument("--format", required=True, choices=KINDS)
    ap.add_argument("--season", type=int, help="season number (default: the newest season look in the identity)")
    ap.add_argument("--number", type=int, help="place in the season, or the part number (default 1; 0 for a long film)")
    ap.add_argument("--title", help="working title (default: the topic)")
    ap.add_argument("--out", help="folder to write (default: ./new-episodes/<prefix>-<topic>/)")
    ap.add_argument("--identities", help="folder of channel identity files (default: films/channels/studio/identities)")
    ap.add_argument("--force", action="store_true", help="accept a length outside the format's window, or a format the identity does not list")
    ap.add_argument("--overwrite", action="store_true", help="write into a folder that already has files")
    a = ap.parse_args(argv)
    a.today = datetime.date.today().isoformat()
    try:
        if a.season is not None and a.season < 1:
            raise Stop("--season starts at 1")
        if a.number is not None and not 0 <= a.number <= 99:
            raise Stop("--number is between 0 and 99")
        if len(a.topic.strip()) < 3:
            raise Stop("--topic needs at least three characters")
        episode, shots, script, ctx, broken = build(a)
        out = Path(a.out) if a.out else Path("new-episodes") / f"{ctx['identity']['prefix']}-{slugify(a.topic)}"
        if out.exists() and any(out.iterdir()) and not a.overwrite:
            raise Stop(f"{out} already has files. Pick another --out, or pass --overwrite.")
    except Stop as e:
        print(f"new_episode: {e}", file=sys.stderr)
        return 2

    (out / "out").mkdir(parents=True, exist_ok=True)
    dump = lambda d: json.dumps(d, indent=2, ensure_ascii=False) + "\n"
    (out / "episode.json").write_text(dump(episode), encoding="utf-8")
    (out / "shots.json").write_text(dump(shots), encoding="utf-8")
    (out / "claims.json").write_text("[]\n", encoding="utf-8")
    (out / "script.md").write_text(script, encoding="utf-8")
    (out / "out" / ".gitkeep").write_text("", encoding="utf-8")
    (out / "NEXT-STEPS.md").write_text(next_steps(episode, ctx), encoding="utf-8")

    f = episode["format"]
    print(f"new_episode: wrote {out}/")
    print(f"  {episode['id']} · {ctx['name']} · {f['kind']} · {f['aspect']} · target {f['targetS']:g} s (window {f['durationS'][0]:g} to {f['durationS'][1]:g} s)"
          f" · {len(episode['story']['beats'])} beats · voice: {episode['voice']['kind']} ({episode['voice']['id']})")
    print("  files: episode.json, script.md, shots.json, claims.json, out/.gitkeep, NEXT-STEPS.md")
    for b in broken:
        print(f"  note: an identity file could not be read and was skipped: {b}")
    print("Assumed (also in episode.json \"assumptions\"):")
    for line in episode["assumptions"]:
        print(f"  - {line}")
    res = V.run(out, identities=a.identities)
    if res["fatal"]:
        print(f"validate: {res['fatal']}", file=sys.stderr)
        return 1
    for line in res["errors"] + res["warnings"]:
        print(line)
    print(f"validate: {'OK' if not res['errors'] else str(len(res['errors'])) + ' problems'}, {len(res['warnings'])} warnings ({res['info']})")
    print(f"Next: open {out / 'NEXT-STEPS.md'}")
    return 1 if res["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())

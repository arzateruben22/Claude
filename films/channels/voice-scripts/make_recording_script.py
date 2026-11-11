"""Build the owner's recording script for one season, in the standard four-part layout (owner's rule, 10 Nov 2026:
"use this script for all future episodes"). One recording session per season, 7-10 minutes of reading (owner, 11 Nov 2026):
the script prints a warning above 10 minutes, so trim the narration (cut repeated or decorative lines, never a fact the
story needs) before sending it. The long video itself must still run at least 8:30.

  Part A  the long video's narration (one file)
  Part B  the 8 short parts' 2-second openings (+ their cliffhangers when they are not already in Part A)
  Part C  the closers "Part N of eight. Full video on YouTube." (record once, reused by every season and channel)
  Part D  two like / follow lines, each read twice: "follow" then "subscribe" (rotates through CTA.md by season)

Usage (run from the repo root, with the season's script checked out or exported to a file):
  python3 -I films/channels/voice-scripts/make_recording_script.py \
      --channel space --season 3 --title "The Moon Starts Coming Closer. It Won't Stop." \
      --script path/to/long01/script.md [--parts path/to/voice-lines.md --parts-section "Season 3"] \
      --cta films/channels/CTA.md --out films/channels/voice-scripts/one-more-orbit-season-3-recording-script.md

Script formats it reads:
  * chapter style (One More Orbit, Reality Rulebook lf01): lines starting  bridge: / vo: / loop:  are the long narration
    in file order; lines starting  hook:  are the parts' openings (the loops double as the parts' cliffhangers).
  * plain style (Possibility Lab): every  vo:  line is the long narration; the parts' openings and cliffhangers come from
    --parts, a file with lines like   1. Hook: "..." / Outro: "..."
Inline tags {c1}, {-}, {|} are stripped; *word* becomes **word** (the stress mark).
"""
import argparse
import re
import sys
from pathlib import Path

CHANNELS = {
    "whatif": dict(name="Possibility Lab", prefix="pl", branch="claude/whatif-s2", cta="Possibility Lab",
                   wpm=155, tone="You're a friend working out a wild puzzle out loud: curious, a little amused, never lecturing."),
    "space": dict(name="One More Orbit", prefix="oo", branch="claude/space-s2", cta="One More Orbit", wpm=135,
                  tone="Quiet awe. Slower and softer than Possibility Lab, as if you're standing outside at night telling "
                       "one friend what you can see. Let the big numbers land, then breathe."),
    "physics": dict(name="Reality Rulebook", prefix="rr", branch="claude/physics-s2", cta="Reality Rulebook", wpm=150,
                    tone="Crisp and curious, like you're slowing a moment down on purpose so a friend can see it."),
    "skincare": dict(name="Skin Sense", prefix="ss", branch="claude/outer-layer-s1-b", cta="Skin Sense (ASMR, Season 3 on)", wpm=115,
                     tone="ASMR (Season 3 on, Evelyn): soft-spoken, close and unhurried, a light whisper is fine if every word stays clear. "
                          "Slower than feels natural; steady volume; the last line of each lesson softest of all."),
}
WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight"]
WPM = 150          # default reading pace, pauses included; each channel sets its own (its tone sets the pace)
MAX_MIN = 10       # the owner's cap for one session


def clean(s: str) -> str:
    s = re.sub(r"\{[^}]*\}", "", s)
    s = re.sub(r"\*([^*]+)\*", r"**\1**", s)
    return re.sub(r"\s+", " ", s).strip()


def read_script(path: Path):
    narration, hooks = [], []
    for raw in path.read_text().splitlines():
        m = re.match(r"^(bridge|vo|loop|hook):\s*(.*)$", raw)
        if not m:
            continue
        kind, text = m.group(1), clean(m.group(2))
        if not text:
            continue
        (hooks if kind == "hook" else narration).append(text)
    return narration, hooks


def read_parts(path: Path, section: str = ""):
    pairs, inside = [], not section
    for raw in path.read_text().splitlines():
        if section and raw.startswith("#"):
            inside = section.lower() in raw.lower()
            continue
        if not inside:
            continue
        m = re.match(r'^\s*\d+\.\s*Hook:\s*"(.+?)".*?Outro:\s*"(.+?)"', raw)
        if m:
            pairs.append((clean(m.group(1)), clean(m.group(2))))
    return pairs


def read_cta(path: Path, channel_label: str):
    text = path.read_text()
    after = text.split(f"**{channel_label}**", 1)[1]
    block = after.split("\n\n", 1)[0]
    lines = [re.sub(r"^\d+\.\s*", "", l).strip() for l in block.splitlines()[1:] if re.match(r"^\d+\.", l.strip())]
    if not lines:
        sys.exit(f"no CTA lines for {channel_label} in {path}")
    return lines


def build(a) -> str:
    ch = CHANNELS[a.channel]
    p = ch["prefix"]
    upload = f"https://github.com/arzateruben22/claude/upload/{ch['branch']}/films/channels/{a.channel}/voice-owner"
    narration, hooks = read_script(Path(a.script))
    pairs = read_parts(Path(a.parts), a.parts_section or "") if a.parts else []
    every = read_cta(Path(a.cta), ch["cta"])
    k0 = ((a.season - 1) * 2) % len(every)
    cta = (every + every)[k0:k0 + 2]   # two lines a season, rotating
    n = lambda xs: "\n".join(f"**{i}.** {x}\n" for i, x in enumerate(xs, 1))
    out = [f"# {ch['name']} Season {a.season}: your recording script", "",
           f"Season {a.season} is one long video, “{a.title}”, cut into 8 short parts. This is everything you read for it.",
           "The words match what's on screen, so read them as written (every fact is checked before it posts). If a phrase doesn't",
           "feel natural in your mouth, say which line and it gets reworded and re-checked (the captions are rebuilt from your",
           "recording, so they'll match what you say).", "",
           "{TIME}", "",
           "### How to record",
           "- **Room:** quiet, with soft stuff around you (a closet of clothes or a bedroom is great; a bathroom or kitchen echoes).",
           "- **Phone:** Voice Memos is fine. Hold it **about a hand's width (15–20 cm) from your mouth**, slightly to the side. Same spot every session.",
           "- **Pauses:** 2 seconds between lines. Flubbed one? Pause, then read **that whole line again**; the last take is kept.",
           f"- **Start each file by saying its name**, e.g. *“{ch['name']}, Season {a.season}, long video”*.",
           f"- **Files:** `{p}-s{a.season}.m4a` (Part A), `{p}-s{a.season}-parts.m4a` (Part B), `part-closers.m4a` (Part C, once ever) and "
           f"`{p}-s{a.season}-cta.m4a` (Part D). One long file is fine too: say each part's name before it.",
           f"- **Upload:** {upload}", "",
           "### How it should sound", ch["tone"],
           "- **Bold words** are the punch of the line: lean on them a bit. Say numbers slowly; they're the payoff.",
           "- Cliffhangers (the last line of each chapter) hang: a little slower, with a lift at the end.", "", "---", "",
           f"## Part A. The long video: “{a.title}”",
           f"File: `{p}-s{a.season}.m4a`. Read straight through; take a breath between lines.", "", n(narration), "---", "",
           "## Part B. The 8 short parts' openings",
           f"File: `{p}-s{a.season}-parts.m4a`. Each part opens with its own 2-second line. Read them in order, with a 2-second pause between them."]
    if pairs:
        out.append("Each part also gets its own cliffhanger, read right after its opening.\n")
        for i, (h, o) in enumerate(pairs, 1):
            out += [f"**Part {i}, opening.** {h}", "", f"**Part {i}, cliffhanger.** {o}", ""]
    else:
        out.append("(The parts' cliffhangers are already in Part A, so there's nothing else to read here.)\n")
        out += [f"**Part {i}.** {h}\n" for i, h in enumerate(hooks, 1)]
    out += ["---", "", "## Part C. The closers (once ever: skip if you've recorded them)",
            "File: `part-closers.m4a`. Every season and channel reuses them.", ""]
    out += [f"**{i}.** Part {w} of eight. Full video on **YouTube**.\n" for i, w in enumerate(WORDS, 1)]
    out += ["---", "", f"## Part D. The like and follow lines",
            f"File: `{p}-s{a.season}-cta.m4a`. Each line twice: “follow” (TikTok, Instagram), then “subscribe” (YouTube).", ""]
    k = 1
    for line in cta:
        for verb in ("follow", "subscribe"):
            out.append(f"**{k}.** " + line.replace("{follow}", f"**{verb}**") + "\n")
            k += 1
    words = (sum(len(x.split()) for x in narration) + sum(len(h.split()) + len(o.split()) for h, o in pairs)
             + sum(len(h.split()) for h in hooks) + 8 * 6 + sum(len(l.split()) for l in cta) * 2)
    wpm = ch.get("wpm", WPM)
    mins = words / wpm
    if mins > MAX_MIN:
        print(f"WARNING: about {mins:.1f} minutes of reading, over the {MAX_MIN}-minute cap: trim the narration", file=sys.stderr)
    time = (f"**About {round(mins * 2) / 2:g} minutes of reading in one session** (about {round((mins - 8 * 6 / wpm) * 2) / 2:g} if you've "
            "already recorded the closers). Until you record, an AI voice stands in; the builder swaps yours in when the files land.")
    out += ["---", "", "*Thanks! Upload the files and that's it.*", ""]
    return "\n".join(out).replace("{TIME}", time)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", required=True, choices=sorted(CHANNELS))
    ap.add_argument("--season", required=True, type=int)
    ap.add_argument("--title", required=True)
    ap.add_argument("--script", required=True)
    ap.add_argument("--parts")
    ap.add_argument("--parts-section", help="only read --parts lines under a heading containing this text, e.g. \"Season 3\"")
    ap.add_argument("--cta", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    Path(a.out).write_text(build(a))
    print("wrote", a.out)

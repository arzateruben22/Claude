"""Build the owner's recording script for one season, in the standard four-part layout (owner's rule, 10 Nov 2026:
"use this script for all future episodes").

  Part A  the long video's narration (one file)
  Part B  the 8 short parts' 2-second openings (+ their cliffhangers when they are not already in Part A)
  Part C  the closers "Part N of eight. Full video on YouTube." (record once, reused by every season and channel)
  Part D  the like / follow lines, each read twice: "follow" then "subscribe" (record once per channel)

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
                   tone="You're a friend working out a wild puzzle out loud: curious, a little amused, never lecturing."),
    "space": dict(name="One More Orbit", prefix="oo", branch="claude/space-s2", cta="One More Orbit",
                  tone="Quiet awe. Slower and softer than Possibility Lab, as if you're standing outside at night telling "
                       "one friend what you can see. Let the big numbers land, then breathe."),
    "physics": dict(name="Reality Rulebook", prefix="rr", branch="claude/physics-s2", cta="Reality Rulebook",
                    tone="Crisp and curious, like you're slowing a moment down on purpose so a friend can see it."),
    "skincare": dict(name="Skin Sense", prefix="ss", branch="claude/outer-layer-s1-b", cta="Skin Sense",
                     tone="Bright, warm and genuinely excited, like you can't wait to show someone what their skin just did."),
}
WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight"]


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
    cta = read_cta(Path(a.cta), ch["cta"])
    n = lambda xs: "\n".join(f"**{i}.** {x}\n" for i, x in enumerate(xs, 1))
    out = [f"# {ch['name']} Season {a.season}: your recording script", "",
           f"Season {a.season} is one long video, “{a.title}”, cut into 8 short parts. This is everything you read for it.",
           "The words are exactly what's on screen and what has been fact-checked, so read them as written. If a phrase doesn't",
           "feel natural in your mouth, say which line and it gets reworded and re-checked (the captions are rebuilt from your",
           "recording, so they'll match what you say).", "",
           "### How to record (5 minutes of setup, then it's easy)",
           "- **Room:** quiet, with soft stuff around you (a closet of clothes or a bedroom is great; a bathroom or kitchen echoes).",
           "- **Phone:** Voice Memos is fine. Hold it **about a hand's width (15–20 cm) from your mouth**, slightly to the side. Same spot every session.",
           "- **Pauses:** 2 seconds between lines. Flubbed one? Pause, then read **that whole line again**; the last take is kept.",
           f"- **Start each file by saying its name**, e.g. *“{ch['name']}, Season {a.season}, long video”*.",
           f"- **Files:** `{p}-s{a.season}.m4a` (Part A), `{p}-s{a.season}-parts.m4a` (Part B), `part-closers.m4a` (Part C, once ever) and "
           f"`{p}-cta.m4a` (Part D, once per channel).",
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
    out += ["---", "", "## Part C. The closers (record once ever; every season and channel reuses them)",
            "File: `part-closers.m4a`. Already recorded? Skip this part.", ""]
    out += [f"**{i}.** Part {w} of eight. Full video on **YouTube**.\n" for i, w in enumerate(WORDS, 1)]
    out += ["---", "", f"## Part D. The like and follow lines (record once for {ch['name']})",
            f"File: `{p}-cta.m4a`. Already recorded for {ch['name']}? Skip this part. Each line twice: “follow” (TikTok, Instagram), then “subscribe” (YouTube).", ""]
    k = 1
    for line in cta:
        for verb in ("follow", "subscribe"):
            out.append(f"**{k}.** " + line.replace("{follow}", f"**{verb}**") + "\n")
            k += 1
    words = sum(len(x.split()) for x in narration) + sum(len(h.split()) + len(o.split()) for h, o in pairs) + sum(len(h.split()) for h in hooks)
    out += ["---", "", f"*About {round(words / 2.3 / 60 + 3)} minutes of reading. Until you record, an AI voice stands in; the builder swaps yours in when the files land.*", ""]
    return "\n".join(out)


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

# Outer Layer season 1, v2: research and script brief

The owner is rebooting Outer Layer. Their note: "the designs are too boring and the facts need to be more
compelling." This folder holds the research and scripts for the new six episodes. The look is being made
separately, so a script here can name a shot idea but must not depend on any particular design.

## Each topic folder: `s1v2/<topic>/`

- **`claims.json`** has one entry per factual claim, in the same schema as
  `films/channels/skincare/ep05/claims.json`: `id`, `sentence`, `claim`, `source_url`, `source_title`,
  `accessed`, `note`, `verified_via`, `status`.
  - **Sources:** prefer dermatology bodies (AAD, BAD), NIH (StatPearls, NCI, MedlinePlus), WHO and IARC, and
    peer-reviewed papers (PubMed or PMC).
  - **Numbers:** verify every number against the source and hedge it exactly as the source does ("about", "up
    to", "in one trial").
  - **`verified_via`:** record honestly how you checked the claim (`search excerpt` or `page`). Page fetches
    may be blocked by the proxy; say so if they are.
  - **`note`:** quote the excerpt you relied on.
- **`research.md`** covers:
  - the three or four strongest angles, each in one line;
  - the angle you chose, and why it stops a scroll;
  - the key numbers with their sources;
  - any disputed or uncertain points;
  - what a dermatologist must check.
- **`script.md`** follows the format of `films/channels/skincare/ep05/script.md`, copied exactly:
  - the header paragraph and the honesty notes;
  - beats `## hook {...}`, `normal`, `change`, `why`, `whoa`, `toscale {segment: toscale ...}`, `takeaway` and
    `tease` (with an `end card:` line);
  - one `vo:` line per beat;
  - `{c1}` claim tags and `{-}` for sentences that state nothing outside the film;
  - `*starred*` landing words;
  - a `## Notes` section.
- **The rules for the script** are in `kits/cinema/script/WRITING.md` (read it all, the Flow section
  especially) and in `films/channels/skincare/bible.md` §6 (template), §8 (honesty) and §9 (risks):
  - 150–180 words, 66–75 s;
  - the hook spoken by 2 s;
  - one thread with no restarts;
  - the voice carries the meaning and the screen the exact figures;
  - about four numbers spoken at most;
  - a person, a wrong idea or stakes in the why;
  - the takeaway calls back to the hook;
  - the "to scale" beat puts one size beside a sheet of paper (≈ 100 µm), or another everyday scale if the
    topic needs it, woven into the story rather than announced.
- **Lint:** the script must pass, warnings included:
  `python3 -I kits/cinema/script/lint.py films/channels/skincare/s1v2/<topic> --segment toscale`

## Hard lines

- **No advice.** Never tell the viewer to do anything or to buy anything. No product or brand claims. The
  biology and the evidence only, hedged as the sources are.
- **Sign-off.** Anything about treatment, sunscreen, tanning or a skin condition needs a dermatologist's
  sign-off; say so in the script's header.
- **No fake people.** No fake before/after of a real person. A projection is badged `model`.
- **Tone.** One curious person telling a friend. No hype words; `lint.py` lists them.
- **Tease.** Leave the `tease` line as a placeholder ("Next: …"); the season's tease chain is set later.
- **Git.** Don't commit or push; the builder does that.

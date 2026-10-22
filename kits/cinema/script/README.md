# kits/cinema/script: from script.md and claims.json to film.json

An episode starts as words and ends as one clock. The script says what is spoken and what the
picture does; the claims ledger says where every fact comes from; the voice measures how long it
all takes; and the episode's `compile.py` hangs every camera key, label and sound on those
measured words. Nothing in `film.json` is a hand-typed time.

| File | What it is |
|---|---|
| `lint.py` | Checks a script against the beat template and its claims ledger, before voicing and again after |
| `timeline.py` | `Film`: the script and the voice → beat layout, word anchors (`f.at("vo02:hair")`), captions, and `script_plan()` |
| `../voice/scriptfile.py` | The one parser everyone shares: beats, vo lines, stars, claim tags, directions |
| `<episode>/compile.py` | The episode's direction: shots, cues, camera and focus keys → `film.json` (+ `sheet.json` for the score) |

## The steps

```
E=films/channels/body/ep01                                   # script.md, claims.json, pron.json
python3 -I kits/cinema/script/lint.py $E --segment meanwhile        # 1. lint the words (no voice yet)
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/tts.py $E/script.md $E/vo --voice bf_emma --lexicon $E/pron.json
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py $E/vo  # 2. voice and word times (never during a render)
python3 -I kits/cinema/script/lint.py $E --segment meanwhile --bpm 75   # 3. lint again, on the measured voice
python3 -I $E/compile.py                                     # 4. film.json and sheet.json
node kits/cinema/film/render.mjs --film $E --tier animatic   # 5. T0, then the tiers in kits/cinema/film/README.md
python3 -I kits/cinema/script/lint.py $E --sources           # the source list for the post description
```

Each channel's segment, voice and tempo are in `films/channels/DECISIONS.md`: body `meanwhile`,
bf_emma, 75 BPM; space `readout`, am_michael, 56.25 BPM; physics `measure`, af_bella at
`--speed 0.95`, 112.5 BPM. Voice, alignment and lint with `--bpm` are light, but voicing still
waits for any render on the box to finish (`STUDIO-PLAN.md`: one job at a time).

## script.md

```
## whoa {shot: pullBack to a capillary net · picture-only 3.5 s · energy: 0.7} (39–52 s)
vo: The tightest are about three micrometers: less than *half its width*. {c10} And it squeezes
through them for its whole life: about *a hundred and twenty days*. {c11}
```

- **One beat per heading:** `## id {direction} (a–b s)`. The id names the beat (`hook`, `normal`,
  `change`, `why`, `whoa`, `takeaway`, `tease`, plus the channel's segment). The window is the
  plan in seconds; the voice replaces it later.
- **Direction** is free text split by `·`. These keys are read as numbers, by `lint.py` and by
  `Film.script_plan()` alike:

  | Write | Means |
  |---|---|
  | `pre: 0.1` | lead-in before the line (default 0.3 s; the hook uses 0.1 so its question lands by 2.0 s) |
  | `picture-only 2.5 s` | the hold after the line, picture and music only (default 0.4 s) |
  | `end card held ≥ 2 s` | on the last beat: how long the end card holds after the line |
  | `energy: 0.7` | the section's energy for the score |
  | `segment: meanwhile` | this beat is the channel's recurring segment |

- **One `vo:` line per beat**, then optionally `end card: "…" · "…"`.
- `*stars*` mark the words that get a camera landing or a sound hit (`f.at("vo05:half")`).
- **Claim tags.** `{c1}` or `{c1,c2}` right after a sentence ties it to claims.json. `{-}` says
  the sentence states nothing outside the film (framing, an instruction, or a description of the
  film's own picture, such as "slowed twenty times"). Claim ids are lower case and end in a
  number. `tts.py`, `align.py` and `timeline.py` never see a tag: `scriptfile.spoken()` removes
  every `{…}` group and every star, then collapses the spaces. Any other `{…}` in a vo line is
  direction and is dropped the same way.
- Spell numbers as they are spoken ("sixteen thirty-eight", "point four five seconds"). The voice
  reads digits its own way, and `norm()` maps digits to words only up to 100.

## claims.json

A list, one entry per claim. A sentence with two facts gets two entries; a claim cited by two
sentences gets two entries.

| Field | What it holds |
|---|---|
| `id` | `c1`, `c2`, … as tagged in the script |
| `sentence` | the sentence exactly as spoken: `scriptfile.spoken()` of the tagged sentence, no stars or tags |
| `claim` | the fact, stated precisely, with its numbers and units |
| `source_url`, `source_title` | where it was checked: the page, the publisher and, for a paper, authors, year and journal |
| `accessed` | the date it was checked, `YYYY-MM-DD` |
| `verified_via` | `"page"` (the page itself was read) or `"search excerpt"` (only a search result's excerpt was) |
| `status` | `"ok"`, `"needs-wording"` (the sentence says more than the source; fails the lint) or `"TODO open link"` (warns) |
| `note` | optional: the excerpt relied on, any arithmetic (marked "computed"), caveats and the cross-check fix it applies |

Record `verified_via` honestly. On this container the proxy blocks page fetches, so every claim in
the first three episodes says `"search excerpt"`, and a person opens each link before an episode
posts. A computed figure (a range, a light-time, a drop time) cites the source of its inputs and
shows the arithmetic in `note`.

## lint.py

`python3 -I kits/cinema/script/lint.py <episode folder> [--segment NAME] [--bpm N] [--wps 2.5] [--json] [--sources]`

| Check | Rule | Before voicing | After voicing |
|---|---|---|---|
| Template | hook first, tease last; whoa, takeaway and the segment present | error | |
| Words per beat | the bibles' ranges, merged (hook 8–14, why 24–44, …) | warning | |
| Pace | 2.2–3.0 words/s in every beat | words ÷ (window − lead-in − hold) | words ÷ the line's measured length |
| Length | 150–180 words; 60–75 s | the plan's last window, and words ÷ 2.5 | the lines laid out (with `--bpm`, by `timeline.py` on the grid) |
| Hook | a question, spoken by 2.0 s | syllables ÷ 3.8 a second, plus lead-in and pauses | the question's last word in words.json |
| Holds | why ≥ 2 s and whoa ≥ 3 s picture-only; end card ≥ 1.5 s and an `end card:` line | error | |
| Stars | balanced, around spoken words, at least one in the hook and the whoa | error | each found in words.json; those inside a phrase listed for a T0 check |
| Claims | every factual-looking sentence tagged; every id in the ledger with the same sentence; fields, dates, `verified_via`, status | error (`TODO open link` warns) | |
| Voice | lines.json matches the script; stars unchanged since voicing | | error / warning |
| pron.json | every entry is used and has a stress mark | warning | |

"Factual-looking" means the sentence has a number, a unit, a name inside the sentence, an absolute
("every", "only", "never") or a comparison ("than", "faster"). Questions never need a tag. The
heuristic errs toward asking; answer with a claim or `{-}`, never by rewording to dodge it.

Where the numbers come from:
- 2.0 s for the hook, 150–180 words and 60–75 s are `STUDIO-PLAN.md`'s and the bibles' templates.
- **3.8 syllables a second** is the median rate of the first sentence of each line in Skin School's
  measured voice (af_heart; 2.6–4.5 across its six lines). It is only an estimate; the voiced lint
  decides.
- **Kokoro speaks fast.** Skin School's af_heart lines ran 2.63–3.81 words/s at speed 1.0 (3.09
  overall; three of six lines above 3.0). Expect the voiced lint to ask for `--speed` around
  0.9–0.95, or a rewrite of the shortest lines, which run fastest.

Exit status is 1 when there is any error. `--json` prints the whole result, `--sources` the
post's source list (each source once, in order of first use).

## An episode's compile.py

The Skin School compiler (`films/skin-school-tiktok/compile.py`) is the reference. A channel
episode's starts the same way, but takes its layout from the script's directions:

```python
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))   # films/channels/<ch>/<ep> → repo root
from timeline import Film

f = Film(HERE / "script.md", HERE / "vo", fps=30, bpm=75)
plan, end_hold = f.script_plan()                 # pre, picture-only holds, energy, end card
BEATS = f.layout(plan, end_hold=end_hold)        # beat starts snapped to eighth notes
A = f.at                                         # A("vo05:half"), A("beat:whoa:end", -0.2)
film = {"id": ..., "fps": 30, "dur": f.duration, "poster": ..., "shots": ..., "cue": ..., "cam": ...,
        "captions": f.captions(max_chars=24), "endCard": f.end_card, "end": {...},   # theme.json sizes.caption.maxChars
        "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines]}
```

Captions page at 24 characters a line, not `captions()`'s default of 32: the channel themes size
their caption face (52–55 px) for the widest 24-character row, and at 32 characters `hud.js` would
shrink the face to fit the plate. `Film` refuses a stale voice (the script's spoken text must equal lines.json's). Counters that
run in real time, such as body's "while you watched" tally, take their rate from the claim
(2,000,000 × t) and start at frame 0, so the spoken figure and the counter agree wherever the
line lands. The keys the film runtime reads are in `kits/cinema/film/README.md`.

## Tested (2026-10-22)

- **Skin School is unchanged.** `script_lines()` on its script.md gives the same lines, text,
  stars and beats as before the claim-tag change and as its `vo/lines.json`. Its `compile.py`, run
  on a scratch copy with the new `scriptfile.py` and `timeline.py`, writes a `film.json` and
  `sheet.json` byte-identical to the committed ones.
- **The three episode-1 scripts pass** with 0 errors and 0 warnings: body 166 words, 71.5 s
  planned; space 171 words, 71.5 s; physics 173 words, 71.5 s.
- **Every check fires.** 13 broken copies of the body episode (an untagged factual sentence, a
  ledger sentence that differs, no picture-only hold, a long hook, an unbalanced star,
  needs-wording, a bad `verified_via`, no segment, an unknown id, a beat too fast, digits, an
  orphan claim, no end-card hold): each gives the expected error or warning.
- **The voiced path** ran on Skin School's real lines.json and words.json (measured pace per line,
  hook timing, starred words found and the ones inside a phrase listed) and on synthetic voices for
  all three episodes. At a Kokoro-like pace they lay out to 69.3–72.0 s on their own grids
  (`timeline.py`, 75 / 56.25 / 112.5 BPM), with two to four lines over 3.0 words/s each.

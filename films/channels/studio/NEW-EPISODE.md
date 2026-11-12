# New episode: from four inputs to a checked plan

A new episode starts from four things: the **channel**, the **topic**, the **target length** and the **format**.
One command turns them into an episode folder with a master spec, a script skeleton, a shot grid and a checklist.
A second command checks the plan.

The four inputs start the work. They do not finish it. The look, the sources, the title, the recording and the
posting stay with a person (section 9).

| File | What it is |
|---|---|
| [tools/new_episode.py](tools/new_episode.py) | Writes the episode folder |
| [tools/validate.py](tools/validate.py) | Checks `episode.json` and `shots.json` |
| [schema/episode.schema.json](schema/episode.schema.json) | The master episode spec |
| [schema/shot.schema.json](schema/shot.schema.json), [SHOTS.md](SHOTS.md) | The shot manifest and how to plan it |
| [templates/episode.example.json](templates/episode.example.json), [shots.example.json](templates/shots.example.json), [claims.example.json](templates/claims.example.json) | A filled example: Skin Sense Season 3 Episode 1, "What One Shiver Does Inside You" |

Both tools are Python 3 standard library only, need no network, and run from the repo root with `python3 -I`.

## 1. Run it

```
python3 -I films/channels/studio/tools/new_episode.py \
    --channel "Skin Sense" --topic "Where do your skin cells go?" --duration 80 --format premium \
    --out <a scratch folder>/ss-skin-cells
```

Always pass `--out` with a scratch folder outside the repo. Without it the tool writes
`./new-episodes/<prefix>-<topic>/` in the current directory. From the repo root that is `new-episodes/` inside the
checkout, and no `.gitignore` covers it, so a stray `git add -A` would stage it beside the shared files. The folder
is moved to the channel's branch, never committed on this one.

| Flag | Needed | What it takes | Default |
|---|---|---|---|
| `--channel` | Yes | The slug, name or prefix: `skincare`, `"Skin Sense"`, `ss` | |
| `--topic` | Yes | The subject in plain words. A topic ending in "?" becomes the episode's question | |
| `--duration` | Yes | Seconds or m:ss: `68`, `80`, `1:06`, `9:00` | |
| `--format` | Yes | `short`, `premium`, `part` or `long` | |
| `--season` | No | Season number | The newest season look in the identity file |
| `--number` | No | Place in the season; the part number for a part | 1; 0 for a long film |
| `--title` | No | Working title | The topic as typed |
| `--folder` | No | The folder name on the channel branch | The next `epNN` by season; the title as a slug for a long film; `s<season>` for Skin Sense's joined long video |
| `--out` | No, but always pass it | Where to write: a scratch folder | `./new-episodes/<prefix>-<topic as a slug>/` in the current directory |
| `--identities` | No | A folder of identity files to use instead of [identities/](identities/) | `films/channels/studio/identities` |
| `--force` | No | Accept a length outside the format's window, or a format the channel's identity does not list. For planning only: a forced length never ships (section 8) | Off |
| `--overwrite` | No | Write into a folder that already has files | Off |

It stops with exit status 2 and a plain message when:

| Case | Message says |
|---|---|
| The length is outside the format's window | The window, and that `--force` plans it anyway and records it |
| A long video under 510 s (8:30) | Refused even with `--force` ([SEASON-FORMAT.md](../SEASON-FORMAT.md)) |
| A premium lesson under 60 s | Refused even with `--force` ([SEASON-FORMAT.md](../SEASON-FORMAT.md)) |
| A 9:16 length too short to hold the like/follow moment after its first 20 s (20 s, plus the line, plus 4 s of ending) | The shortest length that works. Refused even with `--force` ([CTA.md](../CTA.md)) |
| A length that is not a finite number of seconds, or shorter than one frame step | What a length looks like |
| The channel's identity does not list the format (a `premium` on Reality Rulebook) | The formats it has, and that `--force` uses the studio default |
| No identity file matches the channel, or the identities folder is missing | Where it looked, which channels exist, and the file it expected |
| A part numbered outside 1 to 8 | A season is one long film and eight parts |
| The output folder already has files | Pick another `--out` or pass `--overwrite` |
| `--out` names a file, not a folder | Pick another `--out` |

It then prints everything it assumed and runs `validate.py` on what it wrote.

The folder is a starting point, not a build. Each channel is built on its own branch, so move the folder to the
place `NEXT-STEPS.md` names (the identity's `branch` and `filmsPath`) before building. Never commit it on this
branch.

## 2. What it writes

| File | What is in it |
|---|---|
| `episode.json` | The master spec, valid against the schema. Every default it chose is listed under `assumptions` |
| `script.md` | A skeleton in the kit's script format ([kits/cinema/script/README.md](../../../kits/cinema/script/README.md)): one heading per beat with its window and word budget, `vo:` placeholders, the like/follow line in place, and the end card line where the format has one |
| `shots.json` | One planned shot per beat, with the channel's light, materials and sound quoted into the TODOs. A grid to split and rewrite ([SHOTS.md](SHOTS.md)) |
| `claims.json` | `[]` |
| `out/.gitkeep` | The empty delivery folder |
| `NEXT-STEPS.md` | The ordered checklist for this episode, with who does each step and the channel's binding rules |

The kit's own parser (`kits/cinema/voice/scriptfile.py`) reads the skeleton: beat ids, windows, `pre:`, picture-only
holds, the segment and the end card. The lint will complain about the placeholder words until real lines replace them.

## 3. What is loaded from the blueprint

| Value | Read from | If it is missing |
|---|---|---|
| Name, prefix, branch, folder path | The identity file | The tool stops |
| Aspect, size, frame rate, length window | Identity `formats.<kind>` | The tool stops, or with `--force` uses the studio default and says so |
| Native render size | What `kits/cinema/film/render.mjs` draws today: 1080x1920 or 1920x1080. A joined long video (Skin Sense) gets none: it is not rendered as one picture | |
| Voice kind, id, tone, pace | Identity `voice` | A synthetic voice at 150 words a minute, recorded as an assumption |
| Look and palette | Identity `seasonLooks.s<season>`; its palette, or the base palette when the season lists none | The base identity, recorded as an assumption |
| Sound | Identity `sound`, copied whole | Empty |
| Like/follow line | [CTA.md](../CTA.md), under the heading named in identity `cta.section`, rotated by episode number | A TODO, recorded as an assumption |
| Recurring segment (shorts) | A top-level `segment` in the identity, else the kit's: `measure` (Reality Rulebook), `readout` (One More Orbit), `work` (Possibility Lab) | No segment beat |
| Binding rules | Identity `rules` and `never`, copied into `NEXT-STEPS.md` | |
| Beat shapes | Built into the tool, from [WRITING.md](../../../kits/cinema/script/WRITING.md) (short) and [SEASON-FORMAT.md](../SEASON-FORMAT.md) (premium, part, long) | |

## 4. The beat shapes

Windows scale to the target length and sit on whole frames. The like/follow moment is placed by
[CTA.md](../CTA.md): right after the payoff, starting about 71% through, never in the first 20 s.

| Format | Beats, in order |
|---|---|
| `short` | hook (4 s) · normal · change · why (2 s picture-only) · whoa (3 s picture-only) · **cta** · the channel's segment · takeaway · tease (end card) |
| `premium` | hook · enter · mechanism · deeper · payoff (3 s picture-only) · **cta** · return · close (the last frame matches frame 0) |
| `part` | hook (3 s, the part's own line) · setup · turn · peak · **cta** · cliff · tease ("Part N of 8. Full video on YouTube.") |
| `long`, one story | open (20 s) · ch1 · ch2 · **cta1** · ch3 to ch8 · payoff (36 s) · **cta2** · close. The chapter holding the 60% mark is flagged for the twist |
| `long`, joined lessons (Skin Sense) | open · lesson1 · bridge1 · lesson2 · **cta1** · bridge2 · lesson3 ... lesson6 · finale · **cta2** · close |

Rename, split or merge beats freely. `validate.py` only needs the beats and the shots to cover the same span.
Beat ids use letters, digits and underscores only: Prism reads a `script.md` heading as `\w+`
(`prism-studio/scripts/import-episodes.ts`), so a beat named `cta-1` would be dropped from the imported script.

## 5. What it assumes, and how to change it

Every item below is written into `episode.json` `assumptions` when it applies. Fix the value, then delete the line.

| Assumption | Default | Change it with |
|---|---|---|
| Season | The newest look in the identity | `--season` |
| Number | 1 (0 for a long film) | `--number` |
| Folder | `epNN` counted from the seasons so far (six, six, then eight parts; six lessons on Skin Sense). The tool cannot see the channel branch | `--folder`, after checking the branch |
| Title | The topic as typed | `--title`; the final title is the packaging winner |
| Question | The topic, if it ends in "?"; otherwise a TODO | Edit `episode.json` |
| Word budget | Length x the identity's words a minute x the share of the runtime the voice speaks: 1 for shorts and parts, 0.8 for premium lessons, 0.9 for long films | Edit `voice.wpm` or `voice.talkShare`. The 0.8 and 0.9 are working figures, not measurements |
| Like/follow line | Rotated from CTA.md by episode number | Edit `cta` and the `cta` beat in `script.md` |
| Length of the like/follow moment | From the line's word count at the channel's pace, at least 3 s. CTA.md asks for about 2 to 3 s; most lines run longer | Shorten the line, or accept it |
| Long-video shape | One story in eight chapters; six joined lessons on Skin Sense | Edit the beats |
| Part of 8 | `partOf.of` is 8; `partOf.film` is a TODO | Edit `episode.json` |
| Look not approved | `status.lookGate` starts `pending` whatever the identity says | Only the owner changes it |
| AI voice | `disclosures.aiVoice` starts `true`: a synthetic voice, or an AI stand-in until the recording arrives | Set `false` once every line is the real recording. A cloned voice keeps it `true`: set `voice.synthetic` to `true` and record the consent in `voice.consent` (Possibility Lab's Season 3 film: see its identity rules). A guest's voice is never synthesised |
| AI visuals | `false`, or `true` when the season look's notes mention AI illustrations | Set `true` when any AI-made image is shown ([SHOTS.md](SHOTS.md), section 9) |
| Long-video master | `format.shape` is `film` or `joined`. One continuous film: the 2560x1440 master is listed as an upscale of a 1920x1080 render, and no tool writes it yet (Roadmap 2.2). Joined lessons (Skin Sense): no `nativeSize`; the delivery says "a 2560x1440 frame with cards drawn at that size; each lesson's picture is its 1080x1920 master scaled down to 810x1440" | It stays so until a native tier exists (Roadmap stage 2) |
| Where a joined long video's plan lives | `compilations/s<season>/plan/` on the channel branch: a joined video has no `longform/` working folder ([STRUCTURE.md](STRUCTURE.md), section 5) | `--folder`; the coordinator confirms |

One thing the tool cannot know: the identity holds one voice per channel, the current one. For an older season with
another voice, edit `voice` in `episode.json`.

## 6. The workflow, step by step

`NEXT-STEPS.md` in each new folder is this list with the episode's own paths and commands. The stage numbers are the
pipeline's in [README.md](README.md).

| # | Step | Who | Done when | Pipeline stage |
|---|---|---|---|---|
| 0 | Run `new_episode.py`. Read `assumptions` and fix what is wrong | Agent | The folder validates | 1 |
| 1 | Concept: fill `question`, `hook`, `payoff` | Agent, then owner | The owner agrees to the topic and working title | 1 |
| 2 | Research and claims: `claims.json`, and `calc.py` for computed numbers | Agent, then a person | A person has opened every source; `status.sources` is `ok` | 2 |
| 3 | Script and lint: write the `vo:` lines inside the word budgets; run `kits/cinema/script/lint.py` | Agent | The lint passes, or its format gaps are listed (section 10) | 3, 4 |
| 4 | Recording script, only when the voice is a person: `voice-scripts/make_recording_script.py` | Agent, then owner | The script is with the owner; an AI stand-in carries drafts | 4 |
| 5 | Look gate: the season look is approved, or one still (Skin Sense: plus a 10 s clip) is made and shown | Owner | The owner says yes | 6 |
| 6 | Shots: split the grid into real shots and fill every field | Agent | `validate.py` passes; the manifest has a go-ahead | 5 |
| 7 | Build on the channel's branch: stills first, then the full render | Agent, owner for the stills | `status.lookGate` is `approved` before the full render | 6 to 9 |
| 8 | QA: `python3 -I films/channels/studio/tools/qa_episode.py <video> --episode <folder>/episode.json --out <folder>/review/qa-report.json` (`--kind long` for a long video, `--kind long --cards` when it is joined from episodes); `kits/cinema/film/qa.py` for a 60 to 75 s short; the (a) to (h) gate; the internal rubric in [QA.md](QA.md) | Agent, then reviewer | Every hard gate has passed, nothing factual or ethical is open, and the rubric is at 95 or more | 10 |
| 9 | Packaging: `packaging.json`, and the cover and thumbnail built to [PACKAGING.md](../PACKAGING.md) "The hook" (a clean 2x still, `kits/cinema/film/hook.py`) | Agent, then owner | The owner has picked the title; `status.title` is `chosen` | 11 |
| 10 | Push to Prism and post. The coordinator pushes from a checkout of `claude/made-with-claude-film` ([STRUCTURE.md](STRUCTURE.md), section 11) | Coordinator, then owner | The owner has posted by hand | 11 |
| 11 | After it posts: the Episode Intelligence Report, from [templates/episode-intelligence-report.md](templates/episode-intelligence-report.md); `status.stage` to `archive` | Agent | Measured results sit apart from hypotheses | 12 |

Two notes on the order. The recording script comes right after the script, not at the end:
[SEASON-FORMAT.md](../SEASON-FORMAT.md) asks for it "as soon as the season's script passes fact-check", so the build
never waits on a recording. The look gate has two moments: the season's look before any planning goes far, and this
episode's own stills before its full render.

Keep `status.stage` in `episode.json` current: `concept`, `research`, `narrative`, `script`, `storyboard`, `visual`,
`motion`, `sound`, `editing`, `qa`, `export`, `archive`. `validate.py` gets stricter as the stage advances (section 8).

## 7. One worked example per format

Each was run on 11 Nov 2026 against the four identity files. The outputs are the tool's own. Add
`--out <a scratch folder>/<name>` to each command.

### short: Reality Rulebook

```
python3 -I films/channels/studio/tools/new_episode.py --channel "Reality Rulebook" \
    --topic "Why does a spinning coin stand up before it falls?" --duration 68 --format short --season 4 --number 1
```

- Writes `rr-s4e01`, folder `ep21`, 9:16, 1080x1920 native, synthetic voice, about 170 words.
- Beats: hook 0 to 4 · normal 4 to 15 · change 15 to 25 · why 25 to 38.5 · whoa 38.5 to 48.5 · cta 48.5 to 54.5 · measure 54.5 to 58.5 · takeaway 58.5 to 62.5 · tease 62.5 to 68.
- Assumed: the base look (the identity has no Season 4 look); folder `ep21` (Seasons 1 to 3 used `ep01` to `ep20`); like/follow line 1 of 4, which needs about 6 s.
- An example command only. No Season 4 is planned.

### premium: Skin Sense

```
python3 -I films/channels/studio/tools/new_episode.py --channel "Skin Sense" \
    --topic "Where do your skin cells go?" --title "Where Do Your Skin Cells Go?" --duration 80 --format premium --number 2
```

- Writes `ss-s3e02`, folder `ep14`, 9:16, guest voice (Evelyn), the Season 3 look, about 123 words.
- Beats: hook 0 to 4.5 · enter 4.5 to 14 · mechanism 14 to 28 · deeper 28 to 42.5 · payoff 42.5 to 57 · cta 57 to 62.5 · return 62.5 to 71 · close 71 to 80.
- Assumed: the look is "pending look gate"; `disclosures.aiVoice` is `true` until her recording is in every line; `voice.consent` is a TODO for the owner.
- The filled version of this format is the example in [templates/](templates/): Episode 1, nine shots, 80 s.

### part: Reality Rulebook

```
python3 -I films/channels/studio/tools/new_episode.py --channel physics \
    --topic "Watch a wing, slowed ten times" --duration 66 --format part --number 1
```

- Writes `rr-s3e01`, folder `ep13`, 9:16, about 165 words, `partOf` part 1 of 8 with the film left as a TODO.
- Beats: hook 0 to 3 · setup 3 to 18 · turn 18 to 33 · peak 33 to 47 · cta 47 to 53 · cliff 53 to 60 · tease 60 to 66.
- The tease is already written: "Part 1 of 8. Full video on YouTube.", with its end card line.
- On the channel branch, `ep13` to `ep20` already exist: `lf01/parts.py` generates them from the long film with the beats hook, body and tease. Where a channel has such a generator, its files win; use this scaffold for the spec and the shots.

### long: Possibility Lab

```
python3 -I films/channels/studio/tools/new_episode.py --channel whatif \
    --topic "What if Earth spun faster and couldn't stop?" --title "What If Earth Spun Faster and Couldn't Stop?" \
    --duration 8:45 --format long --folder earth-spin
```

- Writes `pl-s3e00`, folder `earth-spin`, 16:9, `shape` `film`, voice kind `owner`, about 1,221 words (inside one 7 to 10 minute recording session at 155 words a minute). The real film's Part A uses the owner's cloned voice, labelled AI: set `voice.synthetic` and `voice.consent` by hand (the identity's rules).
- Beats: open 0 to 20 · ch1 20 to 76 · ch2 76 to 132 · cta1 132 to 137 · ch3 to ch8, about 56 s each, to 474 · payoff 474 to 510 · cta2 510 to 515 · close 515 to 525. Chapter 6 is flagged for the twist.
- The format records the truth about size: rendered at 1920x1080; the 2560x1440 master is an upscale, and no tool writes it yet for one continuous film (Roadmap 2.2).
- Work in `longform/earth-spin/`; finished files go to `compilations/earth-spin/` ([STRUCTURE.md](STRUCTURE.md), section 5).

## 8. Check the plan

```
python3 -I films/channels/studio/tools/validate.py <episode folder or episode.json>
python3 -I films/channels/studio/tools/validate.py films/channels/studio/templates/episode.example.json
```

Options: `--identities DIR`, `--shots FILE`, `--claims FILE`, `--builtin` (use the built-in schema checker even when
the `jsonschema` package is installed), `--strict` (warnings fail, and the last line says so).

Exit status 0 with no problem, 1 with at least one (one `FAIL` line per problem), 2 when the files cannot be read.
It uses the `jsonschema` package when it can be imported and a built-in checker otherwise. The two give the same
verdict on the studio's schemas: 30 broken copies of the example fail under both, each with the same number of problems.

| Check | Fails when | Warns when |
|---|---|---|
| Schemas | A required field is missing, a type or an enum is wrong (a format kind that is not one of the four, a shot with no purpose), an unknown top-level key | |
| Channel identity | The identity file is missing or unreadable; the id's prefix is not the channel's; `format.durationS` is wider than the identity's window for that kind | The format or size differs from the identity, or the window is narrower; a colour is not in the channel's palette; the voice kind differs |
| Beats and shots | A window ends before it starts; the first does not start at 0; a gap; an overlap; shots and beats end at different times; a shot's aspect is not the episode's; a shot id is used twice | A time is not on a whole frame; a planned shot runs longer than 20 s |
| Length | The plan is outside `format.durationS`; a long video under 510 s; a premium lesson under 60 s, forced or not; a forced length (`durationForced`) from stage `editing` on | A forced length before stage `editing`: `--force` plans only, it never ships; the plan differs from `targetS` |
| Claims | A shot uses a claim id that is not in `claims.json`; the ledger is missing or not a list; an entry has no id | Claims are not "ok" yet (a failure from `export` on); a claim marked "ok" without a page a person opened or a `calc.py` sum ([QA.md](QA.md), section 3B; a failure from `export` on); a claim no shot shows |
| Transitions | The first shot does not open; the last does not loop or close; a join is named differently on its two sides | |
| Like/follow | The moment starts in the first 20 s | It sits outside about 70 to 85% of the runtime; a long video does not list two moments |
| Disclosures | A synthetic voice without `aiVoice: true`; a shot with `aiArt: true` without `aiVisuals: true` | `disclosures` is missing; a guest voice with no consent on record |
| Guest voice, any stage | `voice.kind` is `guest` and `voice.synthetic` is `true`: a guest's voice is never synthesised | |
| Guest voice, from stage `editing` on | `disclosures.aiVoice` is `true` (the AI stand-in is still in the file), or `status.recording` is not `received`: finals wait for the real recording | |
| Owner voice, at `export` | `disclosures.aiVoice` is `true` without `voice.synthetic: true` and a `voice.consent` that holds no TODO. A cloned voice ships only with the consent on record; a stand-in never ships | |
| What the engine draws | | A native size the renderer does not draw today |
| Placeholders | A TODO in `episode.json` from stage `qa` on; a TODO in a shot marked `built` or `approved` | TODOs before that |
| Human gates | Stage `editing` or later without an approved look gate; stage `export` or later with sources open, the title not chosen, a recording still waited for, or a shot not approved | Stage `motion` or `sound` without an approved look gate |

A spec named `episode.<tag>.json` looks for `shots.<tag>.json` and `claims.<tag>.json` beside it. That is how the
templates validate in place.

## 9. What still needs a person

| Step | Who | Why a tool cannot do it |
|---|---|---|
| Approve the look: stills, and for Skin Sense a 10 s clip | Owner | [SEASON-FORMAT.md](../SEASON-FORMAT.md) and the `cinema-kit` skill. `status.lookGate` is the owner's to set |
| Open every source | Owner or a reviewer | A claim is OK only after a person opens the source ([STUDIO-STYLE.md](../STUDIO-STYLE.md)). The tools cannot fetch pages, and a search excerpt is not enough |
| Choose the title | Owner | [PACKAGING.md](../PACKAGING.md): the winner is the owner's pick |
| Record the voice, or pass on a guest's recording and written OK | Owner | The studio never contacts a guest. A guest's voice is never synthesised. A clone of the owner's own voice needs his consent on record and an AI label |
| Make reference pictures and paintings | Owner, in ChatGPT | The prompts are in [SHOTS.md](SHOTS.md), section 8b, and [CHATGPT-ART-PROMPTS.md](../CHATGPT-ART-PROMPTS.md). AI art is always disclosed |
| Expert sign-off | A named expert, through the owner | Reality Rulebook: a physicist signs off each script before it posts (channel bible; the name is a TODO). Skin Sense: a dermatologist review is the owner's decision (`films/channels/briefs/coordinator-handoff.md`); until decided it is a TODO in every handoff |
| Post, and press "Uploaded" in Prism | Owner | Nothing posts by itself (`prism-studio/CLAUDE.md`) |

## 10. Known gaps

- **The lint and the delivery QA know one format.** `kits/cinema/script/lint.py` and `kits/cinema/film/qa.py` are built
  for 60 to 75 s shorts. Premium lessons, parts and long films trip their length, pace and template checks, and the
  lint warns on CTA.md's own lines. Per-format profiles are Roadmap stage 1 (lint) and stage 4 (QA). Until then, report
  those results as they are.
- **Skin Sense's old `episode.json`.** Its Season 2 folders hold a file of the same name in another shape, read by
  `set/ss3.mjs`. Do not validate those folders. The fix is in [STRUCTURE.md](STRUCTURE.md), section 12.
- **Prism needs the season's slate first.** A folder outside a season slate imports nothing
  (`prism-studio/scripts/import-episodes.ts`).
- **The tool does not see the channel branches.** It cannot check that a folder is free, find the long film a part
  belongs to, or read the previous episode's like/follow line.
- **Word budgets are estimates.** The measured voice replaces every window. The shares for premium and long formats are
  working figures.
- **No compile step reads `episode.json` yet.** Each channel's compile step still writes `film.json` from `script.md`
  and the voice. Copying `disclosures` and the format across is done by hand until a shared compile step exists
  (Roadmap stage 3).

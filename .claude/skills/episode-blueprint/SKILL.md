---
name: episode-blueprint
description: Start, plan, build or check an episode for one of the studio's science channels (Skin Sense, Reality Rulebook, Possibility Lab, One More Orbit) by following the studio blueprint in films/channels/studio. Use when the user says "new episode", "next episode", "start season", "start the next season", "make an episode for <channel>", "episode blueprint", or names one of the channels with a topic. Scaffolds from four inputs (channel, topic, target duration, output format), plans the episode as one film of defined shots, stops at the owner's gates, runs the validator and the QA tool before reporting done, and writes the Episode Intelligence Report.
---

# Episode Blueprint: one process for every episode

The blueprint is `films/channels/studio/`. Read it; do not restate or re-decide it. The film process itself (stills
before renders, one timeline, measure before anyone watches) is the `cinema-kit` skill.

## Step 0: Read first
- `films/channels/studio/README.md`: who does what, the 12 stages, the fidelity standard, the "never claim" table.
- The channel's identity: `films/channels/studio/identities/<slug>.json` (fields: `identities/README.md`).
- For your stage, in the same folder: `NEW-EPISODE.md`, `SHOTS.md`, `STRUCTURE.md`, `QA.md`, `AUTOMATION.md`.
- On a channel branch the folder may be old: `git show origin/claude/made-with-claude-film:films/channels/studio/<file>`.

## Step 1: The four inputs
Ask only for what is missing: **channel**, **topic**, **target duration**, **output format**. Then scaffold:
```bash
python3 -I films/channels/studio/tools/new_episode.py --channel "<name or slug>" --topic "<topic>" \
    --duration <seconds or m:ss> --format <short|premium|part|long> --out <a scratch folder>/<name>
```
Always pass `--out` with a folder in your scratch space: without it the tool writes `./new-episodes/` in the
current directory, which from the repo root is inside the checkout and is not git-ignored. Read the `assumptions`
it prints and correct any that are wrong. Move the folder into the channel's folder on the channel's own branch
(`branch` and `filmsPath` in the identity; `NEXT-STEPS.md` names the place). Episodes are built there. The
scaffold is never committed on this branch.

## Step 2: Follow NEXT-STEPS.md
The new folder's `NEXT-STEPS.md` is the ordered checklist, with this episode's paths, commands and who does each
step. Work down it and keep `status.stage` in `episode.json` current. Plan one continuous film: `shots.json` is
approved before scene code, and stills are approved before a full render.

## Step 3: Stop at the owner's gates
Never mark one of these done yourself. Ask, wait, and work on what is not blocked.

| Gate | When | Rule |
|---|---|---|
| Topic and working title | Before research goes far | It is the owner's channel |
| Look gate: one still (Skin Sense Season 3: plus a 10 s clip) | Before any full render | `status.lookGate` becomes `approved` only on the owner's word |
| Sources opened | Before export | Only a person who opened the page marks a claim ok. A search excerpt stays OPEN |
| Recording | Before finals | The owner's voice, or Evelyn's through the owner. An AI stand-in is labelled. Evelyn's voice is never synthesised. The owner's cloned voice (Possibility Lab Season 3) is labelled AI and needs his consent on record |
| Title | Before export | The owner picks the packaging winner |
| Listen, watch, approve | Before posting | Agents cannot hear or watch at speed |
| Posting | Always | The owner posts by hand and presses "Uploaded". Nothing posts by itself |

## Step 4: Check before saying "done"
```bash
python3 -I films/channels/studio/tools/validate.py <episode folder>
python3 -I films/channels/studio/tools/qa_episode.py <delivered video> --episode <episode folder>/episode.json \
    --out <episode folder>/review/qa-report.json
# a long video that is one continuous film: add --kind long
# a long video joined from finished episodes with narrated still cards (Season 2; Skin Sense Season 3):
python3 -I films/channels/studio/tools/qa_episode.py <compilations/name/name-16x9.mp4> --kind long --cards
```
Exit 1 means a hard gate failed. Fix the shot or stage that caused it (`QA.md`, section 6), not the whole episode,
then run it again. One exit 1 is expected: a joined long video run without `--cards` fails `freeze`, because its
cards are still pictures; with `--cards` a person confirms each card. Never re-cut an approved master to pass a
gate: report the failure (`QA.md`, section 3). Fill your rows of `review/rubric-scores.json` (`qa_episode.py
--blank-scores` prints the form); `--release` then needs every hard gate passed and 95 points or more.
Report it as it is: which hard gates passed, failed, or wait on a person. The 100-point score is an internal
assessment, not proof of quality, and a failed hard gate blocks release whatever the score.

## Step 5: Write the Episode Intelligence Report
Copy `films/channels/studio/templates/episode-intelligence-report.md` to `review/intelligence-report.md` in the
episode folder (guide: `films/channels/studio/reports/README.md`). Measured facts and hypotheses stay in separate
halves; every number names its source; "not measured" is valid. Its last part lists the blueprint changes needed.

## Never claim what was not used
- Name a technique, size or number only if the build log or a measurement shows it (`README.md`, "Never claim").
- The engine is a CPU rasteriser. Today: no ray tracing, global illumination, ambient occlusion, HDR output, or
  native 1440 or 4K video. The 1440 YouTube file is "a 1440 upscale". Check `README.md` before describing a look.
- A render or an AI image is never presented as a photo: mark it "Illustration". Disclose AI voice and AI art.
- Anything not built yet is "Roadmap", with its stage (`ROADMAP.md`). Say so before promising it.

## Standing rules (read the file; do not copy it)
- In `films/channels/`: `PACKAGING.md` (titles, thumbnails, truth rules), `SEASON-FORMAT.md` (formats, lengths,
  voices, Skin Sense Season 3), `CTA.md` (the like/follow line), `STUDIO-STYLE.md` (the (a) to (h) gate, words, facts),
  `briefs/STANDARDS-v2.md` (clarity, the four review files).
- `kits/cinema/script/WRITING.md` (story), `kits/cinema/README.md`, `kits/cinema/film/README.md`, `prism-studio/CLAUDE.md`.
- Each channel keeps its own palette and type. Never borrow another channel's or client's identity.
- Commit and push only when asked, on the channel's branch. Never touch `main`, never force-push, no pull request
  unless asked, no model names in any file, kill only processes you started and by PID, no secrets in chat.
- End every handoff with: files written, gates passed and waiting, TODO placeholders, open questions.

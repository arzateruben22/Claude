# Next steps: ss-s3e08 · Skin Sense · "Celluma PRO LED panel, explained"

Premium, 9:16, target 150 s. Written by new_episode.py on 2026-11-12.
Where it goes: `films/channels/skincare/ep20/` on the branch `claude/outer-layer-s1-b`. Move this folder there before building; the copies of the channel folders on other branches are old.

Who: **Agent** = a builder or coordinator agent. **Owner** = the channel owner. **Reviewer** = the channel's expert reviewer.
Work top to bottom. A step is done only when its check passes.

## Read first

- `episode.json`, section "assumptions": everything this tool guessed. Fix what is wrong before anything else.
- Channel rules: `films/channels/studio/identities/skincare.json` ("rules" and "never" are binding).
- The blueprint: `films/channels/studio/` (AUTOMATION.md, LIBRARY.md, NEW-EPISODE.md, QA.md, README.md, ROADMAP.md, SHOTS.md, STRUCTURE.md).
- Shared rules: `films/channels/SEASON-FORMAT.md`, `films/channels/PACKAGING.md`, `films/channels/CTA.md`, `kits/cinema/script/WRITING.md`.

## 1. Concept (Agent, then Owner)

- [ ] Replace the TODOs in `episode.json`: `question`, `hook`, `payoff`. One story, one question.
- [ ] Owner confirms the topic and the working title. The final title is chosen at the packaging step.

## 2. Research and claims (Agent, then a person)

- [ ] Write `claims.json`: one entry per fact, in the fields of `kits/cinema/script/README.md` ("claims.json").
- [ ] Record `verified_via` honestly. A claim checked from a search excerpt stays open (`TODO open link`).
- [ ] Every number that is computed gets its arithmetic in a `calc.py` beside the script.
- [ ] A person opens every source. Only then set `status.sources` to `ok`. Never invent a statistic, a study or a quote.

## 3. Script and lint (Agent)

- [ ] Write the `vo:` lines in `script.md`, inside each beat's word budget. Tag every factual sentence with its claim id.
- [ ] `python3 -I kits/cinema/script/lint.py <this folder>`
  The lint is built for 60 to 75 s shorts. For a premium it reports the length, pace and template differently from what this format needs; fix what applies to the words and the claims, and list the rest in the handoff. Per-format lint profiles are on the roadmap.
  The lint also warns on the like/follow line's wording; that line comes from CTA.md and stays.
- [ ] Read it aloud at the narrator's pace (WRITING.md, "The read-aloud test").

## 4. Recording script (Agent, then Owner)

The voice is the guest's. Do this as soon as the script passes fact-check, so the build never waits on it.

- [ ] Make the season's recording script with `films/channels/voice-scripts/make_recording_script.py` (one session per season, 7 to 10 minutes of reading).
- [ ] The coordinator passes it to the owner. The studio never contacts a guest directly; the owner gets their written OK.
- [ ] Until the recording arrives, an AI voice stands in and every draft is labelled as AI. Never an AI copy of a guest's voice.
- [ ] When it arrives: cut it into lines, rebuild the captions from it, set `status.recording` to `received` and `disclosures.aiVoice` to match what is in the file.

## 5. Look gate (Owner)

- [ ] The season look is "pending look gate" in the identity file. If it is not approved, nothing else is built: make one still in the look and a 10 s test clip and get the owner's yes. The coordinator then updates the identity file.
- [ ] Any reference picture the owner makes by hand follows `films/channels/studio/SHOTS.md` (section 8b, reference frames, and section 9, owner-made AI art).
- [ ] This episode's own gate comes at the build step: the owner sees its stills before the full render, and only the owner sets `status.lookGate` to `approved`.

## 6. Shots (Agent)

- [ ] Plan the film as one continuous journey: `films/channels/studio/SHOTS.md`. Split each beat's placeholder shot into real shots and fill every field.
- [ ] `python3 -I films/channels/studio/tools/validate.py <this folder>` passes with no problem.

## 7. Build (Agent, on the channel's branch)

- [ ] Stills first: render the hook, the payoff and the last frame with the final finish, and show them to the owner. Skin Sense: plus a 10 s test clip.
- [ ] No full render until the owner has set `status.lookGate` to `approved`. `changes-requested` means revise and show again.
- [ ] In `films/channels/skincare/ep20/`: the compile step writes `film.json` from the script and the measured voice; nothing in it is a hand-typed time.
- [ ] Copy `disclosures` from `episode.json` into `film.json` (`disclosures.aiVisuals`, `disclosures.aiVoice`).
- [ ] Season 2 build order on this channel, as audited on 11 Nov 2026 (a new season may differ; check the branch):
  the episode's voice.py, voice/align.py, set/build_ep.py <folder>, set/final.sh <folder> (make_sheet.py, studio/render.py, render.mjs --tier final --plain, assemble, film/qa.py, film/youtube1440.py), set/cta_line.py, set/covers.mjs.
- [ ] One render job per machine. Long renders resume with `kits/cinema/film/run.sh <folder>`.

## 8. QA (Agent, then Reviewer)

- [ ] `python3 -I films/channels/studio/tools/qa_episode.py <delivered video> --episode <this folder>/episode.json --out <this folder>/review/qa-report.json`
  The studio's gate for every format: the hard gates and the automated rubric points. Exit 1 means a hard gate failed: fix the shot or the stage that caused it (`films/channels/studio/QA.md`, section 6), then run it again.
- [ ] `python3 -I kits/cinema/film/qa.py <folder>` on the delivered file (the kit's own check; Prism shows its `fails`).
  Its 60 to 75 s length gate fails a 70 to 90 s lesson until a per-format profile exists; report that failure, do not hide it. `qa_episode.py` is the gate for a lesson.
- [ ] The quality gate (a) to (h) in `films/channels/STUDIO-STYLE.md`: nothing under 3; (a), (g) and (h) at 4 or more; nothing factual or ethical open.
- [ ] The internal 100-point rubric in `films/channels/studio/QA.md` (target 95): `qa_episode.py --blank-scores` prints the form for `review/rubric-scores.json`; then run the tool again with `--scores <this folder>/review/rubric-scores.json --release`. Release needs every hard gate passed and 95 points or more. It is an internal assessment: never public, never a prediction.
- [ ] `validate.py` again, with `status.stage` set to `qa`: it now fails on any TODO left in `episode.json`.
- [ ] Report only what was measured. Never claim a technique, a resolution or a number the engine did not deliver.

## 9. Packaging (Agent, then Owner)

- [ ] Write `out/packaging.json`: five titles, three thumbnails, three pairings, every check true (`films/channels/PACKAGING.md`).
- [ ] The title and the thumbnail claim no more than the script. Scores are judgments, not predictions.
- [ ] The owner picks the title. Then set `title` in `episode.json` and `status.title` to `chosen`.

## 10. Push and post (Coordinator, then Owner)

- [ ] Check Prism has this season's slate, or the folder imports nothing (`prism-studio/scripts/import-episodes.ts`).
- [ ] The coordinator pushes from a checkout of `claude/made-with-claude-film`, which holds the current `prism-studio/` (the channel branches hold an old copy or none). Bring the delivered files in without committing them: `git checkout origin/claude/outer-layer-s1-b -- films/channels/skincare/ep20/script.md films/channels/skincare/ep20/claims.json films/channels/skincare/ep20/film.json films/channels/skincare/ep20/out`.
- [ ] Set each cover and YouTube file one second newer than its master (`prism-studio/RUNBOOK.md`: a checkout scrambles modified times). In `prism-studio/` run `node scripts/push-media.mjs --dry-run skincare`: it must list only the files just brought in (an old copy in the checkout would replace a newer final). Then `node scripts/push-media.mjs skincare`. Details and the scratch-tree alternative: `films/channels/studio/STRUCTURE.md`, section 11.
- [ ] The owner reviews in Prism and posts by hand. Nothing posts without the owner.
- [ ] List every TODO and every open claim in the handoff.

## 11. After it posts (Agent)

- [ ] Write the Episode Intelligence Report: copy `films/channels/studio/templates/episode-intelligence-report.md` to `review/intelligence-report.md` (guide: `films/channels/studio/reports/README.md`). Measured results stay apart from hypotheses; no invented numbers.
- [ ] Set `status.stage` to `archive` once the files are stored.

## Skin Sense: binding rules (from the identity file)

- Every factual sentence carries a claims.json tag. A claim is OK only after a person opens the source; anything checked from a search excerpt stays OPEN.
- One skin tone per episode, matched to its art; never change tone inside an episode's story.
- Captions carry 'Education, not medical advice'.
- AI illustrations are disclosed: set disclosures.aiVisuals true (episode.json, copied to film.json) whenever an AI-made image is shown. A world drawn only in code keeps it false.
- Look gate: the owner approves one still and a 10 s test clip before any Season 3 episode is built.
- Evelyn's real recordings only (voice-evelyn/). The owner gets her OK in writing and asks whether she wants credit; the studio never contacts her.
- A soft AI voice (bf_isabella, kits/cinema/voice/tts.py) stands in for look tests and drafts only, labelled as AI. Finals wait for her recording.
- A dermatologist review is the owner's decision (films/channels/briefs/coordinator-handoff.md; the channel bible asks for a board-certified dermatologist). Until the owner decides, it is a TODO in every handoff.
- Season 3: almost no on-screen text. One number or one word at the key moment, plus the captions.
- Season 3: teal #3FBFAE is the only accent.
- Honesty labels on every comparison, illustration, animal result and single study.
- A cover must be newer than its mp4, or Prism falls back to the poster frame.
- One Chromium render job per machine.

Never (each line is a prohibition):

- Never a face; acne only inside a pore.
- No disease, risk or damage words over skin art; never a risk line over skin of one tone.
- No products, brands, before/after, diagnosis or advice.
- No Lumevina name, logo, products or links; never Lumevina's black, rose or gold.
- Never an AI copy of Evelyn's voice.
- Season 3: no gold, rose or red accent and no neutral black ground (films/channels/SEASON-FORMAT.md). The base look's peach and rose come from the art of Seasons 1 and 2.
- In every season: set/ss3.mjs's #B8862B is the dashed placeholder marker only, never an identity colour.
- No title or thumbnail that claims more than the script.
- Never claim a technique, resolution or metric the engine did not deliver (films/channels/studio/README.md, 'Maximum-fidelity standard').
- Nothing posts without the owner; publishing is manual.

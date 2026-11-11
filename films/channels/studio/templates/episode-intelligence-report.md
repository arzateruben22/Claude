# Episode Intelligence Report: `<episode id>` "<title>"

Copy this file to `review/intelligence-report.md` in the episode folder (a long video: in its working folder) and
fill it in when the episode is delivered. Guide: [../reports/README.md](../reports/README.md).

| Field | Value |
|---|---|
| Episode id, channel, format | `<prefix>-s<season>e<nn>`, `<slug>`, short / premium / part / long |
| Folder, branch, delivered commit | `films/channels/<slug>/<folder>`, `claude/...`, `<hash>` |
| Written by, on | builder, YYYY-MM-DD |
| Platform numbers added on | not yet |

Three rules for this file:

1. **Part 1 holds only what was measured.** Every number names the file, tool or screen it came from. No source, no
   number: write "not measured".
2. **Part 2 holds what we think.** Each line says what would confirm or refute it.
3. **Nothing moves from Part 2 to Part 1 without a measurement.** Never invent a statistic, a saving or a trend.

---

## Part 1: Measured

### 1.1 Delivery

| Measure | Value | Source |
|---|---|---|
| Master file | | `out/<name>-9x16.mp4` or `compilations/<name>/<name>-16x9.mp4` |
| Size in pixels; rendered natively at | | `review/qa-report.json` `measurements.video`; `episode.json` `format.nativeSize` |
| Honest label ("1080 native", "1440 upscale", ...) | | [../README.md](../README.md), "Master resolution per format" |
| Length | | `review/qa-report.json` `measurements.video.durationS` |
| Loudness, true peak | | `review/qa-report.json` `measurements.audio` |
| File size | | `review/qa-report.json` `measurements.container.sizeMb` |
| Other delivered files (YouTube file, cover, captions, packaging) | | `ls out/` |

### 1.2 Quality checks

| Measure | Value | Source |
|---|---|---|
| Hard gates: pass, fail, waiting, not checked | | `review/qa-report.json` `verdict` |
| Gates that failed at any point before delivery | | earlier runs of `qa_episode.py`; list each in 1.4 |
| Internal rubric: automated points, people's points, total (internal only) | | `review/qa-report.json` `rubric` |
| The (a) to (h) scores | | `review/rubric-scores.json` `gates.gate_a_h` |
| Lint: errors, warnings, reading grade | | `kits/cinema/script/lint.py` output |
| Claims: total, ok, open | | `claims.json`; `review/qa-report.json` `measurements.sidecars.claims` |
| Voiceless gaps: longest | | `review/qa-report.json` `measurements.voiceGaps` |
| Sound sync; voice over music | | `build/audio/qa.json` |

### 1.3 Build cost

| Measure | Value | Source |
|---|---|---|
| Frames in the final | | `build/final/<aspect>/manifest.json` |
| Render seconds per frame, average; blur samples (K) average and max | | `kits/cinema/film/scorecard.py`, or the chunk lines of the render log |
| Render hours for the final | | the same |
| Machine and what else ran on it | | the render log; note other jobs |
| Draft and animatic renders before the final | count | `build/` folders, the render logs |
| Rounds of stills before the look was approved | count | the handoff messages; `review/` |
| Voice lines; lines voiced again | count | `vo/lines.json`; git log of `vo/` |
| Sound compose and master seconds | | `build/audio/qa.json` `compose_s`, `master_s` |

### 1.4 Re-renders and fixes

One row for each time rendered frames were thrown away, and for each gate that failed.

| # | What was redone (chunks, range or whole film) | Why | Caught by (which tool, reviewer or the owner) | Frames re-rendered | Source |
|---|---|---|---|---|---|
| 1 | | | | | `manifest.json` `runs`, `mixed`; git log |

### 1.5 Techniques really used

From `shots.json` and the code, not from the plan. Write "no" where a technique was planned and dropped.

| Technique | Used | Shots | Evidence |
|---|---|---|---|
| Kit finish (`cinema3d.js`): motion blur, bokeh depth of field, bloom, ACES | | | `manifest.json` (`plain` false) |
| Channel's own finish (plain path) | | | `manifest.json` (`plain` true) |
| Soft shadows | | | the scene's renderer settings |
| Physically based materials (clearcoat, sheen, transmission) | | | the `set/` module used |
| Environment reflections | | | |
| Grain | | | |
| Owner-made AI paintings (`disclosures.aiVisuals`) | | | `film.json` `disclosures`; `art/` |
| Voice: AI, the owner's recording, a guest's recording, a clone of the owner's own voice (`disclosures.aiVoice`) | | | `film.json` `disclosures`; `vo/lines.json` |

### 1.6 Platform numbers

Fill in only from what the owner sends (a screenshot or a CSV) or from Prism's Analytics rows marked API, CSV or
MANUAL. Never from a row marked ESTIMATE or DEMO. Until then every cell says "not yet measured".

| Platform | Posted on | Views | Average watch time or share watched | Likes | Follows or subscribers gained | Source | Read on |
|---|---|---|---|---|---|---|---|
| YouTube | | not yet measured | | | | | |
| TikTok | | not yet measured | | | | | |
| Instagram | | not yet measured | | | | | |

Title and thumbnail tested (YouTube "Test & compare"), if any: which pairings, the platform's own result, the date.

---

## Part 2: Hypotheses

What we think worked or did not, and why. Opinions belong here, however confident. Status is `open`,
`supported by <the measurement>` or `refuted by <the measurement>`. One episode can support a hypothesis; it cannot
prove a rule for the channel.

| # | We think | Because (a line in Part 1, a reviewer's note, or "a guess") | What would confirm or refute it | Status |
|---|---|---|---|---|
| H1 | The hook: | | | open |
| H2 | The look: | | | open |
| H3 | The pacing: | | | open |
| H4 | The title and cover: | | | open |
| H5 | The sound: | | | open |

---

## Part 3: Reusable assets

| Asset (scene module, world, rig, material, prop, score preset, painting, tool) | Where it is (`branch:path`) | Ready to reuse, or needs lifting into `set/` or the kit | Listed in [LIBRARY.md](../LIBRARY.md)? |
|---|---|---|---|
| | | | |

## Part 4: What cost time

Count in things that were measured: renders, re-renders, review rounds, days waiting. Write "not measured" for the rest.

| What | Cost | Cause | How to avoid it next time |
|---|---|---|---|
| | | | |

## Part 5: Limits hit

| Limit (the engine, a tool, the process, disk or time) | Where it showed (shot, stage) | What we did instead | The honest label we used |
|---|---|---|---|
| | | | |

## Part 6: Changes to make to the blueprint

Each row cites the line above that led to it. The coordinator applies them and notes the commit.

| File | Change | Because (section and row of this report) | Applied in |
|---|---|---|---|
| `identities/<slug>.json` | | | |
| `SHOTS.md` | | | |
| `QA.md`, `qa/rubric.json` | | | |
| `LIBRARY.md` | | | |
| `ROADMAP.md`, `README.md` (wish-list) | | | |
| A tool in `tools/` or the kit | | | |

## Sign-off

- Builder wrote Parts 1 to 6 on:
- Coordinator read it and applied Part 6 on:
- Platform numbers added, and hypotheses re-marked, on:

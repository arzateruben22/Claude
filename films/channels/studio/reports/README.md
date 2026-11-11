# Episode Intelligence Reports

The studio's memory. After every delivered episode, lesson, part or long video, the builder writes down what was
measured, what we think, what can be reused, what cost time, which limits were hit, and what to change in this
blueprint. The next episode starts from that, not from recollection.

Template: [../templates/episode-intelligence-report.md](../templates/episode-intelligence-report.md).

## Where reports go

| What | Path | Branch |
|---|---|---|
| The report for an episode, lesson or part | `films/channels/<slug>/epNN/review/intelligence-report.md` | The channel's branch |
| The report for a long video | `<long film working folder>/review/intelligence-report.md` | The channel's branch |
| A season review, written across that season's reports | `films/channels/studio/reports/<slug>-s<season>-review.md` | `claude/made-with-claude-film` |
| This guide | `films/channels/studio/reports/README.md` | `claude/made-with-claude-film` |

- A report lives with its episode ([../STRUCTURE.md](../STRUCTURE.md), section 9). It is not copied here: one file,
  one home. This folder holds only this guide and the season reviews.
- `review/` is never pushed to Prism, so a report cannot leak into a post.
- The archive index points at each report as `branch:path` (Roadmap stage 3).

## Naming

- The file is always `intelligence-report.md`.
- Its first line is `# Episode Intelligence Report: <episode id> "<title>"`, for example
  `# Episode Intelligence Report: ss-s3e01 "What One Shiver Does Inside You"`.
- A season review is `<slug>-s<season>-review.md`, for example `skincare-s3-review.md`.
- Refer to a report from another file as `<branch>:<path>`.

## When, and by whom

| Moment | Who | Fills in |
|---|---|---|
| The episode is delivered (pipeline stage 12) | Builder | Part 1 except platform numbers, and Parts 2 to 6 |
| The coordinator reads it | Coordinator | Applies Part 6, notes the commit |
| The owner sends platform numbers | Builder or coordinator | Section 1.6, and the status of each hypothesis |
| The season ends | Coordinator | The season review |

Most of Part 1 is copied from files, not typed from memory:

```
E=films/channels/<slug>/epNN
python3 -I films/channels/studio/tools/qa_episode.py $E/out/<name>-9x16.mp4 --episode $E/episode.json \
    --scores $E/review/rubric-scores.json --out $E/review/qa-report.json      # 1.1, 1.2
python3 -I kits/cinema/film/scorecard.py $E                                    # 1.3: seconds a frame, render hours
python3 -I -m json.tool $E/build/final/9x16/manifest.json | grep -A3 -E '"runs"|"mixed"'   # 1.4: re-renders
```

`build/` is not committed. Read the manifest, the logs and `frames.jsonl` on the machine that rendered, before the
folder is cleaned.

## The rule against invented statistics

1. A number goes in Part 1 only with its source: a file path, a tool's output, or a platform screen and the date it
   was read.
2. No source means "not measured". That is a normal entry, not a failure.
3. Estimates, impressions and figures from memory go in Part 2, worded as what we think.
4. Platform numbers come only from the owner (a screenshot or a CSV) or from Prism's Analytics rows marked API, CSV
   or MANUAL. Never from a row marked ESTIMATE or DEMO.
5. Never write a saving, a speed-up or an improvement unless both measurements are in Part 1.
6. The internal rubric score is recorded as internal. It is not evidence that viewers liked the film.
7. One episode can support a hypothesis. It cannot prove a rule for a channel. A season review may say "in 5 of 6
   lessons", never "viewers prefer".
8. If a number is later found wrong, strike it and write the correction beside it with the date. Do not delete it.

## How lessons flow back

A finding changes the blueprint only through Part 6 of a report. The coordinator makes the change and cites the
report (`branch:path`, section and row) in the changed line or the commit message.

| Finding | Goes to | Rule |
|---|---|---|
| A look, voice or sound rule that held or failed for the channel; a measured reading pace | [../identities/](../identities/) `<slug>.json`: `rules`, `never`, `seasonLooks`, `voice.wpm`, `sound.rules` | Only from a measurement or the owner's dated decision. A hypothesis does not change an identity |
| A shot, transition or camera move that worked or failed; a continuity slip | [../SHOTS.md](../SHOTS.md): transition vocabulary, continuity rules, presets | Name the shot id and the frames. A new preset must point at code that exists |
| A gate that missed a defect, or failed a good film; a threshold that was wrong | [../QA.md](../QA.md) and [../qa/rubric.json](../qa/rubric.json) | Test the change on the file that showed the problem. Raise the rubric's `version` when points or gates change |
| Something reusable was built | [../LIBRARY.md](../LIBRARY.md) | Add the row in the same change that moves the code into `set/` or the kit |
| A limit of the engine, or a new capability | [../README.md](../README.md) (the wish-list table), [../ROADMAP.md](../ROADMAP.md) | Measure before writing "have". Update the table in the change that adds the code |
| A step that should be a tool, or a tool that broke | [../AUTOMATION.md](../AUTOMATION.md), [../ROADMAP.md](../ROADMAP.md) | One roadmap row, with its test |
| A title or thumbnail observation | [../../PACKAGING.md](../../PACKAGING.md), "What's working" | It stays a hypothesis there until platform numbers support it |

What does not flow back: a hypothesis with no measurement, a number without a source, and anything about a person.

## What a good report looks like

- Part 1 can be checked by opening the files it names.
- Part 2 is short and frank. "We think the hook was slow" is useful; "great engagement" is not.
- Part 4 counts renders and rounds, the things that were counted.
- Part 5 uses the labels in [../README.md](../README.md), "Never claim a technique we did not use".
- Part 6 has at least one row, or says "nothing to change" and why.

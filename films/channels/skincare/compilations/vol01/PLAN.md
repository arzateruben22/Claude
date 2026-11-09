# Skin Sense Season 1: long video (vol01) plan

**Title:** The organ you live inside (thumbnail text: "Skin Sense: Season 1"). **Format:** 16:9, 2560 × 1440, CRF 15, x264 slow, AAC 320k, -14 LUFS, true peak ≤ -1 dBTP, ≤ 90 MB (`kits/cinema/film/compilation.mjs`). **Not rendered yet:** it needs the six finals.

## Chapters (estimated from the draft and published lengths; `compilation.mjs` writes the real `chapters.txt` from the finals)
Total ≈ 7.3 min (7:18). Intro 4 s (belongs to chapter 1), bridges 2 s (belong to the chapter they follow), outro 8 s (belongs to the last).

| start | chapter | episode starts at | episode length |
|---|---|---|---|
| 0:00 | The fight you never saw | 4.0 s | 73.7 s |
| 1:19 | Where a glow comes from | 79.7 s | 70.0 s |
| 2:31 | What's in a scar | 151.7 s | 70.0 s |
| 3:43 | The message behind a frown | 223.7 s | 66.5 s |
| 4:52 | The sunscreen experiment | 292.3 s | 67.8 s |
| 6:02 | Same list as cigarettes | 362.1 s | 68.1 s |

## Layout (the new ivory look)
- Cards are drawn by `compilation.mjs` from `films/channels/skincare/theme-ivory.json` (new `--theme` option): ivory ground, navy Newsreader headline, Red Hat Text supporting text, dark-teal accent (contrast: navy/ivory 15:1, secondary text 6.7:1, accent 5.3:1). Preview: `cards-preview.jpg` (intro, a bridge, a chapter frame, the outro; drawn from draft stand-ins).
- Chapter frame: the delivered 9:16 episode, full height in the middle; left: "Skin Sense", the episode number and title; right: the chapter list with the current one lit.
- Intro: the title, the channel promise and the first poster, over the channel signature. Bridge (`--bridge 2`, new option): "Next · No. 00N" and the next title, silent. Outro: "A new one every day." with the Subscribe pill and the right half clear for end-screen elements.
- Sources in the description: at most 3 per episode (`--max-sources 3`), so the description stays under 5,000 characters (4,338 in the stand-in run; `--max-desc 5000` fails QA if it does not).

## Before it runs (finals drop straight in)
1. `films/channels/skincare/ep01..ep06/out/skin-sense-00N-9x16.mp4` (1080 × 1920, delivered at -14 LUFS) plus the `.jpg` poster of each; each `film.json` has `title.series` ("Skin Sense · No. 00N") and `title.title`; each `claims.json` exists (ep04-06 do).
2. Then: `films/channels/skincare/compilations/vol01/build-vol01.sh` (add `--cards-only` first to look at the cards and the thumbnail). QA gates: 2560 × 1440, 5-11 min, -14 LUFS ±1.5, ≤ -1 dBTP, every chapter ≥ 10 s, picture and sound lengths equal, description ≤ 5,000 characters.
3. All six chapter titles are in sentence case (001-003 already were; 004-006 changed 9 Nov at the coordinator's request).

## Open (list in every handoff)
- The finals (004-006 need the owner's pictures, score and effects, a final-tier render and `qa.py`); the Opus score; every claim still OPEN or SOURCE-READ but not person-checked; dermatologist sign-off for 004-006 (and the earlier episodes' own HUMAN-REVIEW files); the channel handle, links and YouTube's altered/synthetic-content setting (the description's TODO line).
- The card sound uses the studio preset from the channel's first episode sheet; if the new-look episodes get their own score preset, set `theme.preset`.

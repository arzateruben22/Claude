# Body Backstage: PAUSED (8 Nov 2026, by the owner)

Branch: `claude/back-of-the-envelope-s1-b`. Nothing is posted. No final-tier render has been made for 003-006.
Render chain stopped by PID (SIGTERM); finished frames stay in each episode's `build/` (git-ignored: if this container is reclaimed they are gone, and a re-render starts from zero).

## How to resume (any episode)
- Voice toolchain: `kits/cinema/voice/setup.sh` (once per container; `export CINEMA_VOICE=$HOME/.cache/cinema-voice`). Re-voice: `$CINEMA_VOICE/venv/bin/python -I films/channels/body/epNN/voice.py --models $CINEMA_VOICE/models`, then `kits/cinema/voice/align.py films/channels/body/epNN/vo $CINEMA_VOICE/models`, then `voice.py --clamp`, then `python3 -I films/channels/body/epNN/compile.py` and `kits/cinema/script/lint.py ... --segment meanwhile` (heading windows in script.md are lint-only: set them to the compiled beat times).
- Draft render: `kits/cinema/film/run.sh films/channels/body/epNN --tier draft` (resumes finished chunks). ONE Chromium job at a time: a still render started meanwhile makes the next one refuse (that is how 005 lost a run).
- Audio and preview: `python3 -I kits/cinema/studio/render.py films/channels/body/epNN/sheet.json films/channels/body/epNN/build/audio --root films/channels/body/epNN`, then `node kits/cinema/film/render.mjs --film films/channels/body/epNN --tier draft --assemble --audio films/channels/body/epNN/build/audio/mix.wav`; the preview lands in `out/body-backstage-00N-9x16-draft.mp4`: move it to `review/preview-epNN.mp4` (and the .jpg, and copy `build/draft/9x16/contact-sheet.jpg` to `review/contact-epNN-draft.jpg`). Note the 3-digit episode number in that file name.
- Needs: `PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium`.

## 003 "The jump"
- r3 draft is on the branch: `ep03/review/preview-ep03.mp4` (74.4 s), contact sheet, `review/ROUND2.md` (r2 notes), scorecard.md (draft), CLAIMS-REVIEW.md (21 claims). r3 changes: irregular sheaths + cut-section inset on "myelin", wet bare fibre, drum with copper coil/gears/brass, "the delay" bracket, hook "As fast as light? An expert once thought so.", "? s" readout cut, 27 m/s readout fixed, plated end card, claim c21 ("34 vs 4", basis: model).
- The Opus score of r3 and the "r4 queue" list were NOT received by this session; take them from the coordinator.
- Known gaps: the drum traces are still written one after the other (not on "timed"/"it"); the 14 s drum-to-fibres cut can show a near-empty scan frame; the bare fibre is still thin.

## 004 "The gap"
- r2 draft on the branch: `ep04/review/preview-ep04.mp4` (74.8 s). One later code change is NOT rendered: shorter camera transit into the field (`compile.py`, key at `vo05:junction`), to fill the near-empty frame around 46 s.
- r2 added: crisp frame 0 (focus on the gap), glass Golgi/Cajal panels, Nobel pill under the panels, the tease as air sacs on an airway with capillaries, end card "Next: where breath goes", c18 owner-verified (UN: 8 billion in 2022, 12,500 per person; source_url the UN page), c2 dropped. Physiologist sign-off: TODO.
- The "r3 list" was NOT received by this session; take it from the coordinator. Known gaps: "Ca" label near 36 s sits close to a badge.

## 005 "Where breath goes"
- r2 code and copy are committed: scan figure, real court surface and net, matte clotted-tissue old idea, bag at frame 0 (thins on "bag"), irregular sacs, larger SCAN VIEW tag (shared `set/look.js`), re-voiced hedges ("up to about twenty-three", "about half a billion"), claims c2, c9, c10, c11, c13, c15, c16 set OPEN, Galen/"sponge" flag in `review/HUMAN-REVIEW.md`, CLAIMS-REVIEW.md and scorecard.md refreshed. Script is 74.8 s, lint 0 errors.
- r2 RENDER STATE: draft chunks 000-005 (0-60 s) are done on disk in `ep05/build/draft/9x16/` (lost if the container is reclaimed); chunks 006-007 (60-74.8 s) are not. Stopped at about frame 930 of 1122. `ep05/review/preview-ep05.mp4` is STILL the r1 preview (the r2 one was never assembled). Resume with `run.sh films/channels/body/ep05 --tier draft`, then audio and assemble as above.
- Not done: enough camera/scan moves tied to words; hook sacs could be more irregular.

## 006 "The exit"
- r2 draft on the branch: `ep06/review/preview-ep06.mp4` (74.8 s). r2: hedges (c2 adults, c3 "about as wide", c13/c14/c21 "in mice", c26 "in lab studies"), c11/c13/c15/c19/c24 OPEN, tease "Next: season two" with no "No. 07" and no "Next, inside:", one badge spelling, "not to scale" badges, title smudge removed, badge collision removed, scan-volume figure with a lit heart, engraving warms into the membrane (no redraw), HUMAN-REVIEW.md and scorecard.md replaced.
- Not done: neutrophil membrane granules barely show; no new fingertip pull-out shot; the white clumps on the fingertip may still read as pus.
- The "r3 list" was NOT received by this session; take it from the coordinator.

---
## Queued fix lists (received after the pause; NOT started)
Standards v2 (all episodes still in production): fetch `claude/made-with-claude-film` (31088495 or later), read `films/channels/briefs/STANDARDS-v2.md`, copy in its `kits/cinema/script/lint.py` (reading grade per beat 8 or below, 7 overall, no sentence over 22 words). First-listen clarity for a sixth grader, hook in 2-3 s with a striking visual, a meaningful visual change every 2-4 s. Add `review/scene-table.md`, `review/claims-table.md`, `review/clarity-review.md` per episode. Claims: read each source page (hosts now allowed), record quotes, status SOURCE-READ only where the page supports the wording; OK needs a person; fix or drop wording a source doesn't support.

### 003 r4 (Opus r3: (a)4 (b)4 (c)4 (d)3 (e)4 (f)4 (g)4 (h)3; only (h)3 and factual items block)
1) Hook: do NOT present 300,000,000 m/s as Müller's own figure (he cited estimates up to 60x light speed): e.g. "Some thought it might be as fast as light"; relabel the readout. 2) (h): bare fibre wet, textured, re-fired patch by patch; the cut end showing sheath layers; irregular sheaths on the background fibres; a real frog muscle, not the egg blob. 3) Remove the near-empty scan frames at 13.5-14.0 s. 4) "34 vs 4": label it "model" or cut it (42.5 um spacing is far from real node spacing; bare fibres don't re-fire in discrete steps). 5) Vesicles inside the bouton in the 68-72 s tease. 6) All 21 claims OPEN until a person opens each source; AI-voice label and physiologist sign-off TODO.

### 004 r3 (Opus re-score of the real r2 file 592d4c2c: (a)4 (b)4 (c)4 (d)4 (e)4 (f)3 (g)4 (h)3)
1) Claims: 16 of 17 are "ok" on excerpts only: set OPEN, then read each source and record quotes; c7: the source gives a 10-15 nm cleft but the readout says 20-50 nm, reconcile. 2) Golgi/Cajal panels as lit 3D tissue at the synapse's quality (and network nodes up to the synapse's material). 3) Labels Ca2+, sacs and "nerve ending" clear of the badge and of each other (~35-37 s). 4) Break up holds at 15-26 s, 46-54 s and 26-30 s with a new shot or close-up every 2-4 s. 5) Air-sac capillaries as a real mesh. 6) scene/claims/clarity tables. 7) End card "Next: Where breath goes" (capital W). Frame 0 endings should read clearly as nerve endings. Also check the small end-card fact line meets 4.5:1. (Earlier reviewer notes that fixes were missing from the first r2 preview were about the stale r1 mp4; the real r2 file is 592d4c2c.)

### 005 r2 (not yet scored; r2 render unfinished) and the Opus r1 list already applied in r2
Opus r1: (a)3 (b)4 (c)4 (d)3 (e)4 (f)3 (g)4 (h)2. Applied in the r2 code (see 005 above). Still to finish: the r2 render (chunks 006-007), assemble, push, ask for scoring.

### 006 r3 (Opus r2 on 592d4c2c: (a)4 (b)4 (c)3 (d)3 (e)4 (f)3 (g)3 (h)2)
Good already: textured lobed neutrophil, labels/badges, hedges, end card. Order: 1) Read sources, record quotes, starting with c11, c13, c15, c19, c24. 2) Tease: lit anatomical heart, not the outline figure/valentine. 3) Real camera pull-out to a believable fingertip; remove the white clumps under the swelling (they read as pus). 4) 15-26 s: textured engraving dissolving into the living frog membrane, a visual change every 2-4 s. 5) Tissue-textured fibres (not smooth dowels); stop the cell passing through them at ~56 s. 6) Mark the faulty cell; restore its badge clear of the readout. 7) The three review tables; fix the stale c3 note.

Suggested order when resumed: finish the 005 r2 render, then 003 r4, 004 r3, 005 r3 (after scoring), 006 r3, folding Standards v2 into each. One Chromium job at a time.

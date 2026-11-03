# Review: Body Backstage No. 01 "Single file" (draft preview, 3 Nov 2026)

Independent review of `review/preview-ep01.mp4` (draft tier, 540×960, 15 fps, 70.4 s; −14.1 LUFS, −1.9 dBTP).
I pulled 72 frames with ffmpeg (every cut, every caption, label, badge, scale pill and counter on/off point, the
end card) and checked them against `script.md`, `vo/words.json`, `film.json`, `claims.json`, the brief (§1, 1b, 2, 3),
`bible.md` §0, the look test and `WRITING.md`. Times are seconds in the preview. Pixel positions are given at 1080×1920.
The draft has lighter depth of field and motion blur than the final will, and I allowed for that. Everything below is
about shape, material, layout, timing and wording, which the final tier will not change.

**Verdict: not ready for finals.** (a) and (h) are below the gate. Three findings are factual errors on screen (1–3).

## Scores

| | Point | Score | Evidence |
|---|---|---|---|
| a | First 2 s | **2** | The question "How does this cell fit?" is spoken by 1.0 s. But the frame-0 cell is a glossy red dome sitting comfortably in a pipe that is plainly wider than it (0–4.5 s). The picture argues against "Its pipe is narrower than it is" (2.2–3.7 s), so there is no "wait, what?". |
| b | One thread | **3** | The line runs fit, dent, folds, half its width, sickle, "that dent has a job". The 25 trillion count (11.5–16 s) and the meanwhile tally (58–63 s) are side facts that the thread doesn't need, and the tease turns to cargo without stitching it to the dent. |
| c | Picture moves with the sentence | **3** | Good: "dented disc" face-on (5.6 s), "no nucleus" cut-away (9.6 s), "pipes split" (17–21 s), the ghost for "half its width" (41 s). Bad: "tiniest pipe" points at a wide vessel (21.3 s); "no room to pass" plays over visible room (23.5–25 s); "stretches" never shows the wrong guess (27.5–29 s); "25 trillion" shows a few dozen cells (12.5–14 s); the meanwhile beat is the takeaway shot left standing (55–63 s). |
| d | Every camera move motivated | **3** | The moves are eased and land on cuts. Every one of the six scale changes is the same flat horizontal wipe (4.78, 16.78, 22.65, 42.25, 50.38, 63.58). The "craneBack to the hero in an artery" shot (4.8–16.8 s) has no artery: the cells float in a starfield. The ride-along (22.65–25.3 s) reads as a cut, not a ride. |
| e | Voice carries meaning, screen carries figures | **3** | "Less than half its width" plus the 3 µm pill, and "four months" plus the counter, are the model. But the voice says three bare counts ("twenty-five trillion", "over a hundred million", "a billion"), and the 25 trillion has no on-screen readout, only the caption. |
| f | Rhythm | **3** | Speech pace is good (about 2.7 words a second) and the takeaway lands with a short line. Both picture-only holds come after their reveals rather than before them (35.8–38.7 s after "parachute", 46.8–50.7 s after "four months"; WRITING rule 6). The wipe is identical six times, every beat has the same length and energy, and the end card holds exactly 2.0 s. |
| g | Ending: payoff, callback, tease | **3** | "That dent has a job" (56–57 s) is a fair button and the tease is specific. The hook's payoff (how it fits) lands at 34 s, not at the end. Nothing calls back to frame 0. The end card has no fact footnote. |
| h | Production value | **2** | Candy-gloss cells that read as torus or donut primitives, flat-shaded unlit cross-sections, cells floating in a starfield, a capillary "net" of straight cylinders, visible geometry seams at junctions, half-black wipe frames with orphaned HUD, and white-dot oxygen that reads as snow. None of the look test's signature beats appear: no scan view, no reticle lock-on, no glowing cut-edge reveal. |

Gate for finals: no score under 3, and (a), (g), (h) at 4 or more. **Fails on a (2), g (3), h (2).**

## Findings (most important first)

1. **Every micrometre unit renders as "MM"** (7.5 MM at 6.8–9.2 s; 3 MM at 40.4–41.9 s; 50 MM at 45.2–50.4 s). On screen
   the cell reads 7.5 millimetres, a thousand times too big. That is a factual error in every scale pill.
   Cause: the theme's `.hud-scale { text-transform: none }` override isn't taking effect in the render. Both letters come
   out capitalised (µ→Μ, m→M), so the uppercase rule is still applied. Also, Atkinson Hyperlegible Mono has no U+00B5
   (micro sign) glyph, though it does have U+03BC (Greek mu).
   **Fix:** set the unit text as `7.5 μm` using U+03BC, and give the scale pills an explicit `text-transform: none` that
   wins (`.hud .hud-scale, .hud .hud-scale .tx`, or inline). Then check the pill in a DOM screenshot before rendering.
   Do the same for `.hud-counter .u`.

2. **The picture contradicts the hook and the "no room" line.** At 0–4.5 s the vessel is about 15% wider than the hero
   cell (wall to wall about 310 px against about 270 px in the frame) while the voice says "Its pipe is narrower than it
   is". At 21.3 s "tiniest pipe" labels a vessel about twice the cell's width. At 23.5–25 s "There's no room to pass"
   plays with clear gaps on both sides of the cell.
   **Fix:** frame 0 must show the squeeze: the hero folded into a parachute, touching both walls, in the 3 µm segment.
   Put a pre-fold ghost outline wider than the tube behind it so the eye sees "doesn't fit" at once. Move the
   "tiniest pipe" label to the real capillary. During the ride, narrow the lumen so the cell's rim brushes the wall.

3. **"You'd guess it just stretches to fit. It can't." (29.9–30.8 s) is a factual regression.** Red cells do lengthen
   easily; what they can't do is grow their membrane area (c7's note). The 26 Oct audit fixed this exact line to "its
   surface stretches to fit", and the friend-speak rewrite undid that fix. c10's and c16's notes likewise cite wordings
   ("The tightest vessels", "That dimple isn't decoration") that are no longer in the script. Smaller: "threw out its own
   nucleus *to make room*" (c3) states a purpose that the source excerpt doesn't support.
   **Fix:** "You'd guess its skin just stretches to fit. It can't." Re-voice it. Bring each claims.json note in line with
   the current sentence. Hedge or cut "to make room" (for example "and that leaves more room", if a source supports it).

4. **Red cells still read as glossy candy, and often as donuts** (owner fix 1: partly met). The shape is now a dented
   disc and it folds (36–41 s), which is real progress. But the material has hard clearcoat hotspots in every close-up
   (0, 5.6, 23.5, 30.2, 34.5, 51.5, 63.7 s), so the hero reads as a cherry or a sweet. The dimple is cut so deep that
   side views read as a torus with a hole (17.5–21.3, 22.7, 30.2 top, 37.5, 53 s). At 25–25.6 s there are dashed white
   streak artefacts on the cells (blur sampling).
   **Fix:** cut the clearcoat (roughness about 0.35–0.45 with a broad, soft lobe), add the wet sheen as a fresnel rim
   rather than point highlights, and add subsurface scattering so the thin centre glows lighter than the rim (the
   tell-tale of a real red cell). Make the dimple shallower (Evans–Fung centre thickness about 1 µm, not near zero).
   Check the streaks at the final K.

5. **The speed badge sits inside the title zone** (owner fix 2: fails, 0–2.4 s). "▶ 100× SLOWER" spans about x 474–896,
   y 254–324 at 1080. That is inside the title scrim (`.hud-title::before` reaches about 280 px above the title) and
   about 6 px above the series line. The title's pulse line runs under it to x≈900. Bible §0 says nothing is placed over
   the series line or the title while they show.
   **Fix:** hold the speed badge until the title leaves (2.4 s), or put it top right below the title block (y≥620 at
   1080, clear of the scrim). Add a render-audit rule that fails any HUD box intersecting the title scrim's rectangle.

6. **Scale-change wipes leave half the frame flat black, with orphaned HUD on it** (4.75, 16.7, 22.6, 42.3, 50.3,
   63.6 s). "red blood cell" (16.7 s) and "tiniest pipe" (22.6 s) point at black. The "4 MONTHS" counter and the "50 MM"
   pill lose their plates and float over black (50.3 s). The tally floats plateless (63.6 s). The same flat wipe six
   times reads as a stock transition.
   **Fix:** retire every label, pill and counter 0.3 s before the sweep starts. Render the incoming shot behind the sweep
   line instead of black (a real scan reveal: old tissue above the line, the new scale below it, the edge glowing), and
   vary it: use a match-cut or a push for at least three of the six.

7. **Production value (h): primitives and seams.**
   - 42.6–50.4 s: the capillary "net" is a few straight cylinders with dotted cells and empty black between them. It
     reads as a default render; real beds are a dense, tapering, branching mesh in tissue.
   - 4.8–16.8 s: the "artery" shot has no vessel; the cells drift in a starfield.
   - Visible seams and grey bands at vessel junctions: 19, 20.5, 22.7 (a grey strip crosses in front of the hero
     cell), 53 and 58.2 s.
   - Cells interpenetrate (19 s) or sit over or through the branch walls (20.5, 21.3 s).
   - Cut-away faces are flat, unlit pink (9.6–11, 31.5–33, 66–68.4 s).
   - The O₂ dots are uniform white spheres scattered outside the vessel like snow (53.9–63 s).
   - The bloom clips to white on the cargo shot (68.0 s).

   **Fix:**
   - Build the net as a tapered branching mesh with a tissue bed and parallax layers.
   - Stage the meet shot inside an artery lumen (wall out of focus behind, light shafts).
   - Weld the junction geometry and add collision against the walls for the flow.
   - Shade cut faces with the scan view (dark glass core, glowing iso-slices).
   - Give the O₂ different sizes, depth of field, and a flow direction from cell to tissue.
   - Cap the bloom.

   The look test's scan view and reticle lock never appear in this cut. Use them on the two hero beats (the squeeze at
   36–41 s and the sickle jam).

8. **The sickle cell isn't jammed when it's named** (53.7–55 s). It floats in a lumen wider than it, and it reads as a
   flat cartoon crescent moon. By 57 s it does look wedged, with cells queued behind, which is the shot the line needs.
   **Fix:** have it lodged and the queue built by the word "jam" (53.6 s). Give it the same wet material as the healthy
   cells, with irregular pointed tips and a bit of surface texture. Keep the "illustration · not to scale" badge.

9. **Counts instead of comparisons** (owner, brief §2). The voice says "twenty-five trillion" (12.5 s) as a bare number;
   "most of your own cells" helps but comes second. "Over a hundred million" (61 s) and "a billion passengers" (66 s)
   are also counts.
   **Fix:** lead with the comparison and move the number to a readout. For example: "Of all your own cells, most are
   these: about five in every six." Put "≈25 trillion" on screen. For the tally: "your bones made more new ones than
   there are people in Japan" or "about two million every second you watch", but only if computed and sourced in
   claims.json. Keep the exact figure on the tally.

10. **The ending doesn't loop back.** The hook's question gets its answer at 34 s. The last picture (66–68.4 s) is a
    cross-section full of dots, and the end card (68.4–70.4 s) has no fact footnote.
    **Fix:** after "That dent has a job", end on the frame-0 composition (the hero in the 3 µm squeeze, now understood),
    then the tease. Add a footnote such as "Narrowest vessels a red cell passes: about 3 µm (Univ. of Rochester)".
    Hold the end card 2.5 s or more.

11. **End-card layout** (68.4–70.4 s). The title "Next, inside: a / billion passengers" sits on the white-dotted cell
    under a thin scrim, so it's busy at 68.6 s. The line breaks with "a" stranded at the end. The script's card reads
    "Next: A billion passengers". At 68.6 s the two top-right badges ghost on top of each other while fading.
    **Fix:** use a solid end-card plate. Break the line as "Next, inside:" / "a billion passengers". Fade out the badges
    before the card fades in.

12. **Small type below the scale.** "you are here" under the locator (5.2–16.7 s, about 18 px tall at 1080, and partly
    blown out by the cell's halo at 5.2 s). The "7.5 MM" pill shows text with no bar, floating away from the cell (6.8 s).
    The "3 µm" bar (40.4 s) is not laid across the vessel it measures. The O₂ label crowds the badges (55.5 s, three
    notes in the top-right corner, against WRITING picture rule 8). At 57–58 s its leader points at no particular dot.
    **Fix:** bring the locator caption up to the label size (600, about 30 px at 1080) and give it a plate. Lay the
    3 µm bar across the vessel lumen at the squeeze. Anchor the O₂ label to a dot leaving the vessel, on the side away
    from the badges. Measured contrast is fine everywhere I sampled (the caption's unspoken words ≈6.4:1, the series
    line ≈10:1).

13. **Voice takes to listen to.** The recogniser heard extra sounds: "It can't eh" (vo04, a tail of about 0.25 s after
    "can't" at 30.3 s), "Of each one…" (vo02 at 5.1 s), "I follow one…" (vo03 at 17.1 s) and "And meanwhile…" (vo07 at
    58.3 s). They may be breaths or clicks at the line starts.
    **Fix:** listen to each one on headphones, then trim or re-take it.

14. **Minor timing points.**
    - The speed badge reads "100× SLOWER" at 22.7 s, after the ride-along has started (the clock is ramping to 10×). It
      should switch on the cut.
    - The "no nucleus" label is still fading at 12.5 s while its anchor has drifted off the cell; end it at 11.4 s.
    - The meanwhile beat's camera doesn't change at all from the takeaway (55–63 s). Give it a slow pull back so the
      tally has its own picture (WRITING picture rule 4: every beat changes the picture).

## What works

- The shape fix is real: dented discs that fold into a bullet or parachute through the 3 µm neck (36–41 s), and the
  ghost of "its full width" beside the folded cell is the best explanatory frame in the film (41.2 s).
- Captions are clean, plated, inside the safe box (y≈1220–1340 at 1080), with karaoke highlighting on the spoken word.
- The "4 MONTHS" life counter and the meanwhile tally on the pulse line are good HUD ideas: 117 million at 58.5 s, so
  "over a hundred million" holds.
- Loudness is on target: −14.1 LUFS, −1.9 dBTP.
- Badges stay within two per corner, apart from the O₂ moment.
- The "illustration · not to scale" honesty badge is present on the sickle cell.

## Placeholders and open items (TODO)

- A physiologist's sign-off, the channel handle, and the AI-voice label in the post (script Notes).
- Every source was checked only through search excerpts. A person opens each link before posting.

---

# Round 2 (re-render, 3 Nov 2026)

The same reviewer, re-scoring against its own round-1 findings. Source: the re-rendered `review/preview-ep01.mp4`
(draft, 540×960, 70.4 s, −14.1 LUFS, −1.9 dBTP). I pulled 61 new frames: every cut (4.78, 16.38, 22.22, 42.25, 50.38,
63.58, 68.4), every label, pill, badge and counter on/off point, and the end card.

**Verdict: still not ready for finals.** No score is under 3 now, but (a), (g) and (h) are each at 3 and need 4.

## Scores

| | Point | R1 | R2 | Why it moved, or didn't |
|---|---|---|---|---|
| a | First 2 s | 2 | **3** | The ghost of the full width is wider than the pipe from frame 0, so "narrower than it is" now reads. But the striking element is a pale, unlabelled translucent shell around a pink dome that still fits the pipe comfortably. There is no fold or squeeze at frame 0, and a first-time viewer can read the shell as a bubble. |
| b | One thread | 3 | **3** | Better: "outnumber all your other cells put together" replaces the bare count. But the nucleus and the outnumber lines are still side steps off "how does it fit". The meanwhile beat and the tease still branch away from the dent. |
| c | Picture moves with the sentence | 3 | **3** | The hook is fixed. "Tiniest pipe" still labels a vessel about twice the cell's width (20.7–22.2 s). "No room to pass" still plays over visible room (23.5 s). The meanwhile beat still reuses the takeaway frame (55–63 s). |
| d | Camera moves motivated | 3 | **3** | Unchanged: six identical sweeps, the artery shot with no artery, the ride-along that reads as a cut. |
| e | Voice meaning, screen figures | 3 | **4** | The 25 trillion is now a comparison in the voice. The two remaining counts ("over a hundred million", "a billion") have exact figures on screen (the tally, the caption). μm units are correct on every pill. |
| f | Rhythm | 3 | **3** | Unchanged: the holds still come after their reveals (35.8–38.7, 46.8–50.7 s), the sweep is the same each time, and the beats are even. |
| g | Ending | 3 | **3** | The end card is better: "Next: a billion passengers" breaks cleanly and a sourced fact line is added. Still no loop back to frame 0; the hook's payoff stays at 34 s. |
| h | Production value | 2 | **3** | Real gains: softer satin cells with no hard hotspots (5.4, 30, 52 s), the scan-view reveal in the net (43.5–50 s, the look's signature finally on screen), and a textured raster in the sweeps instead of black. Still there: straight-cylinder net, starfield artery shot, junction seams, donut side views, snow-like O₂, HUD orphaned on the sweeps. |

**Blocks a final:** (a) 3, (g) 3, (h) 3. Each needs 4.

## Round-1 findings: status

| # | Finding | Status | Evidence in round 2 |
|---|---|---|---|
| 1 | μm rendered as "MM" | **Fixed** | "7.5 μm" (6.7–11 s), "3 μm" (40.4–41.9 s), "50 μm" (45.2–50 s); the end-card fact also reads "3 μm". |
| 2 | Picture contradicts the hook and "no room" | **Partly** | Hook fixed by the ghost (0–4 s). "Tiniest pipe" (20.7–22.2 s) and "no room to pass" (23.5–25 s) are unchanged. |
| 3 | "It can't [stretch]" regression; "to make room" | **Fixed** | The voice now says "its skin just stretches… It can't", and "to make room" is gone. Left over: the notes for c2 ("about seven and a half") and c3 ("pushed out its own nucleus") still quote old wordings. |
| 4 | Glossy candy cells, donuts, streaks | **Partly** | The highlights are soft now: fix 1 is met on material. The torus or donut read remains in side and bottom views (22.3, 25, 25.6, 30 top, 33.5 s). At 25 s a vertical white sliver shows inside the dimple of the upper cell. |
| 5 | Speed badge in the title zone | **Fixed** | The badge first appears at about 2.7 s. For about 0.2 s (2.7–2.9 s) it shares the frame with the title as the title fades (2.8 s). Fix 2 is met in practice. If you want zero overlap, start it at the title's fully-out time. |
| 6 | Sweeps: black half-frame, orphaned HUD | **Partly** | The band is a teal raster now, not black. Still: "red blood cell" on the band pointing at nothing (16.3 s), "tiniest pipe" the same (22.1 s), the "4 months" counter and the "50 μm" pill on the band (50.3 s) and ghosting into the next shot (50.45 s), the tally on the band (63.5 s). The band still hides the incoming shot, and all six sweeps are identical. |
| 7 | Primitives and seams | **Partly** | Scan view added to the net (43.5–50 s). Known and still open: straight-cylinder net, starfield meet shot (4.8–16.4 s), seams (22.3 s grey strip through the hero cell, 52 and 58 s junctions), overlapping cells (17.5 s), snow-like O₂ (53.9–63 s), clipped bloom on the cargo shot (68.2 s). |
| 8 | Sickle cell not jammed on "jam" | **Open** | Known: it floats in a wider lumen at 53.9 s. |
| 9 | Counts instead of comparisons | **Partly** | 25 trillion is fixed. "Over a hundred million" and "a billion" stay counts, now backed by figures on screen. Acceptable for (e). |
| 10 | No loop back; no footnote | **Partly** | Fact line added (68.7–70.4 s). No loop back to the frame-0 squeeze. |
| 11 | End-card layout | **Partly** | The line break and the wording are fixed. The card still sits over the dotted cell under a thin scrim, and a faint ghost of "100× SLOWER" is still visible at 68.7 s. |
| 12 | Small type, pill placement, O₂ crowding | **Open** | "you are here" is still about 18 px tall at 1080 (5.4–15 s). The 7.5 μm pill is text only, away from the cell (7 s). The 3 μm bar floats left of the vessel instead of across it (40.5 s). Three notes sit in the top-right corner at 55.5 s. |
| 13 | Stray sounds in the voice | **Open** | `vo/words.json` still hears "I follow" (vo03), "It can't eh" (vo04) and "And meanwhile" (vo07). Listen to each and trim. |
| 14 | Small timing | **Partly** | "no nucleus" now lands on "nucleus" (11.3–13.3 s), which fixes that one. The meanwhile beat still has no picture of its own (55–63 s). |

## New in round 2

- **N1 (44–49 s) The "SCAN VIEW · BLOOD FLOW" tag crowds the caption.** It sits at about y 1165 at 1080, almost touching
  the caption plate (about 1180). The 50 μm pill stacks directly under it. The voice never says what the scan is
  showing, so the signature beat lands as decoration.
  **Fix:** park the tag at the right end of the scan line, at least 40 px above the plate. Move the 50 μm pill above the
  line. Time the sweep so its rise lands on "whole life".
- **N2 (0–4 s) The hook's ghost has no name until 41 s.**
  **Fix:** a 1 s "its full width" tag (the same label style as 41 s) on "narrower" (2.8 s), or fold the real cell
  visibly as it enters the ghost. Either earns (a) a 4: the viewer must see "too wide" and "it folds anyway" by 2–3 s.
- **N3 (0–0.5 s) The ghost's top edge sits about 20 px under the title's pulse line, inside the title's dark backing.**
  It doesn't cross the line, but it crowds it.
  **Fix:** frame the ghost 60 px or more lower at frame 0.
- **N4 (claims) Stale notes.** c2's and c3's notes quote earlier wordings. Bring them in line with "dented disc, pressed
  in on both sides" and "threw out its own nucleus".

## What gets this to the final gate

1. **(a) to 4:** label the ghost by about 2.8 s, or show the fold at frame 0, inside the 3 μm segment with the walls
   touching (N2 and #2).
2. **(g) to 4:** end on the frame-0 composition after "That dent has a job", now understood, then the tease (#10).
3. **(h) to 4:**
   - Retire every HUD element before each sweep, and show the incoming shot under the band (#6).
   - Weld the junction seams and stop cells overlapping each other and the walls (#7).
   - Make the dimple shallower so side views stop reading as donuts (#4).
   - Put the meet shot inside a vessel (#7).
   - Give the O₂ different sizes, depth of field and a flow direction (#7).

   The straight-cylinder net is the largest single gap left, but its new scan view rescues it in part. Rebuild it as a
   branching mesh if time allows.
4. **Also before the final:** listen to and trim the voice takes (#13), and fix the sickle-cell timing (#8, a story
   point).

---

# Round 3 (re-render, 3 Nov 2026)

The same reviewer. I pulled 33 new frames from the re-rendered preview (70.4 s): the hook, every sweep (4.75, 16.3,
16.45, 22.1, 42.3, 50.3, 63.5), the meet shot, the ride-along, the net, the sickle cell and O₂, and the end card through
to the loop.

**Verdict: (a) and (g) now pass. (h) at 3 still blocks the final.**

## Scores

| | Point | R1 | R2 | R3 | Note |
|---|---|---|---|---|---|
| a | First 2 s | 2 | 3 | **4** | The ghost of the full width is visibly wider than the pipe from frame 0, and the question comes by 1.0 s. The label "its full width" lands on "narrower" (2.8 s), so the contradiction is named. It's not a 5: there's no fold at frame 0, and the hero is still a dome inside a pale shell. |
| b | One thread | 3 | 3 | **3** | Unchanged script: the nucleus and outnumber lines and the meanwhile tally are still side steps. |
| c | Picture moves with the sentence | 3 | 3 | **3** | "Tiniest pipe" still labels a wide vessel (20.8 s); "no room to pass" still has room (23.5 s); the meanwhile beat reuses the takeaway frame (60 s). |
| d | Camera moves motivated | 3 | 3 | **3** | The sweeps alternate direction and the meet shot now sits in an artery (the wet wall out of focus behind, 9–14 s). The ride-along still reads as a cut. |
| e | Voice meaning, screen figures | 3 | 4 | **4** | Unchanged. |
| f | Rhythm | 3 | 3 | **3** | Unchanged: the holds still come after their reveals. |
| g | Ending | 3 | 3 | **4** | The card fades over a sweep back to the frame-0 composition (pipe plus ghost visible behind the card at 70.3 s), so the replay seam matches. Button, tease and sourced fact are all in place. The loop is dim under the card scrim, and the hook's payoff still lands at 34 s, not at the end. |
| h | Production value | 2 | 3 | **3** | Better: the sweeps are clean (no HUD on the band at 4.75, 16.3, 22.1, 42.3, 50.3, 63.5 s), the meet shot is in an artery, and the badges are sentence case. Still fails "no frame reads as a default render" at:<br>• 22.3 s: a grey seam strip runs through the hero cell on the first ride-along frame.<br>• 43.5–50 s: the net is straight cylinders.<br>• 22.3, 25, 33.5 s: side views read as donuts, and at 25 s there's a white sliver in the dimple.<br>• 53.9–63 s: the O₂ reads as snow.<br>• 17.5 s: cells overlap. |

**Blocks a final:** (h) at 3. (a) and (g) are at 4 and no score is under 3.

## Round-1 and round-2 findings, round-3 status

- **Now fixed:**
  - #6 (sweeps leaving HUD orphaned on the band).
  - #10 (loop back to frame 0, with the fact line).
  - #11 (end card; the ghost badge at 68.7 s is gone).
  - N2 (the hook's ghost is now labelled).
- **Improved, still partly:**
  - #7: the artery wall is now in the meet shot. The net, the seams and the overlaps are known and unchanged.
- **Still open:**
  - #2 (tail): "tiniest pipe" (20.8 s) and "no room" (23.5 s).
  - #4 (tail): donut side views, and the dimple sliver at 25 s.
  - #8: the sickle cell isn't jammed on "jam" (53.9 s).
  - #12: the 3 μm bar orientation, the "you are here" size, and three notes in the top-right corner at 55.5 s.
  - #13: voice artefacts, flagged for a human listen (the owner keeps this voice).
  - #14 (tail): the meanwhile beat has no picture of its own.
  - N1: the scan tag almost touches the caption plate at 44 s.

## New in round 3 (small)

- **R3-1 (4.2–4.4 s)** The "its full width" label is still fading after the ghost has left the frame, and its leader runs
  to the bottom edge, pointing at nothing.
  **Fix:** end the label 0.2 s before the ghost exits, or keep the leader anchored on screen.
- **R3-2 (22.1 s)** The upward sweep line passes through the incoming caption ("into the tiniest ones") as it fades.
  **Fix:** delay the caption until the line has cleared the caption band, or let the caption plate sit above the band's
  raster.
- **R3-3 (2.7–2.9 s)** The speed badge fades in while the title is still fading out. It never crosses the title, but
  starting it at the title's fully-out time keeps owner fix 2 strict.

## What still blocks the final: (h) to 4

1. Weld or hide the junction seam that cuts through the hero cell at the start of the ride-along (22.3 s). It is the
   most visible default-render frame in the film.
2. Make the dimple shallower so side and bottom views stop reading as donuts (22.3, 25, 33.5 s), and remove the white
   sliver inside the dimple at 25 s.
3. Stop cells overlapping each other and the walls (17.5 s).
4. Give the O₂ different sizes, depth of field and a flow direction (53.9–63 s).
5. The straight-cylinder net (43.5–50 s) is the remaining large gap. The scan view carries the lower half, but the
   upper half is bare tubes on black. A tapering, branching mesh, or at least a tissue bed with parallax behind the
   tubes, would close it.

Items 1–4 are local fixes. With them done and the net at least given a bed, I would expect (h) at 4. The sickle timing
(#8) and the voice listen (#13) should be closed before the final too, though they don't gate a score.

---

# Round 4 (re-render, 3 Nov 2026)

The same reviewer. I pulled 16 new frames targeted at the (h) blockers and the hook timing:
0, 2.9, 3.3, 4.1, 17.5, 22.3, 22.6, 25, 30, 33.5, 44, 47, 55.5, 58.5, 60 and 64.5 s.

**Verdict: (h) reaches 4, just.** Every gate is now met: no score under 3, and (a), (g) and (h) at 4. Nothing factual
is open. The finals can go ahead, with the polish items below checked on the final-tier stills.

## Scores

| | Point | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|
| a | First 2 s | 2 | 3 | 4 | **4** |
| b | One thread | 3 | 3 | 3 | **3** |
| c | Picture moves with the sentence | 3 | 3 | 3 | **3** |
| d | Camera moves motivated | 3 | 3 | 3 | **3** |
| e | Voice meaning, screen figures | 3 | 4 | 4 | **4** |
| f | Rhythm | 3 | 3 | 3 | **3** |
| g | Ending | 3 | 3 | 4 | **4** |
| h | Production value | 2 | 3 | 3 | **4** |

## The round-3 (h) blockers

| # | Blocker | R4 | Evidence |
|---|---|---|---|
| 1 | Seam strip through the hero cell at 22.3 s | **Fixed** | 22.3 and 22.6 s are clean: the hero cell sits alone in the lumen. |
| 2 | Donut side views | **Fixed in side views, partly underneath** | At 30 and 33.5 s the cells now read as dented discs; "the dent" points at a real dimple. Bottom-up views (22.6, 25 s) still show a dark central pit, but it reads as a dimple, not a hole. The thin white vertical sliver inside the upper cell's dimple at 25 s is still there. |
| 3 | O₂ like snow | **Partly** | The sizes now vary and the dots are glassier (55.5, 58.5 s). They still read as loose white beads at draft, with no clear flow from vessel to tissue. |
| 4 | Bare straight-cylinder net | **Fixed enough** | The wet tissue bed with its cell texture (44, 47 s) turns the upper half from tubes on black into vessels lying on tissue. The scan view carries the lower half. The vessels themselves are still straight tubes, now acceptable in context. |
| 5 | Overlapping cells | **Open (known)** | At 17.5 s two cells still touch and stack. It reads as a short rouleau, so it's tolerable, but it's not intended. |

Also fixed: the speed badge now comes in only after the title is fully gone (3.3 s; the title is out by 2.9 s), and the
"its full width" label leaves before the ghost does (4.1 s). Owner fix 2 holds strictly, and the leftover leader from
R3-1 is gone.

**Why only 4:** these frames no longer read as a default render. What keeps (h) from 5 is the O₂ beads, the sickle
cell's flat cartoon crescent, the 25 s sliver, and the straight net vessels.

## Still open (none blocks the gate)

- **Story:**
  - #8: the sickle cell isn't jammed on "jam" (53.9 s).
  - #2 tail: "tiniest pipe" labels a wide vessel (20.8 s), and "no room to pass" plays over visible room (23.5 s).
  - #14 tail: the meanwhile beat has no picture of its own (58.5–63 s).
- **HUD:**
  - #12: the 3 μm bar is not laid across the vessel, and "you are here" is still small.
  - #12: three notes in the top-right corner at 55.5 s.
  - N1: the scan tag almost touches the caption plate at 44 s.
  - R3-2: the sweep line passes through the incoming caption at 22.1 s.
- **Voice (#13):** the recogniser still hears "I follow", "It can't eh" and "And meanwhile". The owner keeps this
  voice; a human listens before posting.
- **Pre-final checks on final-tier stills:** the 25 s dimple sliver, the 17.5 s overlap, and the bloom on the cargo
  shot (68 s).

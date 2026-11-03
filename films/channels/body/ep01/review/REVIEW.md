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

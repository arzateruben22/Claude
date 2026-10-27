# Draft review, round 2 (26 Oct): confirmed findings, not yet applied

From the independent two-lens review of the round-2 draft cut (text/layout and picture), each finding verified by a
second agent. Times are film seconds; pixel positions are in the 540×960 draft unless stated. Scratch paths below
point at the reviewers' working files in the session scratchpad (not kept).

```text
=== text ===
OVERALL: Text and layout are mostly clean. Captions, safe box, contrast (caption text 8-12:1, end card 9:1), spine handovers (no overprints; the 0.4 s gaps hold) and notes all hold up. The problems are in the whoa and the readout. One is a hard bug: the 'you' label never shows, because A("vo05:The") matched 'the spin' and inverted its window (t1 42.93 < t0 44.33), so 'Stand there' has nothing to point at, and its label ping still plays at 44.33. The 'a sunrise' pill is clamped against the safe box's right edge onto its own anchor: it fades in over Venus, hides Earth from 49.07 to 49.40, and touches the Sun's glow. Retiming it to about 49.53 avoids both planets. The 1962 radar ping is sped-up light with no 'light sped up' note, while the readout's ping has one. In the readout push, Venus's bright teal pin reads as the round trip's path next to the '4 min round trip' leader and later crosses the end-card title; fading the pin from CUE.echo fixes both. The rest is polish: the end-card title fading in over Earth, the spine label touching Venus's limb in the true-turn close-up, 'west' 0.8 s early, the Sun pill touching Venus, two stranded caption words (the glue fix was checked by simulation), the 27 px dial note, and 'clouds: drawn' missing on the readout's big Venus. Not reported, because they are series conventions: the readout value arriving on 'Light' and the duplicate '6 min' / '4 min' pills (ep02/ep04/ep05 do the same), and the title band. Working sheets and crops are in /tmp/claude-0/-home-user-Claude/fdb5bb83-b6fe-516c-99e3-ad5ff34dc051/scratchpad/review4/ep03/text/ (all 1120 draft frames in text/all/aNNNN.jpg, t = (NNNN-1)/15). No repository file was changed.

--- [text1] high t=42.46-45.9
PROBLEM: The 'you' label never appears. In compile.py, l-you has t1 = round(A("vo05:The") - 0.2, 4). A() takes the first 'the' in the line, which is 'the spin' at 43.13, so t1 = 42.93 comes before t0 = 44.33 (film.json: t0 44.3333, t1 42.9333). The label is never drawn, and the cues 'shown' map has no l-you entry. So on 'Stand there' nothing on screen points to where 'there' is, and the only marker of the pin is a tiny teal patch on a small Venus. Its sound still plays: build/audio/cues-placed.json places a label ping for l-you at 44.33 with no picture.
FIX: compile.py LABELS l-you: "t1": round(A("vo05:Sun") - 0.2, 4) (45.5) and add "v": "middle". In scene.mjs, raise the diagram anchor so the side-1 pill also clears the disc: above = vp.map((v, j) => v + camY[j] * VR * big * 2.0) instead of 1.6. Only l-you uses anchor 'pin', and the close-view blend via wf is unchanged. The pill then spans about centre−52 to centre−13 px at 540, which puts its top ≥ 13 px under both top notes from 44.3 to 45.9. Add the assert that every LABELS/COUNTERS/BADGES entry has t1 > t0; only l-you violates it today. Check stills at 44.4, 44.8, 45.07 and 45.4.
NOTE: Confirmed. film.json l-you has t0 44.3333 and t1 42.9333. presence() then gives q=1 from 43.33, so opacity is 0 on every frame. I stepped through 44.0–46.2 at 15 fps and no pill appears. cues-placed.json still schedules the l-you ping at 44.33, and the shown map has no l-you. In vo05, 'the' #1 is 'the spin' (43.13) and #3 is 'The Sun' (45.69), so A('vo05:Sun') - 0.2 = 45.5 is what the comment ('gone before the Sun passes under it') and CUE.dial0 intend. The placement follow-up is right, but the numbers are off. The pill is about 39 px tall at 540, so 'middle' lowers it by h/2 + 6 ≈ 25 px, not 15. I measured Venus's centre at (338,245) at 44.33, (279,225) at 44.8, (242,227) at 45.07 and (187,252) at 45.53, with disc r ≈ 16 px and the anchor about 26 px above centre. With 'above', at about 45.07 the pill's top-left corner overlaps the tl speed plate (bottom y 160) by about 4 px, and at 44.8 it sits 2 px under the tr plate. With 'middle' alone, the pill (left edge at centre+8) covers a sliver of Venus's upper-right limb, about 8×9 px at 540. It does not cover the teal pin patch, which stays on the disc's upper left for the whole window.

--- [text2] medium t=48.43-52.4
PROBLEM: The 'a sunrise' label sits wrong for its whole life. Its anchor (the tick's outer end, x about 0.71 W) leaves no room to its right inside the safe box. hud.js clamps cands[0] to SAFE.r - w, so the pill (x 302-450 at 540) lands right on its own anchor dot with no leader, and its left end sits in the Sun's glow. Venus is on the tick at the moment of sunrise, so the pill fades in over Venus: from 48.43 to 48.8 the disc shows through 'sunrise'. Then Earth passes fully behind the pill from 49.07 to 49.40. A body vanishes under a label while the caption says 'rising in the west'.
FIX: compile.py l-rise: "t0": round(SUNRISES[RISE_I]["t"] + 1.2, 4) (≈ 49.63, on 'west'; +1.1 also works but is flush with Earth on its first frame), "t1": round(SUNRISES[RISE_I]["t"] + 4.4, 4). Keep side 1 and v 'above'. Optionally use "text": "sunrise". Update the README line that says 'a sunrise' names the tick on 'rising in the west'.
NOTE: Confirmed at 15 fps. From 48.47 to 48.6 Venus shows through 'sunrise' as the pill fades in, and at 48.6 it is under the pill. From 49.07 to 49.4 Earth slides behind the pill's right end and is almost hidden at 49.27. The pill is clamped to x 302–450 (SAFE.r − w). Its anchor dot sits about 6 px under the bottom edge, so there is effectively no leader, and the pill's left end is in the Sun's glow. Checking the proposed window: at 49.53 Earth's lower limb (y ≈ 305) is level with the pill's settled top edge (≈ 306). Only the 0.45 s slide-up (dy 0.012 H) keeps them apart, and +1.2 s gives about 10 px of clearance. Venus is on the left or top of the orbit from 49.7 to 52.3. It returns to the tick at about 53.28, after a t1 of 52.83 has faded (53.23). The text change to 'sunrise' is optional.

--- [text3] low t=28.53-32.6
PROBLEM: The 1962 radar ping is a sped-up cheat with no honesty note. scene.mjs sends the pulse from Earth to Venus between CUE.radar and CUE.pierce (2.03 s) and back by 32.6, for a trip that really takes minutes. The readout's ping, which does the same thing, carries 'light sped up', and this one doesn't. Nothing in the top-left slot qualifies it: the orbit's note has no text from 26.67 to 33.7.
FIX: As proposed: BADGES add {"id": "b-light-r", "text": "light sped up", "t0": t_radar, "t1": round(2 * A("vo04:pierced") - t_radar, 4), "slot": "tl"}, appended after the existing entries. Add 'the 1962 radar ping (why)' to the README honesty table's 'light sped up' row.
NOTE: Real, but small on screen. The ping is visible only from about 30.2 to 30.47 (inbound) and 30.67 to 30.93 (outbound). It crosses about 150 px, roughly 25 million km, in 0.3 s, so it is far faster than light. The readout's identical ping carries 'light sped up', and this one has no note. The tl slot is empty from 26.97 (the orbit note's fade-out) until b-spin at 33.7, and Venus's top is at about 0.24 H with fx 0.42, so a row-1 note at y 125–160 (540) is clear.

--- [text4] medium t=64.5-69
PROBLEM: In the readout's push onto Earth and Venus, the thickest and brightest teal stroke is Venus's meridian pin, not the round trip. Its end meets the leader dot of '4 min round trip', so it reads as the radar's path into Venus, while the real hop (the echo segment) is a short, thin line between the limbs. The caption names the round trip, but the pin is the line that wins. The same arc then crosses 'that' in the end-card title as the card fades in (67.9-69.0).
FIX: scene.mjs: const pinK = (1 - winOp(t, CUE.close, CUE.g1 - 0.4, 0.4)) * (1 - 0.7 * winOp(t, CUE.radar, CUE.true - 0.4, 0.35)) * (1 - winOp(t, CUE.echo, FILM.dur, 0.5)). This turns off the meridian and the 'you' beacon from 64.97 to the end. Check a still at 66.5 to confirm the echo line and ping are now the brightest teal.
NOTE: Confirmed in f066–f068 and at 15 fps from 64.4 to 66.0. The pin meridian becomes a thick bright teal arc across Venus during the push, and its left end meets the '4 min round trip' leader dot. The actual echo segment is a thin stub of about 48 px. Through the end-card fade-in (67.87–68.13) the arc crosses 'that', and a faint teal arc stays visible through the card's scrim from 68.7 to 69.3. The last frame shows no teal on Venus, so turning the pin off from the echo onward leaves the loop to frame 0 as it is now.

--- [text5] low t=67.8-68.3
PROBLEM: The end-card title fades in on top of the planets. 'Next light:' arrives at about 50% opacity over Earth's bright disc, and 'the Moon that' plus the footnote's 'in 1962:' sit over Venus's lit limb. The cause: eK only starts shrinking Earth at FILM.endCard, the same moment the title starts fading in.
FIX: As proposed: const eK = 1 - E.inout2(seg(t, FILM.endCard - 0.5, FILM.endCard + 0.1)); (keep the separate shot === "end" test on the dial's opacity).
NOTE: Confirmed. At 67.87 and 67.93 'Next light:' is fading in at partial opacity over Earth's bright disc, and the title and footnote sit over Venus's lit limb. It is gone by about 68.1. The proposed eK is equivalent to the current shot test before endCard − 0.5 (seg clamps). Earth, the echo line and the ping finish by 67.9. Its shrink starts at 67.3, after 'minutes' starts (66.84) and as l-echo and the 4 min spine leave. Venus under the title is the end card's accepted style.

--- [text6] low t=33.7-42.13
PROBLEM: In the true-turn close-up, the spine label ('radar · one turn, days', then 'one turn · one year (days)') sits flush against Venus's lower limb. Measured at 540: the limb ends at y 496-497 and the label glyphs start at 500, a 2-3 px gap, inside the rim glow. The hook and the change beat had 8-12 px. It reads as text printed on the subject.
FIX: Keep the dist values and raise Venus instead. In compile.py CAM 'space', add fy=0.38-0.01, i.e. fy=0.37, to the four keys at t_radar, t_true, t_true + 1.6 and t_w - 0.2. Venus moves up about 10 px at 540, the gap becomes ≥ 12 px, the push-in and size are unchanged, and the az assert is unaffected. Venus's top (≈ 222) still clears the two-row tl/tr notes (bottoms ≈ 193). If you prefer the reviewer's dist values, also set the why.t0 key's dist to ≥ 23.6 so the dolly never reverses.
NOTE: Measured at 540 (gap from the limb/rim to the spine label's glyph tops). Hook: 16 px at f002 and 7 px at f004. Change beat: about 10 px at f016. Radar beat: 5 px at f029, 3 px at f034, 2–3 px at f035. True turn: 5 px at f036, 4 px at f040, 3 px at f041 and f042. At 41.8 the pin meridian runs down onto 'turn · one'. So the problem also covers the radar beat (28.5–33.7), not only 33.7–42.1. The proposed dist change does add about 6 px. It also turns the 26.67→28.53 segment (23.0→23.6) into a pull-back between two push-ins, so 'the slow push-in is kept' is not quite true.

--- [text7] low t=6-6.7
PROBLEM: As the 'Sun' pill fades in up and to the right of the Sun, Venus sits on the pill's top-right border (contact from 6.2 to 6.6). Two bodies share one label just as the caption says 'the Sun rise'.
FIX: As proposed: l-sun "side": -1.
NOTE: Confirmed at 15 fps. From about 6.2 to 6.5 Venus's disc sits on the top-right border of the 'Sun' pill, and by 6.6 there is a few px gap. Left of the Sun is empty for the whole window (only the orbit line). The 'Venus' pill that arrives at 9.67 sits at y ≈ 160–200 at Venus's upper left, clear of a left-side Sun pill at y ≈ 276–316.

--- [text8] low t=9.67-26.68
PROBLEM: Two caption page breaks leave a word stranded at the end of a page: 'Next door, Venus / hides its face under' | 'a permanent / lid of cloud.' and 'Schiaparelli said / one side always' | 'faced the Sun.'
FIX: As proposed: glue vo02 "under a permanent" in place of "a permanent", and vo03 "always faced the Sun." in place of "faced the Sun.".
NOTE: I reproduced the paging read-only (Film + glue + keep_units + hold, nothing written). The pages come out exactly as claimed: 'Next door, / Venus hides its face' | 'under a permanent / lid of cloud.' (break at 11.967) and 'Schiaparelli / said one side' | 'always faced the Sun.' (break at 25.185). The other 31 pages are unchanged, and the count stays at 33.

--- [text9] low t=45.7-54.3
PROBLEM: The note under the 'your sky' dial, 'the Sun's place, behind the clouds', is set at 27 px (at 1080) and weight 550. That is the smallest text in the film, below the 30 px badge size, and about 2 mm tall on a phone.
FIX: scene.mjs: tx(DCX, DH - 8 * S1, "middle", "the Sun's place, behind clouds", 600, 30). The shorter text keeps about the current width at 30 px, and the baseline stays at 1410/1920. If the wording must stay, use 600/30 and also move E and W out to DCX ∓ (RX + 50 * S1), which stays inside the safe box.
NOTE: Confirmed: the note is about 225 px wide and 8 px cap height at 540, the smallest text in the film (tags are 3.15vmin, about 34 px at 1080). The proposed change alone causes a collision. At 30 px and weight 600 the note grows to about 257 px (x ≈ 119–376 at 540). 'E' spans x 108–114 and 'W' 381–393, with baselines at the note's cap-top, so the three would run together as one line ('E the Sun's place… W').

--- [text10] low t=65.5-67.8
PROBLEM: The readout's push makes Venus large again (radius about 80 px at 540) with its drawn cloud bands plainly visible, but 'clouds: drawn' left at 43.53. Every other close view of the deck carries the note.
FIX: As proposed: BADGES add {"id": "b-illus-r", "text": "clouds: drawn", "t0": round(t_echo + 0.8, 4), "t1": round(t_end - 0.5, 4), "slot": "tr"}, appended after b-light so it stacks third. Add 'the readout's push' to the README's clouds: drawn row.
NOTE: Confirmed. During the readout push (65.3–67.8) Venus grows to r ≈ 80 px at 540 with the drawn bands plainly visible, and only 'Not to scale' and 'Light sped up' are up. I checked the push frames from 64.4 to 66.0: the top-right corner stays empty. Row 3 would sit at about y 198–228 (0.21–0.24 H), x 330–450. Earth's right edge is ≤ 282 and Venus's top ≥ 310 throughout.

[rejected]: 1

[reported]: 11

=== picture ===
OVERALL: I looked at every one-a-second frame. I also pulled all 1,120 draft frames into /tmp/claude-0/-home-user-Claude/fdb5bb83-b6fe-516c-99e3-ad5ff34dc051/scratchpad/review4/ep03/pic/all/ and tiled every move, fade and handover (s_*.jpg in that folder). Every finding below was checked against compile.py, scene.mjs, set/venus.js, set/planet.js and hud.js. I tested the sunrise-timing fix by copying compile.py's tau()/hour() math into pic/tools/rise.py. The copy reproduces film.json's sunrises exactly (43.384, 45.906, 48.427 …).

The film's construction is sound: one continuous shot, the push lands on "lid of cloud", the meridian crosses the face on "backwards", the light-time ring grows on "Light time", and the clocks stop at the conjunction. But the whoa beat, which is the payoff, is broken in three ways:
- The "you" label never appears: a word-lookup bug gives it t1 < t0.
- On "rising in the west" the dial shows the Sun setting in the east, and it is empty on "west" and in the poster frame.
- On "Stand there" Venus turns its night side to the camera.

Holding the orbit clock until "the orbit" fixes the second and third together. Everything is back-computed from the conjunction, so frame 0 and the readout stop do not change.

Other recurring problems:
- Earth sweeps through the frame as a dark, ghosted blob on every pull: behind the caption on "On Earth", and through the speed note at 43.7 s.
- The Venus cloud deck is uniform horizontal bands, so no spin is ever visible except the thin meridian line.
- The radar ping is on screen for only about 0.3 s each way.
- In the readout, the meridian, not the round-trip line, is the brightest teal stroke.
- The "backwards" arrow and Earth's rim bloom royal or cobalt blue rather than ice.

Lower-priority polish: a 5 s static stretch in the change beat; nothing on screen for "Both guesses were wrong"; no "clouds: drawn" note during the readout close-up; the end card fading in over the planets; a lighting flip at the loop seam; small sunrise ticks with no picture of 117 against 225; a flat dial arc; and a teal blip at the pole.

--- [picture1] high t=42.46-45.7
PROBLEM: The "you" label never appears. compile.py sets l-you t1 = A("vo05:The") - 0.2. Film.at matches words case-insensitively and takes the first hit, which is the "the" in "and the spin" (43.133). So t1 is 42.933, before t0 (44.333), and hud never shows the label; the cues file's 'shown' list confirms it is missing. As a result the teal meridian, the brightest mark in the hook and the subject of "Stand there", is never named anywhere in the film. The 'a person standing here' note that script.md promises is not on screen either.
FIX: compile.py l-you: t1 = round(A("vo05:The#3") - 0.2, 4) (45.46), plus the guard `assert all(L['t1'] - L['t0'] >= 1.0 for L in LABELS)` after LABELS (every other label passes it). Do not move t0 to A("vo05:Stand"). At 42.47–43.3 the anchor is the pin on a Venus 80–165 px across, and a fixed above-right pill would sit on the disc it names. Use t0 = round(t_w + 1.5, 4) (≈43.63, wf ≈ 0.4, Venus about 30 px in radius). 'you' is then up 43.6–45.5, over 'the spin and the orbit team up'. Check the fade-in in stills at 43.6–44.1.
NOTE: Confirmed. film.json has l-you t0 44.3333 > t1 42.9333, and the cues 'shown' list has no l-you. Film.at takes the first 'the' in vo05, the one in 'and the spin' (43.133). Frames 42.5–46 show no 'you' pill anywhere, so the teal meridian is never named. The 'a person standing here' note is not in README's honesty table any more, so the label is now the only thing that names the pin.

--- [picture2] high t=49.08-50.65
PROBLEM: The "your sky" dial shows the opposite of the line. The Sun rises at W during "hundred and seventeen days" (48.43). During "rising in the west" (49.08–50.65) it crosses to the east and sets at 49.67. On the word "west" (49.88) and in the poster frame (POSTER 50.37) the dial is empty. The next rise at W (50.95) comes after the phrase ends. The l-rise label is tied to the 48.43 sunrise, so it misses too.
FIX: A layout-neutral version, simulated with compile's tau()/hour():
- In compile.py set R4 = 4.5e6.
- In CLK['orbit'], change the {t: t_w, rate: R4} key to {t: A("vo05:orbit"), rate: R4}.
- In CLK['spin'], change its {t: t_w, rate: R4} key to {t: A("vo05:orbit"), rate: R4}. The true turn's 1,000,000× then carries on through 'Stand there, and the spin', and the note rolls to '4,500,000× faster' on 'orbit'.
- b-paused t1 = A("vo05:orbit").

The whoa keeps almost the same orbit total. The camera az moves 3.4°, Earth's relative angle 1.3°, and the readout bodies stay within 5 px. Sunrises fall at 45.00, 47.24, 49.49, 51.73, 53.97, 56.21 and 58.45. At 'west' the dial Sun is 63° up on the W side.

Also change the RISE_I rule to the first sunrise >= A("vo05:rising"); the current >= 'hundred' rule would pick 47.24. Set POSTER = round(SUNRISES[RISE_I]['t'] + 0.25, 4) ≈ 49.74: the Sun is about 40° up at W, the caption reads 'rising in the west.' and the spine reads 'west'. Update README's 4,000,000×, 2.52 s and 'from 43.4 s' figures.
NOTE: Confirmed frame by frame (dial crop, 45.6–51.4 s). The dial Sun rises at W at 48.43 and reaches noon at 49.07. During 'rising in the west' it slides to E and sets at 49.67. It stays hidden from 49.73 to 50.93, which covers 'west' (49.88) and the poster (50.37). The reviewer's fix is not layout-neutral, though. Cutting 1.97 s of orbit at 4e6 lowers tau_c by 91.7 days, so TH_V0 (and AZ, AZ2, AZ3, PAIR az) turns by +146°. I replayed the camera from film.json with compile's tau(). The conjunction then lands right of the Sun (Venus at 380,331 instead of 183,267 at 62.0 s). The PAIR push sees Venus on the left and Earth on the right (212,333 and 417,339, against 386,387 and 220,278 now), which drops the side −1 fixed l-echo pill onto Venus. Before t_w, Earth moves 56° round its orbit relative to Venus. That changes the normal diagram, and the radar beam steepens from about 10° to about 33° below horizontal.

--- [picture3] medium t=42.46-43.6
PROBLEM: On "Stand there" Venus turns its night side to the camera and reads as a dark glass marble with a teal arc and a bright rim. The README says this was fixed. The cause: the orbit runs at 4,000,000× from t_w (46 days a second) while the close view's az stays at AZ3, so the Sun swings about 87° behind Venus by 43.3 s.
FIX: Use the clock change refined in finding 1 (orbit held until A("vo05:orbit")). The simulated phase angle then stays at 83/85/86/95° through the pull, so Venus is half lit. Confirm in stills at 42.5, 43.0 and 43.5.
NOTE: Confirmed at 42.6–43.5 (e.g. 43.2): Venus is a dark marble with a teal arc and a bright rim, although README says this was fixed. The simulated phase angle is 100/111/119/112° at 42.47/42.85/43.2/43.5.

--- [picture4] medium t=5.53-5.93
PROBLEM: Earth crosses the frame as a large, dark, ghosted disc on every camera move:
- 5.53–5.93: it rises from the bottom left and passes behind the caption plate, right on "On Earth, you see".
- 11.4–11.8: it exits bottom right toward the plate.
- 43.6–43.87: it slides along the top, under the "4,000,000× faster" note and between the top notes.
The ghosting is draft-only (fewer blur samples), but a dark disc sliding across text is not. The Sun already avoids this by shrinking away with the follow; Earth does not.
FIX: The reviewer's eAway gate is right. Simulated, Earth now emerges at 5.93 at (246,543), between the note and the plate, and is full size by 6.4 at (283,477), before l-earth at 6.6. The push shrinks it by 11.6. With the finding 1 clock change, Earth enters the whoa from the right at y ≈ 220–340 and no longer crosses the top notes.
NOTE: Confirmed at 5.53–5.93. A dark disc with draft ghost rings rises from the bottom left, passes behind the caption plate on 'the Sun rise' and then sits between the 'clouds: drawn' note and the plate. At 43.73–43.87 it grazes the bottom of the speed note. The 11.4–11.8 instance is only Earth leaving off the right edge, clear of any text.

--- [picture5] medium t=6.6-9.6
PROBLEM: On "On Earth, you see the Sun rise about 365 times a lap" Earth is a tiny dark bubble. It sits on the near side of its orbit, so its night side faces the el-70 camera, and the label's anchor dot covers its middle. The subject of the line is the dimmest body on screen. The sun:1.8 boost only lights the hemisphere facing away from the camera.
FIX: In scene.mjs, after earth.set: `earth.material.uniforms.uFill.value = 0.035 + 0.3 * (1 - wf) * pK;` (planet.js returns material.uFill). The pK factor fades the fill out as the readout's push lands, so the close-up Earth there keeps its terminator.
NOTE: Confirmed (zoomed f007–f010). Earth is a roughly 22 px dark marble with a thin blue rim, while the Sun and Venus outshine it on 'On Earth, you see…'. The sun:1.8 boost only lights the hemisphere facing away from the camera (Earth's phase angle is 100–106°). The anchor dot on it is an accepted convention.

--- [picture6] medium t=48.43-49.1
PROBLEM: The "a sunrise" pill fades in on top of Venus. The tick, and so the anchor at r_v + 0.9, is where Venus is at that sunrise, inside Venus's drawn radius of 1.63, and Venus then travels up under the pill. At 49.0–49.07 Earth also passes beneath the pill's right end. The label covers the bodies it is about.
FIX: Set l-rise t0 = round(SUNRISES[RISE_I]['t'] + 0.5, 4) and t1 = t0 + 3.5. With the refined clock (RISE_I = 49.49 sunrise), Earth passes just above-right of the tick at 49.9–50.3: simulated at (411,377) at 49.99 and (419,348) at 50.24, which is right under an 'above' pill. Set v: "below"; Earth has left that spot by t0. Recheck stills at t0 … t0 + 1 s.
NOTE: Confirmed at 48.47–48.73: 'a sunrise' fades in over Venus, and Earth slides under the pill's right end at about 48.9–49.1.

--- [picture7] medium t=19.33-37
PROBLEM: The cloud deck is soft horizontal bands, like a blurred Jupiter, with almost no variation along longitude, so a turning Venus looks perfectly still. The Cassinis' 23-hour spin at 50,000× and the true turn are carried only by the 2-px meridian line. On "Venus turns once every 243 days" (33.7–37) the meridian sits on the limb and nothing visibly turns. venus.js promises 'the sideways Y swirls', but chev = |sin lat| × 0.18 is too weak to show. The deck is also slightly warm cream (R≈G, B 5 lower).
FIX: The reviewer's venus.js edits are seamless: cos(2πu) is periodic, and fbm(u*6 - chev*4, …, wrap 6) stays periodic because chev is. set/venus.js is used only by ep03. Cooling hi is optional. Check in stills that 20.0 and 20.4 differ and that the deck does not outshine the meridian.
NOTE: Confirmed. 20.0 and 20.8 look nearly the same apart from the meridian. The deck is horizontal bands with almost no variation along longitude, so the guesses' spin and the true turn read only through the 2 px meridian. On 'Venus turns once every 243 days' (33.7–36.8) the meridian runs along the top and right limb and nothing visibly turns. The deck samples at about (205,206,201): neutral to faintly warm grey.

--- [picture8] medium t=28.53-31
PROBLEM: The radar's ping leaves Earth on "radar" (28.53, with the probe.ping sound) but Earth is far off frame. For 1.7 s nothing moves, then the ping crosses the visible beam in about 0.3 s and bounces off the limb. Nothing pierces anything on "pierced the clouds", although the script's direction is 'through the clouds to the pin'. The 7 s radar beat is otherwise a static half-lit disc with a hairline dashed beam.
FIX: Use `const src = hit.map((v, j) => v + toE[j] * VR * 1.4);`, which projects to about (525, 420). The ping then enters at the frame edge on 'radar' and travels about 175 px to the limb by 'pierced'. Use src in place of ep in pr for both legs. For the pierce, let the inbound leg end at vp's centre with the pulse opacity × (1 - E.in2(seg(t, CUE.pierce - 0.25, CUE.pierce))). Skip the 'teal ring' alternative: a ring() of radius VR×1.02 round vp is an equator ellipse that would read like the 'backwards' arrow. See missed item: this ping also needs 'light sped up'.
NOTE: Confirmed. Nothing moves from 28.53 until 30.2. The ping crosses the visible beam between 30.2 and 30.47, bounces at the limb and leaves by 30.93. Nothing pierces anything. The proposed start point is wrong, though: hit + toE·VR·2.6 projects to x ≈ 681 at 540, 140 px off frame, not 'near the right edge'.

--- [picture9] medium t=65.13-67.8
PROBLEM: "The radar's round trip" is drawn as a roughly 45-px hairline between the drawn limbs, while Venus's meridian is a thick glowing teal arc with a pointed end. The meridian reads as the radar path and is the brightest line on screen. The label's anchor dot sits in empty space below the line: S.echo is offset by −camY × ER × big × 0.6.
FIX: The reviewer's changes are fine: fade the pin from CUE.echo to FILM.endCard + 1.4, widen the echo to 6, ease big back to 1 over CUE.echo → +1.2, and reduce the S.echo offset from 0.6 to 0.2. After the offset change, check in stills that the side −1 'below' pill clears Earth's lower limb.
NOTE: Confirmed at 65.2–67.7. The echo is a hairline. Venus's meridian is the thickest, brightest teal line, and its pointed end reads like an arrow. The pill's anchor dot floats about 50 px (at 540) below the echo line, in empty space.

--- [picture10] medium t=39-42.5
PROBLEM: The ice "backwards" arrow renders as a white core inside a saturated royal-blue bloom halo (≈#3051D4), not ice #8FD0FF. It reads as an off-palette neon bracket under Venus. Earth's rim on the diagram and in the readout blooms the same cobalt (≈#0A3DA8).
FIX: Use an in-gamut ice below the 0.9 bloom threshold: `const C_ARROW = line("ice", 0.85);` gives linear [0.105, 0.353, 0.851] with no clamp needed; its core lands on #7BB2DD and its edges go navy, not violet. Raise the arrow widths from 6 to 8. Earth's rimDay 0.8 → 0.5 is optional.
NOTE: Confirmed (zoomed f041): the arrow has a white core inside a saturated royal-blue/violet glow, not ice. The proposed fix would not change that hue. I replayed look.js's ACES inverse: ice inverts to linear [-0.32, 0.55, 6.78]. Once clamped, any fractional coverage of it (bloom, AA edges, motion blur) lands at #5477F2 (25%) or #8EA8FB (50%), at k 1.0 as well as 1.4. Earth's cobalt rim reads as atmosphere: minor.

--- [picture11] medium t=14.4-19.3
PROBLEM: "For three hundred years, astronomers chased faint smudges in those clouds" plays over a nearly frozen, fully lit, featureless disc for 4.9 s. Both clocks are at 0, and the camera moves 0.7°/s and 1 unit of dolly over 14 s. No smudge is shown.
FIX: Add a push between the landing and the why key, e.g. key(t_g1, CLOSE2, az=AZ2 + 5.0, dist=21.5, ease="sine"). That runs at 0.75°/s, then 0.68°/s to AZ3, and stays within the arc assert. Prefer keeping AZ3 = AZ2 + 10. The reviewer's AZ3 + 16 also turns the radar and true-turn views by 6° and moves the pin's crossing about 0.35 s off 'backwards'. If AZ3 does change, recheck those beats in stills. This works best together with the cloud-deck change (finding 6).
NOTE: Confirmed at 12.7–19.3: a fully lit, featureless disc holds still for about 6.6 s while the counter and caption change.

--- [picture12] low t=31.96-33.69
PROBLEM: On "Both guesses were wrong" the picture and the spine (still "1962 · radar sees through the clouds") show nothing. script.md's direction has the two guesses 'struck out'; they never are.
FIX: The reviewer's c-wrong counter with strike works: hud's counter has a .v element. Its t1 = A("vo04:two") is trimmed to 34.77 by the gap loop. A('vo04:Venus') would keep it off 'Venus turns once every'.
NOTE: Confirmed: on 'Both guesses were wrong' the spine still reads 1962, and nothing is struck out as script.md's direction says.

--- [picture13] low t=65.13-74.67
PROBLEM: The readout's push shows Venus's drawn cloud deck about 160 px across with no "clouds: drawn" note: b-illus ended at 43.53. The same deck stays under the end card and loops into the hook.
FIX: Add the reviewer's b-illus-r badge (tr, t_echo + 0.8 → t_end). A third top-right row at y ≈ 200 (540) clears Earth (x 165–275) and Venus.
NOTE: Confirmed: in the readout push Venus's drawn deck is about 160 px across and banded, with no 'clouds: drawn' note.

--- [picture14] low t=67.8-68.2
PROBLEM: The end card's title fades in directly over the bright Earth ("Next light:") and Venus's lit limb plus the teal meridian and echo line ("that … lands"). Earth and the readout's lines only start to shrink or fade at t_end, the same moment the card arrives, so for about 0.4 s the text is double-exposed on the bodies.
FIX: The reviewer's eK = 1 - E.inout2(seg(t, FILM.endCard - 0.5, FILM.endCard + 0.1)) without the shot gate is fine. It changes nothing before 67.3.
NOTE: Confirmed at 67.87–68.0: the end-card title fades in over Earth and over Venus's meridian.

--- [picture15] low t=45.7-53.87
PROBLEM: The dial's sky arc is very flat: RY = 34 × S1, a 17 px rise at 540 and 34 px at 1080. The Sun appears to slide sideways along the horizon rather than rise, which weakens the one image that says "rising".
FIX: Keep RY. Narrow the dial instead (RX 230 → 150·S1) so the same height reads as a steeper arc, and/or give the dot a short teal flash at the W horizon at each sunrise (it can use the sunrise ticks).
NOTE: Real but minor: the arc rises about 17 px at 540. The fix is wrong, though. Measured at 540, a two-line caption plate runs y 586–668, which is 1336 at 1080, not 1230. The horizon sits at 690. RY 70·S1 puts the noon Sun at 655 (1310), inside the plate. The current noon dot (673) already grazes the plate.

--- [picture16] low t=12-12.67
PROBLEM: While the push lands on "lid of cloud", the far-side meridian shows as a short teal dash on Venus's top limb for about 0.6 s, then fades. It reads as a rendering glitch at the top of an otherwise clean disc. It returns at 18.93–19.33 before the guesses start.
FIX: CUE['close'] = round(t_push2 + 0.6, 4) is safe; CUE.close is used only in pinK.
NOTE: Confirmed at 12.0–12.8: a small teal dash sits on Venus's top limb and then fades.

--- [picture17] medium t=28.53-None
PROBLEM: In the radar beat the ping runs from Earth to Venus and back in about 4 s, which shows light hundreds of times too fast. No note says so. The readout's identical ping does carry 'light sped up', and the top-left slot is empty from 26.7 to 33.7 (no note in f029–f033). Once finding 7 makes the ping visible for its whole run, the cheat is plain to see.
FIX: Add to compile.py BADGES: {"id": "b-light-r", "text": "light sped up", "t0": t_radar, "t1": round(2 * A("vo04:pierced") - t_radar, 4), "slot": "tl"}, which is ≈28.53–32.6 and gone well before b-spin arrives at 33.7. Update README's honesty table to match.
NOTE: found by the verifier

[rejected]: 2

[reported]: 18
```

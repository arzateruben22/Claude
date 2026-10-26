# Rest Frame ep01: script audit (26 Oct 2026)

## Verdict

The core physics holds up and every number I recomputed matches. A 1 m fall takes √(2/9.81) = 0.4515 s. The throws land 19.9, 40.2 and 60.1 cm out. The ghost spacing grows 2.45 cm per 1/20 s step, and nine gaps × 0.05 s = 0.45 s, matching the stopwatch. I re-ran the drag model and got delays of 0.040, 0.147 and 0.297 ms (at 3.99 m/s the delay reaches a full frame). One frame at ×1/20 is 1.667 ms of physics time. The pendulum is 1.74% slower at 30°. The story follows the seven-beat shape plus the measure segment, lint passes with 0 errors, and nothing from the 'Never write' list appears.

One thing must change before posting: the takeaway's 'bullet fired level' line (F1). It breaks the bible's no-firearms rule, and it states a vacuum-only result as a real-world fact even though the claims file's own MythBusters note gives a gap of about 24 frames. The rest are small: the badge's '0.3 ms late' needs to say it is measured against the dropped ball (F2), the picture is told to count nine rungs where there are ten (F3), the sideways arrow could be drawn as a force (F4), and 'speed' should be 'sideways speed' (F5). F6–F9 are wording, end-card and citation fixes.

I checked sources through web search excerpts only. WebFetch failed with DNS errors for openstax.org and phys.libretexts.org, so each link should still be opened once before sign-off.

## Confirmed findings (4) — fix before the final render

### F1 · misleading

**Line:** `vo: ... That holds even for a bullet fired level. {c14}`

**Problem.** Two problems. (1) The bible's platform policy (§9, CARE) says: "No firearms: the classic bullet-drop comparison is left out on purpose." This line puts it back. (2) The line is spoken as a real-world fact, but it is only true with no air. By the episode's own standard ('same frame' at ×1/20) a real bullet fails badly. The badge on screen at that moment says air costs 0.3 ms, so viewers will assume the bullet case is just as close. It is about 130 times worse. The note on c14 already admits the MythBusters gap, so the line contradicts its own ledger.

**Evidence.** Bible §9: 'No firearms: the classic bullet-drop comparison is left out on purpose.' Web search excerpts (pages could not be fetched): MythBusters ep. 125 'Knock Your Socks Off' (2009) measured a fired and a dropped .45 bullet landing 39.6 ms apart (mythresults.com/knock-your-socks-off; vttoth.com/CMS/physics-notes/121: 'air resistance causes the fired bullet to hit the ground more slowly'). Calculation: one frame here = 1/30 s ÷ 20 = 1.667 ms of physics time, so 39.6 ms ÷ 1.667 ms = 23.8 frames late at ×1/20 (1.2 frames even at ×1). Compared with the badge: 39.6 / 0.30 = 132×.

**Fix.**

In air, the throws land a sliver after the drop. {c14}

c14 in claims.json must be rewritten to match:
- sentence: exactly the line above.
- claim: in air, drag delays the thrown tennis balls by 0.04, 0.15 and 0.30 ms behind the drop, under the 1.67 ms frame at ×1/20 (drag.py).
- source: NASA Glenn drag equation, already in the bible.
- note: delete the bullet/MythBusters note.

Checked: lint passes with 0 errors.

<details><summary>Verifier's check</summary>

The finding stands on both counts. (1) Policy: bible.md §9, Platform policy (CARE), says word for word: "No firearms: the classic bullet-drop comparison is left out on purpose." The takeaway line puts that comparison back. That breaks the policy whether or not the physics holds. (2) Accuracy: a web search (excerpts only) confirms that MythBusters' "Knock Your Socks Off" measured a fired and a dropped bullet landing 39.6 ms apart (mythresults.com/knock-your-socks-off). Forum and blog excerpts, including vttoth.com/CMS/physics-notes/121, put the gap down mainly to air drag on the fired bullet. MythBusters still called the myth "confirmed", but only because 39.6 ms is under one 24 fps frame (41.7 ms). By this episode's own standard it fails. I redid the arithmetic: a frame at ×1/20 is 1/30 ÷ 20 = 1.667 ms of physics time. 39.6 ms is 23.8 frames at ×1/20, 1.19 frames even at ×1 and 30 fps, and 132 times the 0.30 ms on the badge. I also re-integrated the tennis-ball drag model (57 g, 6.7 cm, Cd 0.55, ρ 1.2). It gives delays of 0.040, 0.147 and 0.297 ms at 0.44, 0.89 and 1.33 m/s, and 1.657 ms at 3.99 m/s, so c7 and the badge are correct. The badge's sub-frame number makes the bullet case look just as close, when in air it is far worse. c14's own note admits the MythBusters gap. The line is also spoken as a plain fact, so 'air ignored' does not rescue it for a general audience.

The proposed fix reads accurately: in quadratic drag, a faster ball has more upward vertical drag, so the throws do land slightly late. But its tag is wrong. I applied it to a copy and ran `kits/cinema/script/lint.py --segment measure`. The result was 1 error: 'claim c7: its sentence differs from the script', because c7's ledger sentence is the whoa line. It also gave the warnings 'c7 cited by 2 sentences' and 'c14 in claims.json but no sentence cites it'. With the same words tagged {c14}, and c14 rewritten in claims.json, the lint comes out at 0 errors. The takeaway is then 20 words, still inside the 12–20 range.

</details>

### F2 · misleading

**Line:** `takeaway badge: "air ignored: the fastest throw would land 0.3 ms late; a frame here is 1.7 ms"`

**Problem.** '0.3 ms late' is only true compared with the dropped ball, which also has drag. Read as 'late compared with the air-free scene on screen' (the natural reading under 'air ignored'), the fastest throw is 1.84 ms late. That is more than one 1.67 ms frame, which is the opposite of what the badge is reassuring viewers about. The badge has to say what the delay is measured against.

**Evidence.** Re-ran the bible's drag model myself (tennis ball 57 g, 6.7 cm, Cd 0.55, ρ 1.2 kg/m³, k = ½ρCdA/m = 0.0204 /m, RK2 integration, 1 m fall). Drop with no air: 0.45152 s. Drop with air: 0.45306 s (+1.54 ms). The throw delays compared with the drop come out at 0.040 / 0.147 / 0.297 ms for 0.44 / 0.89 / 1.33 m/s, which matches c7. The fastest throw compared with no air: 1.54 + 0.30 = 1.84 ms, more than 1/600 s = 1.67 ms.

**Fix.**

badge: "air ignored: with air, the fastest throw lands 0.3 ms after the drop; a frame here is 1.7 ms"

<details><summary>Verifier's check</summary>

The finding stands. I reran the bible's drag.py model with RK4 integration and interpolation at the floor, using the bible's parameters (57 g, 6.7 cm, Cd 0.55, rho 1.2, k = 0.02041 /m). Drop with no air: 0.45152 s. Drop with air: 0.45306 s, which is 1.54 ms later. Throw delays compared with the air drop: 0.040, 0.147 and 0.297 ms. Fastest throw compared with no air: 1.834 ms. One frame (30 fps at x1/20) is 1.667 ms of physics time. The finding's numbers are exact.

I also varied the ball within ITF limits (56–59.4 g, 6.54–6.86 cm) and Cd from 0.5 to 0.6. The delay compared with the drop stays at 0.25–0.35 ms. The delay compared with the air-free scene runs 1.5–2.1 ms, about a full frame and usually more.

So "0.3 ms late" is only true if "late" means "after the dropped ball in air." The badge never names that reference. The prefix "air ignored:" invites the other reading: "with air, this ball would land 0.3 ms later than what you see." Under that reading the number is off by about 6x, and the delay is more than a frame. That undercuts the reassurance the badge exists to give. The script's own cross-check notes and c7 mean "compared with the drop," which confirms the badge is just missing that reference.

The episode's framing ("thrown or dropped?") makes the drop-relative reading somewhat available, but for a general audience the badge is still ambiguous, and one plausible reading is false. That is enough for "misleading."

The proposed fix is correct: 0.297 ms rounds to 0.3, and "after the drop" names the reference. It is a little longer (92 characters against 77), and "the drop" leans on the script's earlier use of the phrase, but neither makes it wrong or worse. No betterFix needed. If the badge needs to be shorter, "air ignored: in air the fastest throw lands 0.3 ms after the drop; a frame here is 1.7 ms" (89 characters) says the same thing.

One side note outside this finding: a 0.3 ms gap still falls across a frame boundary about 18% of the time, depending on phase. "Under a frame" therefore does not guarantee the same frame, but the badge no longer claims that it does.

Scripts I used: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/refute-ep01/check.py and /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/refute-ep01/sens.py.

</details>

### F3 · math

**Line:** `## measure {segment: measure · the strobe ladder: count the nine rungs down the dropped ball's trail, then the stopwatch reads "0.45 s" ...}`

**Problem.** Off-by-one between the picture and the voice. Ghosts are stamped at τ = 0, 0.05, … 0.45 s. That makes 10 ghosts, and so 10 rungs, joined by 9 gaps. The voice correctly says 'nine gaps', but the picture is told to count nine rungs. A counter that ticks once per rung will either reach 10 or skip one. Also, the top gaps (1.2, 3.7 and 6.1 cm) are smaller than the 6.7 cm ball, so the top four ghosts overlap. The count therefore has to be led by tick marks between rungs, not by eye.

**Evidence.** Computed: drop distance ½g(0.05k)² for k = 0…9 gives 0, 1.23, 4.91, 11.04, 19.62, 30.66, 44.15, 60.09, 78.48, 99.33 cm. That is 10 positions and 9 gaps (1.23, 3.68, 6.13, 8.58 … 20.85 cm). 9 × 0.05 s = 0.45 s, and the landing is at 0.4515 s, 6.7 mm below the last ghost.

**Fix.**

## measure {segment: measure · the strobe ladder: count the nine gaps between the dropped ball's ten ghosts, then the stopwatch reads "0.45 s" ...}

<details><summary>Verifier's check</summary>

The finding stands. The script's own data and the episode's build both show 10 ghosts, and so 10 rungs, joined by 9 gaps.

- **The count.** compile.py sets `DT, NG = 0.05, 10`, with the comment "k = 0 … 9 (τ9 = 0.45 s, c8)". That is 10 ghosts per trail. I redid the drop distances, ½·981·(0.05k)² cm: 0, 1.23, 4.91, 11.04, 19.62, 30.66, 44.15, 60.09, 78.48 and 99.33 cm. The gaps between them are 1.23, 3.68, 6.13, 8.58 … 20.85 cm. Nine gaps × 0.05 s gives 0.45 s. The landing comes at 0.4515 s, 6.7 mm below the last ghost.
- **What "rung" means in this film.** The bible (B4) defines a rung as a line that "join[s] ghosts with the same k". scene.mjs draws rungs for k = 0 to 9, and the ep01 README says rungs "join ghosts that share the same k". So the trail carries 10 rungs, not nine. Strictly, one trail has no rungs at all, because a rung joins two ladders.
- **What the build actually counts.** The measure segment counts gaps. compile.py makes `GAPS` with 9 entries. The scene.mjs counter label reads "n gaps × 1/20 s". The README describes the beat as "Nine gap arrows are counted down the dropped trail". The voice also says "nine gaps".

So only the heading's direction is wrong ("nine rungs"). It disagrees with the voice, with the film's vocabulary and with what is rendered. Anyone who rebuilds the shot from the heading would count to 10 or skip a rung.

The overlap point also checks out. The gaps between ghosts 0 to 3 (1.23, 3.68 and 6.13 cm) are smaller than the 6.7 cm ball, so the top four ghosts overlap and can't be counted by eye. The build already handles this with gap arrows.

The proposed fix ("count the nine gaps between the dropped ball's ten ghosts") is correct, matches the build and is about the same length, so no better fix is needed.

Files checked:
- /home/user/Claude/films/channels/physics/ep01/compile.py
- /home/user/Claude/films/channels/physics/ep01/scene.mjs
- /home/user/Claude/films/channels/physics/ep01/README.md
- /home/user/Claude/films/channels/physics/bible.md

</details>

### F5 · misleading

**Line:** `vo: Speed decides *where* a ball lands. {c10}`

**Problem.** The claim behind this line (c10) says 'sideways (horizontal) speed' and 'level throw', and c11's note says ''Level throw' matters: a throw with an upward or downward component changes the time of flight.' The spoken line drops that qualifier. Once F1 removes 'fired level', nothing left in the takeaway says the throw is level, so the line a viewer repeats at dinner ('speed decides where, height alone decides when') is false for any throw angled up or down. One word puts it back.

**Evidence.** claims.json c10 ('the sideways (horizontal) speed sets how far a level throw lands') and the c11 note above. Bible §7 takeaway: 'sideways speed changes where a ball lands, never when.' Range = v_x·√(2h/g) holds only for v_y = 0 at launch.

**Fix.**

vo: Sideways speed decides *where* it lands. {c10}

<details><summary>Verifier's check</summary>

The finding stands, and the proposed fix is good as written.

1. The spoken line doesn't match its own claim. c10's claim says "the sideways (horizontal) speed sets how far a level throw lands". The sentence just says "Speed". The bible's §7 takeaway and its §8 episode-1 script both say "Sideways speed", and the §8 line goes on to add "For a level throw, only the height sets the clock." That qualifier was lost when the script was rewritten.

2. The physics. Without air, flight time depends only on the vertical launch speed and the height. The horizontal (sideways) speed never changes when a ball lands, at any launch angle. Plain "speed" includes any vertical component, and that does change when. Example: 1.33 m/s aimed 30° upward from the 1 m rail gives t = (0.665 + √(0.442 + 19.62))/9.81 ≈ 0.524 s, against 0.4515 s for a level throw. That is 73 ms, about 44 frames at ×1/20. So the pair "Speed decides where. Height alone decides when." becomes false as soon as the throw is angled.

3. Context doesn't excuse it. The film does say "sideways" in the hook and the change beat, so a careful viewer could fill the qualifier in. But WRITING.md says the takeaway is the line "a viewer could repeat at dinner", which means it gets repeated without that context. Rule 9 also says idealisations must be said aloud or badged. The takeaway badge says only that air is ignored, not that the throw is level. "Bullet fired level" does hint at it, and F1 removes that.

4. The fix. "Sideways speed" reuses the film's own word for a level throw. It makes the first sentence true at any angle, and it frames "Height alone decides when" as a statement about sideways throws. It is still 6 words, so the takeaway stays at 18 words, inside the 15–20 budget. Swapping "a ball" for "it" matches the takeaway example in WRITING.md, and "Height alone decides when" follows naturally.

One note: "Height alone decides when" (c11) still has no explicit "level" once F1 is applied. It now leans entirely on "sideways" in this line, which is acceptable. No better fix needed.

</details>

## Story and wording notes (3) — apply when cheap

### F6 · wording

**Line:** `vo: Throw twice as hard, then three times: forty centimeters, then sixty. {c6}`

**Problem.** On a physics channel, 'twice as hard' is ambiguous: it can mean force or energy. The throws are at 2× and 3× the speed (0.89 and 1.33 against 0.44 m/s), which takes 4× and 9× the kinetic energy. A specialist would object to 'hard' and 'fast' costs no extra time.

**Fix.** vo: Throw twice as fast, then three times: forty centimeters, then sixty. {c6}

### F7 · story

**Line:** `end card: "Next: the swing's secret" · "Follow Rest Frame"`

**Problem.** Picture rule 6 in WRITING.md ('End on a loop and a fact') says the end card carries one true-fact footnote that grounds the premise. This end card has none. The 1638 date the cross-check made precise is no longer anywhere in the film, and it fits here as the footnote.

**Fix.** end card: "Next: the swing's secret" · "Two motions at once: Galileo, Two New Sciences, 1638" · "Follow Rest Frame"

### F8 · wording

**Line:** `- "Galileo showed in 1638" is now "described": 1638 is when Two New Sciences was published.`

**Problem.** The preamble the physicist reads at sign-off does not match the script. The voice line is 'Galileo saw two motions at once' with no date (c4's note says so). The Notes also ask the voice to be checked on "sixteen thirty-eight", which is never spoken. A reviewer may sign off a line that is not in the film, and the T0 listen will look for a word that never occurs.

**Fix.** - "Galileo showed in 1638" is now "Galileo saw", undated: 1638 is when Two New Sciences was published. (And in Notes: Listen at T0: Galileo, twentieth, centimeters, "point four five".)

## Refuted (2) — no change

### F4

**Line:** `## why {shot: the turn, 60–90°, landing on "same height" · vectors: equal gravity arrows, a constant sideways arrow ...}`

**Why it stands as written.** The physics in the finding is right: with air ignored there is no horizontal force, so the constant sideways quantity is velocity (OpenStax UP 4.3). But the finding treats the line as something the audience sees, and it isn't. The script defines `{…}` in a heading as direction for the compiler, never shown or spoken. So no viewer ever reads "a constant sideways arrow". What viewers see is the compiled film, and that is already correct. In /home/user/Claude/films/channels/physics/ep01/scene.mjs, arrow "wy-v" is drawn in MOTION (#08805A). It sits on the thrown ball and points along its vx. The gravity arrows "wy-g-drop" and "wy-g-t44" are drawn in FORCE. In compile.py and film.json, "wy-v" carries the pill "steady glide" in colour "motion", timed to the word "steady" in "a steady glide across". So the arrow is green, labelled and tied to the motion phrase. It is never an unlabeled force sitting next to the gravity arrows. Bible §2 also says "the pill always names the quantity, so colour is never the only cue", so even a bare direction could not legally end up as an unlabeled arrow. As written, the line does not say force. In context, "constant sideways" matches the voice's "steady glide across", and gravity is the only thing labelled as a pull. The proposed fix would be a small step back: its pill "speed" would replace "steady glide", which echoes the spoken words. If the team wants the direction to spell out what the build does, the right wording is: "vectors: equal gravity arrows (force), a constant sideways velocity arrow (motion, "steady glide")". That is optional tidying, not a correction.

### F9

**Line:** `vo: It's *almost* a tie. {c12}`

**Why it stands as written.** The finding misreads the source. The vo line "It's almost a tie" is not unsourced: the quote c12 gives appears word for word on the page it cites. I checked OpenStax's own source files rather than search excerpts. A sparse clone of github.com/openstax/osbooks-university-physics-bundle shows the University Physics Vol 1 ch. 15 modules in this order: Introduction, Simple Harmonic Motion, Energy in SHM, Comparing SHM and Circular Motion, Pendulums (m58364), Damped Oscillations. So Pendulums is 15.4 in OpenStax's numbering, and 15.05 in LibreTexts' numbering, which counts the Introduction. Line 41 of the Pendulums module reads: "The period is completely independent of other factors, such as mass and the maximum displacement. As with simple harmonic oscillators, the period T for a pendulum is nearly independent of amplitude, especially if θ is less than about 15°." The second sentence is exactly what c12 quotes. It comes right after the "completely independent" sentence, and it limits that sentence to the small-angle formula. A reviewer who opens the link therefore finds direct support for "almost", not a contradiction. College Physics 2e 16.4 (module m42243) has the same "nearly independent of amplitude" sentence, so it is not "the" source for that wording. Switching to it only drops "and the maximum displacement", which does not change the claim. I recomputed the exact elliptic ratio, 2K(sin(θ/2))/π: 1.0043 at 15°, 1.0174 at 30°, 1.180 at 90°. So "1.7% longer at 30°" is correct, and c12's note already marks it as computed, as the other claims mark their computed values. The only real flaw is cosmetic. The title "OpenStax University Physics Volume 1, 15.5 Pendulums (LibreTexts copy)" uses the LibreTexts number with the OpenStax book name, and in OpenStax's numbering 15.5 is Damped Oscillations. The URL still opens the right page, so this does not make the claim unsourced or contradicted.

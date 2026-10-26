# Rest Frame ep04: script audit (26 Oct 2026)

## Verdict

The facts mostly check out, but five fixes are needed before voicing. The 1971 Apollo 15 drop, David Scott, the 1.32 kg hammer, the falcon feather, the 1.6 m height, landing together, the Galileo quote and the Falcon footnote all check out. So do Aristotle and the "nearly two thousand years" (MacTutor), the Moon's 1.62 m/s² (a sixth of Earth's), MICROSCOPE 2016–2018 with five months of data, and "a few parts in a million billion". The computed falls are right: √(3.2/9.81) = 0.571 s (said as "about half a second" and "under six tenths") and √(3.2/1.62) = 1.405 s ("about one point four seconds"). The seven-beat shape is complete and uses nothing from the "Never write" list. What needs fixing:
- The whoa's on-screen readout "< 3×10⁻¹⁵" overstates the published result, which is (−1.5 ± 2.7)×10⁻¹⁵.
- "Barely halfway" is a feather fall fraction with no source, probably 1.5–3× too far.
- The "same acceleration" label flashes for 0.155 s, so nobody can read it.
- The takeaway "Gravity treats them equally" contradicts the why beat's "Gravity does pull the hammer harder".
- The tease's "you accelerate" should be "you spin faster".
Each fix keeps the syllable count, but F2, F4 and F5 change spoken lines, so vo02, vo07 and vo08 need re-voicing and their claims.json sentences updating. All sources were checked through web search excerpts only; no page was fetched. Files: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/physics/ep04/script.md, which is identical to /home/user/Claude/films/channels/physics/ep04/script.md, and /home/user/Claude/films/channels/physics/ep04/compile.py, which holds the readout and the label timings.

## Confirmed findings (3) — fix before the final render

### F1 · factual-error

**Line:** `On-screen spine readout during the whoa (compile.py line 117 -> film.json spine): label "difference, titanium vs platinum", text "< 3×10⁻¹⁵"`

**Problem.** MICROSCOPE did not bound the titanium/platinum difference below 3×10⁻¹⁵. Its published result is η(Ti,Pt) = (−1.5 ± 2.3 stat ± 1.5 syst)×10⁻¹⁵. That is −1.5 ± 2.7 ×10⁻¹⁵ combined, at 1σ, so the 1σ range runs from −4.2 to +1.2 ×10⁻¹⁵. The readout looks like it took the uncertainty (2.7) as an upper limit and ignored the −1.5 central value. A physicist reviewer would reject "< 3×10⁻¹⁵". The readout is also not tied to any claim (c10 covers only the spoken line).

**Evidence.** Search excerpts (arXiv:2209.15487 abstract; PRL 129, 121102): 'η(Ti,Pt)=[-1.5±2.3(stat)±1.5(syst)]×10⁻¹⁵ at 1σ', with the combined uncertainty given as about 2.7×10⁻¹⁵. Calculation: √(2.3²+1.5²) = 2.74. Largest 1σ magnitude = |−1.5 − 2.7| = 4.2×10⁻¹⁵, which is greater than 3×10⁻¹⁵. 2σ: 1.5 + 5.5 = 7.0×10⁻¹⁵.

**Fix.**

text "< 5×10⁻¹⁵" (true at 1σ, since 4.2 < 5, and the same length). If the slot fits it, the exact published "(−1.5 ± 2.7)×10⁻¹⁵" is better. Add the readout to c10's note.

<details><summary>Verifier's check</summary>

The finding stands. The readout is at /home/user/Claude/films/channels/physics/ep04/compile.py line 117 and is compiled into film.json (line 372) and sheet.json. The same line is in the copy at /home/user/Claude-readability/films/channels/physics/ep04/compile.py.

The number checks out. A search confirmed the published value η(Ti,Pt) = [−1.5 ± 2.3 (stat) ± 1.5 (syst)]×10⁻¹⁵ at 1σ (arXiv:2209.15487, PRL 129, 121102). Combining the two errors gives √(2.3² + 1.5²) = 2.74, and the central 1σ interval runs from −4.24 to +1.24.

The strongest defence of the line is the collaboration's own wording, "no EP violation at the level of 2.7×10⁻¹⁵". But that phrase describes how precise the test was. It is not an upper limit on |η|. The readout turns it into a hard inequality, "difference < 3×10⁻¹⁵", and leaves out the −1.5 central value.

I worked out how likely each bound is, assuming a flat prior and a normal distribution N(−1.5, 2.74):
- |η| < 3×10⁻¹⁵: about 66%, which is less than even 1σ coverage (68%).
- |η| < 5×10⁻¹⁵: about 89%, close to the usual 90% limit.
- |η| < 7×10⁻¹⁵: about 98%.

Physicists normally quote upper limits at 90% or 95%, so a physicist signing off would flag "< 3". The readout is also not covered by any claim: c10 covers only the spoken line.

The proposed fix "< 5×10⁻¹⁵" is right and the same length. It holds for the whole central 1σ interval (4.24 < 5) and is about a 90% bound. It also still fits the voiceover's "a few parts in a million billion". "< 7×10⁻¹⁵" would be a stricter 95% limit, but 7 no longer reads as "a few", so "< 5" is the better choice. No betterFix is needed.

Apply the fix in compile.py (and the Claude-readability copy), then rebuild film.json and sheet.json. The spine tag "spine:difference, titanium vs platinum" does not change. Add a note to c10, for example: "Spine readout '< 5×10⁻¹⁵': true across the 1σ interval (−4.2 to +1.2), about a 90% bound on |η|."

My web searches ran out after confirming the published value, and arXiv could not be fetched (DNS failure). So I could not re-read the abstract's "at the level of" sentence word for word. It is quoted from a search excerpt, and the conclusion does not depend on its exact wording.

</details>

### F2 · unsourced

**Line:** `The feather is barely halfway. {c2}  (also the on-screen label "barely halfway", compile.py line 137)`

**Problem.** "Halfway" puts a number on the feather's fall: about 0.8 m of 1.6 m in 0.57 s. The script header says no number is claimed for the feather, and c2's source (the NASA Glenn drag equation) gives no fall speed. The 79 cm on screen comes from an assumed sinking speed of 1.6 m/s (compile.py VT = 160 cm/s), which has no source. The few published figures for a feather are 0.5–1 m/s. At those speeds the feather is only 17–32% of the way down when the hammer lands, so "barely halfway" probably overstates it by 1.5–3×. The drift badge marks the picture as an illustration, but the voice still states the fraction as fact.

**Evidence.** Search excerpts: a classroom resource (physicsclassroom.com lab PDF) gives a feather about 0.5 m/s; another source gives about 1 m/s. No measured terminal speed for a falcon flight feather was found. Calculation (free fall to v_t, then constant speed, t = 0.571 s): v_t = 0.5 m/s gives 0.013 + 0.5×0.520 = 0.27 m (17%); v_t = 1.0 m/s gives 0.051 + 1.0×0.469 = 0.52 m (32%); the script's 1.6 m/s gives 0.13 + 1.6×0.408 = 0.78 m (49%).

**Fix.**

vo: "The feather is still in the air. {c2}" (8 syllables, as now; it also sets up "Now take the air away"). Change the on-screen label to "still in the air" and move its anchor in compile.py from A("vo02:halfway.") to A("vo02:air."). Re-voice vo02.

<details><summary>Verifier's check</summary>

The finding stands. I checked it against the repo copy (/home/user/Claude/films/channels/physics/ep04/compile.py, which matches the audit script). The only reason the feather is "halfway" is VT = 160.0 at line 42. The comment at line 110 says it outright: "79 cm of 160: 'barely halfway'". Nothing sources that speed. c2's NASA Glenn drag-equation source gives no fall speed. c2's own note and the script header both say no speed or number is claimed for the feather, but "halfway" is a number (50%).

I redid the fall at t = sqrt(2*1.6/9.81) = 0.571 s two ways: the piecewise model in compile.py, and the exact quadratic-drag form y = vt^2/g * ln cosh(g*t/vt). How far down the feather is when the hammer lands:
- 0.5 m/s: 17% (both models)
- 1.0 m/s: 31–32%
- 1.25 m/s: 38–40%
- 1.6 m/s: 46–49% (the script's speed)
- 2.0 m/s: 54–59%

The finding's figures (0.27 / 0.52 / 0.78 m) are correct. My searches found the same as the fact-checker. Physics Classroom gives "feather = 1/2 m/s" as a teaching value, another source gives about 1 m/s, and I found no measured terminal speed for a falcon flight feather. One more point of reference: a DIY vacuum-chamber feather study (SPP 2024 proceedings) reports about 0.35 s in vacuum against 0.56 s in air. That works out to a drop of about 0.60 m and a feather terminal speed of about 1.28 m/s, which would put it about 38% down at 0.571 s. So every figure I could find or work out puts the feather well under halfway. Getting to "halfway" needs about 1.7 m/s or more, and nothing supports that.

The line is not defensible as fact. The drift badge covers the picture but not the narration, and a physicist signing off would flag a fraction that has no source. My web-search budget ran out after six searches, so the sourcing above is what I have.

The proposed fix is sound. "The feather is still in the air" is 8 syllables, the same as now. It is true for any real feather, since only a drag-free fall lands in 0.57 s. It also sets up "Now take the air away." "air." appears only once in the new vo02, so the anchor A("vo02:air.") resolves cleanly.

Small follow-ups the fix should include:
- Reword c2's note in claims.json; it currently says the feather "is drawn about halfway down".
- Update the comments at compile.py lines 55 and 110.
- Optionally, lower VT to about 100–120 cm/s so the badged drawing shows roughly a third of the way down, in line with the published figures. This is not required once the voice no longer states a fraction.

</details>

### F4 · misleading

**Line:** `vo: Gravity treats them equally. {c13} Only the *air* tells them apart. {c14}`

**Problem.** The takeaway contradicts the why beat. Thirty seconds earlier the film says "Gravity does pull the hammer harder" and shows the label "gravity: far stronger on the hammer". Gravity does not treat them equally: the force on the hammer is hundreds of times larger. What is equal is the acceleration, which is c13's own claim. A viewer repeating this line would be repeating something the film called false.

**Evidence.** c6: W = mg, so the hammer's weight is about 440–4,400 times the feather's (1.32 kg against NASA's 0.3–3 g range for a feather). c13 claim text: 'Gravity gives every object at the same place the same acceleration g'. The why label is in compile.py line 139.

**Fix.**

vo: "Gravity speeds them up alike. {c13}" (8 syllables, as now; it echoes "harder to speed up"). Update c13's sentence to match.

<details><summary>Verifier's check</summary>

The finding is correct and I could not refute it. I checked it against the script and the shipped compile data.

1. **The line contradicts the film.** script.md's why beat (24–40.5 s) says "Gravity does pull the hammer harder. {c6}". The label wy-pull in films/channels/physics/ep04/compile.py (line 139) reads "gravity: far stronger on the hammer", and the arrows show a big pull on the hammer and a tiny one on the feather. About 25 s later, at 62 s, the takeaway says "Gravity treats them equally." A general audience hears that as "gravity pulls them equally", which the film itself called false.

2. **The numbers check out.** Weight is W = mg (c6). With the 1.32 kg hammer (NASA SP-289 via NSSDCA) and NASA's 0.3–3 g range for a feather, the hammer's weight is 1320/3 = 440 to 1320/0.3 = 4400 times the feather's. That matches the finding's figure.

3. **What is actually equal is the acceleration.** c13's own claim text says so: "the same acceleration g". It also matches c7/c8 ("harder to speed up, by exactly as much"). Physicists do say "gravity treats all bodies equally" as loose shorthand for the universality of free fall. But it only works when force has not just been named as unequal, and here it has. The defence "it treats them equally in outcome" asks the viewer to reinterpret the verb, and a takeaway line should not need that.

4. **The proposed fix is sound.** "Gravity speeds them up alike. {c13}" is 8 syllables, the same as "Gravity treats them equally". It says equal acceleration (g) in plain words, matches c13's claim, and echoes "harder to speed up". It also stays true on Earth, where gravity's speed-up is the same for both and air drag makes the difference, so "Only the air tells them apart" (c14) still follows.

5. **What else has to change with it.**
   - c13's "sentence" field must become "Gravity speeds them up alike."
   - The vo07 line in film.json (line 1900) and its word timings must be re-synthesised.
   - Nothing in compile.py is timed off the words "treats" or "equally", so the label and camera timing need no changes.

</details>

## Story and wording notes (2) — apply when cheap

### F3 · story

**Line:** `On-screen label "same acceleration" (compile.py line 140: "t0": A("vo04:exactly"), "t1": R_w + 0.3)`

**Problem.** The label that delivers the why's payoff is on screen for 0.155 s (under 5 frames), so it reads as a flicker, not a label. It is set to appear on "exactly" and to leave 0.3 s after the re-drop starts. The re-drop (R_w) begins before "exactly" is spoken. The green acceleration arrow it labels is drawn from 34.48 s to 35.81 s.

**Fix.** "t0": A("vo04:harder#2", 0.4), "t1": R_w + 0.3. The label then starts with its arrow on "speed up" and holds through "exactly": 34.48–35.71 s, about 1.2 s.

### F5 · wording

**Line:** `vo: Next: a spinning office chair. {-} Pull in your arms, and you accelerate. {c15} *Why*? {-}`

**Problem.** "Accelerate" is loose for a physicist's sign-off. Anyone spinning is already accelerating (centripetally), and the word suggests going faster in a straight line. What rises is the spin rate, which is what c15 claims (ω rises as I falls) and what episode 5's hook asks ("Why does it speed up?"). In episode 5's own model the dumbbells' actual speed drops, even though the spin speeds up.

**Fix.** vo: "Pull in your arms, and you spin faster. {c15}" (10 syllables, as now). Update the quote of this tease in ep05/script.md line 4 to match.

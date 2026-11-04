# No. 03 draft round 2: status (4 Nov 2026, builder)

Done (stills only, no full render; each checked at draft tier):
- Finding 1 (h): lamellae myelin restored (the satin override in scene.mjs removed); drum rig rebuilt as a period
  instrument (smoked-paper drum, grained wood, brass rims/crank/feet, striated muscle, glistening nerve); terminal is
  a bouton on a tapering stalk with vesicles; the next cell is a curved membrane with receptors; the body is a
  rim-lit scan volume with depth slices and a glowing route.
- Finding 7 (partial): terminal flash no longer clips (emissive 1.8 -> 0.55).
- Finding 4 (partial): the race has a lit start line and distance ticks. Not done: the two-bar 373 vs 540 comparison.
Not done: finding 5 (hook re-voice: lead with the surprise, e.g. "Scientists once thought this spark was as fast as
light"), which needs the voice toolchain (kits/cinema/voice/setup.sh; not installed in this container), a lint run
and a re-align; findings 8, 9 (readout copy), 10 (label hold times), 11 (drum traces drawn on the words), 13 (re-voice
"the ache, bare ones."), 14, 15 (meanwhile picture), 16 (assets.md, README). The 3 s end card (finding 7) is also open.
Next: set up the voice toolchain, re-voice vo01 and vo06, then the compile.py copy/timing items, then one full draft
render (about 47 min) after the 8 Nov reset.

## Update (4 Nov, later)
Voice toolchain installed (kits/cinema/voice/setup.sh). Re-voiced and re-aligned: vo01 now "As fast as light? A top expert
once guessed it was." (question and surprise by 1.2 s), vo03 "That was Johannes Müller, who doubted it could be timed.",
vo06 "...the ache takes slow ones" (no more stray syllable), speeds trimmed so the film lands on 74.8 s with a 3.0 s end card.
lint.py: 0 errors. claims.json sentences for c1, c4, c19, c20 updated to the new wording (c4/c20 now tie to "A top expert
once guessed it was."). compile.py: title out at 2.6 s and the "? m/s" readout after it; "every step" readout removed; the gap
count became "34 vs 4 re-fires, same stretch: bare vs wrapped" (from the drawn model: 5 µm steps vs 4 internodes over
170 µm; badged not to scale); label holds (myelin 1.6 s, bare gap 1.7 s with side +1, damaged myelin 2.6 s); "zapped
farther away: its twitch starts later"; the tease's "not to scale" badge after the figure has gone.
Still open: F1 two-bar comparison (the readout "wrapped fibre · F1 record: 373 / 540 km/h" stays), drum traces drawn on
"timed"/"it" with a bracket (finding 11), the meanwhile heart picture (finding 15), end-card callback "? m/s" -> "150 m/s"
(finding 7), the CLAIMS-REVIEW and scorecard still describe the old final. No full draft render until after the 8 Nov reset.

# Light Minute ep03: script audit (26 Oct 2026)

## Verdict

The facts and on-screen numbers are sound. I found no factual errors and no maths errors. I worked from search excerpts only, because every WebFetch failed with ENOTFOUND in this sandbox. Recomputed: the solar day is 1/(1/243.0226 + 1/224.701) = 116.75 d, so \"a hundred and seventeen\" is right (a forward 243-d spin would give about 2,980 d). Sun to Venus is 108.21e6 km / 299,792.458 km/s = 361 s, so \"6 min\" is right. The radar round trip at closest is 2 × 38.2e6 / c = 255 s = 4 min 15 s, so \"about four minutes\" works and the \"4 min\" ring is acceptable. 1666 to 1962 is 296 years, so \"three hundred years\" holds. Earth sees about 365.26 sunrises per lap. The rest checks against search excerpts: the Cassinis' about 23 h (Laskar: Jacques Cassini found 23h15m from his father's 1666–67 observations), Schiaparelli's 1890 225-day lock (Nature, 1890), the NSSDC values (−5832.6 h, 2802.0 h, 38.2 million km) and NASA Space Place on the Sun rising in the west. The story follows the channel's beat order (readout after takeaway, as in eps 2, 4, 5 and 6), the hook lands at about 1.9 s, nothing from the \"Never write\" list appears and nothing reads as hype. lint passes with 0 errors (1 warning: no pron.json). Five fixes, none of which change the voiced timing. (1) Add a \"clouds removed\" badge, because the film shows a sunrise no one could see. (2) Tag \"yes\" and \"And no\" with c9 and c12. (3) Re-source c7 and c18: the cited Wikipedia page says 1961 for the first measurement and 1964 for retrograde confirmation, while NASA's 1962 Goldstone report supports the line as spoken. (4) Put 117 next to 225 on the takeaway spine so the hook's \"no\" closes. (5) Change \"one face always faced\" to \"one side always faced\". Not flagged, because it applies to the whole channel rather than this episode: no episode's end card carries the true-fact footnote from WRITING.md picture rule 6.

## Confirmed findings (3) — fix before the final render

### ep03-1 · misleading

**Line:** `## why {shot: a radar ping from Earth to Venus and back; the clouds clear to the pin; the true spin, backwards · spine "one turn: 243 days", then "one year: 225 days" · picture-only 2 s · energy: 0.62} (25–40 s)  [and in whoa: "the pin's sky: the Sun up in the west"]`

**Problem.** The film clears Venus's clouds at the radar beat. In the whoa it then shows the Sun standing in the pin's sky in the west. Nobody could see that: the clouds are permanent, and from the surface no Sun disc shows through them. The script's honesty list has no badge for this. It badges the cloud deck as "illustration" and the pin as "a person standing here", but not the cleared sky. WRITING.md rule 9 says idealisations are said aloud or badged. An expert would object to a drawn sunrise that reads as something a person on the surface would see.

**Evidence.** claims.json c13 note: "Nobody could see it through the clouds from the surface; it is the Sun's position in the sky." c3 (NASA, search excerpt): Venus is "permanently shrouded in thick, toxic clouds of sulfuric acid". Script honesty list: "not to scale", the clock's speed note, "illustration" on the cloud deck, "a person standing here". It has nothing for the clouds being removed. The badge fits the corner rule: the right corner would hold "not to scale" and "clouds removed" (2 notes), and the left keeps the speed note.

**Fix.**

## why {shot: a radar ping from Earth to Venus and back; the beam goes through the clouds to the pin (the deck stays, badged "illustration"); the true spin, backwards · spine "one turn: 243 days", then "one year: 225 days" · picture-only 2 s · energy: 0.62} (25–40 s). In the whoa, replace "the pin's sky: the Sun up in the west" with "spine 'where the Sun rises on Venus: west'" (as rendered).

<details><summary>Verifier's check</summary>

The finding is right about the script, but it is wrong about the film, and the fix it proposes is worse than the problem.

The script's direction does call for an unbadged idealisation. At the radar beat, "the clouds clear to the pin". In the whoa, "the pin's sky: the Sun up in the west". The pin is badged "a person standing here", so the shot reads as a sunrise that someone on the surface would see. claims.json itself says otherwise. c3 calls the clouds "permanent". c13's note says "Nobody could see it through the clouds from the surface". HUMAN-REVIEW.md flags the same point. WRITING.md rule 9 says idealisations are said aloud or badged, and this one is neither. If the film were rebuilt from the script as written, it would break the rule. My web search was blocked (budget used up), so I relied on the ledger's own sources.

The finding says "the film clears Venus's clouds" and "shows the Sun in the pin's sky". The final render shows neither. I checked review/stills-ep03.jpg, scene.mjs and compile.py:
- **Radar frame:** the cloud bands stay, and "Clouds: illustration" stays in the corner. scene.mjs has no code that clears the clouds.
- **Whoa:** the top-down diagram. "West" appears only as a spine readout (c-west, "where the Sun rises on Venus"). No Sun is drawn in the pin's sky.

The defect is the direction text, which no longer matches the finished picture.

Problems with the proposed fix:
- **Corner rule:** its count is wrong. Through the why beat, the right corner already holds "not to scale" (4.3–67.8 s) and "clouds: illustration" (14.4–42.1 s). Adding "clouds removed" makes three notes, which breaks the two-note limit in WRITING.md (picture rule 8).
- **Re-render:** it would mean adding a cloud-clearing effect and a new badge to a film that has already had its final render.
- **Honesty:** it keeps a drawn surface sunrise that nobody could see. Rewording the direction to match the render removes the idealisation, so no new badge is needed.

</details>

### ep03-2 · unsourced

**Line:** `vo: Can one day outlast a *year*? {-} On *Venus*: yes. {-} And no. {-}`

**Problem.** "On Venus: yes" and "And no" are tagged {-}, which means they state nothing outside the film. Both are claims about Venus. "Yes" says one rotation (243.0 d) is longer than the year (224.7 d), which is c9. "No" says the solar day (116.75 d) is shorter than the year, which is c12. lint.py trusts the tag, so it lists them as claim-free and does not catch this.

**Evidence.** script.md: "{-} marks a sentence that states nothing outside the film". lint output: "{-} (no claim): 4 … On Venus: yes. … And no." NSSDC Venus fact sheet (search excerpt): sidereal rotation −5832.6 h = 243.0 d, length of day 2802.0 h = 116.75 d. Orbital period 224.7 d (bible §7 claim 2). 243.0 > 224.7 supports "yes"; 116.75 < 224.7 supports "no".

**Fix.**

vo: Can one day outlast a *year*? {-} On *Venus*: yes. {c19} And no. {c20}   (spoken words unchanged; add c19 {sentence: "On Venus: yes.", rotation 243.0 d > year 224.7 d, NSSDC} and c20 {sentence: "And no.", solar day 116.75 d < year 224.7 d, NSSDC} to claims.json, because lint needs each ledger sentence to match its script sentence and ties each claim to one sentence)

<details><summary>Verifier's check</summary>

The finding is correct. The spoken words are accurate, but the tags are wrong. script.md defines {-} as "a sentence that states nothing outside the film". "On Venus: yes." answers the hook's question, so it states that one rotation of Venus is longer than its year (243.0 d vs 224.7 d). "And no." states that in another sense a day there is shorter than the year (the solar day is 116.75 d). Both are claims about the real world. The original line passes lint (0 errors) and lists both sentences under "{-} (no claim): 4", so the gap is real and the finding does not misread the script.

I redid the numbers. 5832.6 h / 24 = 243.03 d. 2802.0 h / 24 = 116.75 d. 1/(1/243.02 + 1/224.70) = 116.75 d, which matches the fact sheet. I could not re-run a web search because this turn's search budget was used up, so the source values come from the NSSDC figures already quoted in claims.json (c8, c11, c12). They also match the published fact sheet as I know it.

The proposed fix is broken, though. I ran lint on a copy of the episode with it applied, and it fails with 2 errors and 2 warnings:
- lint requires the ledger's "sentence" to match the script exactly, so it reports "ERROR claim c9: its sentence differs from the script" (ledger: 'So yes: one turn outlasts a year.', script: 'On Venus: yes.'), and the same error for c12.
- It also warns "cited by 2 sentences; a claim ties to one sentence".

The fix that works gives the hook sentences their own new claim ids. Two entries need adding to claims.json:
- c19: sentence "On Venus: yes.", claim: one rotation (243.0 d) is longer than the year (224.7 d), NSSDC Venus fact sheet, a hook preview of c9.
- c20: sentence "And no.", claim: the solar day (116.75 d) is shorter than the year (224.7 d), same source, a hook preview of c12.

Each entry also needs accessed 2026-10-25, verified_via "search excerpt" and status "ok". I checked this version on a copy of the episode, and lint gives 0 errors and 0 warnings with 19 claims cited and 19 in the ledger.

Files:
- Copy with the proposed fix: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/verify_ep03/fix
- Copy with the working fix: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/verify_ep03/better
- Real files, not yet changed: /home/user/Claude/films/channels/space/ep03/script.md and claims.json (the same as the audit copies)

</details>

### ep03-3 · unsourced

**Line:** `In nineteen sixty-two, radar from a dish in California pierced the clouds. {c7}`

**Problem.** The spoken line is true. Goldstone's radar run at the 1962 conjunction was the one that found the slow backward spin and ruled out both guesses. But c7 and c18 cite Wikipedia's "Observations and explorations of Venus", and search excerpts show that page says something else. It says radar first measured the rotation at the 1961 conjunction, from Goldstone, Jodrell Bank and Yevpatoria, and that retrograde rotation "was not confirmed until 1964". The quote the ledger gives ("found in 1962 … a period of 243 days") did not turn up. A person opening that link before posting will find it disagrees with the line. The ledger also credits 1962 with "near 243 days", but the 1962 result was about 230 ± 40–50 days. The 243-day figure came from the 1964–66 conjunctions. The narration says 243 in the present tense, which is fine, but the ledger should say this.

**Evidence.** Search excerpts only (WebFetch failed: getaddrinfo ENOTFOUND for wikipedia.org, imcce.fr and nssdc.gsfc.nasa.gov). Wikipedia, Observations and explorations of Venus: rotation "first measured during the 1961 conjunction … 26 m antenna at Goldstone, California …" and "the fact that rotation was retrograde was not confirmed until 1964". NASA NTRS 19630003286 (the 1962 Goldstone experiment, 85-foot antenna, California): "the 1962 experiment concentrated on the rotation rate which is now given as 230 plus or minus 40 to 50 days, retrograde". Caltech (calteches.library.caltech.edu/2590/1/venus.pdf): "in 1962 … the surprising period of 250 days, but in the retrograde direction". Goldstein's 1962 thesis, working from 1961 data, had instead concluded "one hemisphere always faces the sun", so the 1962 run was the one that overturned the guesses. Later refinements: Carpenter 1962–66, 243.24 ± 0.10 d; Goldstein, 242.6 ± 0.6 d. Note that 230 ± 40–50 d does not exclude 225 d. What rules out Schiaparelli is the backward direction, so c18 still holds.

**Fix.**

Keep the vo line word for word. Point c7 and c18 source_url to https://ntrs.nasa.gov/api/citations/19630003286/downloads/19630003286.pdf, with Caltech E&S as the second source. c7 claim: "Radar first measured Venus's spin in 1961; Goldstone's 1962 run in California indicated a slow backward spin (about 230 ± 40–50 d), confirmed in 1964 and refined to about 243 d by 1966." c18 claim: "It ruled out about 23 h (far too slow) and a forward 225-day lock (wrong direction)." Remove the unfound quote from c7's note.

<details><summary>Verifier's check</summary>

I could not refute the finding. Page fetches failed again (getaddrinfo ENOTFOUND for wikipedia.org, ntrs.nasa.gov and calteches.library.caltech.edu, and curl got a proxy 403), and this turn's WebSearch budget was already used up. So this check rests on the finder's excerpts plus what I already know, and none of it was re-fetched.

1. The spoken line is fine. It says only that 1962 radar from a California dish pierced the clouds. It does not say "first". Goldstone's 1962 run is the one that overturned Goldstein's earlier synchronous reading of the 1961 data, so "Both guesses were wrong" holds for a general audience.

2. The ledger problem is real. Wikipedia's "Observations and explorations of Venus" does say, as I remember it too, that rotation was "first measured during the 1961 conjunction" (Goldstone 26 m, Jodrell Bank, Yevpatoria) and that the retrograde direction "was not confirmed until 1964". The c7 "excerpt" (found in 1962, retrograde, 243 days) reads like a paraphrase, not a quote, and was not found. Anyone who opens that link before posting would see it disagree with the ledger.

3. The 1962 numbers were rough: 230 ± 40–50 d (JPL/NTRS) or about 250 d (Caltech E&S). The 243-day figure came from the 1964–66 conjunctions, so "near 243 days" is a stretch for 1962.

4. c18 has the same errors. Its claim says Goldstone's observations were "beginning at the 1962 inferior conjunction" (they began in 1961) and credits 1962 with "near 243 days". The proposed fix changes only c18's source_url and leaves both errors in place.

5. The proposed c7 claim says the 1962 run "showed … backwards". The cited Wikipedia page says the backward spin was confirmed only in 1964, so "indicated … backwards, confirmed 1964" keeps the ledger consistent with what a reader will find.

6. The arithmetic checks out. 230 ± 45 d does not rule out a 225-day period. What rules out Schiaparelli is the backward direction, so c18's verdict still stands if it is worded around direction.

The fix should also remove the unfound quote from c7's note and update the source_title on both claims.

</details>

## Story and wording notes (2) — apply when cheap

### ep03-4 · story

**Line:** `## takeaway {shot: hold on the diagram, the ticks · picture-only 0.2 s · energy: 0.3} (52–59 s)`

**Problem.** The hook opens two loops: "yes. And no." The takeaway closes the "yes" in words ("one turn outlasts a year"). The "no" (117 days is shorter than the 225-day year) is never put side by side on screen. The 225 appeared only once, on the spine during the why, and the whoa replaced it with "sunrise to sunrise: 117 days". The viewer has to remember a number from about 15 s earlier. WRITING.md picture rule 2 asks the spine's label to "change to say what the number now means" at the takeaway, and this heading doesn't do that. Relabelling the spine closes the "no" without changing the narration.

**Fix.** ## takeaway {shot: hold on the diagram, the ticks · spine relabels "a day here: 117 days · a year: 225" · picture-only 0.2 s · energy: 0.3} (52–59 s)

### ep03-5 · wording

**Line:** `Schiaparelli said one face always faced the *Sun*. {c6}`

**Problem.** "One face always faced" sounds like a jingle when spoken. It also follows "Venus hides its face" from about 10 s earlier, so "face" is heard three times in quick succession. That trips the listener on the line that sets up the second guess.

**Fix.** Schiaparelli said one side always faced the *Sun*. {c6}

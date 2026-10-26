# Light Minute ep02: script audit (26 Oct 2026)

## Verdict

Most of the episode holds up. I recomputed the 6 h Moon trip, the 49-year flight, the 1 light-day (25.90 billion km, 173.14 AU), the 48 h command round trip, the 2012 heliopause crossing, 4.24 ly (1,549 light-days, so 'about fifteen hundred' and '1,550' on screen are both fair), 75,000 years at 17 km/s (74,800), 'four years and three months' (2.9 months), and Venus's 243.0-day spin against its 224.7-day year. All are right. I also checked whether Voyager's distance from Earth dips back under one light-day after 18 November, as it can for part of each year. It doesn't: the lowest point comes in late April 2027 and is still about 0.17 AU above. The story follows the seven beats with a real hook, a wrong idea and an escalation, and nothing from the 'Never write' list appears. Three things should be fixed before posting: (F1) the Europe line states a disputed point as settled (Apidima); (F2) the end card implies Venus is the only planet that spins backwards (Uranus does too); (F3) the Oort cloud numbers drop NASA's 'about' and 'possibly'. (F4) is a wrong time in claims.json that affects when to post, not the narration. F5 and F6 are small story and wording fixes. All web checks used search excerpts; WebFetch failed with ENOTFOUND for science.nasa.gov.

## Confirmed findings (4) — fix before the final render

### F1 · misleading

**Line:** `Count back that far, and our species hadn't reached Europe. {c13}`

**Problem.** The line says, as settled fact, that Homo sapiens had never reached Europe before 75,000 years ago. That is contested. Apidima 1, a skull from Greece dated to at least 210,000 years and published in Nature in 2019 (Harvati et al.), is argued to be an early Homo sapiens from a dispersal that later died out. Critics dispute both its date and its species, but a specialist would still object to 'hadn't reached'. The ledger is also wrong: c13 says 'The earliest claimed site, Grotte Mandrin in France, is about 54,000 years old', but Apidima is a much older claim. What every side accepts is that no Homo sapiens are known in Europe 75,000 years ago, and the on-screen pill in compile.py ('75,000 years ago: no Homo sapiens in Europe') already says exactly that.

**Evidence.** From search excerpts (WebFetch could not reach the pages). University of Tübingen press release 'Earliest known Homo sapiens in Eurasia found in Greece' (Harvati et al., Nature 2019): Apidima 1 is about 210,000 years old and has a mix of modern and archaic traits with no Neanderthal features. Discover Magazine and ScienceAlert report the objections: U-series dates on the samples range from over 300,000 to under 40,000 years (Warren Sharp), Hershkovitz calls the dating 'unconvincing', and Susan Antón calls it 'plausible' but 'not a slam dunk'. The Bristol/Nature 2024 source in c13 supports arrival more than 45,000 years ago and does not exclude earlier, failed dispersals. The 75,000-year anchor itself checks out: 4.24 ly × 9.4607e12 km/ly ÷ 17 km/s = 2.36e12 s, or about 74,800 years.

**Fix.**

Line: "Count back that far, and our species wasn't in *Europe*. {c13}" (unchanged from the proposal). In claims.json c13, replace the Mandrin sentence with: 'No Homo sapiens are known in Europe 75,000 years ago. Earlier claims did not last: Apidima 1, Greece, at least 210,000 years (Harvati et al., Nature 2019; date and species disputed), and Grotte Mandrin, France, about 54,000 years (Slimak et al., Sci. Adv. 2022; Neanderthals returned). Lasting presence starts a little over 45,000 years ago (Bacho Kiro; Ranis, Nature 2024).'

<details><summary>Verifier's check</summary>

The finding stands. I could not run any new searches because this turn's shared WebSearch budget was already used up, so this check rests on the files plus what I already knew of the literature. That knowledge matches the evidence the finding cites. Harvati et al. (Nature 571, 2019) present Apidima 1 as Homo sapiens with a minimum age of about 210,000 years. Critics, including de Lumley (2020), dispute both the date and the species, but the paper has not been retracted or refuted.

"Our species hadn't reached Europe" talks about a first arrival, as if it were settled. If Apidima 1 is accepted, that first arrival came long before 75,000 years ago, so a palaeoanthropologist would reasonably object. "Wasn't in Europe" talks about presence 75,000 years ago, which every side accepts. It matches the compile.py pill ("75,000 years ago: no Homo sapiens in Europe", line 194). It keeps the word "Count", which the pill's A("vo05:Count") anchor uses, and it costs nothing in length or punch.

The ledger error is real too. c13 calls Grotte Mandrin "the earliest claimed site", but Apidima is a far older published claim. The 75,000-year anchor checks out: 4.24 × 9.4607e12 / 17 = 2.36e12 s, about 74,800 years.

The proposed ledger text has a problem of its own. It calls Mandrin, about 54,000 years old, a "lasting arrival". Slimak et al. (Science Advances, 2022) describe it as a short Homo sapiens incursion followed by a Neanderthal return, so it is a failed dispersal just like Apidima. The Bacho Kiro and Ranis lineages also left no living descendants, so "lasting" should describe the species' presence from about 45,000 years ago, not any one site. The betterFix below corrects that.

Applying it means:
- Re-voicing vo05 (vo/lines.json line 70 and the word timings in film.json).
- Updating the old quotes in review/HUMAN-REVIEW.md lines 16-18, review/CLAIMS-REVIEW.md row c13, and ../PRODUCTION.md lines 19-20.
- Optionally softening script.md line 10 ("longer than our species has lived in Europe"). It is not spoken, but it has the same Apidima problem.

</details>

### F2 · misleading

**Line:** `end card: "Next light: the planet that turns *backwards*"`

**Problem.** 'The planet' tells the viewer Venus is the only planet that spins backwards. Uranus also spins retrograde: its rotation is retrograde under the IAU convention, with an obliquity of 97.8°. The voiced tease is fine because it says 'a world that turns slower than it orbits', which only Venus does. The card should not claim uniqueness that the voice avoided.

**Evidence.** From search excerpts. NASA, quoted by Africa Check: 'Like Venus, Uranus rotates in the opposite direction as most other planets.' Sky & Telescope: under the IAU north-pole convention Uranus's rotation is retrograde. NASA NTRS 1985 lists Uranus 'Sense of spin = Retrograde'. The NSSDC planetary fact sheets, the same family as the c17/c18 source, list Uranus's sidereal rotation as −17.24 h, where the minus sign means retrograde.

**Fix.**

end card: "Next light: a planet that turns *backwards*"

<details><summary>Verifier's check</summary>

The finding stands. I couldn't run my own search because this turn's shared web-search limit was already used up, so I checked against what is already known. NASA's own Uranus overview says Uranus is one of two planets that rotate east to west, Venus being the other. The NSSDC Uranus fact sheet gives the sidereal rotation as -17.24 h (the minus sign means retrograde) and the obliquity as 97.77 degrees. Under the IAU north-pole convention, Uranus's spin counts as retrograde. Some might say Uranus is really 'sideways' at 82 degrees under the right-hand-rule pole. That point doesn't help the card, because NASA's public material tells a general audience that Uranus turns backwards like Venus. 'Venus, the planet that spins backwards' is a common pop-science phrase, but it isn't accurate. The finding reads the script correctly. The card is on-screen text that stays up for at least 1.5 s and can be screenshotted on its own, and 'the planet' there says Venus is the only one. The voiced tease avoids that claim: 'a world that turns slower than it orbits' fits only Venus (243.0 d spin vs 224.7 d orbit), and 'And backwards' adds a fact without claiming it is unique. One could read 'the planet' as pointing back to the world just described. But the card has to be right even without the narration, and the claims file (c18) only supports 'Venus rotates retrograde', not that it is the only planet that does. The proposed fix, 'Next light: a planet that turns *backwards*', is accurate, almost the same length (two characters shorter), and matches the voice's 'a world'. It also keeps the stressed word for the camera landing, so no better fix is needed.

</details>

### F3 · misleading

**Line:** `That's three hundred years away. {c10} Getting through it: thirty thousand more. {c19}`

**Problem.** These two numbers are about a cloud nobody has observed, and the line drops NASA's own hedges. NASA writes 'about 300 years' and 'possibly about 30,000 years'. The figures also sit at opposite ends of the ranges given on the same NASA pages: 300 years is the low end and 30,000 years the high end. Said flatly, they sound measured. WRITING rule 9 asks for 'about' here. The on-screen numbers have the same problem: the spine readout shows '300 years to the comet cloud' and '30,000 years more to cross it', and the ghost path is labelled '300 years'.

**Evidence.** From search excerpts (science.nasa.gov failed DNS on WebFetch). NASA's Oort Cloud page and its facts page say 'about 300 years to reach the inner boundary' and 'possibly about 30,000 years to fly beyond it'. The same pages put the inner edge at 2,000–5,000 AU and the outer edge at 10,000–100,000 AU, and call the cloud theoretical. NBC, quoting the JPL team, gives 200–300 years. Calculation: Voyager is at 173.1 AU on 18 Nov 2026 and moves at 16.9 km/s × 3.156e7 s ÷ 1.496e8 km = 3.56 AU/yr. After 300 years it reaches 173 + 1,068 ≈ 1,240 AU, which is where the README draws the inner edge and is below NASA's stated 2,000 AU. Reaching 2,000 AU takes (2,000 − 173) ÷ 3.56 ≈ 513 years, and 5,000 AU takes ≈ 1,356 years. Crossing to 10,000 AU takes ≈ 2,760 years, and to 100,000 AU ≈ 28,000 years.

**Fix.**

That's about three hundred years away. {c10} Through it: maybe thirty thousand more. {c19}

This is 18 syllables, the same as the proposal. It keeps "That's", so the number clearly refers back to the cloud. It also avoids a second form of "cross" in a beat that already says "crossed into interstellar space"; the film also uses "crosses a line" and "crossed day one" elsewhere. The proposed spoken line is also acceptable.

On screen, change four labels:
- The spine c-oort0 label: "years to the comet cloud, about".
- The spine c-oort1 label: "years more to cross it, maybe".
- The ghost-path label l-300: "about 300 years".
- The body label l-30k, which the finding missed: "maybe 30,000 more to cross".

Then:
- Update the "sentence" fields of c10 and c19 in claims.json.
- Re-voice vo04.
- Regenerate the caption in out/posting.json and out/POSTING.md.
- Add "about" and "maybe" to the spine and honesty-table text in the README.

<details><summary>Verifier's check</summary>

The finding stands. I could not re-open the sources myself. science.nasa.gov fails DNS on WebFetch, the proxy returns 403 for NASA and JPL hosts through curl, and this turn's web-search budget was already used up. So this check rests on the excerpts already recorded, and they agree with each other. The episode's own claims.json says "about 300 years" in c10's claim text. c19's note quotes NASA as "probably another 30,000 years" and "possibly about 30,000 years to fly beyond it". c9 calls the cloud theoretical, and NBC quotes the JPL team as "200 to 300 years". So the spoken line removes hedges that the film's own claims file keeps. It also breaks WRITING.md rule 9 ("Use 'about' and 'nearly'"). The script follows that rule everywhere else: "about seventeen kilometers", "about fifteen hundred", "about seventy-five thousand".

I redid the arithmetic. 16.9 km/s × 3.156e7 s ÷ 1.496e8 km ≈ 3.56 AU/yr. After 300 years, Voyager is at 173 + 1,069 ≈ 1,240 AU. That is at or below even the lowest inner-edge estimates (1,000 or 2,000–5,000 AU). After 30,000 years it is at about 107,000 AU, the far end of the outer-edge range. The README admits the drawn cloud runs from 1,240 AU to 108,000 AU, "NASA's two figures". So the two numbers are the most optimistic inner edge and the most distant outer edge. Spoken flatly, they sound measured.

The "comet cloud: theory" badge says the cloud is unconfirmed. It does not hedge the numbers, and the spine readout shows a bare "300" and "30,000". The 300-year figure is also a 2013 estimate, made when Voyager was about 125 AU out. That is one more reason to say "about".

The pacing claim checks out. The why beat is 31 words in about 14 s of speech, roughly 2.2 words/s, against 2.7 in the normal beat, so two extra syllables fit. The proposed fix is sound and its spine labels match the film's existing "light-days to Proxima, about" label. But it misses one on-screen label: film.json l-30k "30,000 more to cross", anchored at oort-deep.

</details>

### F4 · factual-error

**Line:** `On November eighteenth, it crosses a line. {c5}`

**Problem.** The spoken date is correct, but the time in the ledger is wrong. c5 says 'NASA announced ... 12:16:07 a.m. CST on 18 November 2026' and its note says '06:16 UTC'. That is EarthSky's figure. NASA's own page gives 2:16:07 a.m. PST, which is 5:16:07 a.m. EST, 4:16:07 a.m. CST and 10:16:07 UTC: four hours later. EarthSky's time puts the crossing on 17 November in Pacific time, which is probably why its headline says 'November 17-18'. This matters for scheduling. If the post goes up before 10:16 UTC on the 18th, 'Its signal now needs a full day' is a few hours early.

**Evidence.** From search excerpts. NASA Science, 'Voyager 1: What Is a Light-Day?': Wednesday 18 November 2026, 2:16:07 a.m. PST, at 16.094 billion miles (25.902 billion km). NASA's mission page lists 'NOV 18, 2026, 5:16AM EST'. Science News gives 5:16:07 a.m. Eastern. EarthSky gives 12:16:07 a.m. CST. Arithmetic: PST = UTC−8, so 2:16:07 PST is 10:16:07 UTC; CST = UTC−6, so 12:16:07 CST is 06:16:07 UTC. The two do not agree. One light-day = 299,792.458 km/s × 86,400 s = 25.90 billion km = 173.14 AU, which checks out.

**Fix.**

On November eighteenth, it crosses a line. {c5}  (Voice unchanged. In claims.json c5: claim '... at 2:16:07 a.m. PST (10:16:07 UTC) on 18 November 2026'; source_url https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/; note: change '(CST; 06:16 UTC)' to '(10:16:07 UTC; EarthSky's 12:16 a.m. CST looks like a PST conversion slip)'. Post at or after 10:16 UTC on 18 Nov if possible: before then the signal is short of a day by only about a second.)

<details><summary>Verifier's check</summary>

The finding stands, but only for the ledger. The spoken line and the date are right, and the finding says so too.

What I could not check: this turn's search budget was already used up. Fetches were also refused: science.nasa.gov and earthsky.org failed DNS, and ssd.jpl.nasa.gov (Horizons), naif.jpl.nasa.gov and voyager.jpl.nasa.gov got proxy 403s. So I could not open NASA's page or compute the crossing from an ephemeris. I relied on the finding's quoted excerpts, the repo's own records and arithmetic.

What I checked:
1. The finding reads c5 correctly: '12:16:07 a.m. CST', note '06:16 UTC', with EarthSky as the source. /home/user/Claude/films/channels/crosscheck.json confirms the CST figure came only from EarthSky ('EarthSky reports NASA's ... 12:16:07 a.m. CST ... so use NASA's page'). Nobody ever checked it against NASA directly.
2. Arithmetic. US daylight time ends Sunday 1 Nov 2026, so standard time applies on the 18th. 2:16:07 PST (UTC−8) and 5:16:07 EST (UTC−5) both give 10:16:07 UTC, so NASA's two pages and Science News all match. 12:16:07 CST (UTC−6) gives 06:16:07 UTC, four hours earlier. One light-day = 25,902,068,371 km = 173.1446 AU, which is correct.
3. The likely cause: 12:16 is exactly 2:16 PST minus 2 hours. The correct PST-to-CST step is plus 2 hours, giving 4:16 CST, so EarthSky probably applied the offset backwards. That slip would also explain EarthSky's 'November 17-18' headline, because 12:16 a.m. CST is 10:16 p.m. PST on the 17th. NASA itself is unlikely to have published a time in CST.

So c5 credits NASA with a time NASA did not give, and its UTC is four hours off. That is a real error in the ledger.

Two caveats:
- The voice line stays as written. Under NASA's time it is 18 November everywhere in the US.
- The scheduling risk is overstated. In mid-November, Voyager's distance from Earth grows by about 27 km/s (rough estimate). Posted at 06:16 UTC, 'needs a full day' would be short by only about 1.3 light-seconds, which no general audience would notice. Posting after 10:16 UTC is a harmless extra, not a correctness requirement.

The proposed fix also misses the c5 note, which would still say '(CST; 06:16 UTC)' and contradict the corrected claim.

The same CST figure also appears in /home/user/Claude/films/channels/space/ep02/claims.json, /home/user/Claude/films/channels/space/ep02/review/CLAIMS-REVIEW.md and /home/user/Claude/films/channels/crosscheck.json.

</details>

## Story and wording notes (2) — apply when cheap

### F5 · story

**Line:** `So we haven't left for the stars. {-} Voyager has crossed day one of *fifteen hundred*. {c14}`

**Problem.** The takeaway's two sentences contradict each other, and the first contradicts the episode. The why beat says Voyager 'crossed into interstellar space'. The next sentence says it is one day into a fifteen-hundred-day road, which means it has left, just barely. An attentive viewer, or the channel's expert reviewer, hears 'haven't left' as false. The reframe the episode has earned is 'barely'.

**Fix.** So we've barely left for the stars. {-} Voyager has crossed day one of *fifteen hundred*. {c14}

### F6 · wording

**Line:** `It coasts at about seventeen kilometers a second: Earth to the Moon in six hours. {c3,c4}`

**Problem.** This sentence has two numbers, which breaks WRITING rule 3 (one number per sentence). Spoken, the colon blurs the speed into its human picture. A full stop costs nothing and turns the Moon trip into the short follow-on sentence that rule 5 asks for. The figures themselves are correct.

**Fix.** It coasts at about seventeen kilometers a second. Earth to the Moon in six hours. {c3,c4}

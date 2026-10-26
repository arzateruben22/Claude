# Light Minute ep06: script audit (26 Oct 2026)

## Verdict

The episode is almost clean: two real problems, an on-screen label and a source. Neither needs the voice-over re-timed. WebFetch could not reach any page (DNS blocked), so every check below rests on search excerpts plus my own arithmetic.

**Numbers checked and correct:**
- **Equator speed:** 40,075 km / 23.93 h = 1,674 km/h (1,670 km/h on a 24 h day). NASA Space Place gives 1,675, so "about 1,670" holds.
- **Speed of sound:** NASA Glenn gives 761 mph = 1,225 km/h. 1,670 / 1,225 = Mach 1.36, true at the equator, which is where the line places it.
- **Earth's orbit:** NSSDC gives 29.78 km/s.
- **New York to Boston:** the great-circle distance is 306.1 km. At 29.78 km/s that takes 10.3 s. The line starts at about 16.9 s, by when Earth has covered about 505 km, so "farther than" is true.
- **Sun's speed:** NASA gives 828,000 km/h; 828,000 / 3,600 = 230 km/s.
- **One lap:** NASA says about 230 million years. As a cross-check, 2π × 26,990 ly ÷ 230 km/s = 221 million years, inside the 225–250 million estimates once you allow for the spread in those figures.
- **First dinosaurs:** the AMNH video puts them at 230 million years ago. The earliest certain fossils date to about 233–231 million years.
- **Light time, galactic trip:** 230 km/s × 60.5–64.5 s = 13,900–14,800 km, which light crosses in 0.046–0.049 s. "0.05 s" and "about a twentieth" both hold.
- **Galactic centre:** MPE/GRAVITY 2021 gives 8,275 pc = 26,990 ly, so "27,000 years" holds.
- **Galileo:** the ship's cabin passage is in the 1632 Dialogue, as the Wikipedia "Galileo's ship" excerpts confirm.

**Story:** the episode has every beat: a 7-syllable hook spoken by about 1.9 s, a person and a wrong idea (Ptolemy, then Galileo), an escalation to the galaxy, a takeaway you could repeat, and a specific tease. The readout coming after the takeaway is the channel's normal order (episodes 4 and 5 do the same), so I did not flag it. No line from the "Never write" list appears, and there are no exclamation marks.

**Lint:** it gave two word-count warnings and no errors. The normal beat has 21 words (asks 22–34) and the whoa has 34 (asks 16–28). I left them out of the findings because they are about timing, not facts.

**The two fixes:**
- **F1:** change the why beat's spine from "what you can feel: a change in speed" to "what you can feel: a jolt, not speed". Earth's own orbital speed changes by 3,600 km/h over the year and nobody feels it.
- **F2:** re-source c5 to Ptolemy's Almagest I.7 (Toomer's translation) or G. C. Lewis's history of ancient astronomy. The Wikipedia Dialogue article it cites now does not appear to say this.

## Confirmed findings (2) — fix before the final render

### F1 · misleading

**Line:** `why heading, on-screen spine: "what you can feel: a change in speed"`

**Problem.** This label sits on screen through the whole why beat, and it says something false about the episode's own subject. Earth's orbital speed does change: it swings by 1 km/s (3,600 km/h, about twice the equator spin speed the film just showed) between perihelion in January and aphelion in July, and nobody feels it. Earth's spin and orbit also change direction all the time. We don't feel the orbit because Earth is in free fall around the Sun, and the spin's effect is about 0.3% of gravity. The claim's own reviewer note (c7) already asked for "'speed' → any change of motion", and the spoken line ("You feel a jolt, never a smooth ride") is right. Only the label was never updated, and a physicist reviewer would object to it.

**Evidence.** NASA NSSDC Earth Fact Sheet, checked by search excerpt (ESA's Earth page gives the same figures): mean 29.78 km/s, max 30.29, min 29.29. 30.29 - 29.29 = 1.00 km/s x 3,600 = 3,600 km/h, against 1,670 km/h for the spin. The c7 note in claims.json says the same: changes of speed or direction; the orbit can't be felt because of free fall. The "story" paragraph at the top of script.md repeats the old wording ("a steady speed can't be felt, only a change in it"), so update it too.

**Fix.**

Spine: "what you can feel: a jolt, not speed" (36 characters, same as the original, and it matches the voice-over word "jolt"). In the header's story paragraph, change "a steady speed can't be felt, only a change in it" to "smooth motion can't be felt, only a jolt".

<details><summary>Verifier's check</summary>

The finding stands, and the proposed fix is good as written.

I could not check the source live: the web search budget for this turn ran out on my first query. I relied on the NSSDC Earth Fact Sheet figures as I know them (mean 29.78 km/s, max 30.29, min 29.29; perihelion in early January, aphelion in early July). Those match the finding and the c3 source.

I redid the arithmetic. The swing is 30.29 - 29.29 = 1.00 km/s, which is 3,600 km/h. That is 2.16 times the 1,670 km/h equator spin (finding: "about twice"). The spin's centripetal effect is about 0.034 m/s², roughly 0.3% of g (finding: correct).

Strongest defence of the original line: inside Galileo's cabin, "you can feel a change in speed" is true in everyday terms, as when a ship lurches or a car brakes. Also, Earth's 1 km/s change is spread over six months. That works out to about 6e-5 m/s², or 6e-6 g, which would be too small to feel even without free fall. So the finding's "nobody feels a 3,600 km/h change" is partly rhetorical.

The defence still fails, for three reasons:
(1) The spine sits under the beat that answers "why don't we feel any of it?". Read that way, it suggests Earth's motion is a steady speed, and the episode's own c3 source shows that is false.
(2) It leaves out direction. Spin and orbit are constant changes of direction, and that is exactly the "Earth moves at a constant speed, so we can't feel it" mistake that physicists object to. The real reasons are free fall for the orbit, and an effect too small to feel for the spin.
(3) The c7 reviewer note in claims.json already asks for "'speed' → any change of motion". The spoken line was updated to "You feel a jolt, never a smooth ride" and the spine was not, so the on-screen text now contradicts both the voice-over and the claim file.

The proposed spine, "what you can feel: a jolt, not speed", is 36 characters, the same as the original (I counted both). It repeats the voice-over word "jolt" and no longer claims Earth's speed is constant. "Jolt" is loose in the same way the voice-over already is: steady acceleration can also be felt. Even so, c7 defines jolts as changes of speed or direction, so it holds up for a general audience. The header's story paragraph should change to match, from "a steady speed can't be felt, only a change in it" (49 characters) to "smooth motion can't be felt, only a jolt" (40 characters). It is not shown on screen, so its length does not matter. No better fix is needed.

Files: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/space/ep06/script.md (why heading spine and the story paragraph), /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit/space/ep06/claims.json (c3, c7).

</details>

### F2 · unsourced

**Line:** `vo: Ptolemy argued that if Earth moved, birds and clouds would be left *behind*. {c5}`

**Problem.** The statement is true, but c5 cites the Wikipedia article on Galileo's Dialogue. I found no excerpt where that article credits the clouds-and-birds argument to Ptolemy. The search excerpts only describe the book's four-dialogue structure and the ship thought experiment, and c5's own note admits the argument comes from Almagest I.7. Under rule 9 the cited source has to say what the line says. Context for the reviewer: Ptolemy made this argument specifically against Earth spinning on its axis ("would not accompany the earth in its rotation"). That fits the episode, because the Dialogue's Second Day, where the ship cabin appears, is about the daily rotation.

**Evidence.** Search excerpts. G. C. Lewis, An Historical Survey of the Astronomy of the Ancients: "Ptolemy admits that, with respect to the stars alone, this is the most simple hypothesis; but ... The clouds, and birds in their flight, and projectiles, would not accompany the earth in its rotation." Toomer's translation of Almagest I.7, as quoted in a Filozofski vestnik article: "neither clouds nor other flying or thrown objects would ever be seen moving towards the east." Search excerpts of the Wikipedia Dialogue article showed no Ptolemy, birds or clouds passage. WebFetch failed (DNS blocked for en.wikipedia.org).

**Fix.**

Keep the voice-over line word for word: "Ptolemy argued that if Earth moved, birds and clouds would be left *behind*." Re-source c5: set source_title to "Ptolemy, Almagest I.7, tr. G. J. Toomer (Princeton UP, 1998)" and add G. C. Lewis, An Historical Survey of the Astronomy of the Ancients (1862), as a web-checkable second source. Keep the Dialogue article only as context for c6.

<details><summary>Verifier's check</summary>

The finding stands. I couldn't check sources live: the shared WebSearch budget for this turn was already used up, and WebFetch to en.wikipedia.org failed on DNS. I worked from the files, the finding's quoted excerpts, and what I know of Almagest I.7.

1) The line itself is correct and fine for a general audience. In Almagest I.7 Ptolemy argues that if Earth moved through space, living things and objects in the air would be left behind. He also argues that if Earth spun, clouds and things that fly or are thrown would never be seen moving east, because Earth would outrun them. "Birds" is a fair plain-English reading of "things that fly", and Lewis (1862) says "birds in their flight" outright. The finding does not dispute any of this; it keeps the line word for word.

2) The sourcing problem is real. c5's source_url and source_title point to the Wikipedia article on Galileo's Dialogue. c5's own note concedes that the argument comes from Almagest I.7 and that "an astronomer may prefer to cite it directly". That is an admission that the cited page is not the source. Every search excerpt of the article describes its four-day structure and the ship, not Ptolemy's clouds-and-birds argument. Under the series rule that the cited source must say what the line says, c5 fails as it stands. The finding reads the script correctly. It also notes that Ptolemy's clouds argument targets Earth's spin, which matches the Second Day framing behind c6/c13, so the line still fits the episode.

3) The proposed fix is sound:
- G. J. Toomer's translation of the Almagest was reissued by Princeton University Press in 1998 (first published 1984). Citing I.7 there is correct.
- Sir George Cornewall Lewis, An Historical Survey of the Astronomy of the Ancients (London, 1862), is a real, freely scanned book whose quoted passage matches the line almost word for word.
- Moving the Dialogue article to c6 only is right.

Two small points when applying it, neither a reason to change the fix:
- Because Toomer is not open access, put a public scan of Lewis 1862 in source_url, so the person checking links before posting can see "clouds, and birds in their flight ... would not accompany the earth in its rotation".
- Reword c5's claim field so it notes that the clouds-and-birds point is aimed at Earth's spin, while the left-behind point is aimed at Earth moving through space. The spoken line can stay as is.

</details>

# Light Minute ep01: script audit (26 Oct 2026)

## Verdict

The episode is clean on facts and math. Two small fixes are left, and neither changes a spoken line, so nothing needs re-voicing. Page fetches fail in this sandbox (DNS fails or the proxy returns 403), so every source was checked through search excerpts.

Sources: every source says what its claim says. Smithsonian: 150 million km and about 8 min 20 s (c1, c11). NASA Voyager light-day page: about 8 min 20 s over 93 million miles (c3). NASA Space Place: about 8.3 min, and objects seen as they were (c4, c10). NSSDC: 29.78 km/s, with a range of 29.29 to 30.29 (c2). LIGO, Fermi and INTEGRAL: 17 Aug 2017, a delay of +1.74 ± 0.05 s, 40 Mpc, and a speed bound of −3×10⁻¹⁵ to +7×10⁻¹⁶ (c5, c6, c9, c13). MPE: 8,275 ± 9 ± 33 pc (c12). Wikipedia: the last glacial period ran about 115,000 to 11,700 years ago (c14). The old NASA Glenn Newton's first law page (c8) is still indexed with its content.

Recomputed numbers:
- **Light time:** 1 AU / c = 499.0 s, which is 8 min 19 s, so the ring and clock reading 8 min 20 s is fine. It ranges from 490.7 s at perihelion to 507.4 s at aphelion, so "for over eight minutes" holds all year.
- **Earth's move:** 29.78 km/s × 500 s = 14,890 km (14,860 km at 499 s), so the label "14,900 km in 8 min 20 s" is right. That is 14,890 / 12,742 = 1.17, so "1.2 Earth widths" is right. It is 500 s / 365.256 days × 360° = 0.0057°, so "0.006° of its orbit" is right.
- **Distance to the merger:** 40 Mpc × 3.2616 = 130.5 million light-years.
- **Speed difference:** 1.7 s / (130 million years × 3.156×10⁷ s per year) = 4×10⁻¹⁶, consistent with the published bound.
- **Galactic centre:** 8,275 pc × 3.2616 = 26,990 light-years, with a range of 26,880 to 27,100, so the "27,000 years" ring holds. 27,000 years ago falls inside the last glacial period, so "light from the last Ice Age" holds.

Specialist points: the vanishing Sun is impossible (mass can't vanish), and the thought-experiment badge covers that. The straight-line exit ignores the other planets, also covered by that badge. The line keeps "arrived", as the cross-check asked.

Story: the seven beats are there and work.
- **Hook:** a 6-syllable question that lint estimates is spoken by about 1.61 s.
- **Change:** the picture breaks an expectation (the Sun goes out and nothing happens).
- **Why:** gravity's speed, with the dated 2017 detection.
- **Whoa:** Earth circles an empty point, then leaves. It is bigger than the change.
- **Takeaway:** a reframe the viewer can repeat.
- **Readout and tease:** the closing readout (placed after the takeaway, as DECISIONS.md decided), then a real question for next time.

No line from the "Never write" list, no exclamation marks and no hype. lint.py reports 0 errors and 1 warning (there is no pron.json yet). Pace is at most 2.93 words a second, so any later edit to the why or whoa beats should not add words.

Outside this episode: bible.md §5 still labels B9's "You are here" at 26,000 ly. Episode 1 doesn't build B9, but the bible should be updated to the channel's 27,000 before episode 5.

Files: /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit-ep01/space/ep01/script.md and /tmp/claude-0/-home-user-Claude/b65d3a2f-52c6-526e-b15b-5f369330bc42/scratchpad/audit-ep01/space/ep01/claims.json.

## Confirmed findings (1) — fix before the final render

### F1 · unsourced

**Line:** `Down here, nothing changes. {-}`

**Problem.** The {-} tag means a sentence claims nothing outside the film. This sentence claims something outside it: it is the episode's central physical prediction, that nothing on Earth changes at first, neither the light (c4) nor the orbit (c7). WRITING.md rule 9 says every factual sentence goes in claims.json. lint.py lists it among the four no-claim sentences, so the post's source list would carry no source for it.

**Evidence.** lint.py run on the audit copy prints '{-} Down here, nothing changes.' among the no-claim sentences. The facts behind it are already in the ledger: c4 (NASA Space Place, from a search excerpt: 'we always see the Sun as it was about 8.3 minutes ago') and c7 (an inference from c3 and c5: Earth keeps orbiting until the change arrives about 499 s later).

**Fix.**

Down here, nothing changes. {c15}   plus a new claims.json entry: {"id":"c15","sentence":"Down here, nothing changes.","claim":"If the Sun vanished, changes in its gravity, like its light, would travel at light speed, so Earth's sky and orbit stay as they were for about 8 min 20 s.","source_url":"https://bigthink.com/starts-with-a-bang/this-is-why-the-speed-of-gravity-must-equal-the-speed-of-light/","source_title":"This is why the speed of gravity must equal the speed of light (Big Think, Starts With A Bang)","accessed":"2026-10-26","verified_via":"search excerpt","status":"ok","note":"Excerpt: the gravity delay is 'exactly the same amount of time as it was for light: 8 minutes and 20 seconds'. Also C. Baird (WTAMU), 'What is the speed of gravity?'. A thought experiment, badged on screen."}   (tested on a copy: lint.py passes with 0 errors; c4 and c7 stay tied to their own sentences)

<details><summary>Verifier's check</summary>

The finding stands, but its proposed fix does not work. The sentence comes straight after "Now switch it off." and predicts what physics does in the thought experiment: for about 8 min 20 s nothing on Earth changes. That covers the sky (light travel time) and the orbit (gravity changes travel at c). That is a factual claim about the world, not a stage direction like the other three {-} sentences ("Rewind.", "Now switch it off.", "Next: leave for the nearest star today."). It also says more than the next sentence, which covers only the sky: the orbit half is sourced only later, by c5 and c7. So WRITING.md rule 9 ("every factual sentence goes in claims.json") applies, and the {-} tag hides the sentence from lint's looks-factual check. I reran lint.py on the audit copy and it lists the sentence among the 4 no-claim sentences, as reported. The physics holds up in search excerpts. Big Think (Starts With A Bang) says the gravity delay is "exactly the same amount of time as it was for light: 8 minutes and 20 seconds". C. Baird's WTAMU explainer says the sky goes dark and Earth leaves its orbit at the same moment. NASA Space Place gives the Sun's light as about 8.3 minutes old. One overstatement in the finding: the post's source list would not lose anything in practice. It is a de-duplicated list of URLs and already carries Space Place and LIGO through c4, c5 and c7. The real problem is the ledger rule, not a missing link. The fix {c4,c7} breaks the lint. I applied it to a copy and lint.py exits 1 with 2 errors: "claim c4: its sentence differs from the script" and the same for c7. Each ledger entry's sentence field has to match its script sentence exactly, and c4 and c7 already belong to other sentences. It also adds 2 warnings, "cited by 2 sentences; a claim ties to one sentence". The working fix is a new ledger entry for this sentence. I tested it on a copy: 0 errors, 15 claims cited, 15 in the ledger, no re-voicing needed.

</details>

## Story and wording notes (1) — apply when cheap

### F2 · wording

**Line:** `end card: "Next: the nearest star" · "Light Minute · No. 002"`

**Problem.** The script header says every cross-check fix is applied, but this end card skips one. The cross-check gave space its own tease wording, 'Next light:', and episodes 2, 3 and 4 already use it on their end cards. Episode 1 still shows the generic 'Next:' that all three channels share. The card also lacks the grounding true-fact footnote that WRITING.md picture rule 6 asks for ('The end card carries one true-fact footnote that grounds the premise').

**Fix.** end card: "Next light: the nearest star" · "Light Minute · No. 002" · footnote: "2017: gravity and light from 130 million light-years arrived 1.7 s apart" {c6}

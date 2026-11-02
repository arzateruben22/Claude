# What a person must check before this posts

Back of the Envelope No. 002, "Everyone, one place": `out/envelope-002-9x16.mp4` (74.4 s, QA PASS; `scorecard.md`).

1. **Claims.** A demographer or physicist works through `CLAIMS-REVIEW.md`. All 9 claims were checked from a search
   excerpt only, so a person opens each source (UN World Population Prospects 2024, ScienceAlert on crowd density,
   Britannica on Greater London, Nations Online on Earth's land, Walpole et al. 2012, Biology Insights on body
   density) and ticks each row. The episode does not post until every row is ticked. While there:
   - The 828 m tower height (Burj Khalifa, Guinness World Records) is cited only in claim c7's note; it has no source
     link of its own. Add one, or confirm the note is enough.
   - Body density (c8) rests on popular-science pages (0.97–1.06 g/cm³); the ledger asks for a physiology text.
   - The spine's "≈ 2,100 km²" at 4 per m² (`calc.py`: 2,050, rounded half up) has no claim row; it follows from c1
     and c4.
2. **End-card wording.** The card says "Next envelope: *all the ants*" over "≈ 2.6 Londons", with the footnote "UN
   World Population Prospects 2024: about 8.2 billion people in mid-2024." and the chip "Back of the Envelope · No.
   003". The voice says "Next envelope: who weighs more, all the ants or us?". The script's end-card line has "No.
   002"; the chip names the next episode on purpose, as in No. 001. Confirm both, and that the footnote reads on a
   phone.
3. **A model, not a crowd.** What is shown and assumed:
   - 2 people per m², a calm crowd (badged "∵ 2 people per m² (a calm crowd)"). Twice as close, 4 per m², is shown
     as unsafe with chalk hatching; no crush is shown.
   - Every body at 62 kg, the world's average adult mass (badged "62 kg adult average"). Children weigh less, so the
     0.5 km³ and the 800 m cube are upper bounds.
   - Bodies as dense as water (badged "∵ as dense as water"); the work card shows the 0.97 and 1.06 g/cm³ bounds
     (806 m and 783 m).
   - The tower is a generic stepped spire at its true 828 m, drawn 2.2× wider than true so it reads on a phone
     (badged "true sizes · tower drawn wider"). It is not named and is not a likeness of the Burj Khalifa. The
     tip clears the cube by 8–17 px at 1080 (8–9 px at 58.5–60.0 s); the chalk 828 m rule carries the comparison.
   - Greater London is drawn as a square of its 1,572 km², not its outline. The drive across the square uses an
     assumed 100 km/h (pill "64 km · about 38 min at 100 km/h").
   - The takeaway ("the world isn't full") is about standing room only (c9). Check it does not read as a claim about
     food, housing or resources.
4. **The channel.** Back of the Envelope is the owner's name (27 Oct). The handle and trademark checks are not done:
   handle TODO on TikTok, YouTube and Instagram; a USPTO/EUIPO search (only the open web has been searched).
5. **AI labelling.** The narrator is synthetic (Kokoro, voice am_puck). Turn on TikTok's AI-generated label and put
   "Voice: synthetic" in the post text; the same on Reels and Shorts where they ask.
6. **Sources in the post.** `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep02 --sources` prints the
   six sources with links (run 2 Nov: works) for the caption or a pinned comment.
7. **A listen.** Phone speaker and headphones: the voice over the score (13.9 LU apart), the sound on each spine
   term and label. Words to check: "eight billion", "half a square meter", "Londons", "tallest tower", "dangerous";
   the pause after the hook's question.
8. **Cover frame.** The poster (`out/envelope-002-9x16.jpg`) is the boxed "2.6 Londons" over the Greater London
   square at 41.43 s. TikTok lets you pick another in the app; the cube beside the tower (about 54–56 s) and frame 0
   (the figure in its half square metre under the title) are the other candidates.
9. **Upload.** Upload the 1080×1920 MP4 to TikTok and Instagram from the web or TikTok Studio, not through an app
   that re-compresses it; use `out/envelope-002-9x16-youtube.mp4` (1440×2560) for YouTube. Leave auto-captions off:
   captions are burned in.

Nothing has been posted.

TODO placeholders: the channel handle, the posting accounts, a pinned sources page, a source link for the 828 m
tower height, a disclaimer line if wanted ("standing room only: not a claim about resources"), the reviewer's name
and sign-off date.

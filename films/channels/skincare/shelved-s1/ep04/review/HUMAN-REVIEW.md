# What a person must check before this posts

1. **Claims: a board-certified dermatologist.** Every claim was checked from a search excerpt only. The dermatologist
   works through `CLAIMS-REVIEW.md`, opens each link and ticks it; the episode does not post until every row is ticked.
   Points to look at hardest:
   - "A tan adds up to about SPF three or four" (c12): Harvard Health's figure; other sources say "4 at most". The
     film compares the tan to an SPF number and recommends nothing; the dermatologist decides whether the line could
     read as advice.
   - "In under a trillionth of a second, one can fuse two letters of their DNA" (c4): measured in lab DNA strands
     (Schreier et al. 2007, "within about 1 ps"); badged "measured in lab DNA".
   - "A dozen stacked would be as thick as a sheet of paper" (c13–c14): a keratinocyte nucleus ≈ 8.6 µm is a
     model-fitted estimate (Gareau 2011); the cap's width is taken as the nucleus's.
   - c6/c10/c11 cite sources whose exact titles weren't seen in the excerpts (PMC2593890; the NOVA Lisbon summary);
     confirm the titles when opening the links.
2. **Health-information rules.** TikTok and YouTube medical-misinformation policies: the film says what a tan is and
   never tells anyone what to do; no product, brand or ingredient is shown or named.
3. **Skin tone.** One melanin level (medium) for the whole episode: the channel's one-tone-per-episode rule
   (bible §1), approved by the owner on 2 Nov. Check that nothing reads as a statement about any tone.
4. **AI labelling.** The narrator is synthetic (Kokoro bf_isabella): turn on TikTok's AI-generated label and put
   "Narration: synthetic voice (AI)" in each post; the same on Reels and Shorts.
5. **A listen.** Phone speaker and headphones. Words to check: ultraviolet, melanin, nucleus, parasol, "SPF three
   or four" (its timing was placed by hand, `fixwords.py`).
6. **Photosensitivity.** The UV dashes are thin and steady; transitions are dips and an iris, never flashes. qa.py's
   flash count is in `scorecard.md`; run a broadcast analyzer before any TV use.
7. **Sources in the post.** `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep04 --sources`.

TODO placeholders: the channel handle, the posting accounts, a pinned sources page.

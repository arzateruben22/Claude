# Outer Layer season 1 (reboot): facts pass 2

The owner's direction (2 Nov): "make the facts slightly more compelling and interesting … more of a million-dollar studio production, for a science business revolving around skin care."

A new studio-grade look is being built separately, so this pass is the **script and facts only**.

## Inputs, for each episode `films/channels/skincare/epNN/`

- `script.md` (the current lint-clean script)
- `claims.json` (the sourced ledger)
- `research.md`, where it exists (or `s1v2/<topic>/research.md`)

## Deliver: the script and the ledger, rewritten

1. **Three ranked "I didn't know that" beats:**
   - the strongest becomes the **hook** (spoken by 2 s, a question or claim about the picture);
   - the second becomes the **whoa** (the midpoint escalation);
   - the third becomes the **closing twist** (the takeaway's reframe, which still calls back to the hook).

   New facts are welcome if they are sharper. Every fact must be sourced:
   - prefer dermatology bodies, NIH and peer-reviewed sources;
   - verify every number;
   - hedge as the source does;
   - record `verified_via` honestly. Page fetches may be blocked, so say "search excerpt" when that's how you checked.
2. **One counter-intuitive turn** that flips what a viewer assumes. Example: tanning beds share a list with cigarettes, but that list ranks how sure the evidence is, not how harmful.
3. **A human-scale comparison for every number.** The voice says the meaning ("thinner than a hair", "a pinch of salt shared by a stadium"); the exact figure goes on screen. About four numbers spoken at most.
4. **Fewer on-screen labels:** at most two at a time, and captions carry the words. Note in the beat headers which labels stay.
5. **Rules that stay:**
   - Flow: one thread, no restarts, the voice carries the meaning, callbacks;
   - 66–75 s, 150–180 words;
   - the beats are hook, normal, change, why, whoa, toscale (the "to scale" segment, woven in), takeaway, tease. The **tease line stays word for word**, because it is the season's chain (`s1v2/SEASON.md`);
   - the "model, not a photo" labels;
   - no recommendations and no brands;
   - a dermatologist's sign-off, noted in the script header.
6. **Ledger:** update `claims.json` so every `{cN}` matches its sentence exactly (lint checks this). Remove claims you no longer cite.
7. **Lint:** `python3 -I kits/cinema/script/lint.py films/channels/skincare/epNN --segment toscale` must give 0 errors and 0 warnings.
   - Lint estimates pace from word counts.
   - Re-voicing happens afterwards, so keep every beat's pace near 2.6 words/s.
8. **Shot descriptions:** leave each beat header's shot description short and look-agnostic ("the reveal on X"). The picture is being redesigned.
9. **Don't touch:** `voice.py`, `vo/`, compile, scene, set files. Don't commit.

## Report (one block per episode)

- the three beats, ranked, each with its source;
- the counter-intuitive turn;
- the new hook line;
- the whoa line;
- the closing twist line;
- the final lint output.

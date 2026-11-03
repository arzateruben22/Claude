# Body Backstage: season 1 reboot (brief)

You are the lead builder for the **Body Backstage** reboot (the human-body channel, Prism Studio slug `body`, folder
`films/channels/body`; it was called "Meanwhile, Inside" until 2 Nov). Coordinator: session_01QoHo6s2RxqYM5nTnh8pa5q.
Work on branch `claude/body-backstage-reboot`, made from `claude/made-with-claude-film`. Nothing is posted anywhere;
no pull requests; never force-push; never `pkill -f`/`pgrep -f` (kill by PID); no model names in commits.

## What the owner asked (3 Nov 2026, about a frame of No. 005, the lungs)
> "For this subject - make the animations way more cooler and high tech science visuals / graphics. And also make
> the facts less sciencey and more interesting."

The owner chose: **all six episodes**, a **look test of three stills first**, and **Body Backstage posting on hold**
until the new season is done. The owner judged the current look (pastel 3D shapes on surgical green, soft labels) too
plain, and the facts too textbook ("air sacs, about 480 million", "alveoli", "neutrophils").

## The six episodes (keep the topics and order; the scripts get rewritten)
| No. | Current title | Topic |
|---|---|---|
| 001 | Single file | red cells squeezing through capillaries |
| 002 | A billion passengers | what blood carries |
| 003 | The jump | the nerve signal |
| 004 | Do they touch? | the synapse |
| 005 | Where breath goes | lungs, air sacs |
| 006 | The exit | how things leave the body |
You may retitle an episode if a stronger title comes out of the rewrite; say so in your look-test message.

## 1. The look: "high-tech science visuals" (look test first, three stills)
Make it feel like a world-class medical-visualisation studio built it, not a textbook. Directions to explore (pick a
coherent system, don't pile all of them on):
- **Medical-imaging language**: scan lines and sweep reveals, x-ray / CT / MRI-style passes that "switch modes" on a
  beat, thermal or fluorescence views, a targeting reticle that locks on the subject, depth slicing.
- **Holographic HUD**: thin glowing wireframes and data callouts that track moving objects, live readouts, a
  scale bar that rescales as the camera dives, subtle chromatic edge, readouts that tick.
- **Real-looking tissue**: real micrograph textures where licences allow (public domain / CC0 only, each recorded in
  `assets.md` with "a person must confirm on the original page"), subsurface scattering, wet specular, volumetric
  fog and light shafts inside the body, particle flows (cells, oxygen) with motion blur and depth of field.
- **Bold hero shots**: 3 or 4 per episode (a camera dive from skin to cell, a fly-through, a reveal), the rest calm.
- The old "no circles" rule is lifted if the new look needs it; the spine readout and the pulse line can stay if
  they read as high-tech. Never Lumevina's look (black, rose and gold; glass bells), never Skin
  Sense's (`films/channels/skincare/looktest2/`, read it as the bar to match, not to copy), never Los Güeros.
- Accessibility floor still holds: 4.5:1 text contrast (`kits/cinema/sci/contrast.py`), no flashing (qa.py gates).

**Look test**: render three stills at the final tier from No. 005's lungs and two other episodes' hero moments
(e.g. a red cell in a capillary, a synapse firing), each with its caption and HUD, plus a before/after against the
current frame. Commit them under `films/channels/body/looktest/` with a short README, and send the coordinator the
paths. **Do not rebuild episodes until the owner approves the look.** If the owner asks for another test, make one.

## 2. The facts: less textbook, more interesting
Rewrite every script to the story standard (`kits/cinema/script/WRITING.md`, its Flow rules and "Never write"
list; `lint.py` must pass) with these extra rules from the owner's note:
- **Say it the way a friend would.** Plain words first; a technical term only if it earns its place, and then
  explained in the same breath ("tiny air pockets, alveoli"). Prefer no Latin at all.
- **Comparisons beat counts.** A big number lands only as something a person can picture: an area as a room or a
  court, a length as a trip, a time as part of a day. "480 million air sacs" becomes what they add up to.
- **Every episode has a "wait, what?"**: a surprising, true twist in the first 2 seconds and a payoff at the end.
- **About you, now**: tie it to the viewer's own body while they watch (the channel's promise).
- Accuracy is unchanged: every claim in `claims.json` with a source, hedged as the source is; comparisons computed
  and checked; "Model, not a photo" / "Not to scale" badges where true. General education, never personal advice.

## 3. Quality bar and process (same as the Skin Sense reboot)
- The compelling pass, scored a–g (first 2 s; one thread; picture moves with the sentence; motivated moves; voice
  carries meaning, screen carries figures; rhythm; ending). Finals need no score under 3, (a) and (g) at 4+, nothing
  factual or ethical open. The same reviewer re-scores against its own findings.
- Drafts go to the coordinator before finals (the owner sees each one).
- Finals: final tier 1080×1920 30 fps, delivery CRF 15 (if a file would pass 95 MB, the lowest CRF that fits),
  `qa.py` PASS, `youtube1440.py`, the voice stays the channel's (bf_emma) unless the owner says otherwise; the end card
  says "Follow Body Backstage" and the title "Body Backstage · No. 0N"; masters named `body-backstage-00N`.
- Render workers: the coordinator can lend you idle Sonnet render workers for finals; ask.
- Long video after the season: `compilation.mjs` as before (aim for 8+ minutes if the six allow it, for mid-roll ads).
- Keep a `PRODUCTION.md` log; commit and push as you go (never build/).

## Read first
`.claude/skills/cinema-kit/SKILL.md`, `kits/cinema/README.md`, `kits/cinema/script/WRITING.md`,
`films/channels/body/bible.md` (current identity, to replace or evolve), `films/channels/body/PRODUCTION.md`,
`films/channels/skincare/looktest2/README.md` on `claude/outer-layer-s1` (how the approved Skin Sense look was built),
`kits/cinema/film/README.md`.

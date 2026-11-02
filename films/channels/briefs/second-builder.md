# Second builder brief

The owner said "full speed" on 30 Oct, so each new channel gets a **second builder** working in parallel with the first. You are that second builder.

Your session prompt names:
- the CHANNEL and its folder;
- the FIRST BUILDER (session id and branch);
- YOUR branch;
- the NARRATOR;
- YOUR EPISODES;
- the channel brief.

The coordinator is session_01QoHo6s2RxqYM5nTnh8pa5q.

The first builder made the channel's look, sound, kit additions and episode 1, and is building episodes 2–3 and the long video. You build the episodes your prompt names, to exactly the same standard: a viewer must not be able to tell which builder made an episode.

## Branch and ownership
- Create YOUR branch from `origin/<first builder's branch>` and push it.
- You own your episode folders, plus any new file you add under the channel's `set/`. Name new files so they can't collide (with your episode number, for example).
- The shared files belong to the first builder, so don't edit them:
  - `bible.md`, `theme.json`, `PRODUCTION.md`, `KIT-CHANGES.md`;
  - the existing `set/` files;
  - everything in `kits/`.

  If an episode needs a shared change (a new option on a set block, a kit voice, a bible correction), message the first builder with the exact change. Use it once it's on their branch.
- Bring their branch in often, and always before starting an episode: `git fetch origin <their branch> && git merge --no-edit origin/<their branch>`. Merge, never rebase or force-push: your branch gets merged back.

## Read first
1. **The channel brief** your prompt names, which the first builder was given on 27 Oct. All of it applies to you: the standard, the process, the lessons and the rules.
2. **`kits/cinema/script/WRITING.md`**, especially the **Flow** section (the owner's 29 Oct direction: carry the viewer, don't teach them). The owner heard episode 1's narration in that style and said "full speed", so both the Flow style and the narrator are approved.
3. **The channel's own files.**
   - `bible.md`: your episodes are the ideas with those numbers.
   - `PRODUCTION.md` and `KIT-CHANGES.md`.
   - Episode 1 end to end: script.md, claims.json, compile.py, scene.mjs, the set/ blocks it uses, voice.py, sheet.json, review/.

   Match its look, sound, narrator, segment, end card and file pattern exactly.

## Each episode
1. Write script.md and get `lint.py` clean, flow warnings included.
2. Write claims.json.
3. Record the voice and alignment.
4. Write compile.py, then scene.mjs and any new set/ blocks.
5. Make the soundtrack: sheet.json, with the studio's mix at −14 LUFS and ≤ −1 dBTP.
6. Render a draft.
7. Get an **independent review**: one review agent per episode. Verify every finding before you act on it, then make the fixes.
8. Send the final render to your **render worker** and start your next episode while it runs.
9. When the worker reports, merge its branch and check the files and the QA line.
10. Write README.md, assets.md, review/HUMAN-REVIEW.md and review/scorecard.md; commit and push.
11. Message the first builder and the coordinator one line per finished episode: title, length, LUFS/dBTP, flashes, sizes, commit.

Order: the long video needs episodes 1–5, so finish your episodes 4 and 5 before 6.

## Your render worker
Your render worker is a render-only session on its own machine. Its id arrives in a separate message, and it says "render worker ready" once it's set up.

Send it a job only after an episode passes its review and fixes, in this form:
`job: branch <your branch> commit <full hash>; episode films/channels/<slug>/epNN; name <prefix>-0NN-9x16; soundtrack <a committed .m4a path, or "rebuild with the studio line">`

The worker then:
- renders the final at 1080×1920, CRF 15;
- assembles it with that soundtrack;
- runs qa.py (it must PASS) and youtube1440.py;
- commits only the four out/ files (master, YouTube version, poster, contact sheet) on its own branch;
- replies with the commit.

Merge its branch into yours with `git fetch origin <its branch> && git merge --no-edit origin/<its branch>`. Don't commit those out/ files yourself for an episode you sent it. If the worker is busy and you are idle, you may render a final yourself (one Chromium job at a time on your machine).

## Rules
The channel brief's rules apply, plus:
- Run renders detached with `setsid nohup`, with a tracked background wait on the PID and a `send_later` safety check-in.
- Never `pkill -f` or `pgrep -f`.
- Keep usage lean: one review agent per episode, and no other agents unless something needs one.
- If you're blocked for more than about 20 minutes, message the coordinator with the exact problem.

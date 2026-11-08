# Skin Sense No. 004 sample: "The Message Behind a Frown" (new art direction, 21.5 s)

Preview: `review/skin-sense-004-sample-preview.mp4` (540×960 draft, plain 2D render, voice only) and `review/contact-sheet.jpg`.
Built to `ART-DIRECTION.md` on branch `claude/skin-sense-art-direction` (not copied here: a git fetch of that branch timed out; its text was read through the GitHub tool) and `../reference/ep04-frown-reference.webp`.
Supersedes the 3D draft in `../ep04/` (kept, not deleted). Lethality hook dropped (owner ruling).

Beats: hook question · nerve ending, acetylcholine, muscle fibre (signal and response) · toxin cuts one protein (SNAP-25), message never sent · takeaway.
Build: `python3 -I build.py` (film.json + mix.m4a), then `node kits/cinema/film/render.mjs --film films/channels/skincare/ep04s --tier draft --plain [--assemble --audio films/channels/skincare/ep04s/mix.m4a]`.

**Art slot:** `art.json` names the image and the label anchors (0–1 of the image). Clean text-free art: replace `art/placeholder.png`, set `placeholder` false, adjust anchors. Labels, leader lines, the cut mark and the push-in follow.
**Placeholder:** a crop of the reference (its baked-in pills double up with the drawn ones; marked "Placeholder art" on screen).

## Claims (script tags → `../ep04/claims.json`): c1, c2, c3, c14 (mechanism), c4 (skin is not the target). All OPEN until a person opens each source; treatment topic needs a board-certified dermatologist sign-off.

## TODO / known gaps
- Word timings for captions are **estimated** (character-weighted): the Parakeet model failed its SHA256 check in this session. Re-run `align.py` and `build.py`.
- Voice only, no score or sound effects yet. Loudness set by ffmpeg loudnorm (-14 LUFS), not the studio mixer or qa.py.
- Footers sit at y 1776–1860, inside the bottom platform UI zone (as specified); confirm.
- "SNAP-25 · cut" pin is placed by eye on the placeholder; not an anatomical authority.
- The cut mark (ring and slash) is a simple code overlay; wants real art for the cut.
- Sample not final-tier rendered; draft only.

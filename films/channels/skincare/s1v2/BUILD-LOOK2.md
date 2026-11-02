# Building 004–006 in the approved look (look test 2)

The owner approved look test 2 on 2 Nov ("Yes much better"). Rebuild the episode's picture in that look, on its facts-pass-2 script.

## Read first

- **`films/channels/skincare/looktest2/scene.mjs`** and its frames in `looktest2/review/` (look at `before-after.jpg` and the stills). This is the standard.
- **`films/channels/skincare/set/studio.js`**:
  - `createStudio(renderer, scene)`, then `studio.aim(...)` and `studio.set({ key, rim, fill, env, warm })`;
  - `skinMaterial`, `cellMaterial`, `nucleusMaterial`, `strandMaterial` and `fluidMaterial`;
  - `createShaft`, `createGrain(hud)` and `colourScript`.
- **`set/ref/textures.js`**: SECTION, DERMIS and CELL as data URIs. Load them in a promise and set `window.SCENE_READY`. Sources are in `set/ref/SOURCES.md`; list them in the episode's `assets.md` with "a person confirms each licence on the original page".
- **`set/terrain.js`**: the macro relief. Also read `set/section.js`.
- **The episode's current files:** `script.md`, `claims.json`, `compile.py`, `scene.mjs` and `review/storyboard.md`.
  - The old compile and scene hold working plumbing you can reuse: the voice timeline (`Film`), captions, title and end card through `hud`, the `motif.js` title and end bars, the gauge for to-scale, and the cue sheet.
  - Their pictures and overlays belong to the old look and are retired.
- **`kits/cinema/script/WRITING.md`** (Flow, "The picture") and **`films/channels/skincare/bible.md`** (honesty rules, one skin tone per episode).

## Rules from the test (the coordinator's and the first builder's)

**Shots and labels**
- 3–4 bold hero shots per episode. Each has one subject filling the frame and one slow move.
- Add atmosphere: particles and dust in a light shaft, haze cards, shallow depth of field, and a rack focus where it helps.
- At most **two** small labels on screen at once. Captions carry the words; honesty notes are small and in a corner.

**Honesty**
- Keep the honesty labels: "model, not a photo", "micrograph · stained skin", "illustration", "mouse study" and the rest, as the claims need.
- One skin tone per episode: 004 light, 005 medium, 006 deep. Never pair tones with a risk line.

**The UV switch**
- It's the signature cut: a cyan scan line sweeping down the frame (DOM), as in looktest2. Put it on the key fact.

**Render cost**
- `CINEMA.kMax` is 3. Use no transmission on skin or hairs: each transmissive material costs a second scene pass per motion-blur sample.
- Build heavy geometry once, never per frame. Aim for about 5.5 s/frame at final.

**Camera and code**
- Keep the camera above the skin's surface in section shots.
- Never put a `//` comment in the middle of a line of code. It silently drops whatever follows.
- Every timed moment hangs on a spoken word or a beat (`f.at("voNN:word")`). Shot cuts land on words.
- Keep the title, the end card (tease, follow chip naming the NEXT episode, footnote ending "Narration: synthetic voice (AI)"), the captions and the to-scale gauge.

## Working method

1. **Storyboard.** Rewrite `review/storyboard.md`: one line per sentence, giving the new image and how the camera gets there, grouped into the 3–4 hero shots.
2. **Build.** Rewrite `compile.py` and `scene.mjs`, run `python3 -I films/channels/skincare/epNN/compile.py`, and lint the script: `python3 -I kits/cinema/script/lint.py films/channels/skincare/epNN --segment toscale` must give 0 errors and 0 warnings.
3. **Stills.** **Every Chromium job takes the shared lock**, because other builders are rendering too:
   ```
   export PLAYWRIGHT_DIR=/opt/node22/lib CHROMIUM=/opt/pw-browsers/chromium
   rm -rf films/channels/skincare/epNN/build/draft
   flock /tmp/chromium.lock node kits/cinema/film/render.mjs --film films/channels/skincare/epNN --tier draft --times 1,5,…
   ```
   PNGs land in `build/draft/9x16/frames/*/`. Look at them with the Read tool and iterate until each hero shot looks like looktest2's stills. The render's "!" lines report safe-box and overlap problems; fix them.
4. **Draft.** Run `bash films/channels/skincare/s1v2/draft.sh NN` (it takes the lock itself). It ends with "DRAFTNN DONE", writes `review/outerlayer-0NN-9x16-draft-preview.mp4` and `review/draft-contact-sheet.jpg`, and prints the sync and mix checks. **Sync must PASS.**
   - A label whose sound lands within about 0.6 s of another sound (a shutter, a signature) can fail sync; move it.
5. **Records.** Update `README.md`, `assets.md` (the reference textures and their sources) and `review/scorecard.md` (a new section, "Look 2 rebuild").
6. **Don't commit.** The builder commits.

## Report

- the hero shots, one line each;
- three stills (paths);
- the draft's sync and mix lines;
- anything left open.

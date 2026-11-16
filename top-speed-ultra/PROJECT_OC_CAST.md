# Project OC: the cast (six playable characters)

The owner asked (2026-11-11) for six characters to choose from, three men and three women, built from reference
sheets they generated; that the chosen character be the driver everywhere; that the six be the only looks for the
venues' people; a future two-character pack prepared but not sold; and (5:45 PM) that the wheel, the characters and
the first-person view with the arms look as good as possible and run smoothly. This file is the catalog, the asset
status, what lane "cast A" changed and how it was checked. The progress log has the dated entry.

## Graphics pass log: done / in progress / next

(One lane: the two pack characters first, then the graphics pass on the six. Nothing here is committed: HEAD is
`440e96e`, and everything after it is in the working tree for the judges. An Opus continuation starts from "Next".)

**Done (stage 1, the Chad package, 2026-11-12):**
- Chad and Chadaline are in the cast catalog (`cast.ts` `CAST_PACK.identities`, unlock `pack`), with portraits.
- The builder has what they need, additive only: `curlsMedium` and `longWaves` hair, lighter hair tips, fuller brows,
  light stubble, a jaw-softening face value, a double-breasted jacket with peak lapels and a padded shoulder, a
  collared shirt with its top buttons undone, straight suit trousers, lace-up shoes, a bodycon strap dress, a fur
  shrug, pointed stilettos with plain black soles, small hoops, rings, a right-wrist watch, a pocket square, buttons.
- The picker shows the pack locked ("Chad & Chadaline pack: coming soon, $22.22, 18+"), with a labelled TEST switch
  in test-mode builds. The lock is one rule in `src/game/castPack.ts`.
- They are the driver (a jacket sleeve over a white cuff; a fur sleeve from mid forearm with the gold watch) and the
  on-foot avatar in both venues, and never in the crowd.
- The store entry is 2222 cents, 18+, `available: false`.
- Regression groups `cast-pack`, `cast-pack-seat`, `cast-pack-seat-phone` and `cast-pack-venues`.

**Opus continuation (2026-11-12, from 08:50 UTC; the Fable builder stopped at the owner's 92 % rule):**
- **Stage 1, repaired:**
  - The pack check "the TEST switch unlocks both ..." failed. The cause was the test, not the game: Chromium lost the
    localStorage write (the save and the `tsu.test.keep` flag) when the page reloaded straight after it. The suite now
    waits 3 s before such a reload (`settleStorage` in `tests/regression.mjs`).
  - The looks were tuned:
    - Chad: a smaller shoulder pad, a 9.5 mm jacket shell, 7.5 heads, muscle 0.55, shoulders 0.6.
    - Chadaline: the hair curtain comes forward past the ears, with wider cards.
    - The shrug's rolls are blended into one fluffy sleeve.
  - The `__SHORT__` placeholder below is filled in.
  - `cast-pack`, `cast-pack-seat` and `cast-pack-seat-phone`: 14 of 14 pass.
- **Stage 2, done:**
  - The full-beard box. The six's `fullBeard` was a solid 4 mm shell: the hard dark box at yaw 45 degrees and more.
    Mateo and Marcus now use the face work's strand-card `beard`. The beard mask's cheek line now fades over 14 mm (it
    was 8 mm), and its back edge over 10 mm (it was 5 mm), full only a centimetre ahead of the ear (`masks.ts`
    `beardAt`).
  - The grey speckle:
    - The cards' per-strand grey turns into its mean share where a strand is under a pixel (`cards.ts`).
    - The hair cap's grey is now fine strands with a soft threshold, the mean at a distance (`hair.ts`). It was a
      hard step on 3 mm noise: a zebra up close and a speckle at game distance.
  - Before: `tests/out/cast/stage2-before.png`. After: `stage2-after.png` and `game45-zoom-before-after.png`. The
    preset `casual` (beard, black hair) is the regression head, with and without grey 0.5.
- **Stage 3, partly done:**
  - Done:
    - Marcus's scar on his RIGHT eyebrow: `Look.scar 'browR'` draws a skin line, and the right brow is parted where it
      crosses (`skin.ts`, `face.ts`, `person.ts` through the unused `uFaceP.w`).
    - Straight and relaxed trouser legs: `Garment.leg`, the pack's tube, for Danny, Leila, Jas (straight) and Mateo,
      Kate (relaxed). Kate's cargo pockets sit out on the fuller leg.
    - Marcus's beard is now greyer (grey 0.3).
  - Not done: see "Next".
- **Stage 5, done (2026-11-12):**
  - The alternating perf pairs ran against a clean `5cf7212` build. Phone passes. Desktop failed p95 because of
    Chadaline's fur sleeve at full lock; that is fixed at the source, and one run after the fix is inside the base's
    spread.
  - The base's `phone` group: 18/18, sky camera included. Ours: 18/18.
  - Every group passes: `boot`, `phone`, `venues`, `cast`, `cast-seat`, `cast-seat-phone`, `cast-venues`,
    `cast-pack`, `cast-pack-seat`, `cast-pack-seat-phone` and `cast-pack-venues`, and the standalone pages.
  - The numbers and lines are in the progress log.
- **Stage 4, done (code; frames from cast-seat):** `hands-acc.ts` gains the outfits `workcuff` (Mateo), `blazer`
  (Leila), `short` (Marcus), `bomber` (Jas) and `look.hairTie` (Jas, on the right wrist), behind new values only. The
  six are wired to them through the catalog. The regression check asserts each.

**Third pass after the weekly reset (Fable builder, 2026-11-15/16; uncommitted, on top of everything above):**

This pass finished the LOOKS, the pack pair first, then the six, and replaced 01's appearance with the owner's new
reference. Before: `tests/out/cast/pack-<id>-*-fx.png` and `compare-<id>-*-fx.png` (2026-11-12). After:
`pack-<id>-*-fx3.png` and `compare-<id>-*-fx3.png`.

- **Done, the pack pair (Chad, Chadaline):**
  - **Faces.** The side of the face is one surface from the cheekbone to the jaw (`FaceShape.cheekFill`: two smooth
    masses under the features), so the ledge under the cheekbone that shaded as a dark band is gone. The nose stands
    out of the profile (`noseProj`), the jaw's angle sits higher (`jawRise`), the eyes are larger, and the skin's
    shading is softer (`Look.softShade`: less baked occlusion on the lit side, a paler scatter where the light falls
    off, which was the red-brown patch on the cheek and jaw).
  - **Chadaline's hair** is flowing hair, not a cap with a curtain: a horseshoe of hair round the back and sides of
    the head with its own rounded front ends beside the face (`HairSpec.flowing`), hollow so the throat is clear,
    the hairline coming down over the temples in an inverted V from the centre parting, uneven ends, loose waves in
    the strands' flow. Nothing is clipped beside the face, so nothing is see-through there.
  - **Chad's curls** are curl-sized clumps with real depth, locks over the forehead, deep shade between the clumps
    and the lighter tips on the clumps' outer turns.
  - **Chad's jacket** has tailored sleeves (`Garment.tailored`: cut round a slimmer arm, without the deltoid's ball),
    a square shoulder line and a closer waist (`Garment.fitK`); the shirt under it is cut the same, so it stays inside.
  - **Chadaline's stilettos**: the foot bends at its ball (`buildRig(..., toeFlat)`), so the toes and the pointed
    toe box lie flat on the ground and the heel rises steeply; the toe is a point 4.5 cm past the toes; the vamp
    covers the toes; the sole is narrower than the foot and plain black.
  - **Budget.** Chadaline's LOD 0 is 78,780 triangles on the phone build (it was 89,325; the budget is 90,000). Chad's
    is 83,268 (it was 87,134).
- **Done, the six:**
  - **01 (Mateo Reyes) follows the owner's reference of 2026-11-15**, which replaces the first sheet: heavyset and
    broad, a round face with full cheeks and a soft jaw (`FaceShape.round`), no beard, thick curls showing under a
    black fitted cap (`curlsUnderCap`; `Accessories.cap`, a grey under-brim, our own small white OC mark on the front
    only), a black crew-neck tee to mid upper arm, a thin silver chain, black straight jeans, black low-top
    sneakers. The portrait is re-cropped from the new face sheet below the cap's crown (10.5 KB WebP; no real mark
    shows). The cockpit arms take his tone and the black `short` sleeve. The crowd's 01-based people follow.
  - **Leila's waves** are flowing hair from a side parting with layered ends (`wavesFlow`); **Danny's side part**
    thins gradually into the clipped sides and stands up in a quiff at the front (it was a slab cut level).
  - **Marcus** is bigger: `BodyShape.bulk` takes the muscle past the builder's old maximum (chest, shoulders, arms,
    back, neck, legs). His henley is cut closer.
  - **Sleeves, collars and lapels.** The outer layers' sleeves are tailored (Danny's and Kate's overshirts, Leila's
    blazer, Jas's bomber a little). Leila's blazer has notch lapels (`Garment.lapel`). A tee can sit high and close
    at the neck (`neck: 'crewHigh'`).
  - **Shoes.** Leila's low heels use the bent foot, as the stilettos do. A very heavy body's shoes are no longer cut
    in half (the shoe's meshing box follows the ankles).
  - **Faces.** All six take `cheekFill`, `noseProj`, `jawRise` and `softShade` with their own values; Kate's loose
    face-framing strands, which hung as detached slabs across her cheeks, are off.
- **Proof run in this pass:** the suite groups, the perf pairs, the renders beside the sheets, the venue frames and
  the full-lock frames are in the progress log's entry of 2026-11-16.

**Fourth pass (Opus, verification only, 2026-11-16 04:14-06:20 UTC; uncommitted, on top of the third pass):**

No new look work, as the brief asked. On the final build of the third pass (`npx tsc --noEmit` passes; `npm run build`
gives one `data-build="owner-test"`, in `dist/artifact.html`; the pages' file sizes are the same as the third pass's
final `dist`):
- **The groups that had last run before the third pass's last four small changes all pass**, one Playwright process
  at a time, at load averages of 14 to 31 on the 4 shared cores: `cast-seat` 3/3, `cast-seat-phone` 2/2,
  `cast-pack-seat` 3/3, `cast-pack-seat-phone` 2/2, `cast-pack-venues` 4/4 as Chad and 4/4 as Chadaline, `boot` 6/6,
  `venues` 13/13, `phone` 18/18. The lines are in the progress log's entry of 2026-11-16 (fourth pass).
- **The sky-camera check passed** this time ("220 px for 110 CSS px at 2x, mean 132.4, sd 33.02 ...; self-check copy
  ok") at a load of 27 to 30, so the base-worktree comparison the brief asked for on a second failure was not needed
  and was not run. The third pass's one failure is recorded as not repeated, not as explained.
- **The third pass's last changed visuals, re-checked** (`tests/out/cast/p4/`, one frame script): Leila's hairline at
  LOD 0, Chad's and Mateo's and Danny's LOD 1/2 busts and game-distance frames, and all eight at LOD 1 and LOD 2. No
  regression: the new LOD 1 fronts of all eight are pixel-identical to the third pass's frames of 02:51-02:53
  (`<id>-front-lod1.png`), and Leila's head, three-quarter head and Chad's bust are pixel-identical to the third pass's
  `-fx3` frames. Chad at LOD 1/2 has no painted beard and no white shirt patches through the jacket's sides. Nothing
  was changed in this pass.
- **The open look items are recorded below as KNOWN GAPS** for a later pass.

**Fourth pass, repair after the judges (Opus, 2026-11-16 08:30 UTC on; uncommitted, on top of everything above):**

The judges kept the code but rejected the looks (art: keep=false). The repair was told not to edit
`src/onfoot/people/*`, `src/preview/hands*`, `car-wheel.ts` or `Physics.ts` (another session's), so it did what lies
outside them and queued the rest as a Fable prompt (`PROJECT_OC_HANDOFF.md`, "the cast judges' people-builder
defects"). Frames named `-r1`.
- **Your own character up close in Stoppage Time** (`venues/sportsbar/main.ts`): the close-up LOD 0 is now built and
  drawn in third person at HD as well as Ultra (it was Ultra only, so at HD the player saw themselves at LOD 1: a blurred
  face and the inner top shredding through an open jacket). Lot 57 already did this at HD. Low keeps LOD 1 in both
  venues (the phone budget). Leila at HD, 2.1 m, daylight: `tests/out/cast/r1/avatar-sportsbar-leila-farahani-front-r1c.png`
  and `tests/out/cast/pack-page-<venue>-<id>-close.png`. The cost: Leila's LOD 0 at the builder's high quality is
  163,218 triangles (her LOD 1, 14,527).
- **People a step away in Stoppage Time** (`venues/sportsbar/crowd.ts` `nextJob`): anyone within 3.2 m of the camera
  on the LOD 1 list gets their LOD 1 built first, nearest first, ahead of the patio's casters. Before, all seven people
  within 3.6 m of a camera at the bar stayed at LOD 2 for the whole 20 s probe (and over 100 s in a second probe); after,
  the four within 2.2 m reached LOD 1 one by one as the time-sliced builder ran (each build 1.2 to 3 s on SwiftShader
  at a load of 11; `r1/crowd-sportsbar-leila-farahani-early-r1c.png` and `-late-r1c.png`). LOD 1 itself is still
  coarse up close (see the KNOWN GAPS).
- **Catalog values** (`cast.ts`): Chad's jaw wider and squarer, a heavier brow, thicker brows and the builder's
  `stubble` (the `lightStubble` didn't show at LOD 0): `pack-chad-head-r1.png` (sheet, before, after). Marcus leaner
  with less bulk and the mass moved off the belly (fat 0.16, bulk 0.45, apple -0.35): the stomach is flatter, the
  chest still projects like a bust in profile, which is `body.ts`'s pectoral shape (`compare-marcus-bell-body-r1.png`,
  `marcus-bell-side-r1b.png`).
- **The picker's turntable** (`src/ui/castStage.ts`): the judges' frame (Leila's face hidden behind her hair, the teeth
  showing) was NOT reproduced in three runs at 390x844 DPR 3: the moment the close-up lands, a full turn held at every
  30 degrees (`r1/z-turn12-r1.png`), and a first frame whose clock was 0.8 s and 1.5 s earlier than the stage's (a rAF timestamp can be).
  The time step is now never negative (a real path to wild face-morph weights, though the skewed runs drew her face
  fine, so it is not shown to be the cause). The stage takes `hold` (a test angle) and reports `turn`. The new check
  "the picker's turntable front-on at 390x844 DPR 3 shows Leila's face (regression grab)" holds it front-on and
  requires the head box to be mostly skin (front-on about 0.3; the judges' frame 0); `picker-front-390x844-dpr3.png`.
- **Daylight venue frames:** `cast-pack-venues` runs at Day (it was Sunset: the venue clock was 19:30 and the frames
  were night) and its front frame is a fixed camera 2.1 m in front of the avatar (the turned camera showed no one).
  `tests/cast-pack-venues-shoot.mjs` defaults to 13:00, takes any character, adds a close frame and checks the avatar's
  level (LOD 0 at High).
- **The picker's intro** reads "Six drivers to choose from, plus a pack coming soon."
- **Hooks:** `__onfoot.cast()` in both venues gives each person's level (`where[].draw/lod` or `rep/lod`) and yours.

**In progress:** nothing is half-built.

**Next (in order), as of the third pass:** see "What is still short of the sheets" and "Highest-impact remaining
visual defects" below. In short: the faces are smoother and each has its own proportions but they are still the
builder's stylised faces; Chad's curls read as a curly mop, not the sheet's glossy ringlets; Marcus's tee still
hangs wide at the waist; the sneakers, deck shoes and sandals have no laces, tongue or strap detail; the hands'
full lock still drops one hand out of the frame (the other session's shuffle).

**Next (in order), as of the Opus continuation (kept for the record; items 1 and 2 were worked in the third pass):**
1. **Stage 3, still open:** these need the builder's geometry (`head.ts`, `hair.ts`, `body.ts`, `garments.ts`), which
   is Fable-class work.
   - The faces' own shapes against the sheets (Mateo's broad jaw, Danny's slim face, Jas's youthful face).
   - The cheek and jaw hollows that shade as smudges.
   - Leila's waves and Danny's side part as layered locks, not a helmet. Chadaline's long hair, and Chad's curls.
   - The shoulders' slope, the ballooning outer sleeves, and Marcus's muscle (he is at the parameters' maximum).
   - Collars and lapels on the six. Mateo's jacket worn zipped.
   - Shoes that read from the front.
2. **Perf:** re-run the desktop pairs in full after the fur fix. Only one run after the fix was measured.

Honest scope: the six are stylised real-time 3D built by our procedural people builder, for a phone browser. They
are matched to the sheets as closely as the builder's shapes allow. They are not photoreal and not imported models.

## The catalog (one source of truth)

`src/onfoot/cast.ts` holds everything about how a character looks, as data. Each `CastEntry` has:

| Field | What it is |
| --- | --- |
| `id`, `ref` | A stable id (`mateo-reyes`, ...). `ref` is the master brief's technical label (M01 to F03). |
| `name`, `first`, `age`, `heightCm`, `build`, `from` | Who they are. All fictional. |
| `presentation` | `m` or `f`. It sets the hand shape in the cockpit. |
| `unlock` | `base` for the six. `pack` is reserved for the future pack. |
| `portrait` | The picker's portrait (`src/ui/assets/cast/<id>.webp`, 320x400, 9 to 16 KB each, inlined in the build). |
| `sheets` | The owner's reference sheets (body and face). They are not shipped. |
| `body`, `face`, `look` | The people builder's parameters. These are our mesh and material references: the builder makes the mesh and materials from them. |
| `wardrobe` | Slots: `top`, `outer`, `bottom`, `shoes`, `acc`. |
| `anim` | Walk speed, the idle clips the crowd picks from, and the gait. |
| `arms` | The cockpit arms: sleeve colour, the closest sleeve the hands have, watch, bangle, ring, nails, and what the hands can't show yet. |
| `crowd` | The variety a crowd member may take: tints per slot, whether the outer layer may come off, and optional accessories. |
| `notes` | Where the build differs from the sheets or the brief, recorded rather than blended. |

The saved choice is `Settings.character` (`src/game/settings.ts`). It is `''` until the player picks.

| Ref | Name | Age, height | Hair, defining features | Canonical outfit (as drawn) |
| --- | --- | --- | --- | --- |
| M02 | Mateo Reyes | 27, 175 cm, heavyset, broad | Round face, full cheeks, soft jaw, no beard; thick dark curls under a black fitted cap with our own OC mark; thin silver chain (the owner's reference of 2026-11-15, which replaces the first sheet) | Black crew-neck tee, black straight jeans, black low-top leather sneakers |
| M03 | Danny Tran | 31, 172 cm, slim | Side-part undercut, thin rectangular glasses, steel watch | Heather-grey overshirt rolled to the forearm, white tee, olive chinos rolled at the ankle, white leather sneakers |
| M01 | Marcus Bell | 38, 188 cm, muscular | Shaved head, short full beard with grey, sunglasses on his head | Navy henley, sand chino shorts, brown leather sandals |
| F02 | Leila Farahani | 29, 168 cm, slim | Shoulder-length waves from a side part, gold hoops | Cream blazer, black fitted top, black trousers, black low heels |
| F01 | Jas Cruz | 24, 160 cm, petite | High ponytail with loose strands, hair tie on her right wrist | Cropped olive bomber, white tank, light-wash jeans, chunky white sneakers |
| F03 | Kate Morgan | 35, 175 cm, athletic | Low loose ponytail, dirty blonde, freckles, blue-grey eyes | Faded denim shirt rolled up, white tee, khaki cargo pants rolled at the ankle, navy deck shoes |

### Asset status

- **What exists:** six procedural presets for the people builder. The builder makes LOD 0, LOD 1 and LOD 2 itself
  (the venues' budgets). There are six portraits cropped from the face sheets.
- **What does not exist:** no imported meshes, rigs, UV texture sets or scanned textures. The master brief's nine PNGs
  and `character_roster.json` were not attached. Only the brief came, plus a body sheet and a face sheet for each of
  the six, which were used.
- **Missing views or parts:**
  - (2026-11-12) Marcus's eyebrow scar is now built (`Look.scar 'browR'`). The hands' missing sleeves are now added
    in `hands-acc.ts`, additively, as agreed with its owner: `workcuff`, `blazer`, `short`, `bomber` and
    `look.hairTie`.
  - There is no driver head or torso model in the car. From the hood and chase cameras, only the arms show through
    the glass.

### Mismatches (recorded, not blended)

- **Marcus's scar** is on his right eyebrow in both images. The brief's text says left. We follow the images. Built
  2026-11-12 as a pale line up through the right brow. The front face sheet also shows a fainter mark above the left
  brow, which is not built.
- **01's first sheet is superseded.** The owner sent a new reference on 2026-11-15 ("Use this for one of the male
  characters to use instead of the Hispanic guy"): `owner/npc-refs/01-mateo-2026-11-15` (a face sheet, a body sheet and
  a note). It replaces 01 Mateo Reyes's appearance; the slot, the picker place, the name and the backstory stay. The
  first sheet (`characters/01-mateo-reyes`: skin fade, boxed beard, charcoal work jacket zip-front, navy work pants,
  work boots) is no longer built.
- **The cap's marks.** The cap in the new photos carries a baseball team's mark on the front, a cap maker's flag on
  the side and a league logo on the back. None is reproduced. Ours has a small white embroidered OC mark on the front
  only. The picker portrait is cropped below the cap's crown, so no real mark shows in it.
- **01's brim shadow.** The cap's brim shades the upper half of his face in the studio renders; the sheet's light is
  softer.
- **Leila's nails:** a muted nude polish is our provisional choice. The sheets don't show her nails clearly.

## How the character is the driver everywhere

- **The cockpit arms.** `Game.configureCar` calls `characterLook(archetype, Settings.character, presentation, skin)` in
  `src/game/drivers.ts`. With a character, the arms take:
  - the character's skin tone,
  - `arms` (sleeve colour, the closest sleeve, watch, bangle and nails),
  - the presentation.

  Without a character, they are `lookFor`'s archetype look, exactly as before. `PlayerCar.configure` handles the two
  kinds of change differently:
  - A tone change alone goes through the hands' public `setTone`, without a rebuild.
  - Anything else rebuilds the arms through `buildDriverArms`, which also applies `setTone`.

  Nothing in `src/preview/hands*` was edited.
- **The archetype stays gameplay only.** The archetype (Closer, Ace, Wrench) and its ability (Clear Path, Focus Time,
  Grip) remain a separate choice and work as before. The archetype's off-wheel pose and signature colour carry over.
  The six are cosmetic.
- **On foot.** `readDriver` in `src/onfoot/lot57/driver.ts` reads `character` from `tsu.settings`, or `?char=` on the
  standalone pages. `driverPerson` then builds `castPerson(id)`. Both venues use it, in the game (through `embed.ts`,
  same storage) and on their own pages.
- **Old saves.** A save with a presentation and skin tone but no character keeps that exact look until the player
  picks. The picker then opens on the closest character: the one of the same presentation whose skin tone is nearest
  in RGB (`closestCharacter`). The old Presentation and Skin tone controls in the Driver panel are replaced by a
  Character row that opens the picker.
- **Bought driver styles** (Night Shift, Golden Hour, Canyon Run) follow one rule, `withStyle` in `drivers.ts`. When a
  style is equipped, its gloves, watch and sleeve (colour and cuff) replace the character's. Its nail colour applies
  to a female presentation only. The skin tone and hand shape stay the character's. Styles have no equip slot yet
  (status `hook`), so nothing calls it with a style today.

## The picker

`src/ui/CastPicker.tsx` and `src/ui/castStage.ts`. You reach it from:

- a Character entry on the main menu, which shows the chosen character's portrait, name and home town,
- a Character row in the garage,
- a Character row in the Driver panel.

It shows six portrait cards and a live 3D turntable of the selected character. The turntable shows LOD 1 at once and
swaps to LOD 0 a moment later. It is loaded on demand, so boot doesn't carry the people builder. "Drive as <name>"
saves the choice. The picker says plainly that the characters are stylised real-time 3D and that looks are cosmetic.

## The crowds (the six are the only looks)

- **Lot 57:** `src/onfoot/lot57/npcs.ts`. Guests, staff, crew and the two walkers. `crowd-worker.ts` builds from the
  options it is sent.
- **Stoppage Time:** `src/onfoot/venues/sportsbar/crowd.ts` (guests and spares), `crew.ts`, and `house.ts`, which uses
  `crew.ts` `staffOptions`. `life.ts` uses the cast for its clip test.

All of them build from `crowdPerson(seed, slot)` or `staffPerson(seed, slot, uniform)`:

- **What stays fixed:** a member keeps the base character's face, skin, hair, proportions and defining accessories
  (Danny's glasses, Leila's hoops).
- **What varies:**
  - the clothes' tints,
  - whether the outer layer is on,
  - the optional accessories,
  - the venues' own routes, schedules, idles and conversation timing.
- **No doubles side by side:**
  - Consecutive slots are different characters.
  - A Stoppage Time party never holds two of the same.
  - A regular is always the same character.
- **Budgets unchanged:** the crowd budgets, LODs, pooling and the builder's phone quality are as before.

The "Simulated crowd" labels stay.

## The Chad & Chadaline pack (built 2026-11-12, locked, not on sale)

The owner's premium pair: "Chad" and "Chadaline" (working names; the ids `chad` and `chadaline` stay if they are
renamed). They are our own fictional adults in the game's stylised 3D look, built from the owner's sheets
(`owner/pack/chad`, `owner/pack/chadaline`; not shipped, only a portrait crop of each is).

| Ref | Name | Age, height | Hair, defining features | Outfit (as drawn) |
| --- | --- | --- | --- | --- |
| P01 | Chad | 28, 188 cm, tall and athletic | Dark-brown medium curls with lighter tips, strong brows, light stubble, brown eyes, stud earrings | Black double-breasted peak-lapel jacket, white pocket square, white shirt with the collar open, black suit trousers, black lace-up shoes |
| P02 | Chadaline | 27, 168 cm, hourglass | Long dark hair with brown ends, full brows, brown eyes, small gold hoops, gold watch, rings | Black strap mini dress cut close, cream faux-fur shrug off the shoulders, black pointed stilettos with plain black soles |

- **The lock** is one rule, `src/game/castPack.ts` `packUnlocked`:
  - the store's entitlement `cast-pack-duo-characters`, which nothing sells today; or
  - in a test-mode build only, the picker's switch labelled "TEST: try the pack" (`Settings.packTest`). It is not a
    purchase: no entitlement, no receipt. A live build ignores it.
- **Locked:** the picker shows both cards, the preview and the turntable, and the button reads "Chad & Chadaline
  pack: coming soon, $22.22, 18+". A save that names a pack character plays the look without a character.
- **Unlocked:** they work everywhere the six do: the cockpit arms (`Game.configureCar`), the on-foot avatar in both
  venues (`lot57/driver.ts`; on the standalone pages `?char=chad&pack=test`), the picker and the menu.
- **Never in the crowd:** `crowdPerson` and `staffPerson` draw only on `CAST`, the six.
- **The store:** `cast-pack-duo` is 2222 cents, `min_age: 18`, `available: false`. It grants the two characters and
  `cast-pack-duo-scarlatta`, the Rossini Scarlatta, which is reserved and not built on this branch. The checker
  takes $22.22 as the owner's second price exception. Before it can be sold it needs the car, and an 18+ check at
  checkout: the store's rule today is 13+ with a guardian's OK.
- **Recorded, not blended:**
  - The sheet's red shoe soles are a real brand's trademark. Ours are plain black.
  - Her watch is drawn on her right wrist. On foot it is there. The cockpit hands only wear a watch on the left.
  - The jacket's flap pockets and the trousers' pressed crease are not built.

### What the pack added to the people builder (additive only)

Every existing preset, default and the public API build as before. New values only:

- `params.ts`: hair `curlsMedium`, `longWaves`; facial hair `lightStubble`; `Look.hairTips`, `Look.browThick`;
  `FaceShape.jawSoft`; fabric `fur`; garments `suitJacket`, `suitTrousers`, `shrug`, `stilettos`, `oxfords`;
  `Garment.fit: 'body'`, `Garment.unbutton`; accessories `hoopSize`, `watchRight`, `rings`, `pocketSquare`, `buttons`.
- `hair.ts`: the two styles; a tapered edge and a fringe (no ledge at the hairline); a curtain that fills out below the
  ears, with waves; a narrower face opening; lighter streaks. `masks.ts` gains `hairlineDepth`. `cards.ts` takes `tips`.
- `garments.ts`: the jacket (peak lapels as a lofted strip, a shoulder pad), the straight trouser leg, the shrug's
  rolls, the bodycon drape and thin straps, the pointed toe, the pump's heel counter, the lace-up shoe's low heel.
- `person.ts`: under a closed suit jacket the shirt's hidden triangles are left out. Two shells 7 mm apart crossed in
  the armpit and the shirt showed through.
- `face.ts` (brow fullness), `head.ts` (`jawSoft`), `cloth.ts` (fur), `acc.ts` (the new accessories).
- `src/preview/hands-acc.ts` (agreed with its owner, additive): outfits `jacket` and `fur`.

### What is still short of the sheets (honest)

Seen in `tests/out/cast/pack-chad-*-fx3.png` and `pack-chadaline-*-fx3.png` (2026-11-16, after the third pass). The
state before that pass is in the `-fx.png` images of 2026-11-12.

- **Still not the sheets' people.** They are clearly better than the six in hair and clothes, and their faces are
  smooth and proportioned, but they are the builder's stylised faces, not photoreal ones.
- **Chad:**
  - The curls read as a dark curly mop with brown tips and locks over the forehead. They are not the sheet's glossy,
    separate ringlets, and the lower edge over the forehead is two broad lobes.
  - The jacket's shoulders are square with a sharp corner at the sleeve head; the sheet's are softer. The sleeves
    are slim now. The six buttons are black on black and barely show; the flap pockets and the trousers' crease are
    not built.
  - His jaw is square with a flat chin.
- **Chadaline:**
  - The hair is long flowing hair with a centre parting and reads as that from every side. It is fuller round the
    head than the sheet's, and the streaks on top show a wood-grain pattern close up.
  - The fur shrug is still two fluffy sleeves and three rolls across the back; the sheet's is one deep, soft wrap.
  - The stilettos read as pointed pumps from the side and from above. From straight ahead at standing height the
    bare instep hides most of the toe box. The sides of the shoe are low.
  - Her legs are slimmer than the sheet's.
- **At full lock** one hand leaves the bottom of the frame (the hands turn rigidly with the rim; the other session's
  hand-over-hand shuffle would fix it).

## What lane "cast A" changed (files)

- **New files:**
  - `src/onfoot/cast.ts`, the catalog.
  - `src/ui/CastPicker.tsx` and `src/ui/castStage.ts`, the picker and its turntable.
  - `src/ui/assets/cast/*.webp`, the six portraits.
  - `src/onfoot/test-cast.html` and `src/onfoot/test-cast.ts`, the studio page, with `&fh=` and `&hair=` overrides.
  - `tests/cast-shoot.mjs` and `tests/cast-sheets.py`, the renders and the sheet comparisons.
  - `tests/cast-perf.mjs`, the 120 s seat-view drive.
  - `tests/cast-lock.mjs`, the full-lock and still frames.
- **The people builder (additive only):**
  - `params.ts`:
    - new hair values: `highPonytail`, `lowPonytail`, `fade`, `sidePart`, `waves`;
    - a new facial hair value, `fullBeard`;
    - new garment kinds: `bomber`, `overshirt`, `workJacket`, `henley`, `cargo`, `chinoShorts`, `workPants`, `sandals`,
      `deckShoes`, `lowHeels`, `chunkySneakers`, `workBoots`;
    - `Garment.roll`;
    - optional `Accessories.sunglassesUp` and `hairTie`.
  - `hair.ts`, `garments.ts`, `acc.ts` and `person.ts` build those values. Every existing value, preset and the public
    API build as before. `face.ts`, `masks.ts` and `skin.ts` are untouched: `hair.ts` reads `faceMasks` but doesn't
    change it.
  - **Tuned on 2026-11-12 after the renders:**
    - The high ponytail lost its face-framing cards, which hung as dark slabs beside the cheeks.
    - The full beard is 4 mm instead of 5.5 mm, thinner up the sideburns, with a slightly smaller area.
- **The game:**
  - `drivers.ts`: `characterLook` and `withStyle`.
  - `settings.ts`: `character`.
  - `Game.ts`: the character in `configureCar`, plus the `driverArms` and `abilityId` test getters.
  - `PlayerCar.ts`:
    - a tone-only change goes through `setTone`;
    - the `armsLook` test getter;
    - the drawn wheel is limited to the hands' range.
- **The UI:**
  - `App.tsx`: the Character entry on the main menu, the garage row and the Driver panel row.
  - `styles.css`: the picker, one stacked layout.
- **On foot:**
  - `lot57/driver.ts`: the character is the avatar.
  - `lot57/npcs.ts`: the guests, staff, crew and walkers are the six.
  - The sportsbar's `crowd.ts`, `crew.ts`, `life.ts` and `main.ts`: the same, plus `cast()` hooks in both venues.
- **The store:** `catalog.json`, `cosmetics.json` and the synced server catalog carry the `cast-pack-duo` scaffold.
- **Tests:**
  - `tests/regression.mjs` groups `cast`, `cast-seat`, `cast-seat-phone` and `cast-venues`.
  - A `tsu.test.keep` flag lets a check reload a page without the group's test settings overwriting the save.

## What the graphics pass changed (2026-11-12, Fable then Opus; uncommitted)

- **The pack:**
  - `cast.ts`: `CAST_PACK.identities`.
  - `castPack.ts` (new): the lock.
  - The picker's pack section.
  - `settings.ts` `packTest`.
  - The store entry at 2222.
  - The builder values listed under "What the pack added".
  - `hands-acc.ts`: `jacket` and `fur`.
  - Checks: `cast-pack`, `cast-pack-seat`, `cast-pack-seat-phone`, `cast-pack-venues`.
  - `tests/cast-pack-venues-shoot.mjs` (new): the standalone venue pages.
- **The shared face work:**
  - `masks.ts` `beardAt`: softer cheek line and back edge.
  - `cards.ts`: the per-strand grey turns into its mean under a pixel.
  - `hair.ts`: the cap's grey as fine strands.
- **The six:**
  - `params.ts`: `Look.scar`, `Garment.leg`.
  - `skin.ts`, `face.ts`, `person.ts`: the scar.
  - `garments.ts`: the straight and relaxed leg, and the cargo pockets on it.
  - `cast.ts`: the beards (`beard`), Marcus's grey and scar, the legs, and the arms' new outfits.
- **The hands** (`hands-acc.ts`, additive): `workcuff`, `blazer`, `short`, `bomber` and `look.hairTie`. The fur sleeve
  is cheaper (sheen 0.4, normal scale 1.2) after the perf pairs. `drivers.ts` passes `hairTie`.
- **Tests:**
  - `regression.mjs`: `settleStorage` before the reload checks, and the six's own sleeves in the `cast` arms check.
  - `cast-shoot.mjs` and `test-cast.ts`: `yaw`, `game`, `shoe` and `bust` views, `preset-<name>` and `&grey=`.
  - `cast-sheets.py --pack`.

## What the third pass added to the people builder (2026-11-15/16, additive only)

Every existing preset, default and the public API build as before: each item is a new optional value, and unset it
changes nothing. The session that owns `people/*` agreed to edits in `face.ts`, `skin.ts`, `masks.ts`, `head.ts` and
`body.ts`; `anim.ts`, `Physics.ts`, `car-wheel.ts` and every `hands*` file were not touched in this pass.

- `params.ts`:
  - `FaceShape.cheekFill`, `noseProj`, `round`, `jawRise`;
  - `BodyShape.bulk`;
  - `Look.softShade`, `Look.beardShadow`;
  - hair `wavesFlow`, `curlsUnderCap`;
  - `Garment.tailored`, `fitK`, `drapeK`, `lapel: 'notch'`, `neck: 'crewHigh'`;
  - `Accessories.cap`, `capUnder`, `capMark`.
- `head.ts`: the four face values. `body.ts`: `bulk` (with the pectorals and lats limited so they stay plates and a
  V), and `buildRig`'s fourth argument `toeFlat` (the foot bent at its ball; `Rig.toeBend`).
- `hair.ts`: flowing hair (`flowing`, `partV`, `ends`), curl clumps (`clumpF`, `clumpA`), the cap's band
  (`capBandY`, `under`), the side part's `cutLen` and `quiff`, `cardStep`; the cap shader's big-curl mode (swirled
  streaks, tips on the clumps' outer turns, the edge in locks). `person.ts` carries the clump's height in the
  occlusion attribute's whole part.
- `garments.ts`: tailored sleeves from a slimmer arm (`GarmentSdf.tX`), the drape's side and overall strength and
  its faded top, notch lapels, the high crew neck, the bent shoe frame, the pointed toe box, the pump's vamp, and the
  shoe box that follows the ankles.
- `acc.ts`: the cap (crown, band, brim with an under-colour, button, our OC mark); cloth takes no clear coat.
- `skin.ts`: `uSoft`. `person.ts`: `beardShadow`, `softShade`, the bent foot for stilettos and low heels, and the
  hidden-triangle rule under any tailored outer layer.
- `cast.ts`: the new 01; every character's face values; the outfits' cuts. `castStage.ts`: what the looks check reads.
- Tests: `regression.mjs` (01's sleeve; the new check "cast: 01 follows the owner's reference ..."; the storage
  pause grows with the machine's load), `cast-sheets.py` (01's new sheets), `cast-shoot.mjs` and `test-cast.ts` (a
  `foot<deg>` view from above).

## The first-person seat view: smooth and glitch-free

- **Full lock, before (2026-11-12).** The drawn wheel turned with the steering ratio up to the old clamp of ±2.2 rad
  (126°). The hands grip at ten and two and turn rigidly with the rim, and they read right only to about ±1 rad. At
  full lock one forearm swept across the hub and the spokes and the other hand disappeared at the bottom of the rim.
  Frame: `tests/out/cast/lock/jas-phone-lock-strip.png`.
- **The fix.** `src/game/vehicle/PlayerCar.ts` `updateCockpit`:
  - The drawn wheel follows the ratio exactly up to 0.8 rad, then eases into 1.05 rad (`WHEEL_KNEE`, `WHEEL_MAX`).
  - At 30 m/s the physics' lock is about 0.8 rad of wheel, so on the freeway nothing changes. Only low-speed hard
    turns are limited.
  - The physics' steering is unchanged.
  - Frame: `tests/out/cast/lock/jas-phone-lock-strip-after.png`. Both hands stay on the rim, and the hub and spokes
    stay clear both ways.
- **The regression check.** `cast-seat` asserts the wheel is between 0.6 and 1.05 rad at full lock each way.
- **What would restore the real lock.** A hand-over-hand shuffle in `src/preview/hands*`, which belongs to the other
  session. It is listed below for them.
- **Flicker and z-fighting.** Two frames of the same still seat view, half a second apart, were compared over the
  wheel, hub and cluster (480x450 px at DPR 2): 41 pixels of 216,000 differ by more than 24 levels, at most 46. That is
  the cluster's live needle and antialiasing, not flicker. Texture filtering was already there: the cockpit's canvas
  and surface maps use anisotropy 8 with mipmaps (`src/preview/car-tex.ts`).
- **Per-frame allocation.** Nothing this lane added runs per frame in the drive. The `armsLook` getter allocates only
  when a test reads it. The picker's turntable loop allocates nothing.
- **Materials.** The wheel's detail was already in place from the sport-wheel lane and is unchanged here:
  - perforated Nappa grips with double stitching,
  - Alcantara with nap,
  - 2x2 twill carbon under clear coat with an anisotropy map,
  - brushed and knurled metal,
  - emissive shift lights.

## Verified results

The results with the exact suite lines are in the progress log's entries of 2026-11-16 (the third pass: the `-fx3`
renders, the far-level strip `lod1-eight-fx3.png`, the daytime venue frames `venue-pack-day-fx3.png`, the full-lock
strip `lock-pack-fx3.png`, the perf pairs and the suite) and of 2026-11-12. The renders and frames are in
`tests/out/cast/`, and `tests/out` is not committed. The list below is the first pass's; the same scripts made the
later sets with a suffix:

- **The six against their sheets:**
  - `compare-<id>-body.png` puts the front, side and back of each sheet beside the render.
  - `compare-<id>-head.png` does the same for the face sheet's front, profile and three-quarter.
  - Made by `node tests/cast-shoot.mjs`, then `python3 tests/cast-sheets.py <sheets folder>`.
- **The picker:** `picker-1450x767.png`, `picker-1450x767-cards.png`, `picker-390x844.png` and
  `picker-390x844-cards.png`.
- **The seat view:**
  - `seat-<id>-1280x720.png` and `seat-<id>-390x844.png` for the six.
  - `seat-six-1280x720-hands.png` (montage).
  - `seat-lock-left|right-1280x720.png` at full lock.
  - `seat-hood-1280x720.png` and `seat-chase-1280x720.png`.
- **The venues:** `venue-lot57-avatar.png`, `venue-lot57-crowd.png`, `venue-stoppage-avatar.png` and
  `venue-stoppage-crowd.png`.
- **The beard shell:** `beard-fullBeard-vs-beard.png` (the shell against the builder's own beard shading) and
  `beard-before-after.png` (the shell thinned).

## Highest-impact remaining visual defects (honest, updated 2026-11-16 after the third pass)

1. **The faces are stylised, not the sheets' people.** The cheek and jaw smudges are gone in the front and
   three-quarter views (`compare-<id>-head-fx3.png`), and each face has its own width, jaw, nose and eyes. But a
   viewer would not pick the sheet's person from the render by the face alone.
2. **Marcus.** He is bigger than the builder's old maximum, with a large chest and shoulders. His tee still hangs
   as wide at the waist as at the chest, so he does not read as the sheet's V-shaped bodybuilder; his legs are
   slimmer than the sheet's.
3. **Shoes.** The stilettos and low heels now stand on a bent foot and read from the side and from above. The
   sneakers, the deck shoes and the sandals are plain shapes with a sole: no laces, tongue or strap detail, and the
   sandals' straps break up at the edges (`<id>-foot30-fx3.png`).
4. **Hair.** Chad's curls are a mop, not ringlets. Danny's top is a quiff on clipped sides but still one mass.
   Leila's waves are flowing hair with a side parting; the parting's edge is ragged close up.
5. **Cloth.** No pockets, seams or creases; Chad's buttons barely show; a tee's neck still dips a little at the
   front on the heaviest and the most muscular bodies.
6. **No driver body in the car.** The hood and chase cameras show only the arms.

Fixed across the graphics passes:
- the full-beard box (strand-card beards), the grey speckle, Marcus's scar, the leggings look of the trousers, the
  hands' sleeves (2026-11-12);
- the dark cheek and jaw shading, Chadaline's cap-and-curtain hair and the see-through beside her face, Chad's
  ballooning sleeves and ball shoulders, the outer layers' sleeves, the helmet hair of Leila and Danny, the stilettos'
  rigid foot and red-sole question (plain black), Chadaline's triangle budget, and 01's new appearance (2026-11-16).

## KNOWN GAPS for a later pass (recorded by the fourth pass, 2026-11-16; not worked on in it)

These were open when the third pass stopped. The fourth pass was verification only and did not change them. Most need
the people builder's geometry (`src/onfoot/people/*`, Fable-class, coordinated with the session that owns it).

1. **Marcus:** his tee hangs as wide at the waist as at the chest, so he does not read as the sheet's V-shaped
   bodybuilder; his legs are slimmer than the sheet's.
2. **Shoes:** the sneakers (01, Jas), the deck shoes and the sandals are plain shapes on a sole: no laces, tongue or
   strap detail, and the sandals' straps break up at the edges (`<id>-foot30-fx3.png`).
3. **Danny's hair:** a quiff over thinning clipped sides, but the top is still one mass, not separate locks.
4. **Chad's curls** read as a curly mop with brown tips, not the sheet's glossy separate ringlets; the lower edge over
   the forehead is two broad lobes.
5. **Danny's profile:** a faint darker tone under the cheekbone in the profile view
   (`p4/danny-side-mateo-head-p4.png`, left).
6. **01's cap:** the brim shades his forehead and the upper half of his face in the studio renders; the sheet's
   light is softer (`p4/danny-side-mateo-head-p4.png`, right).
7. **Seen again in the fourth pass's frames** (`tests/out/cast/p4/`), the same as in the third pass's:
   - Leila's side parting has a ragged edge and a two-tone step between its two sides close up
     (`p4/leila-hairline-p4.png`).
   - At LOD 1 an open outer layer (Danny's, Leila's, Jas's and Kate's) shows the shirt under it with a ragged edge,
     and Chad's open collar is a ragged white V at LOD 1 and LOD 2 (`p4/lod1-eight-front-p4.png`,
     `p4/stubble-shirt-bust-lod12-p4.png`).
   - 01 at LOD 2 shows skin along the tops of his shoulders (the tee's shoulders are lost at that level), and his cap
     reads as a black bowl at LOD 1 and LOD 2, with no brim or mark (`p4/bust-zoom-p4.png`). These are the far
     levels only (a person a few dozen pixels tall).
   - At full lock one hand rides the top of the rim and the other leaves the frame (the hands' owner's shuffle).

8. **Added by the judges' review (2026-11-16, art: reject), all in the people builder or the hands; queued as a Fable
   prompt in `PROJECT_OC_HANDOFF.md`:**
   - Chad: a hard, notched hairline with a black rim; the curls a blotchy sponge, not ringlets (worse than "a mop").
   - Chadaline: a jagged cut at the centre parting; hard black alpha strands in profile; the shrug's back is bands
     with dark gaps, and it reads grey knit, not one cream fur roll.
   - Jas's and Kate's hair still read as helmets; Danny's hair is a brown block and a black block; his open
     overshirt has a ragged white edge at LOD 0.
   - Marcus: the chest projects like a bust in profile (the catalog's change flattened the belly only); the sandals'
     ragged black bits; the legs smear tan into brown at LOD 2.
   - LOD 1 (the crowd within a few metres, and your avatar at Low): open outer layers show the top through in ragged
     patches; faces are soft. Stoppage Time now builds LOD 1 first for people within 3.2 m, but LOD 1 is the limit.
   - The seat view at full lock on the phone: Chadaline's fur sleeve covers about a third of the screen and the right
     arm crosses the hub (`hands-acc.ts` 'fur' and the hands' shuffle).
   - Leila's waves show see-through holes at the side on the picker's turntable (about 90 to 120 degrees).

## For the session that owns `src/preview/hands*` (only `hands-acc.ts` edited, additively, as agreed)

- **Hand-over-hand at full lock.** The hands turn rigidly with the rim and read right only to about ±1 rad.
  `PlayerCar` now limits the drawn wheel to 1.05 rad. A shuffle would let it turn to the real lock (±2.2 rad).
- **The six's sleeves and wrist pieces** were added in `hands-acc.ts` on 2026-11-12, behind new option values only:
  `workcuff`, `blazer`, `short` and `bomber`, and `look.hairTie`. The existing outfits, the defaults and every other
  `hands*` file are unchanged. Two notes for that session:
  - Marcus's short sleeve shows the forearm above `rollAt`. The skin's tan line (`hands-skin.ts`, which wasn't
    edited) sits there, faint on his dark skin.
  - The hair tie sits 8 mm up the wrist, below a bomber's cuff.

## Next task (cast B)

1. **The full loop with each of the six, in the built game:**
   - drive to the venue, park, get out, walk in,
   - interact (order at Lot 57's bar; a seat or the bar at Stoppage Time),
   - walk out, drive away,
   - reload: the character, the car and the scene must come back intact.

   Check the camera transitions, blocked exits, repeated interactions and a character swap between visits.
2. **A graphics pass on the six (Fable for the builder's geometry, Opus for materials and renders):**
   - the faces against the face sheets,
   - the hair shapes (waves, side part),
   - a full beard with strand cards,
   - the scar,
   - the shoulders and sleeves,
   - each one re-shot beside its sheets.

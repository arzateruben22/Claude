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

**In progress:** nothing half-built. See "What is still short" under the pack section for the look.

**Next (in order):**
1. Stage 2, the shared face work: the full-beard box at yaw 45 degrees and more; the grey-beard speckle at game
   distance. Not started.
2. Stage 3, the six against their sheets: faces, hair (Leila's waves, Danny's side part), beards, Marcus's scar,
   bodies, cloth, shoes. Not started. The pack's new pieces can be reused: `suitTrousers`' straight leg for the
   six's trousers, the jacket's shoulder pad for the sloping shoulders, `jawSoft` and the hair taper and fringe.
3. Stage 4: the `hands-acc.ts` options for the six (work-jacket cuff, blazer cuff, short sleeve, bomber cuff, hair
   tie). Not started. The pack's `jacket` sleeve is close to what Leila's blazer needs.
4. Stage 5: the alternating perf pairs against a clean `5cf7212` build, the phone group on that base worktree, the
   final renders of the six, the full suite. Not started.

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
| M02 | Mateo Reyes | 27, 175 cm, stocky | Skin fade with a textured top, short full beard, thin chain | Charcoal canvas work jacket, white tee, navy work pants, black work boots |
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
  - Marcus's eyebrow scar. It needs a mark in `face.ts` or `skin.ts`, and another branch changes those files.
  - The hands (`src/preview/hands*`, another session's) have no:
    - canvas work-jacket cuff (Mateo; the shirt cuff stands in and shows a cufflink),
    - blazer cuff without a shirt cuff (Leila),
    - short sleeve ending above the elbow (Marcus; the rolled work sleeve stands in, and the forearms are bare as drawn),
    - bomber's ribbed cuff on a plain sleeve (Jas; the suit sleeve stands in, ribbed all along with a small R patch),
    - elastic hair tie on the wrist (Jas; the metal bangle stands in).
  - There is no driver head or torso model in the car. From the hood and chase cameras, only the arms show through
    the glass.

### Mismatches (recorded, not blended)

- **Marcus's scar** is on his right eyebrow in both images. The brief's text says left. We follow the images. The
  scar isn't built yet (see above).
- **Mateo's jacket** is drawn zip-front. The brief's text says open. It is built as drawn and worn open.
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

__SHORT__

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

The results with the exact suite lines are in the progress log entry of 2026-11-12. The renders and frames are in
`tests/out/cast/`, and `tests/out` is not committed:

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

## Highest-impact remaining visual defects (honest)

1. **The faces are far from the sheets.** The builder's faces are generic: flat eyes and dark smudges over the cheeks
   and jaw on every character. Leila's and Danny's hair reads as a helmet. Bodies are sloping-shouldered, sleeves
   balloon, and Marcus doesn't read as muscular. Straight jeans and trousers render skin-tight, and the
   bomber's ribbed hem doesn't read. This is the people builder's geometry and shading
   (`face.ts`, `skin.ts`, `masks.ts`, `body.ts`). Those belong to another branch and are Fable-class work.
2. **The full beard (Marcus, Mateo) is a solid 4 mm shell.** The edges are hard and there are tabs at the ears in
   profile. It reads as a beard at a distance, and as a mask up close. The builder's own `beard` shading is almost
   invisible (`beard-fullBeard-vs-beard.png`). A beard needs strand cards with a soft alpha edge.
3. **Marcus's scar** isn't built (it needs `face.ts` or `skin.ts`).
4. **The hands' missing sleeves and accessories,** listed below.
5. **No driver body in the car.** The hood and chase cameras show only the arms.

## For the session that owns `src/preview/hands*` (not edited here)

- **Hand-over-hand at full lock.** The hands turn rigidly with the rim and read right only to about ±1 rad.
  `PlayerCar` now limits the drawn wheel to 1.05 rad. A shuffle would let it turn to the real lock (±2.2 rad).
- **Sleeves and wrist pieces the six need:**
  - a canvas work-jacket cuff with a plain button (Mateo),
  - a blazer cuff with no shirt cuff showing (Leila),
  - a short sleeve ending above the elbow (Marcus),
  - a bomber's ribbed cuff on a plain sleeve, with no patch (Jas),
  - an elastic hair tie on the right wrist (Jas).

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

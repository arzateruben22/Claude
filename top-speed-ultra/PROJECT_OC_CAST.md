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
- **Stage 4, done (code; frames from cast-seat):** `hands-acc.ts` gains the outfits `workcuff` (Mateo), `blazer`
  (Leila), `short` (Marcus), `bomber` (Jas) and `look.hairTie` (Jas, on the right wrist), behind new values only. The
  six are wired to them through the catalog. The regression check asserts each.

**In progress:** nothing is half-built.

**Next (in order), as of the Opus continuation:**
1. **Stage 3, still open:** these need the builder's geometry (`head.ts`, `hair.ts`, `body.ts`, `garments.ts`), which
   is Fable-class work.
   - The faces' own shapes against the sheets (Mateo's broad jaw, Danny's slim face, Jas's youthful face).
   - The cheek and jaw hollows that shade as smudges.
   - Leila's waves and Danny's side part as layered locks, not a helmet. Chadaline's long hair, and Chad's curls.
   - The shoulders' slope, the ballooning outer sleeves, and Marcus's muscle (he is at the parameters' maximum).
   - Collars and lapels on the six. Mateo's jacket worn zipped.
   - Shoes that read from the front.
2. **Stage 5:** the results are in the progress log entry "2026-11-12: The cast graphics pass (Opus continuation)":
   the perf pairs, the base's phone group and the suite lines.

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
  - (2026-11-12) Marcus's eyebrow scar is now built (`Look.scar 'browR'`). The hands' missing sleeves are now added
    in `hands-acc.ts`, additively, as agreed with its owner: `workcuff`, `blazer`, `short`, `bomber` and
    `look.hairTie`.
  - There is no driver head or torso model in the car. From the hood and chase cameras, only the arms show through
    the glass.

### Mismatches (recorded, not blended)

- **Marcus's scar** is on his right eyebrow in both images. The brief's text says left. We follow the images. Built
  2026-11-12 as a pale line up through the right brow. The front face sheet also shows a fainter mark above the left
  brow, which is not built.
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

Seen in `tests/out/cast/pack-chad-*-fx.png` and `pack-chadaline-*-fx.png` (2026-11-12, after the Opus pass):

- **Not yet the best-looking characters in the game.** They read as their outfits at a distance, but up close they are
  the builder's stylised faces, not the sheets' people.
- **Chad:**
  - The jacket's sleeves are still fuller than the sheet's tailored sleeve. Two changes made them a little slimmer: a
    smaller shoulder pad that stops at the shoulder point, and a jacket shell of 9.5 mm instead of 12.5 mm.
  - His head is still small for the shoulders, at 7.5 heads (it was 7.8).
  - The curls are a dense, rounded mass with a ragged lower edge over the forehead. They don't yet show the sheet's
    loose, lighter-tipped curls.
- **Chadaline:**
  - Her hair is the weakest part:
    - the long hair is a cap with a hanging curtain;
    - beside her face, thin strand cards still let the background through in places;
    - the top is flat, and the waves and volume of the sheet aren't there.
  - The curtain now comes forward past the ears (`front` 0.08), and the cards are wider (0.034 m) with the same card
    count, so the gaps are fewer. Her LOD 0 is close to the budget (89,325 of 90,000 triangles), so more cards are not
    an option without a cheaper curtain.
  - The fur shrug now reads as one fluffy sleeve with soft tiers (rolls 3.8 cm apart, blended), not a stack of tyres.
    The band across the back still shows separate rolls.
  - The stilettos read as stilettos from the side. From the front they read as low pumps.
- **Both:** the shared face defects of the six apply to them too: generic face shapes, and the shading of the cheek and
  jaw hollows.

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

## Highest-impact remaining visual defects (honest, updated 2026-11-12 after the graphics pass)

1. **The faces are still far from the sheets.**
   - The builder's faces are generic.
   - Shading in the cheek and jaw hollows reads as dark smudges, on the women too (Kate's
     `compare-kate-morgan-head-fx.png`). It is the head's geometry and lighting, not a mask (`head.ts`, `skin.ts`),
     and is Fable-class work.
2. **The hair.** Leila's and Danny's hair still reads as a helmet. Chadaline's long hair is a cap with a curtain. Chad's
   curls are a dense mass.
3. **The bodies.**
   - The shoulders slope.
   - The sleeves balloon on the outer layers (Mateo's jacket, Chad's suit jacket, Kate's shirt).
   - Marcus doesn't read as clearly muscular: he is at the builder's maximum muscle and shoulders, so this is
     `body.ts`.
4. **The shoes** are flat slippers from the front (Mateo's boots, Kate's deck shoes, Chadaline's stilettos from the
   front).
5. **No driver body in the car.** The hood and chase cameras show only the arms.

Fixed in this pass:
- the full-beard box (now strand-card beards);
- the grey speckle;
- Marcus's scar;
- the leggings look of the trousers (`Garment.leg`);
- the hands' sleeves.

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

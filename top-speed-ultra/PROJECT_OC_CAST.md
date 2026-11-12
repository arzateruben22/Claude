# Project OC: the cast (six playable characters)

The owner asked (2026-11-11) for six characters to choose from, three men and three women, built from reference
sheets they generated; that the chosen character be the driver everywhere; that the six be the only looks for the
venues' people; a future two-character pack prepared but not sold; and (5:45 PM) that the wheel, the characters and
the first-person view with the arms look as good as possible and run smoothly. This file is the catalog, the asset
status, what lane "cast A" changed and how it was checked. The progress log has the dated entry.

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

## The future two-character pack (scaffold only)

- **The store entry.** `src/store/catalog.json` has `cast-pack-duo`, a pair (one man, one woman). It is
  `available: false`, with one configurable `price_cents` (500, a placeholder). Its caveat says the final price is
  undecided ($5 or $10 for the pair). It is synced to the server catalog.
- **The cast catalog.** `CAST_PACK` in `cast.ts` has the `pack` unlock category and no identities.
- **Kept out of play.** `pickable()` adds pack identities only when owned. The crowd takes only `base`.
- **The store stays in test mode.**

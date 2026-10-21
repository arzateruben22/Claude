# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

## 2026-10-21: ST2, the Ultra graphics tier as a test-mode entitlement SKU (branch `claude/store`, not committed)

Built on ST1 (`7a5a856`). Decision 15 makes Ultra the paid graphics tier, as an entitlement flag only; Low and HD are
free. This pass sells it as the sku `graphics-ultra` in test mode. Nothing in this branch can charge anyone:
- The store is in test mode, so it takes only the 4242 test card.
- Live Stripe keys refuse the sku while its grant is `hook`, and the server test proves it.
- No live keys exist.

`claude/modes` (read at `1af99e2` with its uncommitted RS1 edits) still has no Ultra flag, so the flag stays in
`src/store/entitlements.ts`. The Opus queue line in `PROJECT_OC_HANDOFF.md` says how RS2 picks it up.

**What it is.**
- **Catalog.** `catalog.json` gains `graphics-ultra` "Ultra Graphics": kind `graphics`, $5 (a proposal, TODO
  owner), one-time, no window, no number. Its copy is one line: "The maximum graphics tier. Low and HD are free."
- **Entitlement.** `cosmetics.json` gains the entitlement `graphics-ultra`: type `graphics`, tier `ultra`, free tiers
  Low and HD, status `hook`. The free baseline now lists every graphics setting but Ultra.
- **Server.** `npm run store:sync` copied the sku to the server. Nothing else changed there:
  - `create-checkout` sends it as a `price_data` line at the server's price.
  - `stripe-webhook` grants it, and a refund revokes it, like any sku.
  - It's a row in 0001's `entitlements` table, under the same row-level security, so it needs no migration.
    `rls-probe.sql` now probes it.
- **Who has Ultra** (`ultraState()` in `entitlements.ts`):
  - `test`: any test-mode build, for everyone, bought or not.
  - `owned`: the account holds the grant.
  - `owner`: owner mode is on. `ownerMode()` reads `#owner` and the saved `owner` setting, the switch
    claude/hypercar adds; this branch's settings don't have it yet.
  - `free`: a live build where the sku can't be bought yet. It needs to be available and `ready`, the server's
    live-key rule. A tier is never locked before it can be bought.
  - `locked`: anything else.
  - ST1's `ultraUnlocked()` would have locked Ultra in a live build with no way to buy it. This rule replaces it.
- **The gate.** `gateQuality()` and `App.tsx`'s `gated()` draw a saved Ultra as High while it's locked, and keep the
  saved choice. A purchase, Restore purchases, a refund, signing out or `#owner` re-checks it on the store's change
  event. The picker's Ultra button opens the Store while Ultra is locked. In a test build the gate changes nothing.
- **Restore at boot.** A signed-in live build reads the account's rows once at boot. That was §12's optional
  hardening; Ultra needs it because it works outside the Store.
- **Store and settings copy.** The store shows an Ultra card under "Graphics", with the test-mode notice under its
  price. A state line says who has Ultra on this device. The checkout sheet says "Graphics only: it changes nothing
  about how any car drives, scores or earns. Low and HD are free." The receipt points to Settings → Display →
  Graphics. The settings screen has one line under the picker for each state.
- **Checker.** `tools/store-check-catalog.mjs` adds the Ultra rules: one graphics entitlement, tier `ultra` with
  free tiers Low and HD, its id equal to `ULTRA_ENTITLEMENT`, granted by the Ultra sku alone, and copy that says
  "Low and HD are free".

**Verified** (2026-10-21, load average 40 to 48 from the other lanes; logs in `tests/out/`, names `store-st2-*`):

- `npx tsc --noEmit` is clean (`store-st2-tsc.log`). `npm run build` is clean (`store-st2-build.log`): its own
  `tsc -p tsconfig.game.json`, Vite and the single file. The bundle holds no `sk_`, `rk_live`, `whsec_` or
  `service_role`, and no "nothing is scored".
- `npm run store:check`: 23 skus, 12 available, 46 entitlements, and the server copy in sync, with 0 skus whose
  grants are all ready. On scratch copies, 12 of 12 planted catalogs came out as expected
  (`store-st2-check-planted.log`):
  - This branch passes.
  - These fail: Ultra as tier `hd`; free tiers without HD; the Founder Pack also granting Ultra; the Ultra sku also
    granting a paint; the sku as a subscription; the sku in the founder window; copy without "Low and HD are free";
    the flag renamed in `entitlements.ts`; a second, paid HD tier; Ultra at $4.99; and Ultra marked `build` while
    available.
- The entitlement test, `node server/supabase/tests/ultra-entitlement.mjs`, passed **17/17**
  (`store-st2-ultra-entitlement.log`). It runs the real `create-checkout` and `stripe-webhook` against Postgres 16
  with both migrations. A stand-in for PostgREST runs a player's requests as `authenticated` under row-level
  security. The game's own `src/store` code is bundled live, against that stand-in, and in test mode. It shows:
  - Test keys put it on sale. Live keys refuse it (409) with no Stripe call.
  - The checkout line is the server's $5.00, with the page's price fields ignored, `mode=payment` and the player's
    id.
  - No sign-in, an under-13 profile and an unticked 18-or-guardian box are refused.
  - The webhook grants it once across redeliveries, with no serial. A second checkout is refused: "already have
    everything".
  - **Restore**: the boot read and Restore purchases on a second device bring it back. Another account restores
    nothing of it.
  - **Revoke**: a refund revokes the row, and Restore takes it off the device. A player can't undo the revoke or
    grant it to themselves, and an anonymous visitor reads nothing.
  - **Grant again**: buying it again restores the row, and refunding the Coast Paint Pack leaves Ultra in place.
  - With the go-ahead (the bundle patched to `ready`), an account without it is `locked` and draws High.
  - Owner mode grants it through `#owner`, the saved setting or `{ owner: true }`, and `#owner=0` doesn't.
  - As the catalog is (`hook`), a live build keeps it `free`.
  - In test mode, 4242 grants it at $5.00 with a test receipt. A declined card and a real card grant nothing.
    Signing out and in restores it, the card number isn't stored, and no request goes to Supabase or Stripe.
  - A planted bug (the `locked` state removed) failed 3 of the 17 checks, as it should. The file was restored from
    a copy.
- `server/supabase/tests/run-local.sh` ran as the postgres user (`store-st2-rls.log`). Both migrations ran twice,
  and every earlier probe answered as before. For `graphics-ultra`:
  - A sees none of B's rows. A's insert, their attempt to take B's row, and a fake purchase are refused. B
    restores theirs.
  - After the refund, B's attempt to clear `revoked_at` is refused, and 0 live rows remain.
  - An anonymous read is refused.
- `node server/supabase/tests/serial-webhook.mjs`: 24/24 (`store-st2-webhook.log`).
- `npm test -- --only=boot,progression,store` on the final build passed **31/31** (`store-st2-suite.log`): boot
  6/6, progression 5/5, store 20/20. The new store checks:
  - The Ultra card: $5, the notice, the one line, the test-build line, and the lede.
  - Buying Ultra with 4242: a $5.00 test receipt, "Owned", and Restore purchases keeps it.
  - Settings at 1280 × 720: the picker reads Low / Medium / High / Ultra, with the `owned` line.
  - The phone check, extended: the Ultra card and the settings screen at 390 × 844 (`test` line), with no
    sideways scroll.
  - The 1280 notice check now includes the Ultra card.
- STORE_LIVE_RESULT
- Screenshots, each one looked at:
  - `store-ultra-1440x900.png` and `store-ultra-card-1440.png`.
  - `store-ultra-1280x720.png` and `settings-ultra-1280x720.png`.
  - `store-ultra-390x844.png`, `store-ultra-card-390.png` and `settings-ultra-390x844.png`.
  - On every one, the price has "Test mode · nothing is charged" right under it. The settings line sits under the
    Graphics picker, and nothing overflows at 390.

**Not run here.** Anything that needs the owner's accounts: a real Supabase project (its Auth, PostgREST and
row-level security under Supabase's own roles), the functions deployed on Deno, and Stripe test-mode Checkout with
real webhook deliveries. The entitlement test runs the real function code under Node with its types stripped,
against a stand-in for PostgREST and a stub of Supabase's roles and `auth.uid()`.

**For the owner, before Ultra is sold live** (`PROJECT_OC_MONETIZATION.md` §12):
- The price ($5 is a proposal).
- The edit to `CLAUDE.md`'s "everything the game has today stays free", which covers today's Ultra preset.
- Whether earlier Ultra users keep it.
- Whether Ultra's longer draw distance in the scored modes is acceptable (§3): 2.4 km against High's 1.8 km.

Then `graphics-ultra` goes to `ready`.

**For the merge.**
- This branch's settings still show Low, Medium, High and Ultra. The store's "Low and HD are free" matches once
  RS2's three modes land.
- `App.tsx` will conflict with the live preview and with `claude/modes`. Keep `gated()` where settings reach the
  game, the picker's Ultra lock and the `.ultra-note` line.
- `launch-kit/store.html` still lists the 11 launch items without Ultra: a follow-up.

## 2026-10-21: ST1, the Founder Edition SKU finished in test mode, and the catalog check accepts a car's own wheel (branch `claude/store`, committed)

This pass continues from the edits on disk (the two entries below, 33 changed files) and from an ST1 attempt earlier
the same night. That attempt made the checker change and the Ultra flag, then stopped when the machine restarted. Its
logs are `tests/out/store-st1-*.log`; its suite run, at a load of 35 to 40, failed on a screenshot timeout and then on
a closed browser. Nothing is committed or merged. `hypercar-founder` stays `available: false`, so nothing in this
branch can charge anyone, in test mode or live.

**The catalog check and the hypercar's wheel.** The live preview (`local/live-preview`, which holds `claude/hypercar`)
adds `'multi'` to `WheelStyle` in `src/preview/car-wheel.ts` for the OC Hypercar (`wheel: 'multi'` in `car-shape.ts`).
The old checker wanted the store's wheel styles and that type to be the same list, so the preview's suite failed with
"wheel styles twin5,five,cl10,aero differ from car-wheel.ts twin5,five,cl10,aero,multi". `tools/store-check-catalog.mjs`
now checks three things:

- Every store style (`cosmetics.json` `wheel_styles`) is in the type.
- A style in the type that the store doesn't list is valid only while a car in `car-shape.ts` wears it as its factory
  wheel (a car-only style), and no paid wheel setup may use it.
- A style no car wears and the store doesn't list fails: a style forgotten in `cosmetics.json`, or a dead one in the
  code.

It reads `src/preview/`, where every lane keeps these files today, or `src/game/vehicle/` if they move. This pass also
makes the factory-wheel match accept a `wheel:` that ends its line or object (`wheel: 'multi' }`); the type's own line
still doesn't count. `cosmetics.json`'s note and the checker list in `PROJECT_OC_MONETIZATION.md` say the same.

**The Ultra flag (decision 15).** `claude/modes` (read at `1af99e2` with its uncommitted RS1 edits) has no Ultra
entitlement yet. This branch defines it the way the Founder Edition's car is defined: `ULTRA_ENTITLEMENT =
'graphics-ultra'` and `ultraUnlocked({ owner })` in `src/store/entitlements.ts`. It's an entitlement only the server's
webhook could grant, read with `has()`, and owner mode and any test-mode build unlock it. No sku grants it and it has
no price, so nothing can sell it. The id is `graphics-ultra`, not `ultra`, because `settings.ts` already uses `ultra`
for Ultra Realism (the level-5 tunnel vision). One line in `PROJECT_OC_HANDOFF.md`'s Opus queue tells RS2 to read it.

**The store's suite under load.** Three changes in `tests/regression.mjs`, in the store group only. No assertion
changed.

- The store group holds the game's frame loop while it checks the store's UI. `holdGame` cancels the game's
  `requestAnimationFrame` through `window.__game`, and `resumeGame` starts it again. At a load of 45 to 50 (nine
  headless browsers on four cores), the game drawing behind the panel made a screenshot run past 240 s and a click
  past 120 s. With the loop held, the store-opening check took 76 s instead of 286 s at the same load.
- The Founders Sunset check makes the menu's two clicks with the loop held. It runs the loop until the chase camera
  has drawn six frames, then holds it again for the shot and for "Share run" (the run card is a 2D canvas of its own).
- The store group's screenshots and the run card's download get the frames' allowance (`FRAMES_MS`, 240 s) instead of
  120 s and 90 s.

**One layout fix.** The previous attempt's `Price` in `Store.tsx` puts the test-mode notice under every price. That
makes a narrow item card wrap the price under the name, where it sat mid-card at 1280 and 390. `.store-pricebox` now
keeps it at the card's right edge (`margin-left: auto`).

**Verified** (2026-10-21, load average 33 to 50 from the other passes; logs in `tests/out/`, `st1b` names):

- `npx tsc --noEmit` is clean (`store-st1b-tsc.log`, the final files). `npm run build` is clean
  (`store-st1b-build2.log`, the final files). The bundle holds no `sk_`, `rk_`, `whsec_` or service-role key and no
  "nothing is scored".
- The checker (`store-st1b-check.log`):
  - `npm run store:check` passes on this branch: 22 skus, 11 available, 45 entitlements, 4 store wheel styles, and the
    server copy in sync.
  - On scratch copies, 11 of 11 came out as expected. These pass: this branch's catalog with this branch's code; with
    the live preview's `car-wheel.ts`, `car-shape.ts` and `cars.ts` ("car-only multi"); with those files moved to
    `src/game/vehicle/`; with `multi` also listed as a store style; and with the hypercar's wheel written last on its
    line.
  - These fail: a style no car wears; `multi` left in both types after the hypercar stops wearing it; a paid setup
    using `multi`; `multi` listed but missing from this branch's type; `aero` removed from the type; and the hypercar
    sku `available: true` with its grants still `build`.
  - The ten planted catalogs from 2026-10-19 (the $4.99 exception, the founder window, exclusives, numbering) behave
    as before: 10 of 10.
- `node server/supabase/tests/serial-webhook.mjs` passed 24/24 (`store-st1b-webhook.log`). That includes "a refund
  retires No. 0001, clears it from the row and takes the car back", "a retired number is never reissued: the next sale
  is No. 0003", and the three cases the review reproduced: one live number per player, a refund before its
  completion, and a refund racing the numbering both ways round.
- `server/supabase/tests/run-local.sh` ran as the postgres user (`store-st1b-rls.log`). Both migrations ran twice.
  Every player and anonymous write or call on 0001's and 0002's tables and functions was refused. A refund retires the
  number and clears it from the row.
- The Ultra flag (`store-st1b-ultra-flag.log`) was checked on esbuild bundles of `entitlements.ts` in a scratch folder,
  with fetch refused. A test-mode build unlocks it with no grant. A live-mode build doesn't, unless owner mode is on or
  the account holds `graphics-ultra`. No request was made.
- `npm test -- --only=boot,progression,store` on the final build (`store-st1b-suite3.log`, 33 min at a load of 44 to
  50): boot 6/6, progression 5/5, store 16 of 17. The one failure was the Founders Sunset run card: the "Share run"
  click ran past 120 s with the game drawing behind the result screen. That check then got the hold described above,
  with only the test file changed and the same build. After that, `npm test -- --only=store` passed **17/17** in
  1123 s at a load of 49 to 50 (`store-st1b-suite4.log`).
  - Two earlier runs on the way: `store-st1b-suite.log` hit two screenshot timeouts and two click timeouts before the
    hold, and was stopped by hand. `store-st1b-suite2.log` passed 27/28; the run card's 90 s download wait failed.
- Screenshots, each one looked at:
  - At 1280 × 720: `store-1280x720.png`, `store-hypercar-1280x720.png` and `store-items-1280x720.png`.
  - At 390 × 844: `store-390.png`, `store-hypercar-390x844.png`, `store-items-390x844.png` and
    `store-checkout-390.png`.
  - Also `store-hypercar-card-1440.png`, `store-checkout-1440.png` and `store-founders-sunset-chase.png`.
  - Every price has "Test mode · nothing is charged" right under it, and the wrapped prices sit at the card's right
    edge. The suite measures this: all 12 prices at 1440, 1280 and 390, and the checkout sheet's price at 1440. The
    hypercar card says "Coming soon", "No pre-orders" and "Sold until Dec 31, 2026", with no quantity and no "never
    again".

**Not run here.** Anything that needs the owner's accounts: a real Supabase project (its Auth, PostgREST and
row-level security under Supabase's own roles), the Edge Functions deployed on Deno, and Stripe test-mode Checkout with
real webhook deliveries. The serial test runs the real `stripe-webhook` code with its types stripped by Node. It runs
against Postgres 16 behind a small stand-in for PostgREST, and it answers Stripe's refund and session calls itself.
`run-local.sh` uses a stub of Supabase's roles and `auth.uid()`. This pass didn't run the render group; the render
line in the 2026-10-19 repair entry below comes from that run's own log.

**For the merge with the live preview.** The store files there are this branch's committed `bb798e0`, except
`src/game/profile.ts`, which will conflict. The live preview's `buy` and `sell` refuse `oc-hyper` by id, and this
branch refuses any store-only car (`storeOnly`) and keeps it outside the slot count: keep both. The store suite's sell
check accepts either message ("can't be sold for credits").

## 2026-10-19 (later): the hypercar store change, repaired after two reviews (branch `claude/store`, not committed)

Two reviews of the entry below (integrity and business) rejected it. The server, serial, entitlement and checker
work stood; three serial cases broke "a refunded number is retired", the checker had gaps, and some copy wasn't
true. This pass fixes each point as the reviews asked. Still not committed or merged; the SKU stays `available:
false`.

**Server (migration 0002, `stripe-webhook`).**

- **A refund racing the numbering (P3).** `assign_serial` now locks the purchase row (`select ... for update`)
  before it reads the status. A refund written at that moment either commits first, and `assign_serial` refuses
  ("refunded, not paid"; the webhook answers 500 and Stripe retries), or it waits until the number is issued and
  its trigger then retires it. A completion that reads back a refunded purchase now also takes back what a racing
  delivery granted.
- **A retired number on the plaque (P1).** The refund trigger now resets the player's entitlement rows for that sku
  to their lowest live number, or to none. A second paid purchase by a player who already holds a live number (two
  checkouts opened side by side) is refused inside `assign_serial`: marked `refused`, never numbered, and refunded
  in full (idempotency key `founder-duplicate-<session>`; a retry re-asks with the same key). The client's
  "refused" message now names both reasons.
- **A refund delivered before its completion (P2).** `charge.refunded` with no matching purchase no longer answers
  "ignored". It looks up the Checkout Session at Stripe (`GET /v1/checkout/sessions?payment_intent=`) and records
  the purchase as `refunded`, so the completion that follows reads `refunded` and grants nothing. A charge with no
  Checkout Session is still ignored (200); a failed lookup is a 500, so Stripe retries.
- **Not built, noted for the owner** (`PROJECT_OC_MONETIZATION.md` §12, `server/README.md`): `restore()` at boot in
  live mode, and treating a lost dispute like a refund.

**Checker** (`tools/store-check-catalog.mjs`): an entitlement marked `exclusive: X` may be granted by sku X only; a
sku that grants a car (a `vehicle`) or a server-numbered item (`serial: 'server'`) must be `serial: true` and in the
founder window.

**Copy.**

- **Free Drive.** It has a score (the distance), a saved best, a device-only board and a shareable run card, so
  "where nothing is scored, timed or ranked" is gone everywhere: the catalog description, the store's two-tune line,
  intro line and terms, rule 3a and the catalog row, `cosmetics.json`, and the deck's store page. The new words:
  no clock and no rivals, your Free Drive bests stay on your device, and Unleashed runs and run cards are marked.
  The marking isn't built (the car isn't in the game), so it is now a condition for `available: true` in rule 3a and
  in the car's `needs`.
- **"Then never again"** is off the car's copy (catalog, the deck's chip and card, the doc's catalog row, the
  marketing callout) until the owner decides what it covers. "Sold until December 31, 2026" stays, and so does the
  open decision in §12. The Founder Pack's own "then never again" is unchanged.
- **"Never power"** now reads "never pay-to-win" with the exception named, in `launch-kit/index.html`, `plan.html`,
  `marketing.html` and `store.html`, `PROJECT_OC_MARKETING.md` (the four places) and `PROJECT_OC_LAUNCH_90.md`. Each
  notes that the exception still waits for the owner's edit of `CLAUDE.md`. `CLAUDE.md` itself is not edited.
- **"Every freeway, mode and car stays free"** now says "every car you can earn": the store intro (which no longer
  calls everything "Optional looks" while the car's card shows), the under-13 lines, the main-menu tile, the
  ambassador answer in `PROJECT_OC_MONETIZATION.md` and the deck's under-13 line.
- **The Founder Ice swatch** sits right beside the paint's swatch, not on its own at the end of the line, where at
  1440 it read as a fourth item.

**Verified** (2026-10-19, load average 3 to 8 from other passes; logs in `tests/out/`, `-r2` names):

- `node server/supabase/tests/serial-webhook.mjs`: **24/24** (`store-hypercar-webhook-r2.log`). The 17 earlier
  checks plus 7 new: a second purchase refused and refunded with one key, never numbered; its refund leaves the
  first number on the plaque; two live numbers (planted as the old webhook issued them) go back to the lowest, then
  to none; a refund before its completion leaves nothing granted or numbered; a charge with no session is ignored
  and a failed lookup is a 500; a refund held open while `assign_serial` runs (it waits 2.0 s, then refuses); an
  `assign_serial` held open while the refund arrives (the refund waits 2.0 s, then retires the number). The earlier
  refund check now expects the row's number cleared. The same file against the **pre-repair** migration and webhook
  (a scratch copy): **16/24**, failing exactly on P1, P2 and P3 (`store-hypercar-webhook-oldcode-r2.log`).
- `server/supabase/tests/run-local.sh`, as the postgres user: both migrations twice; `rls-probe.sql` now probes 0002
  too. A player reads only their own number; as that player, 8 writes and calls on `serials`, `serial_counters`,
  `entitlements.serial`, `assign_serial` and `retire_serial` are refused, and as an anonymous visitor 6 are; a
  refund retires the number and clears it from the row (`store-rls-r2.log`).
- The checker on planted catalogs in a scratch copy of the files it reads (`store-hypercar-check-r2.log`): with
  `oc-hyper` simulated in a scratch `cars.ts` and its grants `ready`, dropping `serial`, a new $3 sku with no window
  granting `car-oc-hyper`, the Coast Paint Pack granting it, a second numbered sku granting it, and the Coast Paint
  Pack granting the plaque each exit 1; the simulated car alone exits 0. A 498-cent hypercar, a 499-cent Coast Paint
  Pack and `available: true` without the car also exit 1. `npm run store:check` passes on the real files.
- `npx tsc --noEmit` and `npm run build` clean (`store-hypercar-tsc-r2.log`, `store-hypercar-build-r2.log`). Both
  Edge Functions also typecheck strictly with a Deno shim (outside the repo). The bundles hold no `sk_`/`rk_`/
  `whsec_` key, no service-role name and no "nothing is scored".
- `npm test -- --only=store`: **16/16** in 796 s (`store-hypercar-suite-r2.log`). It ran on the build before two
  later edits that change no UI (a note in `cosmetics.json`, a deck stat); the build above is from the final files.
  Screenshots: `store-hypercar-1440x900-r2.png`, `store-hypercar-390x844-r2.png`, `store-hypercar-card-1440-r2.png`
  (the Founder Ice swatch beside the paint), `store-hypercar-card-390-r2.png`, `store-lede-390-r2.png`.
- The deck (Playwright, `deck-store-hypercar-r2.log`): no sideways scroll on the store page at 1440 or 390, or on
  the index, plan, marketing and go-live pages at 390; no page errors; the card's ice line sweeps in on reveal, is
  there at once with reduced motion and steady without JavaScript. Screenshots: `deck-store-hypercar-1440-r2.png`,
  `deck-store-hypercar-390-r2.png`, `deck-store-rules-1440-r2.png`, `deck-store-rules-390-r2.png`,
  `deck-index-rules-1440-r2.png`.
- `npm test -- --only=render` once more (`store-hypercar-render-r2.log`, load 5.0 to 6.6 at the start): **12 of 13**
  passed; "High and Ultra presets rebuild mid-drive" failed with "Target page, context or browser has been closed"
  (the browser went away under it), and the run then ended on an uncaught `browserContext.close`. Not re-run since;
  this line was left as a placeholder by that session and is filled in from its log on 2026-10-21 (entry above).

## 2026-10-19: the OC Hypercar Founder Edition in the store, "Coming soon" (branch `claude/store`, not committed)

The owner's decisions of 2026-10-16, as `PROJECT_OC_HYPERCAR.md` §11 on `claude/hypercar` specifies them: the car is
sold for $4.99, one time, in the founder window to December 31, 2026. It is still being built on that branch, so the
store shows it as **Coming soon** and nothing can buy it, in test mode or live. Built in two sessions (the first was
stopped by a usage limit part-way; the second finished it and ran every check again). Not committed or merged.

**What changed.**

- **Catalog.** `hypercar-founder` in `src/store/catalog.json`: 499 cents, one time, `serial: true`, `available:
  false` with a plain `unavailable_reason`. Both founder items name the window as `"FOUNDER_UNTIL"`, one constant in
  `src/store/founder.json` (`2026-12-31T23:59:59-08:00`, the last second of the 31st in Pacific time; a bare
  `2026-12-31` would end at 4 pm Pacific on the 30th). The store (`catalog.ts`), the server's copy (`npm run
  store:sync` writes the date and `founder_until`) and the checker all read that file.
- **Checker** (`tools/store-check-catalog.mjs`): $4.99 is accepted for that sku only; the founder window must be the
  constant; the two founder offers may share no grant and no name; a store car is sold only once it is in
  `src/game/cars.ts`, takes no slot and is never sold back; a numbered sku needs a migration that seeds its counter.
- **Entitlement.** `car-oc-hyper`, `plaque-founder-edition` and `paint-oc-founder-silver` (with Founder Ice LEDs) in
  `cosmetics.json`. `entitlements.ts` `storeCars()`/`syncGarage()` and `profile.ts` `setStoreCars()` put `oc-hyper`
  in the garage outside the slot count while the account owns it, refuse to sell it for credits, take it out on
  sign-out or refund and put it back on sign-in.
- **Serials** (server only). Migration `0002_founder_serials.sql`: a per-sku counter, a `serials` ledger, a `serial`
  column on `entitlements`, `assign_serial()` (service role only), a trigger that retires a refunded number, and
  RLS (a player reads their own number, never writes it). `stripe-webhook` asks for the number when the payment
  succeeds; `create-checkout` and the webhook both check the window (the webhook by the session's creation time).
- **Store panel** (`Store.tsx`, `styles.css`): the card in silver and Founder Ice, "Founder Edition · sold until Dec
  31, 2026", $4.99, the plaque and paint, "The $10 Founder Pack does not include this car", "Coming soon" and "No
  pre-orders".
- **Docs and deck.** `PROJECT_OC_MONETIZATION.md`: the $4.99 exception and its fees ($0.44, $4.55 kept, $4.47 on an
  international card), rule 3a (the two-tune rule, with the race-tune numbers from the plan's §5.3), the two founder
  offers kept apart, the Vela E Wheel Set caveat (also a `caveat` in the catalog), and a note that the forecast
  doesn't count the car. `launch-kit/store.html` (the card, the price row, the rules, the forecast note), `index.html`,
  `plan.html` (the $4.99 calculator preset), `marketing.html` and `golive.html` (migration 0002).

**Verified** (2026-10-19, load average 0 to 9 from other passes):

- `npm run store:check`: fails on a planted 498-cent hypercar and on a planted 499-cent Coast Paint Pack, and on a
  planted `available: true` (the car isn't in `cars.ts`); passes once restored (`tests/out/store-hypercar-check.log`).
- `npx tsc --noEmit` and `npm run build` clean (`store-hypercar-tsc.log`, `store-hypercar-build.log`).
- `node server/supabase/tests/serial-webhook.mjs`, the real `stripe-webhook` against a throwaway Postgres 16 with
  both migrations: **17/17** (`store-hypercar-webhook.log`). A retried delivery (3 concurrent, 1 later) and the
  session's second success event all keep No. 0001; a refund retires No. 0001 and the next sale is No. 0003; a
  session created a minute before the deadline and paid an hour after is honoured; one created after it is refused
  and refunded once; No. 0000 can't be issued; a player can't write, issue or reset a number.
- `server/supabase/tests/run-local.sh` (run as the postgres user): both migrations twice, every probe refused.
  **Corrected after review:** `rls-probe.sql` then probed the 0001 tables only, so "every probe refused" covered
  none of 0002's objects. The player probes of `serials`, `serial_counters` and `assign_serial` were in
  `serial-webhook.mjs` alone, and nothing probed them as an anonymous visitor or probed `retire_serial`. The repair
  below adds them to `rls-probe.sql`.
- `npm test -- --only=store`: **16/16** in 811 s (`store-hypercar-suite.log`), including the hypercar card, the
  garage grant and the webhook test. Screenshots: `store-hypercar-1440x900.png`, `store-hypercar-390x844.png`,
  `store-hypercar-card-1440.png`, `store-hypercar-card-390.png`.
- The deck (Playwright, `tests/out/deck-store-hypercar.log`): no sideways scroll at 1440 or 390; the card's top line
  sweeps in when the section is revealed, is there at once with reduced motion, and is steady without JavaScript;
  the plan's $4.99 preset reads "Stripe keeps $0.44 of $4.99". Screenshots: `deck-store-hypercar-1440.png`,
  `deck-store-hypercar-390.png`, `deck-store-prices-1440.png`, `deck-store-money-1440.png`.
- `npm test -- --only=render` once, at a load average of 6 to 9: **13/13** in 949 s (`store-hypercar-render.log`).
  "pause stops the simulation, resume carries on" passed in 94.1 s. This tree gives each 5-frame wait 240 s instead
  of 60 s (`FRAMES_MS` in `tests/regression.mjs`, set by the first session after 5 frames took up to 58.7 s under
  SwiftShader at a load of 15 to 19). No assertion changed.

**Open, for the owner.**

- `CLAUDE.md` still says "Never sell power: no faster-than-earnable cars" without rule 3a's two-tune exception. It
  wasn't edited by an agent; the suggested line is in `PROJECT_OC_MONETIZATION.md` §11.
- What "never sold again" covers (the Founder Edition's exclusives, or the car itself), owner mode in public builds,
  and the Vela E Wheel Set once the Vela E is hidden (`PROJECT_OC_MONETIZATION.md` §12).

## 2026-10-16: the launch kit: the plan, the marketing, the store in test mode and the presentation, committed

The owner's ask (2026-10-16): a 30–90 day launch plan at minimum up-front cost, free marketing to start before
launch, a presentation with animated step-by-step guides the way Lumevina's was, a paywall built Lumevina's way but
not live until Supabase and Stripe are plugged in, and realistic prices for what the game could sell. All of it is
now committed on `claude/store`, on top of `4756141` (the three documents' first drafts and the catalog). It is not
merged into `claude/always-on`, where the UI pass is still running; the orchestrator merges it later. Nothing is
deployed, and nothing can be charged: no Stripe or Supabase account is connected.

**What was made** (the two entries below have the detail):

- `PROJECT_OC_LAUNCH_90.md`, the $0 plan: 13 weeks from Day 1 (Monday, October 19), the OC-only beta on Days 1–45
  (testers from Day 15), the store on Day 46 at the earliest. Each step names who does it, its cost, the proof it
  worked and what to do if it didn't. Then the metrics, the gates, the risks, and the optional costs, each with the
  trigger that justifies it.
- `PROJECT_OC_MARKETING.md`, the free pre-launch playbook: the hook ("Drive the real 405 at sunset, on your phone"),
  three clips a week, the waitlist, the press, OC communities and car meets, and the unpaid Founders crew with the FTC
  disclosure.
- `PROJECT_OC_MONETIZATION.md`, what the store sells and why. At launch, 11 items: the Founder Pack ($10, sold until
  December 31, 2026), two paint packs, four wheel sets and three driver styles at $3 each, and a pay-what-you-want tip
  from $2. Body kits ($5), the Lot 57 hangout outfits ($3; the owner's "get out like a Sims character and go to Golden
  Road" idea, planned as our own fictional taproom, free to visit, and the store never names Golden Road), the
  Rossini GT Spider ($5), a
  livery pack ($5) and a club ($3 a month or $30 a year) are in the catalog as `available: false`. None can be sold
  until it exists in the game.
- The store and paywall in test mode: `src/store/`, `src/ui/Store.tsx`, `server/` (the migration, the
  `create-checkout` and `stripe-webhook` functions, the go-live README), `.env.example`, the secrets lines in
  `.gitignore`, and the new store rule in `CLAUDE.md` in place of "no real money".
- The presentation in `launch-kit/`: the hub, the 90-day plan with its calculator, the marketing guides, the store
  demo and the go-live guide.

**The money, plainly.** Over 90 days, with 200 to 3,000 players reaching the menu and 1–3 % of them buying, the
store brings in about $12 to $660 after fees (`PROJECT_OC_MONETIZATION.md` §7). The plan's simpler arithmetic gives
$0 to about $850, most likely under $100. Against the plan's full optional spending list (about $280), the low and
middle cases lose money. A California LLC's $800 yearly tax would sink all three. Expect little or no profit.

**Fact-checked.** Each document had two adversarial passes on 2026-10-16, by web search. Direct page loads to
stripe.com, supabase.com and Google's help pages were refused from this machine, so those figures come from search
summaries, and each document cites its sources with their dates. By the passes' own counts they made 17 corrections
to the monetization document, 24 to the plan and 34 to the marketing document. Among them:

- Stripe's second $15 fee for contesting a dispute.
- The .com price, about $11.17 from 1 Nov 2026 (Verisign's $10.97 plus ICANN's 20¢).
- The FTC penalty, kept at $53,088 for 2026.
- "Early access" as a material connection: 16 CFR 255.5, not 255.0(e).
- SB 122: signed 29 Jun 2026, with draft CDTFA rules of 1 Sep 2026.
- The scope of the Supreme Court's grant in Epic v. Apple: the contempt finding.
- The Founder Pack's nine paints, all still "hook".
- The build size: 3.5 MB with the store.

The paywall had an independent check of its own (typecheck clean, the store group 13/13), and the reviewer kept it,
with fixes recommended before live mode; those belong to the Fable review queued in `PROJECT_OC_HANDOFF.md`. The
presentation was reviewed and kept. For this commit I changed four dated "uncommitted" notes (three in
`PROJECT_OC_LAUNCH_90.md`, one in `PROJECT_OC_MARKETING.md`) to say the files are committed.

**Checked for this commit**, in the `tsu-store` worktree. No other pass ran in this worktree, but three other passes'
renders and suites shared the 4 cores (load average 9 to 18 while the suite ran):

- `npx tsc --noEmit`: clean, exit 0 (`tests/out/commit-tsc.log`).
- `npm run build`: clean, exit 0. The single file is 3,371 KB of JS and 49.4 KB of CSS (`tests/out/commit-build.log`).
- `npm run store:check`: "catalog ok: 21 skus (11 available), 42 entitlements" and "server catalog in sync: 21 skus,
  11 available, 0 with every grant ready".
- The full suite, `npm test` (`tests/out/commit-suite.log`, 01:25 to 02:39 UTC), exit 1. Its last lines, exactly
  as printed: "77/78 passed. Failed:" and "pause stops the simulation, resume carries on: page.waitForFunction:
  Timeout 60000ms exceeded." By group: boot 6/6, interchanges 7/7, survival 7/7, race 6/6, abilities 4/4,
  progression 5/5, render 12/13, phone 5/5, launch 5/5, store 13/13, store-live 7/7.
  - The failure is a time-out, not a wrong value. The check waits at most 60 s for 5 frames (`frames()`, unchanged
    on this branch), and the load average was 13 to 14 at the time. The render group's other checks took 41 to 83 s
    each, and the context-loss check took 454 s.
  - Rerunning the render group alone (`tests/out/commit-render-rerun.log`, 02:39 to 03:00 UTC, load 11 to 18)
    passed that check in 32.3 s. Then the next check, "reset puts the car back on the road, stopped", timed out in
    the same 5-frame wait (it had passed in the full run, in 64.7 s). That run printed "12/13 passed." Each of the
    two checks passed in the seven earlier logged runs I found, in this and the other worktrees.
  - Why I don't think it's the store: the store adds no per-frame work. Its only timers are the test-mode waits
    inside a purchase or a sign-in, and the paint hook runs only when a store item changes. With no store paint,
    the car gets the same paint material as before. The two checks don't touch the store. Not proven on an idle
    machine: no quiet window came up while I worked. Rerun `npm test -- --only=render` when the other passes are
    idle.

**Open: the owner's decisions.**

- **Prices.** Every price in `catalog.json` is a proposal (TODO, owner).
- **The Founder window.** It ends 2026-12-31 23:59:59 Pacific (Day 74). Sales start on Day 46 (Thursday, December 3)
  at the earliest, so the window is about four weeks. If Day 1 moves, decide before sales start: keep December 31 (a
  shorter window, and the '26 on the badge stays true), or move the end with the calendar. Never extend it once
  sales start.
- **Two kinds of Founders.** The business draft promised the 45-day testers a free "Founders" badge, and the plan
  (B6) puts the unpaid crew's names on the Founders credits. The Founder Pack sells a Founder '26 badge and a place on
  the Founders roll. Decide how the free and the paid Founders differ.
- **Founders Sunset.** The pack's exclusive paint (#E8622C pearl, "never sold again") is close to Newport Sunset
  (#E2603A gloss, in the $3 Coast pack; ΔE76 about 8). Change one of them, or the exclusive may read as hollow.
- **The Rossini GT Spider** ($5, also earnable for credits). Paying skips its credit price. That isn't power, but it
  is in tension with "never sell credits". Make it money-only or credits-only.
- **No upgrade price.** A paint-pack buyer who later buys the Founder Pack pays twice for those paints. The checkout
  refuses only a buyer who already owns everything in it. The cart isn't built either, so each item pays its own 30¢.
- **A hypercar.** The session's task list names a "Hypercar Founder Edition … fastest car" and a "$4.99 OC Hypercar
  Founder Edition SKU on claude/store". Selling a car faster than the earnable ones breaks "never sell power". No
  such SKU is in this commit. The owner should settle this before one is added.
- **The store in a public test-mode build.** Hide it, or show it as a labelled demo. Marketing clip 1.1's copy
  depends on the answer.
- **The trademark check.** The Rossini Notte, Rossini Ora and Vela Pulse watches: Zhuhai Rossini filed a ROSSINI
  mark (serial 79148981, status unchecked), and HiFuture sells a VELA smartwatch. Run the USPTO class 14 search and
  rename the watches before those styles sell. "Top Speed" is T-Bull's racing game, so keep it out of tags (plan F2).
- **The first real-phone run.** Nothing in this kit has run on a real phone. Gate 0, and every post with a link, wait
  for it.
- **The seller** (TODO): an individual or an LLC, the support email, Stripe's statement descriptor, the domain, the
  Orange County name filing and the city business licence, and a lawyer's look at the terms, the refund and privacy
  policies, and the club's terms.

**Verify at launch** (each document lists its own, with sources):

- Stripe's fees and its $15 dispute fees (third-party sources only).
- Supabase Free's limits and its mailer cap (2 or 3 an hour); Resend's 100-a-day cap.
- Google Play's fees and its Epic settlement (pending court approval).
- Apple's US link-out commission (in court; Supreme Court argument targeted for January 2027).
- Texas SB 2420.
- SB 122's final CDTFA rules, before 1 January 2027.
- The B&P 17602 notice windows.
- Whether a minor can disaffirm a single in-game purchase, and whether AB 2426 reaches in-game cosmetics.
- The FTC penalty, again in January 2027.
- Each subreddit's rules, on the morning you post; each car meet, with its organiser.
- The radio call signs KCST, KFWY and KNYN. KFWY is a defunct Washington AM call sign.

**Left inconsistent, for their owners:**

- `PROJECT_OC_MONETIZATION.md` §7 still uses a $10 domain and "about $280". The plan and its calculator use $11.17.
- §9 names `orders` and `refund_requests`. The built schema has `purchases` and `entitlements`, and no refund
  table.
- The built `waitlist` table takes the full 5-digit ZIP, but the plan's F6 says only "in OC: yes/no" and the first
  three digits are stored. This is a privacy point for the Fable review.

## 2026-10-16: the launch presentation (`launch-kit/`, branch `claude/store`)

The owner's ask for "a whole presentation with animated step-by-step guides", built Lumevina's way as a small site
in `launch-kit/`: `index.html` (the hub: the OC sunset wordmark, "OC Ultra" with "Top Speed" beneath, a "Try this
first" strip and a link to the test build), `plan.html` (the 90-day plan: the four phases as one road of 35 steps,
the release routine, the 13 weeks, the metrics, the gates and risks, and the money calculator), `marketing.html`
(the hook, the 8-week clip calendar, five guides: clips, the waitlist, the press, the Founders crew with the FTC
disclosure, posting day; templates with copy buttons), `store.html` (what stays free, the 11 items read from
`catalog.json` and `cosmetics.json` at build time, a test-mode checkout demo, later items, the rules, the money) and
`golive.html` (`server/README.md`'s ten steps with the migration and every command ready to copy). Every guide has a
road rail, a car that drives step to step, Next, Back and optional auto-play. Nothing is deployed or committed; the
orchestrator publishes it as one artifact. Total 556 KB with the two wordmark images.

**Checked** (headless Chromium through Playwright, from `file://`):

- Every page at 390 × 844 and 1440 × 900 (`tests/out/deck-<page>-{phone,desktop}.png`): no horizontal scroll, no
  page or console errors, the Google Fonts faces loaded.
- The store demo follows `src/store/payments.ts`: 4242 succeeds and grants all 12 Founder Pack items; 4000 0000 0000
  0002 is declined and grants nothing; a valid non-test number (4111…) is refused; a bad Luhn number, a past expiry, a
  missing age, a bad email and a missing 18-or-guardian tick each give the game's own message; a $1 tip is refused;
  a car's wheel set needs that car "earned"; Use Founders Sunset repaints the preview car. No card number is stored.
- The plan calculator matches the plan's §7.3 table ($846.90 at 3,000 players, 3%, $10).
- With JavaScript off, every step and catalog card is visible; with reduced motion, nothing animates.
- The copy buttons fall back to selecting the text when the clipboard is refused (headless refuses it).

**Not checked:** a real phone, and the published artifact itself (the platform's wrapper was imitated locally).
`server/README.md` step 1 says a project ref is "12 letters"; the go-live page avoids stating a length (verify).

## 2026-10-16: the store and paywall, in test mode, built the Lumevina way (branch `claude/store`)

The owner's ask: a paywall "exactly like Lumevina", not live until Supabase and Stripe are plugged in, but with every
technical piece in place. Built in the `tsu-store` worktree; nothing deployed, nothing committed. The rules are the
new store rule in `CLAUDE.md`; what is sold and for how much is only `src/store/catalog.json` and `cosmetics.json`
(unchanged by this pass); the reasons are in `PROJECT_OC_MONETIZATION.md`.

**What was built.**

- **Client** (`src/store/`): `config.ts` (test mode unless `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
  `VITE_PAYMENTS_LIVE=true` are all set at build time), `payments.ts` (the one Stripe integration point: test mode
  checks Luhn, expiry and CVC and takes Stripe's test cards only, 4242 succeeds and 4000 0000 0000 0002 declines, any
  other number is refused unread; live mode sends the token and the sku, never a price, to `create-checkout` and goes
  to Stripe's hosted Checkout page, then confirms the purchase from the server on return), `account.ts` (a neutral
  month-and-year age question before the email, keeping only 13+ or not; magic-link sign-in that signs straight in
  during the demo and uses Supabase Auth live; sign-out), `entitlements.ts` (`has`, `list`, `restore`; a ledger in
  `localStorage` in test mode, the `entitlements` table cached for offline play live), `locker.ts` (the paint each
  car wears), `bus.ts` (safe storage and the change event), `catalog.ts` (types).
- **The Store panel** (`src/ui/Store.tsx`, styles under `.store` in `styles.css`): the test-mode banner, the account
  box with Restore purchases, Your items (the paint picker for your car, test receipts), the Founder Pack with its
  fixed end date and no countdown, the catalog grouped by kind with prices and what each unlocks, "Earn the … first"
  for a car you don't own, and a checkout sheet with "Looks only", the AB 2426 licence line, the 18-or-guardian box,
  the tip's pay-what-you-want amount (floor $2), the Founders roll opt-in, and a subscription's terms above an
  unticked checkbox. App.tsx: one Store entry in the main menu, one in the pause menu, the panel line, and the store
  opening by itself after a Stripe return or a sign-in link.
- **In the game**: store paints go on the car through `PlayerCar.setPaint(hex, finish)`, which now takes the finish
  numbers from `cosmetics.json` (pearl, gloss, satin, metallic) and swaps the cached material instead of recolouring
  it (recolouring would have left the next car built in the factory colour wearing the store paint). The run card
  draws the Founder '26 badge and the Founders frame when owned. Wheels, driver styles, liveries, kits, outfits and
  the club items are data only: they can be bought in test mode and are listed in Your items, but no hook shows them
  yet. `cosmetics.json` statuses were left as they were (the paints stay `hook` until a review checks the renders).
- **Server** (`server/`, not deployed): the migration (`profiles`, `purchases`, `entitlements`, `waitlist`,
  `invite_codes`, row-level security on all), `create-checkout` and `stripe-webhook` Edge Functions (fetch and Web
  Crypto, no SDK), the server's catalog copy (`npm run store:sync`; `npm run store:check` runs both catalog checks),
  `.env.example` files, and `server/README.md` with the go-live steps, each with how to tell it worked.

**Verified.**

- `npx tsc --noEmit` clean; `npm run build` clean (`tests/out/store-continue-tsc.log`, `store-continue-build.log`).
- Before the change, on the same tree's build: boot, phone and launch **16/16** (from the first builder's notes;
  that run's log wasn't kept).
- After, `npm test -- --only=store,store-live,boot,phone,launch` (`tests/out/store-continue-suite.log`, 20:41 to
  21:21 UTC, with other passes' renders loading the 4 cores to 9 to 13): **36/36 passed**, exit 0. That's boot 6/6,
  phone 5/5, launch 5/5, store 13/13 and store-live 7/7.
  - An earlier full run (`store-definitive-suite.log`, 19:20) stopped at the store group's first page. It took more
    than 120 s to reach the menu while other passes rendered. `tests/regression.mjs` now gives a page up to 5 minutes
    to boot (`BOOT_MS`, in `open()`, the store reload and the store-live loads). No assertion was changed, and the
    boot check still prints the real load time (16.7 s in this run).
  - The store lines:
    - catalog: the two files agree with each other, the code and the server copy. 21 skus (11 available), 42
      entitlements; the server catalog is in sync.
    - webhook signature: RFC 4231 case 2 matches. Good and rolled-secret headers pass. A tampered body, a wrong
      key, a timestamp ±301 s off, and missing or malformed headers all fail. The form encoding is right.
    - the store opens from the menu with every available item and its price: 11 items on sale, 10 not offered. The
      banner reads "TEST MODE Nothing is charged. Use 4242 4242 4242 4242." The Brio wheel set says "Earn the
      Rossini Brio first".
    - 4000 0000 0000 0002 is declined and grants nothing: "Your card was declined. Nothing was charged and nothing
      was added." A non-test card (4111…) is refused. 0 items.
    - the Founder Pack bought with 4242 grants 12 of 12 entitlements. The receipt reads "RECEIPT · TEST MODE …
      Founder Pack $10.00 USD, Visa •••• 4242, OCU-TEST-…, Founders roll: Test Founder". The card number is not in
      storage.
    - the Founders Sunset paint becomes selectable and goes on the car: #e8622c, metalness 0.35, roughness 0.25,
      clear coat 1/0.03, on every body-paint mesh. Factory paint puts #a80d10 back.
    - the tip: $1 is refused ("Choose an amount from $2 to $100."); $7 grants the one badge.
    - the club (preview only; not on sale): "$30.00 a year, renews automatically every year until you cancel."
      shows above an unticked checkbox, and Pay stays disabled.
    - the purchase survives a reload: Founder Pack "Owned", 13 entitlements, the car still in #e8622c, signed in as
      founder@example.com with the Founder '26 and Fuelled the build badges.
    - the car in Founders Sunset (chase shot), and the run card's frame pixel at rgb(241,129,54).
    - phone: the store, the checkout and the receipt fit 390 × 844 with no sideways scroll.
    - test mode sends nothing to Supabase or Stripe: 19 requests, to file:, fonts.googleapis.com and
      fonts.gstatic.com only.
    - live (against the mock project): secure-checkout banner; magic-link request and return; checkout body
      `{"sku":"founder-pack-2026","roll_name":null,"renewal_agreed":false,"adult_or_guardian":true}`, with no price
      and no card form; back from Stripe the receipt comes from the purchase row and Founders Sunset is on the car;
      a refused item shows the server's reason; a cancelled checkout says nothing was charged; 20 mocked calls, to
      mock-oc-ultra.supabase.co and checkout.stripe.com only.
- Row-level security, on PostgreSQL 16 with a stub of Supabase's roles (`server/supabase/tests/run-local.sh`,
  `tests/out/store-rls.log`): the migration runs twice cleanly; a player reads only their own purchases and
  entitlements and every write to them is refused; a player can upsert only their own profile; an anonymous visitor
  can add an email to the waitlist and nothing else (no reading it, no setting a referral code, bad emails and ZIPs
  refused); `invite_codes` is closed to both.
- The two Edge Functions type-check with the project's TypeScript 5.5 in strict mode, with only `Deno.env.get` and
  `Deno.serve` declared (a scratch tsconfig; there is no Deno on this machine to run them).
- Screenshots: `tests/out/store-1440.png`, `store-checkout-1440.png`, `store-receipt-1440.png`,
  `store-club-terms-1440.png`, `store-390.png`, `store-checkout-390.png`, `store-receipt-390.png`,
  `store-founders-sunset-chase.png` (the GT in Founders Sunset), `store-run-card-founder.png`,
  `store-live-checkout-1280.png`, `store-live-receipt-1280.png`.

**Found and fixed on the way:** the tip's price line ran 16 px off a 390 px screen; a select wrapped in its label
read its whole option list as its name (every field now has its own label); the checkout footer wrapped to two
lines in the narrow sheet and covered the renewal checkbox; live sign-in cleared the address before setting the
"reopen the store" flag, so the store would not have reopened after a sign-in link (caught while writing the
`store-live` group).

**Checked by web search (2026-10-16, second builder).** docs.stripe.com still doesn't resolve from this machine,
so these come from search results quoting Stripe's and Supabase's pages:
- the webhook signature scheme and Stripe's 5-minute default tolerance;
- 4242 succeeds;
- 4000 0000 0000 0002 is the generic decline (confirmed by third parties only);
- the literal `{CHECKOUT_SESSION_ID}`, and `client_reference_id` up to 200 characters;
- `custom_unit_amount` for pay-what-you-want;
- 2.9 % + 30¢ US card fees;
- Supabase's `/otp` with `create_user`.

Two things changed. `server/README.md` step 3 no longer says an unlisted redirect URL is refused: Supabase falls
back to the Site URL. And the README's last section now cites each source.

**Not checked, and left out.** The Edge Functions have never run in Supabase's runtime or against Stripe's API (no
deployment; `server/README.md` lists each detail still to verify at launch, and its step 9 is the real test). Not built: the club's customer portal and monthly paint (`invoice.paid`), a refund-request button,
the waitlist form and invite-code redemption, the Founders roll in a credits screen, the badges on the profile card
(the profile panel lives in App.tsx, which is being reworked), and hooks for wheels, driver styles, liveries and kits.
`PROJECT_OC_MONETIZATION.md` §9 still names `orders` and `refund_requests` tables; the built schema is `purchases`
(plus `entitlements`) and has no refund-request table yet. Its §8.2 asks for the birth year; the store asks for the
month and year, so nobody in their birthday year passes early. Security and business-rule design are Fable-class
under the triage rule: a review prompt naming these files is queued under "Fable queue" in `PROJECT_OC_HANDOFF.md`.

## 2026-10-16: the reference pass, R2 to R4, checked together and integrated

Three more deltas from `PROJECT_OC_VISUAL_TARGET.md` were reviewed and kept, and are committed together on
`claude/ref-pass`: R2 (overcast light, below), R3 (the race HUD) and R4 (palms with real fronds), whose own entries
follow this one. The rows of the visual target are now marked: R1 to R4 Done (R3 has no lap counter, because no course
has laps, and the map corner shows no rival dots), R5 to R7 Not yet.

**R2, overcast light** (`src/game/env/Environment.ts`, and the output pass in `src/game/Game.ts`). Under cloud the sky
now does the lighting, by day only (night keeps its moonlight). How overcast it is follows how much of the sun the
weather hides: none in clear weather, which renders exactly as before, about three quarters under cloudy, all of it in
rain.

- The direct sun falls away much faster than before and turns a neutral, slightly cool white. Under cloudy it keeps
  about 7% of its clear strength, enough for a faint shadow under the cars instead of hard shadows.
- The sky light (the hemisphere light) rises and turns nearly neutral and a little cool, with a grey ground bounce.
- The environment map that lights the paint and the cabin brightens under cloud, so the dark plastics don't go black.
  The visible sky goes a little greyer.
- The cloud deck's undersides darken (cloudy's `cloudDark` 0.35 to 0.5) and the dome flattens, so the deck comes down
  toward the horizon.
- Exposure opens up by as much as 20% (1.016 under cloudy by day, up from 0.92), so the sky reads bright and the road
  mid-grey while the cockpit stays the darker part of the frame.
- On High and Ultra, the output pass desaturates the frame by up to 15% under cloud (0.89 saturation under cloudy).
  This is folded into the existing output shader, so it adds no extra pass. Low and Medium have no output pass, so
  they get the light without this grade.

**Verified** (960 × 540, High, Free Drive, 30 s at 30 m/s, overlay hidden; `tests/out/fix-r2-shot.mjs`). I-405 North,
day, cloudy: `tests/out/fix-R2-cloudy-{cockpit,chase,hood}.png` against
`tests/out/fix-R2-before-cloudy-{cockpit,chase,hood}.png`. The light state read back
(`tests/out/fix-R2-before-day-cloudy.log` against `fix-R2-after-day-cloudy-v2.log`): sun intensity 1.302 to 0.23,
hemisphere 0.598 to 0.917 (sky colour #dfeaf7 to #ecedf7), exposure 0.92 to 1.016. In the chase frame the car's shadow
on the road is much fainter and the grade is greyer. Sunset, cloudy, at the old 3 degree sunset preset:
`tests/out/fix-R2-sunset-cloudy-{cockpit,chase,hood}.png` against `fix-R2-before-sunset-cloudy-*.png`. The road and
the walls read clearly lighter than the near-black of before (sun 0.291, hemisphere 0.685, exposure 1.094;
`fix-R2-after-sunset-cloudy.log`). Clear weather renders as before, since with no cloud every new term drops out:
`tests/out/fix-R2-clear-cockpit.png` (sun 3.1, hemisphere 0.55, exposure 0.92; `fix-R2-after-day-clear.log`). The cost
is the same draw calls (cockpit 761, chase 615, hood 539 before and after). No suite check was added for R2. The
render group still renders rain, fog and mist by day (the weathers R2 changes most) with no page errors.

**R3, the race HUD.** The position box with the race timer, the standings with estimated gaps that fall in position
order, the rev lights, and Free Drive's road-name plate back where it was on the phone. See the R3 entry below:
`tests/out/fix-R3-r2-phone.png`, `fix-R3-r2-desktop.png`, `fix-R3-r2-phone-free.png`, `fix-R3-r2-suite.log`.

**R4, the palms.** Frond-card crowns cut out by alpha: 382 triangles on High and Ultra and 222 on Low and Medium,
against 448 before. Frond-shaped shadows and ringed, leaning trunks. See the R4 entry below:
`tests/out/fix-R4-compare-2x.png`, `tests/out/preview/fix-R4-palm-crown-high.png`, `fix-R4-suite-render.log`.

**The whole suite on the three together** (`npx tsc --noEmit` clean, `npm run build`, then `npm test` in the `tsu-ref`
worktree; `tests/out/integrate-ref-suite.log`): **58/58 passed**, exit 0, in about 13 minutes of group time. The lines
that touch this pass: "race standings: gaps fall in position order, the timer sits in the race box: 78 rows ahead and
72 behind over 50 s, all in order"; "palms: alpha-tested frond crowns within the old triangle budget: 109 palms in 11
crown meshes, 222 triangles a crown at Low"; "high: … palm crowns 382 triangles; ultra: … 382; low: … 222"; renders
day rain, fog and mist; no page errors in any group.

Not checked: a real phone or GPU, the Medium tier's frames, and R2's look at night or in rain, fog or mist (the suite
renders those weathers, but no one has compared their frames before and after).

**Merged into `claude/always-on`**, on top of the lens flare (g2) and the headlight beam pool. Both sides were kept
where they met. In `Environment.ts`, the new star shader goes with R2's overcast exposure. In `cockpit.ts`, the
interface returns both the live `mirrors` (R1) and the rear-view face, `rearView`, that the flare's occlusion test
uses. That face now follows the live mirror over the driver's side. `Game.ts` and `textures.ts` merged on their own:
the saturation uniform is set before the composer renders and the flare draws after it, so the flare is not
desaturated, and the frond and bark textures sit beside `beamPool()`. On the merge: `npx tsc --noEmit` clean, `npm run
build`, `npm test -- --only=boot,render,race,phone` **30/30 passed** (`tests/out/merge-ref-suite.log`; it includes
"renders sunset, clear … daylight 0.92" on the new 5.5 degree sunset, the race standings check and both palm checks).
One frame pair of R2's light on the new sunset (CA-91 West, cloudy, High;
`tests/out/merge-R2-sunset-cloudy-{cockpit,chase}.png`, `merge-R2-sunset-cloudy.log`) shows daylight 0.91, sun 0.299,
hemisphere 0.846 and exposure 1.04. The road reads mid-grey, the live mirrors show the road behind, and there are no
page errors. The sun is out of frame there, so the flare under cloud was not seen; by the code it is about a fifth of
its clear strength under cloudy.

## 2026-10-16: palms with real fronds (reference pass, R4)

The palms were a dense green ball of 18 plain arcs and a skirt of 10 more (448 triangles at every tier). Now:

- **Crown** (`palmCrown(detail)` in `road/props.ts`). Each frond is one 1.5 m card folded along its midrib into a
  V, bent along a rachis that lifts at the base and droops toward the tip: young fronds higher and upright, old ones
  lower and hanging, the vertex colour darker toward the crown's heart. A few straw-brown dead fronds hang under the
  crown, and a 7-sided collar of leaf bases joins it to the trunk. High and Ultra: 12 live + 5 dead fronds, 6
  segments a frond, **382 triangles**. Low and Medium (`props < 1`): 10 + 4, 4 segments, **222 triangles**. Still one
  InstancedMesh per part per tile.
- **Frond texture** (`frond()` in `textures.ts`). One 512 × 512 texture with a live pinnate frond (bare petiole, pale
  midrib, lance-shaped leaflets leaving it at about 45 degrees and drooping at their ends, gaps between them) and a
  dead one, alpha-tested at 0.4, double-sided. It is now uploaded as ImageData instead of a canvas: a canvas keeps
  premultiplied colour, so every transparent texel had turned black (read back rgba 0,0,0,0 outside the frond; now
  91,122,57,0) and the mip-maps darkened the fronds' edges. A low alpha floor across the blade keeps far fronds solid:
  box-filtered like the GPU's mip-maps, the share of texels passing the alpha test is 1.09 of mip 0's at mip 1, 1.24
  at mip 2 and 1.6 at mips 3 to 5, so far fronds fill in rather than dissolve.
- **Trunk.** The bark has a ring groove every 32 pixels (80 rings a trunk) over a lattice of leaf-base scars. Trunks
  lean up to 3.4 degrees in a random direction; the crown sits on the leaning top with a random yaw and a 1 to 1.25
  scale. These come from a second random stream, so every house, tree and palm is where it was.
- **Shadows.** three.js's shadow pass copies `map` and `alphaTest` into its depth material when a material has both,
  so the crowns cast frond-shaped shadows with no custom depth material (Medium, High and Ultra; Low has no shadows).

**Verified** (960 × 540, I-405 North, day, clear, Free Drive, 30 s at 30 m/s, overlay hidden;
`tests/out/fix-R4-shot.mjs`): `tests/out/fix-R4-high-chase.png`, `fix-R4-high-hood.png`, `fix-R4-low-chase.png`,
`fix-R4-low-hood.png`. The before frames, `tests/out/fix-R4-before-{high,low}-{chase,hood}.png`, were rendered by
the first R4 attempt from this worktree's own build before any palm edit (its log lists the old crown: alphaTest
0.45, 448 triangles); the main checkout's build was not used because it is a different branch. The same palm before
and after, 2×: `tests/out/fix-R4-compare-2x.png` (a dense blob before; separate arching fronds, the dead ones and the
lean after). Close-ups from the realism preview (`src/preview/test-palm.ts`, the game's own palms at 13 m):
`tests/out/preview/fix-R4-palm-crown-high.png` (and `-2x`), `fix-R4-palm-crown-low.png`, `fix-R4-palm-whole-high.png`,
and `fix-R4-palm-shadow-high.png` (the crown's shadow on the ground, leaflets visible in it).

| Frame (calls / triangles a frame) | Before | After |
| --- | --- | --- |
| High, chase | 615 / 1,508,910 | 615 / 1,503,364 |
| High, hood | 539 / 1,404,037 | 539 / 1,398,491 |
| Low, chase | 408 / 457,335 | 408 / 449,653 |
| Low, hood | 332 / 392,832 | 332 / 385,150 |

The crowns' own share, the same frame with them shown and hidden (`tests/out/fix-R4-calls.mjs`, hood): Low 4 calls and
8,658 triangles (4 crown meshes in view), High 7 calls and 58,446 triangles (main and shadow passes). Two consecutive
measurements of the paused frame, crowns unchanged, read 374 then 332 calls on Low and 584 then 539 on High (an extra pass on
some frames), so single-run call counts can differ by about that much.

New checks in the render group: "palms: alpha-tested frond crowns within the old triangle budget" (the crown meshes
alpha-tested, double-sided and casting shadows, at most 448 triangles, the frond blade between 15% and 85% gaps, a
transparent texel keeping its colour), and the High/Ultra rebuild check now reads the crown's triangles at each tier
(at most 448, Low fewer than High). `npm test -- --only=render` **13 of 13** (`tests/out/fix-R4-suite-render.log`):
"109 palms in 11 crown meshes, 222 triangles a crown at Low, castShadow set; blade 41.62% gaps; transparent texel rgba
91,122,57,0" (castShadow is set on every tier; Low's renderer draws no shadows) and "high: … palm crowns 382
triangles; ultra: … 382; low: … 222", no page errors.

Not checked: a real phone or GPU, the Medium tier's frames, palms at sunset or night.

## 2026-10-16: the race HUD (reference pass, R3), second round after the judge

The race HUD replaces the three race numbers in the stats box with a position box (the big position, "of 4", the
distance to go, and now the race timer beside the position, labelled Time), the live standings (position, the
rival's OC city tag, name, the gap to you in seconds, your row in volt; a phone shows the three rows around you)
with the note "Gaps in s · estimated", and eight rev lights over the gear. The judge sent the first cut back for
three things, all fixed:

- **Free Drive had moved on the phone.** The road-name plate had been pushed to +292 px for every mode. In the
  `(pointer: coarse)` block it is back at +244 px; only while the race box is shown
  (`.hud:has(.hud-race:not([hidden]))`) does it go under the box, to +292 px. The opt-in frame-rate chip moves under
  the race box in a race too (+282 px; at +218 px it sat on the standings).
- **The timer sat stacked under the road name, over the horizon.** It now lives in the race box, top right
  (`.hud-pos > .hud-timer`); nothing of the race HUD is on the road plate.
- **The gap column could disagree with the order.** `standings()` estimated a car behind you with its own speed,
  so a slow car further back could show a smaller gap than a fast one just behind (the first cut's desktop frame
  read P2 −9.0, P3 −13.7, P4 −11.3). Every gap is now the distance along the course at your speed (`vMe`), so the
  gaps fall with the positions; finishers are still ranked first, ahead of every unfinished car.

**Verified:** `tests/out/fix-R3-r2-phone.png` (390 × 844, Irvine Sprint, 40 s in: race box 156–287 px, timer
0:40.6 in it, gaps −6.1 / −8.4, plate at 302 px) and `tests/out/fix-R3-r2-desktop.png` (1440 × 900: timer 0:40.9 in
the box, gaps −6.5 / −6.9 / −12.6, plate alone at the top); `tests/out/fix-R3-r2-phone-free.png` (Free Drive on the
phone: plate at 254 px = 10 + 244, under the Distance/Top box at 156–210 px); `tests/out/fix-R3-r2-phone-race-fps.png`
(frame-rate chip at 292 px, under the box, left of the plate). New check in the race group: 50 s of the Irvine
Sprint (20 s slow, 30 s fast) sampled every second, 78 rows ahead and 72 behind, gaps never out of order; the HUD
timer in `.hud-race`, none on the plate, the HUD gap column in order. `npm test -- --only=race,phone` **11 of 11**,
no page errors. Not checked on a real phone.

## 2026-10-16: the sun's lens flare draws at High, and the sunset preset is a sunset again (finding g2)

**The flare.** three's `Lensflare` reads the framebuffer back for its occlusion test, which fails on the multisampled
target High and Ultra render into: it never drew there and left a solid 16-px black square at the sun's screen
position (`tests/out/audit-sunset-ahead-{hood,cockpit,chase}.png`, `audit-crops/ahead-hood-sun.png`). It is gone.
`Environment` now draws the flare itself: `updateFlare()` projects `sunDir` through the camera's own orientation
each frame and places five additive planes (the glow at 26 % of the screen's height, four ghost rings at
sun·(1−2d)) in a small screen-space scene with an orthographic camera, sized in shares of the screen's height so
they stay round in portrait, and `renderFlare()` draws that scene over the finished frame after the composer, so
bloom and AO never see it and Low (no composer) gets the same picture. Occlusion is a raycast toward the sun every
third frame (400 m, through the roads, the traffic and the terrain's instanced props; see-through, hidden and
skinned meshes ignored; 0.2–2 ms per cast here), the mountain ring's crest height at the sun's azimuth
(`ridgeAltitude`, soft over the sun's half-degree disc), and for the player's car `PlayerCar.sunBlocked`: the
cabin as a box with the kit's windscreen, side windows, rear screen and the Vela's glass roof as openings and the
rear-view mirror (now `Cockpit.rearView`) as a blocker, since raycasting the real body cost 15–19 ms. The result
blends over 0.3 s. The ring writes depth now, so stars and clouds no longer show through its ridges. Glow texture
given a hot core and long halo, ghost rims softened (`textures.ts`).

**The sunset preset.** The first version of this fix lifted the sunset sun from 3° to 8° because the ring's crest
is 6.9° at its azimuth (258°), so a 3° sun had never shown; the judge rejected that: at 8° `daylight`
(`smoothstep(−0.1, 0.14, alt)`) is exactly 1, the suite's `renders sunset, clear` check (`e.day < 1`) fails by
construction, and the preset read as full afternoon (sunlight 3.1, hemisphere light and sky gain the same as day).
Retuned without touching the ring or the formula: the crest profile, computed from the ring's own `fbm2` (3.0° at
az 164° to 12.3° at az 110°), is lowest in the western half at az 292–293° (5.0–5.1°, a late-June sunset
direction over OC), so the preset is now **5.5° at az 292°**: the whole disc clears the crest by 0.14° (the
flare's ridge factor is exactly 1), daylight 0.91 (0.92 after the suite's 15 s ease from day), sunlight 2.86,
golden 0.79, so the preset is dimmer and warmer than day again. I-405 North, the suite's own start, faces it 11°
left of the nose at the start and 12° right after 30 s. Not touched, worth its own finding: the sunrise preset
(4° at az 100°) sits behind a 9.6° crest, so it never shows its sun either.

**Verified** (headless Chromium, SwiftShader, 960 × 540, I-405 North after 30 s of autopilot; all with zero page
errors):
- `npm test -- --only=render` **12 of 12** (`tests/out/fix-g2-r2-render.log`): sunset daylight 0.92, day 1,
  night 0; the suite's own `tests/out/sky-sunset-clear.png` (Low, 640 × 360, cockpit) shows the sun just over the
  ridge through the windscreen with the glow and ghost train.
- High, cockpit/chase/hood (`tests/out/fix-g2-r2-sunset-high-{cockpit,chase,hood}.png`,
  `fix-g2-r2-sunset-high.log`): flare visible in all three (strength 0.77, ridge 1, nothing hit, raycast
  0.3–1.9 ms), the sun in a dip of the ridge line, long lamp-post and palm shadows down the road, no square;
  563–638 draw calls and 1.45–1.56 M triangles a frame.
- Low, hood/chase (`fix-g2-r2-sunset-low-{hood,chase}.png`, `fix-g2-r2-sunset-low.log`): the same placement
  (sun at pixel 580,206 in the hood view on both presets), 342–418 calls, 0.40–0.46 M triangles.
- High, portrait 390 × 844, hood/cockpit (`fix-g2-r2-sunset-portrait-high-{hood,cockpit}.png`,
  `fix-g2-r2-portrait-high.log`): the glow and ghosts stay round, the sun over the ridge right of the nose. With
  the sun turned to the car's heading (az 279°, crest 8.3°) the ridge hides it, honestly: no flare and no square
  (`fix-g2-r2-sunset-ahead-portrait-high-hood.png`, ridge factor 0). Pre-existing and not part of this finding:
  the cloud layer stretches into vertical streaks in portrait.
- Ultra, hood, 640 × 360 (`fix-g2-r2-sunset-ultra-hood.png`, `fix-g2-r2-sunset-ultra.log`): the flare draws over
  the bloomed frame, no square; 1,278 calls, 3.74 M triangles a frame.
- `npx tsc --noEmit` clean for both `tsconfig.json` and `tsconfig.game.json`.
- Before/after: `tests/out/audit-sunset-ahead-hood.png` (black square, stars by day) vs
  `tests/out/fix-g2-r2-sunset-high-hood.png`; the first fix's bright-afternoon frames are `fix-g2-sunset-high-*.png`.

## 2026-10-15: live rear-view and door mirrors on High and Ultra (reference pass, R1)

The first delta against the owner's reference image (`PROJECT_OC_VISUAL_TARGET.md`): the rear-view mirror used to
show the sky's environment map (a dark band from the seat). `Game.configureCar` now passes `mirrors: 'live'` to
`PlayerCar` on High and Ultra when the device has a fine pointer (phones and Low/Medium keep `'env'`), and
`buildCockpit` returns its `CarMirror`s so the car can switch them off outside the seat and dispose them on a
rebuild. Three things were needed to make the glass show the road and the traffic behind:

- **Our cars are mid-engined.** From the mirror's eye the bulkhead window frames the car's own wing, tail lamps and
  engine-cover louvres, with the car behind squeezed into a slot (`tests/out/dbg-mirror2-eye-aim.png`). The
  rear-view therefore renders the world without the player's car (`CarMirror.hide`: body, cabin, hands, wheels,
  hidden for that nested render only), as a rear camera would, and is aimed straight back 2.5 degrees below level.
  The door mirror keeps the flank.
- **The glass was off screen.** Hung just left of centre it sat 45 degrees right of the eye and only its left 38 %
  was in a 16:9 frame at the cockpit's 58-degree view. It now hangs over the driver's side (x about -0.22), fully in
  frame at 16:9 and 16:10.
- **Cost.** Each mirror renders every other frame (the two alternate) into a 512x128 / 256x112 target with a 400 m
  far plane: the far road chunks were most of the draw calls (471 -> 172 for the rear-view), the sky dome still
  draws (it sits at the far plane whatever it is), the backdrop hills and clouds beyond 400 m do not. Measured in
  SwiftShader at 960x540, High, I-405 North, day, moderate traffic, over 4 frames with `info.autoReset` off: 645
  calls / 2.13 M triangles a frame with `'env'`, 823 / 3.05 M with the live mirrors (the rear-view's own render 172
  calls / 0.92 M, the door mirror's 181 / 0.93 M; the player's car is 240 k triangles).

The judge rejected the first cut for one reason: the mount had moved for every tier, so on a phone (portrait, 96°
view) the environment-map mirror became a dark slab over 43 % of the screen width in front of the road
(`tests/out/review-R1-phone-cockpit.png`). Fixed by hand: with `'env'` the glass keeps its old place just left of
centre and its old aim through the bulkhead window; only the live mirror moves over the driver's side.
`tests/out/fix-R1-phone-cockpit.png` (390 × 844, Low) shows the road clear again, with no mirror targets built
(`car.interior.mirrors.length === 0`). Suite: `npm test -- --only=render` **12 of 12** on the agent's cut (the
High/Ultra/Low preset check now also asserts live/live/env mirrors); the hand fix typechecks and only changes the
`'env'` branch.

**Verified:** `tests/out/fix-R1-cockpit.png` (the driver's seat with a sedan placed 20.9 m behind in the same lane:
it fills the middle of the rear-view, with the median, the lane line, a second car in the right lane and the sound
wall; 2x crops `fix-R1-cockpit-{rearview,door}.png`; `fix-R1-before-cockpit*.png` is the `'env'` state). `npm test
-- --only=render` **12 of 12** (the High/Ultra/Low preset switch now also checks the mirror mode: live, live, env),
`npx tsc --noEmit` clean. Not measured on a real GPU.

## 2026-10-15: first realism pass by agents: headlight beams, the NPC nose, the jaw and neck

The first orchestrated render pass (two art-director audits, then one fix agent per shortfall and a sceptical judge
per fix) kept three fixes before the account's session limit stopped it. Each was judged on before/after renders.

**Headlight beams (game, finding g1).** The two spotlights painted blown-out, heart-shaped blobs on the road right
under the bumper, and came on at sunset. Now the spots are a narrow soft cone aimed just above level, so they reach
traffic and walls but not the road under the nose, and the low beam on the road is a painted pool: a 12 × 38 m
additive strip of fourteen rows re-laid on the road's height each frame (it follows crests and sags), with two
pools merging into one widening wedge and a soft cut-off at 30–36 m lifted on the right like a US low beam
(`textures.ts` `beamPool()`, `PlayerCar.ts`, `Game.ts` `weatherTick`: the lamps now fade in with gloom instead of
switching at a threshold). Before/after: `tests/out/audit-night-hood.png` vs `tests/out/fix-g1-night-hood.png`,
and the cockpit, chase and sunset frames beside them. The judge kept it and listed what remains: a faint two-lobe
seam at 4–6 m in the hood view, the narrower cone no longer lights adjacent-lane cars inside 15 m or a nearby wall
(not yet looked at in a night shot with a wall), the pool ignores camber on banked ramps, it is not fogged, and a lit
traffic car at 28 m reads as a blown-white rear: pre-existing, worth its own finding.

**The NPC nose (people, p1).** The bridge was a pinched blade with hard sidewall creases and a separate bulbous tip.
`src/onfoot/people/head.ts`: a wider radix starting at the eye line, softer dorsum and sidewall blends, the tip a
lobule that continues the dorsum, fuller maxilla beside the nose. Judged at 0.62 m and 0.33 m on the reference,
casual and elder presets at three yaws (`tests/out/preview/fix-p1-*.png`): the crease and the ridge highlight are
gone, the bridge reads about twice as wide, nothing else moved. Cost flat (build-time SDF).

**Jaw to neck (people, p2).** One convex curve from chin to throat, masseter lumps, a ball under the chin, the
trapezius rising to the ears. `head.ts` and `body.ts`: a concave cervicomental angle, the mandible's lower border as
an edge over the neck, a visible sternocleidomastoid band, the neck a column, the elder's wattle a distinct pouch.
Judged on profile, front, talk, lineup and collar renders (`tests/out/preview/fix-p2-*.png`). Noted, not blocking:
a soft dark patch under the lean female's ear in profile, and her collarbones now at the gaunt limit.

**Not reached:** the lens flare's black square at High (g2), stars by day (g3), waxy skin (p3) and the rest of both
audits' lists (night lighting, Monopoly houses, blank mirrors, paper mountains, flat daylight; teeth, hair, mouth
corners, brows, expressions). They run in the next pass. The audit also judged my lens flare (added earlier today):
it never draws at High and leaves a solid black square at the sun; the sunset preset's 3° sun also sits below the
procedural ridge line, so the flare would rarely show even when fixed.

**Verified:** the judges' renders above, `npx tsc --noEmit` clean, and the full suite on this build: `npm test`
**53 of 56** (`tests/out/full-1015c.log`) with the three misses all 30 s Playwright timeouts on a screenshot or a
click in the launch group while another pass was rendering on the same four cores; the launch group alone then
**5 of 5** (`tests/out/launch-1015e.log`), so every check passed on this build. The suite's actions now get two
minutes instead of Playwright's 30 s (`tests/regression.mjs` `open()`), since software rendering shares the CPU
with other renders here; what a check asserts is unchanged.

## 2026-10-15: the ability hand poses are on the anatomical hands

The one thing the realism hands had lost against the old cockpit: the abilities' gestures. `DriverArms.setPose`
now takes a hand off the rim and back. A pose names where the wrist goes and which way the hand points and its back
faces; the hand bone's rotation is solved from the bind hand's measured axes (wrist to middle knuckle, the palm
normal), the arm's two-bone IK follows the wrist, and it blends over 0.3 s each way. Clear Path: the left hand comes
up at the window and waves (a slow roll about the forearm) for 1.6 s. Focus Time: the left wrist comes up in front
of the eyes, back of the hand to the driver, for 0.9 s. Locked In: the right hand rests on the console, palm down,
for the five seconds, the left hand steering alone. The fingers keep their grip curl in every pose; there's no
finger rig, so a wave reads as a raised loose fist.

**Verified:** the preview's hands page with `?pose=knee|watch|wave` (`tests/out/preview/pose-*.png`), then the game
itself: each ability fired through `useAbility()` with the matching driver and captured from the driver's seat
(`tests/out/pose-{wave,watch,knee}.png`: the Closer's wave with the gold watch, the Ace's gloved watch check, the
Wrench's hand down on the console while the left hand holds the wheel). `npm test -- --only=abilities` **4 of 4**
with the poses in; no page errors. Then the full suite on this build (semi, autopilot fix, poses): `npm test`
**56 of 56**, 20 minutes in this container (`tests/out/full-1015b.log`).

## 2026-10-15: the tractor-trailer semi, a cleaner windscreen, and a safer autopilot

**The semi.** The last block-built traffic vehicle is now built like the others, from `src/preview/traffic.ts`: a
conventional tractor (boxy loft, a 2.2 m hood narrower than the cab, glass only over the doors, chrome grille
surround and bumper, sun visor, roof fairing in the paint colour, twin stacks, fuel tanks between the axles, frame
rails and a fifth wheel over the tandem, west-coast mirrors) and a 45 ft box trailer with floor frame, side skirts,
red conspicuity tape, landing gear, door seam and lock rods, mud flaps and an underride guard, 20 m in all on five
axles. The game instances ten turning wheels from the spec's axle list, and keeps the semi in the two right lanes.
`tests/out/preview/traffic-semi.png` is the preview render; `tests/out/semi-chase.png` is the game, placed 22 m behind
one on the 405.

**Windscreen dust** at the driver's seat was reading as snow at the desktop tier: its opacity is halved (0.26 →
0.13). It is still there against the light.

**The autopilot** (attract mode and the suite's driver) used to judge a lane by where cars were, not where they were
going, and the longer semi changed the seeded Survival run enough that at 39 s it moved into lane 3 as a pickup 5 m
ahead was also moving into lane 3. It now counts a car that is signalling and moving into a lane as already in it,
for both the gap ahead and the clear check. Seeded Survival runs through again.

**Verified:** `npm test -- --only=survival` **7 of 7** (a new check: seven traffic classes from the preview, the semi
20 m × 2.5 m with ten wheels, 5 of 154 seeded cars are semis and every one spawned in the two right lanes; the seeded
run now scores 8,591 with a 16.82 s best streak, 21 clean passes, top 116 mph). `--only=survival,abilities` **10 of
10** on the first semi build before the tractor was reshaped. No page errors in any run.

## 2026-10-15: the Chrome noir menus are in the game

The owner asked for "something more modern with a futuristic HD cyberpunk feel" and chose direction B, "Chrome
noir", from the two the designers built in worktrees. The agent that was to apply it is stopped by the weekly limit, so
its patch (`scratchpad/ui-design-2.patch`: `index.html`, `scripts/single-file.mjs`, `src/ui/App.tsx`,
`src/ui/styles.css`) was applied three-way and the three conflicts resolved by hand: the day's "start at your exit"
picker and Feedback panel now live inside the new layout (the Start panel is a `panel wide`; the roads and exits grids
scroll with their panel). The look: a chromed ULTRA wordmark with a slow sheen, Big Shoulders Display for headings,
Chakra Petch for text, JetBrains Mono for numbers and labels, violet-black glass with a hairline edge, magenta
selection corners, a yellow Drive dock pinned to the bottom of the menu, hexagonal ability button, angled chips
for the touch pedals and the top bar. Every accessible name, role and class the suite relies on is kept.

Three layout faults from the unfinished direction were fixed: controls scrolled into view landed under the sticky
Drive dock and panel footers (now `scroll-padding-bottom` on the overlays, so Playwright's and the browser's
scroll-into-view keep them clear); the exit picker's inner scroll fought the panel's sticky footer (its
`max-height`s removed, the panel grows and the overlay scrolls); and the desktop side card (Loop Lab, the data credit)
was pinned to the animating menu column instead of the viewport (the slide-in now animates the column's parts).

**Verified:** `npm test -- --only=launch,phone,boot` **16 of 16** on this build (the phone layout checks, the exit
picker click-through, the Feedback and Share run buttons). All 13 screens captured at phone and desktop size in
`tests/out/ui-after/` (the capture tool now waits for entrance animations to finish: in software rendering the first
frames after load take seconds, so the animations started late and the first desktop captures were mid-fade).
Not reviewed yet: an art-director pass over every screen for polish; the agents' review and polish steps run when the
limit lifts.

## 2026-10-15: the realism preview's cars, cockpits and hands are in the game

The owner, after trying the test build: "This game looks like garbage, keep rendering for MAXIMUM RESULTS." The
background agents that were going to integrate the realism preview are stopped by the account's weekly limit until
Oct 18, so the integration was done by hand, ahead of the preview's remaining parts.

**What changed.** `src/game/vehicle/PlayerCar.ts` now builds the player's car from the preview modules
(`src/preview/car.ts`, `cockpit.ts`, `hands.ts`): the four garage cars as four distinct bodies (clearcoat metallic
paint with flake, shut lines, LED lamps, tail-lamp clusters, diffuser, exhausts, forged wheels with tyres and
drilled discs, a contact shadow), each with its own cockpit (GT black Alcantara and cognac Nappa, Brio navy leather
with aluminium, Corsa carbon buckets with harnesses and a roll hoop, Vela E ivory leather with a screen dash), a real
tachometer with a live needle, a windscreen with the dashboard's ghost reflection and dust, door and rear-view
mirrors, and the driver's anatomical hands gripping the rim at ten and two with the chosen look (skin tone, sleeves or
rolled, gloves, gold/steel/smart watch, ring, bangle, painted nails on the female presentation). The wheels spin and
the fronts steer (the preview built them rigid; the game puts each in its own groups, calipers on the hub). Graphics
Low and Medium use the preview's 'phone' quality tier, High and Ultra the 'high' tier. The paint, the car and the
driver's look rebuild only what changed. The previous cockpit (`Cockpit.ts`, `Instruments.ts`) is no longer used.

**Verified** (headless Chromium, SwiftShader, 960 × 540, Low, sunset, `tests/out/car-low-{cockpit,chase,hood}.png`
and `tests/out/dbg2-*.png`): build in software 428 ms car + 597 ms cockpit + 966 ms hands; no page errors; the
driver's seat shows the dash, tach, mirror, A-pillar and both hands with the Closer's gold watch; chase shows the GT
from behind with tail lamps, diffuser and wheels; hood shows the bonnet lip and the road once the half-second view
blend has finished (a shot taken mid-blend sits inside the windscreen). Frame cost at the seat: 355 draw calls,
490k triangles (the old car: 444 calls, 491k), 10–12 fps in this software renderer, the same as before the change.
**Suite:** `npm test -- --only=boot,survival,render,phone,launch` with the new car and traffic: **34 of 34** (the
render group's six skies, the lost-context recovery and the High/Ultra rebuild all pass with the preview car built
at both tiers; Survival's seeded numbers are unchanged: 16,244, 28.75 s, 25 passes). The test link
https://claude.ai/artifact/AsFiTsf6TFF4Hij25U3MR9 carries this build.

**Traffic bodies** (same session). The preview's unbranded traffic vehicles (`src/preview/traffic.ts`, moved out of
`car.ts` and given a coupe) now feed the game's instanced traffic: sedan, coupe (the "sports" class), SUV, pickup, a
new van class, and the box truck are lofted bodies with a glass band and vertex-coloured trim (grille, bumpers,
mirrors, box, bed), on the game's own turning wheels and braking lamps, in the preview's clearcoat paint with the
per-car instance colour. Collision boxes and wheel positions come from the same specs, so what you see is what you
hit. The semi is still the block-built one. Verified (`tests/out/traffic-{cockpit,chase}.png`, Heavy, seeded, 154
cars): bodies, colours and lamps render through the instancing; 373 draw calls and 838k triangles from the seat in
Heavy traffic (the bodies are denser than the old profiles); no page errors.

**The road** (same session). The interstates and state routes (the 5, 405, 22, 55, 57, 91) are now Portland cement
concrete, as they are: light grey-beige slabs 4.57 m long with sealed, slightly skewed transverse joints, the
longitudinal joint at each lane edge, diamond-ground tining in the normal map, darker polished wheel paths, an oil
line and hairline cracks (`textures.ts` `pcc()`, one lane by one slab per tile, with its own roughness map; rain
darkens and glosses it like the asphalt). The toll roads (73, 133, 241, 261) and every ramp stay asphalt. Lane lines
are four raised Botts' dots per 3.66 m where there was a painted dash, with the reflective marker in the gap kept.
Sound walls are split-face masonry block in running bond, tan, 0.2 m courses (`blockWall()`), instead of tinted
concrete. Verified in daylight from the seat, chase and hood cameras (`tests/out/car-low-{cockpit,chase,hood}.png`,
Low, 960 × 540): the slabs, joints, dots and block courses read at every distance; no page errors; 371 draw calls
and 606k triangles from the seat in Moderate traffic. Suite: `--only=boot,render,survival` **24 of 24** on this
build (the rain and fog renders cover the wet concrete).

**Not done, candidly.** The ability hand animations (the Closer's watch check, the Ace's wave, the Wrench's hand on
the knee) do not yet exist on the new hands: `setPose` is a no-op until the hands get a rig. The cockpit's two side
screens are static pictures (the HUD carries speed and gear); the shift paddles do not flick. Phone performance is
still unmeasured; the Feedback report will say.

## 2026-10-15: launch features: start at your exit, and the run card

Built for the local launch plan (`PROJECT_OC_BUSINESS.md`): every OC resident has an exit, and a run should be
shareable without a server.

- **Start at your exit.** The Start panel now lists all 20 carriageways under the 12 quick starts; tapping one lists
  every real exit on it (from the guide signs in the map data: 416 across the network, 4 to 58 per carriageway) with
  its distance along the road and which side it leaves. Picking one starts you 450 m before its sign, in the second
  lane, and the toast names the exit. `Settings.exit` holds the key (`'<carriageway> @ <metres>'`); the quick starts
  clear it. Time Trial keeps its fixed start.
- **Run cards.** The results screen has "Share run": a 1080 × 1350 PNG drawn on the device (the road's shield, the big
  number, the reason, the stats, "#TopSpeedOC", "A game. Drive the real ones at the limit.", and the device-only and
  map-credit lines). It goes through the phone's share sheet where there is one, otherwise it downloads. Nothing is
  uploaded by the game.

**Verified** (headless Chromium, SwiftShader, `npm test -- --only=launch,boot,phone,survival`, then `--only=launch`
again after a test fix): 22 of 22 checks pass.
- Launch: CA-57 North lists 14 exits, the same number the data has; picking "Orangewood Avenue" (the Lot 57 exit) and
  tapping Drive started on CA-57 North 450 m before the sign. The run card downloaded as `top-speed-oc-free-703.png`,
  1080 × 1350, 955 KB (screenshots `tests/out/launch-exits.png`, `tests/out/launch-run-card.png`).
- Boot, Survival and Phone groups unchanged: 781,426 lane points clear, 11,333,756 barrier segments the same twice,
  Survival score 16,244 with a 28.75 s streak, the phone menu and HUD fit, Go to lists 20.
- One test fix: the first run of the card check timed out at 15 s because the results screen keeps rendering the
  scene behind it at 1–2 fps here, so the click and the drawing took about 19 s; the check now allows 90 s.

Not measured: a real phone's share sheet (headless Chromium has no `navigator.share`, so the download path is what
the suite exercises).

**Feedback report** (same day). Pause → Feedback, or Settings → Feedback, shows a report about the device and the
drive: the browser, screen and pointer, cores and memory, the GPU (`WEBGL_debug_renderer_info`), the graphics preset,
pixel ratio and drawing-buffer size, frame rate, draw calls, triangles and textures, the mode, road, speed, traffic
density and car count, the sky settings. Copy (clipboard, or select-and-copy where that is refused) and Share (where
`navigator.share` exists). The game sends nothing; the player pastes it to us. This is how the launch's ambassadors
report real-phone performance, which has never been measured.
- Verified (`npm test -- --only=launch`, 4 of 4): the report named the browser (HeadlessChrome), "GPU: ANGLE (Google,
  Vulkan 1.3.0 (SwiftShader Device (Subzero)...))", the Low preset, "11 fps · 444 draw calls · 491k triangles · 45
  textures" and the drive on CA-57 North; Copy and Back worked with no page errors (`tests/out/launch-feedback.png`).
  Those numbers describe this sandbox's software renderer, not any phone.

**Abilities tuned toward the owner's "about 5 seconds"** (same day): Clear Path 8 → 6 s (traffic needs a moment to
move over), Locked In 7 → 5 s, Focus Time stays 5 s; cooldowns unchanged. **Clear Path with No Traffic**: with the
density at None and no cars about, the ability says "No traffic to clear" and keeps its charge instead of burning a
45 s cooldown on nothing.
- Verified (`npm test -- --only=abilities,launch`, 9 of 9): Clear Path 153 → 106 cars with all 46 in view kept, scale
  0.65 then 1 after its 6 s, cooldown blocks a refire; Focus Time 0.7× then 1×; Locked In grip ×1.3 then ×1 after
  5 s; with density None and 0 cars, Clear Path did not fire and stayed ready. Phone group re-run after the Feedback
  button was added to the pause and settings screens: 5 of 5.

**Full suite after the day's changes: 55 of 55** (`npm test`, all nine groups, about 11 minutes here). The
interchange chains, races, progression and render checks match the 2026-10-12 numbers (405 N → 55 N in 215 s, the
Irvine Sprint won in 2:21.7, 178 XP for 60 s, the six skies rendered, context loss recovered).

**Test link.** This build is published separately at https://claude.ai/artifact/AsFiTsf6TFF4Hij25U3MR9 so it can be
tried on a real phone (the main link https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV still holds the 2026-10-13
build: updating it needs the 3 MB live page read first, which this session could not do safely). Inside the
artifact viewer a plain download does nothing, so the run card there goes through the viewer's own save hook (see
the technical notes); on a phone the share sheet comes first either way.

## 2026-10-12: a committed regression suite, and the bugs it found

The test scripts behind the entries below (`final.js`, `modes.js`, `sim.js`, `dbg3.js`) were never committed. They're
replaced by `tests/regression.mjs`, run with `npm test`. It has 50 checks in eight groups, uses the same method
(headless Chromium, SwiftShader, `window.__game`), and takes about 10 minutes here. The technical notes explain it.

### Results

- **The build as committed (c0d7b34): 42 of 49 passed.** All 7 failures came from the bugs below. The same suite ran
  against both builds, with `GAME_HTML` pointing at the old one.
- **With all six fixes: 50 of 50 passed.** The numbers in this section are from that final run.
- **The 50th check came later.** It compares the barriers on a first and a second look (bug 5). It was checked against
  the fixed build with only that fix undone, where it failed: 18,040 segments over 3 m on the first look, 298 on the
  second.

| Group | Verified |
| --- | --- |
| Boot | Menu after 2.7–5.5 s across runs. 20 carriageways on 10 routes. 781,426 lane points with no barrier within 1 m of a lane's centre. 11.3 million barrier segments the same on a first and a second look. OSM/Overture credit shown. No Controls screen. |
| Interchanges | Moderate traffic, seeded. 405 N → 55 N in 215 s, 55 N → 91 E in 403 s, 91 E → 241 S in 269 s (sim time). Largest move in one simulated second: 50.4 m, so no teleports. No wrong-way time. The profile counted 4 freeways and 3 interchanges. Turned around at the end of the 5 South, the navigator planned again (4 hand-offs). After a road with no way through, it picked the destination up again (11 hand-offs). |
| Speed Survival | Heavy traffic, seeded. 45 s at 116 mph: score 16,244, best streak 28.8 s, 25 clean passes, 1 near miss. At 63 mph the streak is 0 and the best is kept. 8 passes counted for exactly 8 newly scored cars; a re-pass of a car that had already scored didn't count. Ramming a stopped car at 30 m/s ends the run: "Crashed into a sports car", with the board labelled "Local leaderboard · this device only". Two Time Trials: 154 cars identical at the start and after 8 s. |
| Races | The countdown holds you off the gas (0 m/s, moved 0 m, in gear 1) and flat on it (at most 0.1 m/s, 0.11 m). Rivals stay at 0 m/s. Flat out, the autopilot won the Irvine Sprint: P1 in 2:12.0–2:21.7 over three runs, +1,540 credits. (The build as committed won in 2:48.6 in both its runs; why it was slower wasn't traced.) Driving slowly ends "Too far behind" at P4. |
| Abilities | Clear Path: 154 → 125 cars, all 59 in view kept, traffic scale 0.65 then 1, no refire in the cooldown. Focus Time: world at 0.7× then 1×. Locked In: grip ×1.3 then ×1. |
| Progression | 60 s of driving: 178 XP, 64 credits, "Ton Up", saved as profile v1. Showroom: "29,900 more credits needed", "Opens at level 5", then the Brio bought with 11,000 credits left; computed top speed 211 → 201 mph. Ultra Realism: tunnel vision 0 at level 1; 0.42 at level 6 and 155 mph; 0 once switched off. Radio: Coast → Freeway FM → Canyon Radio → off, audio running. |
| Render | 640 × 360. Day, sunset, night, rain, fog and mist rendered. Rain: grip 0.8, wet 1. Fog: visibility 0.14. Night: daylight 0. Live time with a fixed clock: daylight 0 at 02:13 Pacific, 1 at 13:00. Pause holds the car; resume moves it. Reset: 40.0 → 0.7 m/s. Recovers from a lost WebGL context. High and Ultra rebuild mid-drive. |
| Phone | 390 × 844, touch. The menu and Profile fit with no sideways scroll. The top bar is clear of the gear readout. Touch controls are shown. Go to lists all 20 carriageways. |

No page errors in any group.

### Bugs found and fixed

1. **The countdown backed you off the grid.**
   - The countdown holds the car with `brake: 1`. In automatic, holding the brake at a standstill selects reverse
     (the arcade way to back up). So off the gas, the car backed 2.05 m off its grid slot at up to 1.7 m/s, in
     reverse, in Races and Time Trial.
   - The old check only tried it flat on the gas.
   - Fix: `CarPhysics.hold` keeps reverse out while the countdown holds the brakes. Now: 0 m/s, in gear 1.
2. **Barrier stubs in travel lanes at ramp starts.**
   - Barriers are worked out lazily, ±32 samples at a time. For ramps that start at another road, a line meant to
     clear the first three samples ran `w[k] = w[k] && 1`, which turned "not worked out yet" (−1) into a barrier.
   - So if a ramp was first looked at from further along it, it got a 4–6 m barrier stub inside the freeway's
     lanes. Whether a stub appeared depended on what you'd driven past before.
   - Fix: those samples are set to 0, as the comment intended.
3. **Barriers on ramps 2.5 to 3.5 m overhead.**
   - A ramp climbing past a freeway gets barriers once it's 2.5 m clear of it. The physics took barriers within
     3.5 m of the car's height, so it hit barriers over its roof.
   - One stood in the fast lane of the 55 North at 13.13 km, at the I-5 interchange. With seeded Moderate traffic,
     3 of 8 runs of 405 N → 55 N → 91 E ended up off the route. In one, the autopilot hit that barrier at 50 m/s
     and spun onto a ramp backwards.
   - Fix: the physics only takes barrier segments within 2 m of the car's height.
   - After all the fixes, 8 of 8 seeds reached the 91, in 377–396 s with 0–4 contacts.
4. **Crash cushions inside the 91.**
   - Two ramps (ids 443 and 282) stop inside the 91 East and West, near 65.3 km and 10.4 km. They have no road
     after them, so each got a wall and a crash cushion in lane 3.
   - Fix: a road that stops on another road gets no end wall (`Network.hasEndWall`). Rendering uses the same rule.
5. **Barrier segments tens of metres long on a first look.**
   - `wallsNear` read a segment's end from a shared buffer after checking its neighbours. If that check had to work
     out more of the road, it overwrote the buffer, and the segment's end jumped about 64 m along the barrier.
   - On a curve, that chord cuts across the road for one physics step. On a first pass over every road, 24,221 of
     4.6 million segments were longer than 3 m (up to 74.9 m), and 4 crossed within 1.5 m of a road's centre line.
   - Fix: the end is copied before the neighbours are checked. Now 937 are longer than 3 m (up to 24.4 m), the same
     on a first and a second pass, so those are the shape of the roads, not the cache.
6. **Navigation went quiet.**
   - If a reroute found no way (from a ramp you'd spun onto backwards, say), the route was left empty and never
     planned again. The prompt disappeared for the rest of the drive while Go to still showed a destination.
   - Being turned around at the end of a freeway never re-planned either.
   - Fix: `Game.followRoute()` keeps the destination and plans again at the next road and after a turnaround.

**The lane scan.** It finds any barrier within 1 m of a lane's centre line, on every lane of all 20 carriageways
every 4 m.
- Before the fixes: 121 spots. 17 were barriers 2.5–3.5 m overhead and 104 were at road level. The at-grade count
  depends on the order roads are first looked at.
- After: 0.

### Found, not fixed

- **The autopilot isn't a perfect driver in Heavy traffic.** It crashed in 2 of 12 seeded two-minute Survival runs,
  before and after the fixes:
  - It rear-ended a car during its own lane change.
  - A traffic car (not an aggressive one) changed lanes into it about 5 m ahead, closing at 20 m/s.

  The suite seeds Survival and Free Drive traffic so its runs repeat. The game itself still seeds them at random.
- **No planned way north from the far south.** Past about 42.6 km on the 405 South and 53 km on the 5 South, the
  planner has no way back north, because turnarounds and street exits aren't in its graph. The prompt is blank until
  you're turned around at the end, and then it comes back.
- **Switching graphics presets leaks a little.** Each round trip to Ultra leaves about 17–20 more textures alive
  (36 → 56 → 73). The frame rate on Low afterwards is unchanged (1.63 fps before, 1.50 and 1.63 after, at 320×180).
- **Frame rates here are low.** SwiftShader in this sandbox draws Low at about 1.6–2.3 fps, Medium at 0.3–0.7 fps,
  and High and Ultra at about 0.3 fps once warm. At 640 × 360, the first three frames after a switch took 108 s on
  High and 271 s on Ultra. Low runs no faster at 320×180 than at 640×360, so it's limited by geometry (about 400 draw calls and 440k
  triangles), not pixels. This is not a phone measurement.

## 2026-10-09 (later): P2–P4 systems

All of these were built, then checked in Playwright. Results are as printed by the test scripts.

### Profile (`profile.ts`)

Versioned v1 on the device: XP and levels, fictional credits, lifetime stats, freeways driven, nine achievements, and
a Profile screen.

Verified:
- XP and levels accrue from driving.
- "Ton Up" unlocks.
- The Profile screen renders at phone size.

### Weather and time (`env/Environment.ts`)

Verified:
- Six combinations rendered (day, sunset, night, rain, fog, mist) with no errors.
- Rain: grip 0.8, wet 1.
- Fog: visibility 0.14.
- Live mode at 02:13 Pacific gave daylight 0 (correct).

### Drivers and abilities (`drivers.ts`)

| Ability | Verified result |
| --- | --- |
| Clear Path | Removed 0 of 67 cars in view and 26 out of sight; scale 0.65 during, 1 after; the 45 s cooldown blocks a refire |
| Focus Time | Traffic moved at 0.70× |
| Locked In | Grip 1.00 → 1.30 → 1.00 |

Hand poses were checked in screenshots (the watch flex shows the gold watch).

### Races, cars, garage (`race.ts`, `cars.ts`)

Verified:
- The countdown holds you and all rivals at 0 m/s.
- Racing slowly ends "Too far behind" at P4.
- Flat out, the autopilot won the Irvine Sprint, and 1,500 credits and racesWon were added.
- Buying the Brio for 9,000 of 20,000 credits leaves 11,000, and the physics mass becomes 1,250 kg.
- The showroom refuses without enough credits ("29,900 more credits needed") and below the car's level ("Opens at
  level 8").

**Bug found and fixed.** Rivals crept forward at 1 m/s during the countdown.

### Ultra Realism and radio

Verified:
- Locked below level 5.
- At level 6 and 155 mph, tunnel vision reached 0.37, and it switches off on its own.
- The radio cycles Coast → Freeway FM → Canyon Radio → off, with the audio context running.

**Bugs found and fixed:**
- On phones the top bar covered the gear readout. Buttons now have their own row.
- Route shields on the profile were greyed out by a CSS selector.
- Coarse terrain tiles could cover a road in a cut at speed. They now stay below nearby roads.

### Full regression (`final.js`)

Verified:
- Loads in 16.9 s in software rendering.
- 405 N → 55 N in 274 s on the autopilot.
- Night and rain render.
- The High and Ultra presets rebuild mid-drive.
- Recovers from a lost WebGL context.
- Pause and resume work. Reset was checked separately with real frames: 39.9 → 0.5 m/s.
- Speed Survival scored 2,723 points, with a best streak of 27.6 s.
- The race finished P1.
- No page errors.

## 2026-10-09: the real freeway network

### Data

- **OpenStreetMap is blocked here.** The sandbox blocks openstreetmap.org, overpass-api.de and geofabrik.de (proxy
  403).
- **Overture Maps is reachable.** Its public S3 bucket is open, and Overture's transportation theme is derived from
  OSM under the ODbL. We range-read only the parquet row groups that cover OC: 27 row groups in one file.
- **What came out.**
  - 4,166 motorway and trunk segments, with route refs, connectors, levels and destinations.
  - 46,902 street segments, used for overpasses.
- **Elevation.** 324 AWS Terrain Tiles at zoom 13 (USGS 3DEP/NED in the US).
- **The builder** is `tools/oc-network/build.py`, whose README explains it. It produces:
  - 20 carriageways and 1,247 ramp pieces
  - 1,256 junctions and 506 grade-separated crossings
  - 247 street overpasses and 428 exit signs with OSM destination text
- **Builder checks.**
  - 502 of 506 crossings clear 6.5 m. The other 4 are listed in its output.
  - The largest height step at a junction is 0.29 m.
- **Reachability** (offline graph check): every freeway direction can reach every other, except SR-261 South. That
  one really ends at Walnut Ave; in the game it turns you around.

### Engine

- **Rewrite onto the data.** The procedural single road was replaced:
  - `world/Path.ts`: spline paths, one-way, finite.
  - `world/Network.ts`: grid, surfaces, barriers, routing.
  - `world/Roads.ts`: chunk streaming for every path, overlap culling, decks and columns, guide signs, overpasses.
  - `world/Terrain.ts`: real elevation tiles, road embankments and cuts, OC scenery, the sea.
- **Physics** now collides with real barrier segments, gore noses included.
- **Traffic** runs on every nearby carriageway, follows Y junctions, and collides in world space.
- **Phone-first UI.** The Controls screen is gone. The top bar has View, Go to and Pause. The corner window shows a
  map or a sky camera. There are five traffic levels, a start-freeway picker, and a local leaderboard.

### Verified: driving through real interchanges (the autopilot steers, the physics drives)

Each chain is one continuous drive with no teleporting. Route and path switches came from the game's own
`trackPath`. One of the chains had started on I-405 North by mistake: the test script never passed its starting
point through to the browser. That bug was fixed for later runs, and the chain is still a valid drive.

| Chain | Freeways | Result |
| --- | --- | --- |
| I-405 N → 55 N → 91 E → 241 S | 4 | All reached (I-5 S leg ran out of the 900 s test budget on the 241) |
| I-405 N → 55 N → I-5 N → 57 N | 4 | All reached: 405/55 connectors, 55→5 connector, the Orange Crush to the 57 |
| I-405 N → 55 S → 73 S → I-5 S | 4 | All reached: the 73 ends in the 5 at San Juan Capistrano |

Freeways driven so far: I-405, CA-55, CA-91, CA-241, I-5, CA-57 and CA-73.

Later the same day, after the steering change and the ramp-side fix:

| Chain | Result |
| --- | --- |
| I-405 N → 55 N → 91 E → 241 S | All reached again with the new steering |
| 91 W → 55 S → I-5 S | Reached. The 55 South starts from the 91 at a Y |
| I-5 S → 55 S → 405 N, then 55 N → 91 W → 57 S → **22 E** | All reached |
| 241 N → **133 S** → I-5 N → 55 N → 91 E → 241 S, then **133 N** | Both 133 directions reached. The 261 leg ran out of its 1,600 s budget; reaching 241 South from 241 North means a long loop |
| 241 S → **261 S** at the Y (`dbg3.js`) | Hand-off at s = 9,197 m, then 500 m on the 261 |

**All ten freeways have now been driven through real junctions:** I-5, I-405, 22, 55, 57, 73, 91, 133, 241, 261.

**Bug found and fixed.** The autopilot drove past the I-5 South → 133 connector. `sideOf()` judged the ramp's
side against the straight tangent at the split, and the 5 curves there. It now projects onto the curved road.

- **No page errors.** None of the game runs logged a page error. The only error in the logs came from that same test
  script.

### Verified: Speed Survival (`modes.js`)

- 45 s at the autopilot's 116 mph cruise in Heavy traffic: score 1,601, best streak 10.6 s, 8 clean passes,
  1 near miss.
- A car that has already scored can't score again.
- The streak drops to 0 under 100 mph, and the best streak is kept.
- Ramming a car at a closing speed of about 22 m/s ends the run, and the results screen shows.
- The results screen shows the "Local leaderboard · this device only" label. The automated check for this missed it
  first time: the CSS uppercases the label, and the check was case-sensitive. The label itself is there.

### Verified: physics fixes

- **Bug: traffic collisions pumped energy in.** The car you hit was slowed instead of pushed, so contact repeated
  every step. Seen: 275 mph backwards. Fixed the sign of the impulse.
- **Sim mode spinning at about 160 mph.** Three causes:
  - The tyre falloff had a step at 0.12 rad. It's now smooth.
  - The 2.6° steering floor at speed asked for about 13 g. Lock is now speed-sensitive, at about 0.6° at 200 mph.
  - Sim had no stability control at all. It now has a light race-mode one that only acts past about 5° of slide.

  Result, autopilot at handling 1 (`sim.js`):

  | Cruise | Worst slide | Spins |
  | --- | --- | --- |
  | 134 mph | 0.8° | none |
  | 168 mph | 3.6° | none |
  | Flat out (166 mph on the curves) | 14.5°, once | none |

  There was one 14.5° slide flat out. Race-mode stability control caught it.

### Verified: UI at phone size (390 × 844, touch)

- The menu, start picker, Go-to picker, driving HUD and sky camera all render. There's no horizontal scroll.
- Found and fixed: the top bar covered the gear readout, and the grey HUD labels were unreadable against a bright sky.

### Verified: hands

- The thumb used to cross the rim face like a stick. It now lies along the rim's inner side, and the back of the
  hand sits over the rim.

### Not done yet, honestly

- **Performance on a real phone is unmeasured.** In SwiftShader the Low preset drew about 400 to 800 calls and
  500k triangles. Tree canopies were the biggest share and now have a 4× lighter phone version, not yet re-measured.
- **Exits.** There are no exit numbers, and street ramps rejoin by moving you to an on-ramp, not by driving streets.

## Before this log

- **Top Speed OC v1/v2.** A single-file canvas game, committed and published earlier (commit 24ac829).
- **Ultra.** A 3D engine on a procedural freeway. It became the base for this work.

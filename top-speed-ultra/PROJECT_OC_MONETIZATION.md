# OC Ultra: what we sell, for how much, and why

Written 2026-10-16 for the owner's ask: realistic payment options, what exactly to sell inside the game and how much
to charge (custom kits, avatars, cars, getting out like a Sims character at the hangout), with a paywall built the
way Lumevina's was, in test mode until Stripe and Supabase are connected. The catalog this document argues for is
data the game and the paywall read:

- `src/store/catalog.json`: every item for sale, its price, what it grants, and whether it can be sold yet.
- `src/store/cosmetics.json`: what each grant unlocks in the game (paint hexes, wheel styles from
  `src/preview/car-wheel.ts`, driver styles, badges), and how ready the game is to show it.

Prices are proposals for the owner to approve (TODO). Nothing here is legal or tax advice; the points marked
"verify at launch" move often. The Stripe pages could not be opened directly from this machine (the network proxy
refuses stripe.com), so Stripe's figures come from Stripe's own pages as indexed by web search on 2026-10-16.

---

## The short version

- **The rule.** Payments are built but in test mode. Nothing is charged until the owner connects Stripe and Supabase
  and turns live mode on. We sell cosmetics, expansions and support. We never sell power (one exception, the owner's:
  the OC Hypercar Founder Edition, faster in Free Drive only; rule 3a), never sell credits, never sell random
  rewards, and have no premium currency. Everything the game has today stays free.
- **The launch catalog (first 90 days).** A Founder Pack ($10, sold only until December 31, 2026). Two paint packs
  ($3 each). A wheel set for each of the four cars ($3 each). Three driver style sets ($3 each). A pay-what-you-want
  "Fuel the build" tip (from $2). That's 11 items. A livery pack ($5) is in the catalog but can't be sold until the
  livery layer exists in the game.
- **Prices.** Whole dollars, $2 at the least, because Stripe's fixed 30¢ takes a third of a $0.99 sale. At $3 we keep
  $2.61. At $10 we keep $9.41. **One exception, the owner's (2026-10-16):** the OC Hypercar Founder Edition is $4.99.
  Stripe takes $0.44 and we keep $4.55 ($4.47 on an international card).
- **The OC Hypercar Founder Edition** ($4.99, one time, sold until December 31, 2026). A numbered car, being built on
  another branch, so it's `available: false` until it's in the game. It's the one car faster than anything you can
  earn, and only in Free Drive, which has no clock and no rivals (rule 3a). The $10 Founder Pack doesn't include it.
- **Where people buy.** On the web, through Stripe's hosted Checkout page. The phone apps restore your items when
  you sign in. Whether the iOS and Android apps may show a store button is a launch-time decision, because the court
  cases and both stores' fees are still moving.
- **The money, honestly.** Over 90 days, with 200 to 3,000 players reaching the menu (the same counts as
  `PROJECT_OC_LAUNCH_90.md`) and 1 to 3 % of them buying, the store brings in about **$12 to $660 after fees**.
  The store's own costs are about $10 to $85.
  - Against the 90-day plan's full optional spending list (about $280), the low and middle cases lose money.
  - A California LLC's $800 annual tax would sink all three.
  - The store might pay for its own domain and database. It won't pay for the launch, and that's expected.

---

## 1. The rule (replaces "no real money")

The game's old rule was "no real money anywhere". The owner decided on 2026-10-16 to have a store. The new rule:

1. **Test mode until the owner says live.** The paywall is built and works end to end in test mode: the card form
   accepts the test card 4242 4242 4242 4242 and nothing leaves the browser. No real card is ever typed into our own
   fields. Live payments go through Stripe's hosted Checkout page once the owner connects the accounts.
2. **Cosmetics, expansions and support only.** Looks (paint, liveries, wheels, kits, driver styles, outfits, badges),
   new content once it exists (a new car body, a new hangout), and plain support (a tip, a supporter club).
3. **Never sell power.**
   - No car faster than one you can earn at your level.
   - No grip, handling, power, score, XP or credit boosts.
   - No paid abilities and no shorter cooldowns.
   - No paid weather that changes grip.
   - A wheel or a body kit changes how the car looks, never how it drives.

   **3a. The owner's two-tune rule (2026-10-16).** The OC Hypercar Founder Edition is the one car that is faster
   than anything you can earn, and only in Free Drive. Free Drive has no clock and no rivals, but it isn't free of
   scores: ending a drive files it with the distance as its score, saves a best and ranks it on a board kept on the
   device only (`endFreeDrive` in `src/game/Game.ts`, the Free Drive tab of Personal bests in `src/ui/App.tsx`), and
   its run card can be shared. So the store never says "nothing is scored" there. It says: no clock and no rivals,
   your Free Drive bests stay on your device, and Unleashed runs and run cards are marked.
   - **In Free Drive it runs Unleashed:** the highest top speed, the quickest launch and the most grip, downforce
     and braking in the game, and its own ability (Cold Thrust, Ground Lock, Thrust Hop).
   - **In every other mode** (Speed Survival, Races, Time Trial) **it runs the race tune**, with its ability off.
     The race tune is at or under the best car you can earn, the Rossini Corsa, on every measured number
     (`PROJECT_OC_HYPERCAR.md` §5.3, arcade handling 0.35):

     | Measured | Race tune | Rossini Corsa |
     | --- | --- | --- |
     | Top speed | 231 mph | 232 mph |
     | 0-60 / 0-100 mph | 3.12 s / 5.36 s | 3.12 s / 5.35 s |
     | ¼ mile | 10.13 s @ 155 mph | 10.12 s @ 156 mph |
     | 100-0 mph | 84.6 m | 84.3 m |
     | Lateral grip at 25 / 40 / 80 m/s | 1.07 / 1.20 / 0.77 g | 1.25 / 1.21 / 0.79 g |
     | Simulation handling (1.0): 0-60, 100-0, lateral g at 40 / 80 m/s | 4.19 s, 90.8 m, 1.07 / 1.18 g | 4.18 s, 90.6 m, 1.10 / 1.19 g |

     Those are the plan's measurements: the tune run through the game's `CarPhysics.step` at 120 Hz, outside the
     game. A physics test checks them in the game at both handling extremes (milestone M3 on the hypercar branch; it
     isn't built yet). If any measurement in the game puts the race tune over the Corsa, the race tune becomes the
     Corsa's numbers. Races set rivals against your car's own top speed, so a race in the race tune is the same race
     as in a Corsa.
   - **Free Drive's distance earnings are capped at the race tune's top speed** (231 mph), so the paid car doesn't
     earn credits or XP faster.
   - Its Free Drive runs and run cards are marked "Unleashed". **Before `available: true`:** the Free Drive board
     must show that mark on every Unleashed run (or keep those runs off the board), and so must the run card. It
     isn't built yet (the car isn't in the game), so it is written into the car's `needs` in `cosmetics.json`, next
     to the tunes, the earnings cap and the physics test.

   So the no-pay-to-win rule holds in Speed Survival, Races and Time Trial, and the one board an Unleashed run can reach
   (Free Drive's, on your own device) says which runs were Unleashed. The car is sold only once both tunes, the
   earnings cap, the marking and the physics test are in the game (`available: false` until then).
4. **Never sell credits.** OC Credits are earned by driving only. There are no credit packs, no doublers, and no
   club bonus. This also keeps the store out of Stripe's rules on virtual currency and stored value
   ([Stripe restricted businesses][s-restricted]).
5. **No random paid rewards.** No loot boxes, mystery packs or gacha. You see the exact item, on your own car,
   before you pay.
6. **No premium currency.** Prices are in dollars and cents. One price per item. No "gems".
7. **Everything the game has today stays free** (§2).
8. **No ads at launch.**

This rule is now in `CLAUDE.md`, except rule 3a: its "Never sell power" line doesn't name the two-tune exception
yet (§11). Until the owner makes that edit, public copy says "never pay-to-win" and names the exception wherever it
would otherwise say "never power".

## 2. What stays free

Everything that exists today, and the free customisation the UI pass is adding:

- Every freeway, every real exit start, every mode (Free Drive, Speed Survival, Races, Time Trial) and every race
  course.
- The four cars, earned with credits by driving: Rossini GT (the starter), Rossini Brio, Rossini Corsa, Vela E.
- Each car's factory paint, wheels and interior.
- The free Garage palette from the UI pass (`PROJECT_OC_UI_TARGET.md`, U5): six paints per car and two rim styles per
  car. Paid paints and wheels sit on top of this palette. They never replace it and never duplicate it. When U5 lands,
  check its hexes against `cosmetics.json` and rename any clash.
- The three drivers, both presentations, five skin tones, their looks and watches.
- The three abilities: Clear Path, Focus Time and Locked In.
- The radio, the weather and time of day, Ultra Realism, run cards, the local leaderboard, the achievements.
- Visiting the on-foot hangout (Lot 57), whenever it ships.

Why so much stays free: the launch is built on local trust ("It's your freeway"), and the launch kit's drafts tell
people "nothing costs money" (its ambassador answer and store copy in `PROJECT_OC_LAUNCH_KIT.md`; no ambassadors
have been recruited yet). Players who never pay must not be able to tell
that a store exists, except for a Store button.

## 3. The launch catalog (first 90 days)

Lean on purpose: 11 items you can buy, all small, all cosmetic, all built from parameters the renderer already has.
"Net" is what we keep after Stripe's standard US card fee of 2.9 % + 30¢ (§5).

| Item | Price | Net | What you get | Ready? |
| --- | --- | --- | --- | --- |
| **Founder Pack** | $10 | $9.41 | Founder '26 badge (profile, run card), **Founders Sunset** pearl paint, a Founders run-card frame, your name on the Founders roll in the credits (opt-in, approved by the owner), plus both paint packs (8 paints). Sold until **Dec 31, 2026**, then never again | Paints: the finish hook is built (store pass), render review pending. Run-card badge and frame: drawn by the store pass. Profile badge and the roll: to build (small) |
| **Coast Paint Pack** | $3 | $2.61 | Laguna Tidepool, Crystal Cove Sand, Dana Point Navy (metallic), Newport Sunset, for every car | Hook (the store pass built the finish hook, `setPaint(hex, finish)`; the paints stay `hook` until their renders are reviewed) |
| **Freeway Nights Paint Pack** | $3 | $2.61 | 405 Midnight (metallic), Interchange Orange, Toll Road Graphite (satin), Saddleback Dusk (metallic) | Hook (as above) |
| **Rossini GT Wheel Set** | $3 | $2.61 | Irvine Silver five-spoke, Fullerton Black centre-lock, Tustin Graphite aero, each with its own calipers | Hook |
| **Rossini Brio Wheel Set** | $3 | $2.61 | Santa Ana Bronze twin-five, Fullerton Black centre-lock, Laguna Pearl aero | Hook |
| **Rossini Corsa Wheel Set** | $3 | $2.61 | Santa Ana Bronze twin-five, Laguna Pearl five-spoke, Anaheim Gunmetal aero | Hook |
| **Vela E Wheel Set** | $3 | $2.61 | Irvine Silver twin-five, Fullerton Black five-spoke, Laguna Pearl centre-lock | Hook. **Caveat:** the hypercar branch hides the Vela E from new players, which makes this set unsellable to them (below) |
| **Night Shift** driver style | $3 | $2.61 | Black perforated gloves, the **Rossini Notte** steel watch (midnight-blue dial), charcoal bomber cuffs, plum nails | Hook |
| **Golden Hour** driver style | $3 | $2.61 | Bare hands, the **Rossini Ora** gold watch (champagne sunburst dial), cream linen jacket cuffs, sunset-coral nails | Hook |
| **Canyon Run** driver style | $3 | $2.61 | Canyon suede gloves, the **Vela Pulse** smart watch (sunset face), olive field jacket cuffs, sandstone nails | Hook |
| **Fuel the Build** (tip) | pay what you want, from $2 (suggested $5) | $1.64 at $2, $4.55 at $5 | A small "Fuelled the build" badge, the same at any amount. Unlocks nothing else | Badge: to build (small) |
| *Stripes and Roundels Livery Pack* | $5 | $4.55 | Twin 405 Stripes, Coast Side Stripe, Two-Tone Roof, Door Roundel with your number | **Not sellable yet**: needs a livery layer in the paint (`available: false`) |
| *OC Hypercar Founder Edition* | $4.99 | $4.55 | The OC Hypercar, numbered by the server (No. 0001 up); a **Founder Edition** plaque with the number on the sill and console; **OC Founder Silver** paint with Founder Ice lights, on this car only. Unleashed in Free Drive only (rule 3a). No garage slot; can't be sold for credits. Sold until **Dec 31, 2026** (whether it is ever sold again is the owner's open decision, §12). Not in the Founder Pack | **Not sellable yet**: the car is being built on another branch (`claude/hypercar`) and isn't in the game this store ships from (`available: false`) |

**Ready** means it works today: it needs only the entitlement check and the picker. **Hook** means the renderer
already has the parameter but the player can't choose it yet. Examples: `buildCar` takes a caliper colour, and
`addWheel` takes a style, but the wheel style comes from the car's fixed shape. Paint was one colour through
`PlayerCar.setPaint`, always in the factory metallic-flake finish (`paint()` in `src/preview/car-mats.ts`), so every
paid paint, gloss included, needed the finish hook. The store pass (same day) built it: `setPaint(hex, finish)` now
takes the finish numbers from `cosmetics.json`, and the Store's Your items picker applies them. The paints stay
`hook` until a review checks their seat, hood and chase renders (the Fable prompt in `PROJECT_OC_HANDOFF.md`). The
driver looks are fixed per driver in `lookFor`. Each hook is
an afternoon of routine (Opus-class) work. A catalog item is sold live only when what it grants shows up in the game
and has been checked in renders (§9).

### Why these items

- **Paint and wheels** are what players change first in every car game. They're also the cheapest thing we can make
  well: a colour, a finish and a style we already render.
- **One wheel set per car**, rather than one set for all cars, so each set looks right on its car. The paid setups
  never repeat a car's factory wheel (`factory_wheels` in `cosmetics.json`, checked by script). Every style is built
  at one size (`WHEEL` in `car-wheel.ts`) and scaled to the car's own axle, so a wheel set keeps the car's wheel and
  tyre size and changes nothing about grip or gearing (the physics reads `cars.ts`, not the wheel mesh). A
  car's wheel set can be bought only once that car is in your garage. The store says "Earn the Corsa first", so
  nobody pays for something they can't use.
- **Driver styles** fit the game's first-person view: your hands, gloves, sleeves and watch are what you look at for
  the whole drive. The watches are our own designs, named for our own makes (Rossini Notte, Rossini Ora, Vela Pulse).
  No real watch brand is used on purpose. But "Rossini" is also a real watch maker's name: Zhuhai Rossini Watch
  Industry, a Chinese maker owned by Citychamp Watch & Jewelry since 2008 ([China Daily][rossini-cd]), filed a US
  application for the word mark ROSSINI in 2014 (serial 79148981; its current status wasn't checked)
  ([Justia][rossini-tm]). "Vela" is also the model name of a HiFuture smartwatch ([Sharaf DG][vela-hifuture]). So the
  three watch names need the class 14 trademark search, and probably new names, before these styles are sold (§10).
- **A Founder Pack** rewards the launch crowd. It can't go on sale before the OC-only beta ends (Day 46, below), so
  it sells to anyone in the first four weeks of the public launch, not only to the OC testers. It's a one-time
  thank-you with a real end date, not a pressure tactic:
  - The date is fixed and never extended.
  - No countdown timers, and no "only N left" (there's no limit to the number sold).
  - Its exclusives (the badge, Founders Sunset and the frame) are never sold again.
  - It includes both paint packs, so a founder who wants everything doesn't pay twice.
  - The end date is a placeholder. On the 90-day plan's calendar (Day 1 = Monday, October 19) the store can open
    on Day 46 (Thursday, December 3) at the earliest, so the pack sells for about four weeks, to Day 74
    (December 31). If Day 1 moves, the owner decides before sales start: keep December 31 (a shorter window, and
    the '26 on the badge stays true) or move the end with the calendar (TODO, owner).
- **Two founder offers, kept apart.** The $10 Founder Pack and the $4.99 OC Hypercar Founder Edition sell in the same
  window (one constant, `FOUNDER_UNTIL` in `src/store/founder.json`). Neither includes the other, and the store says
  so on the car's card. Their names and looks don't overlap: the pack has the **Founder '26** badge and
  **Founders Sunset** pearl in the sunset colours; the car has the **Founder Edition** plaque and **OC Founder Silver**
  in silver and ice. The catalog checker fails if they ever share a grant or a name.
- **The hidden Vela E makes its wheel set unsellable to new players.** The hypercar branch hides the Vela E from
  new players (`PROJECT_OC_HYPERCAR.md` §1). After that merge, a new player can never earn the Vela E, so the store's
  "Earn the Vela E first" lock refuses them the Vela E Wheel Set, and it sells only to players who already own a
  Vela E. The catalog marks it (`caveat` on `wheels-vela-e`). Decide before that merge: retire the set, or keep it for
  Vela E owners and reword "Earn the Vela E by driving to buy it" (TODO, owner).
- **A tip, not a "VIP"**: some people want to pay for a free local game. Pay-what-you-want lets them. One badge at
  any amount, so there's no ladder to climb.
- **No subscription, battle pass or ads in the first 90 days.** Each of them needs a steady flow of new content, or
  a large audience, and we have neither yet (§4).

## 4. Later, and only once each thing exists

Nothing below is sold, pre-sold or promised before it's built, shown in the game and checked. All these items are in
the catalog as `available: false`, so the paywall can be tested against them.

### New cars

- New cars arrive **earnable by driving** first (credits and a level, like the four today).
- A car may also be sold for money only if **its numbers equal those of a car you can already earn**. The example in
  the catalog is the **Rossini GT Spider** ($5): an open-top body with exactly the GT's numbers in `src/game/cars.ts`.
  It's also in the showroom for credits. Paying skips the credits, never the level gate.
- A car bought with money can't be sold back in the garage for credits. Today the garage pays 60 % of a car's
  credit price when you sell it (`sell` in `src/game/profile.ts`), which would turn dollars into credits.
- A car that is faster, grippier or quicker off the line than what you can earn at your level is never sold. The
  one exception is the owner's: the OC Hypercar Founder Edition, faster only in Free Drive, which has no clock and no
  rivals and marks its Unleashed runs (rule 3a). It's never earnable, takes no garage slot, and can't be sold back
  for credits (`profile.setStoreCars` and `sell` in `src/game/profile.ts`). It's restored on sign-in like every
  other item.
- **The OC Hypercar Founder Edition** ($4.99, `hypercar-founder`). The server numbers each sale, never the device:
  - A per-sku counter in the database (`server/supabase/migrations/0002_founder_serials.sql`). The `stripe-webhook`
    function asks for the number when the payment succeeds, and it's written to the buyer's entitlement rows.
  - One number per Checkout Session: a retried webhook delivery gets the same number back.
  - One live number per player. Two checkouts opened side by side both pass the "already own" check; the second one
    paid is refused (status `refused`), never numbered and refunded in full.
  - Numbers start at **No. 0001** and are never reused. A refunded number is retired, not reissued, and the player's
    entitlement rows go back to their lowest live number, or to none, so the plaque never shows a retired number.
  - A refund never races the numbering: `assign_serial` locks the purchase row before it reads the status, so a
    refund written at the same moment either makes it refuse or waits and then retires the number.
  - Stripe doesn't promise the order of events. A refund that arrives before its `checkout.session.completed`
    looks up the Checkout Session at Stripe and records the purchase as refunded, so the completion grants nothing.
  - **No. 0000** is reserved for owner-mode tests and can never be issued.
  - A player reads their own number and can never write it.
  - The window is checked twice: when the checkout is created, and in the webhook against the time Stripe created
    the Checkout Session. A checkout created before the deadline and paid after it is honoured. A session created
    after it grants nothing and is refunded in full.

### Body kits ("custom kits")

- One kit per car, $5 each: the GT's Coast Aero kit, the Brio's Street kit, the Corsa's Track kit, the Vela E's Aero
  kit.
- Looks only. The car's drag and downforce numbers stay the same, and the store says so: "The Corsa drives exactly
  the same."
- They need kit parts lofted onto each body (`car-body.ts`) and checked from the seat, hood and chase cameras. That
  is days of work, so they come after launch.

### Getting out like a Sims character: the Lot 57 hangout

- The owner's idea of getting out and going to Golden Road is planned as **Lot 57**, our own fictional taproom and
  yard at the real spot on Orangewood Avenue in Anaheim (`PROJECT_OC_ON_FOOT.md`). The real venue's name, sign and
  look are never used, and the store never says "Golden Road". A real business can appear in the game only with a
  signed deal (`PROJECT_OC_BUSINESS.md` §6.2).
- Today it's **a prototype only**. The people builder and the venue are in `src/onfoot/`, but the game has no player
  avatar on foot and no way to get out of the car. **Don't sell it or take pre-orders**, and don't tie a Founder perk
  to it.
- How to price it when it ships:
  - **Free to visit**: get out, walk, sit, order from the alcohol-free menu, watch the simulated crowd. This is the
    game's most talked-about idea, so it should spread, not sit behind a paywall.
  - **Paid avatar outfits, $3 each.** The people builder already has the garment kinds (jacket, leather, blazer,
    tee, jeans, boots and the rest in `src/onfoot/people/params.ts`). The catalog lists two as examples: Lot 57
    Weekend and Lot 57 Night Out.
  - **Maybe one expansion later**: a second hangout with its own streets and things to do, about **$8**, only if
    it's big enough to be worth that. Lot 57 itself stays free.
- The on-foot rules keep applying: simulated crowds, labelled as simulated. No live occupancy, no multiplayer claim.

### Supporter club (optional, after day 90)

- **OC Ultra Club**: $3 a month (we keep $2.59) or $30 a year (we keep $28.62). For that you get a club badge, a new
  club paint each month that you keep after cancelling, and early test builds of new freeways and counties. No
  gameplay perks and no extra credits.
- Open it only after day 90, and only if (a) at least about 50 people have bought something (an estimate to set, not
  a forecast), and (b) there is a plan for 12 months of club paints.
- California's automatic renewal law applies. As amended by AB 2863, it covers contracts made or extended from
  July 1, 2025 ([Barnes & Thornburg, 2025][ca-arl-bt]; [Fenwick][ca-arl-fenwick]; [AB 2863][ca-ab2863]):
  - Before the Join button, shown clearly: the price, how often it bills, that it renews until you cancel, and how
    to cancel.
  - An **unchecked** checkbox the player ticks: their express affirmative consent to the renewal terms. Keep the
    record for at least three years, or one year after the membership ends, whichever is longer.
  - A confirmation email with the terms and how to cancel.
  - **Cancel online** in Account, through the same channel used to join. Stripe's customer portal does this
    ([Stripe customer portal][s-portal]). No forced phone call. Don't block the exit with a save offer.
  - An annual reminder, and clear notice before any price change.
  - Verify the exact notice windows in Business and Professions Code §17602 with a lawyer before the club opens.
  - The FTC's federal "click to cancel" rule was vacated by the Eighth Circuit on July 8, 2025
    ([Fenwick][ftc-vacated]), but state laws like California's still apply.

### Not now, maybe never

- **A battle pass.** It needs new rewards every few weeks, and its "earn it before the season ends" pull runs against
  the no-pressure rule. If one ever comes: it never expires, it's cosmetics only, and it costs about $5 to $8.
  For reference, Fortnite's pass costs 800 V-Bucks, sold as $8.99 for 800 since March 2026
  ([Shacknews, 2026][fn-vbucks]), and Rocket Pass Premium costs 1,000 credits, about $10 ([Immortal Boost][rl-credits]).
- **Ads.** Not at launch. They'd cost the "nothing leaves your device" story and earn almost nothing at our player
  counts.
- **A paid weather pass** (an old design-only idea in the roadmap). All weather is free today. Rain also changes
  grip, so a paid weather pass would sell gameplay. No.

## 5. Prices that survive Stripe's fixed fee

Stripe's standard US price for online cards is **2.9 % + 30¢ per successful charge**, with no setup fee and no
monthly fee. Stripe adds **1.5 %** for international cards and **1 %** when it has to convert currency
([Stripe pricing][s-pricing]). Stripe's minimum charge in US dollars is **$0.50** ([Stripe currencies][s-min]).

The 30¢ is what decides our prices:

| Price | Stripe takes | We keep | Kept | At a 15 % app-store cut we'd keep |
| --- | --- | --- | --- | --- |
| $0.99 | $0.33 | **$0.66** | 67 % | $0.84 |
| $2 | $0.36 | $1.64 | 82 % | $1.70 |
| $3 | $0.39 | **$2.61** | 87 % | $2.55 |
| $4.99 (the hypercar; the owner's exception) | $0.44 | **$4.55** | 91 % | $4.24 |
| $5 | $0.45 | $4.55 | 91 % | $4.25 |
| $10 | $0.59 | **$9.41** | 94 % | $8.50 |
| $3 a month (plus Billing's 0.7 %) | $0.41 | $2.59 | 86 % | — |
| $30 a year (plus Billing's 0.7 %) | $1.38 | $28.62 | 95 % | — |

What that means:

- **$0.99 is out.** Stripe would keep a third of it.
- **$2 is the floor** (the tip's minimum). **$3 is the standard item.** $5 is a bigger pack. $10 is the Founder Pack.
- **Whole dollars.** $3 reads as honest, and Apple has allowed rounded prices such as $3.00 since its 2023 pricing
  change, so the same prices would work in an app later ([Apple, Dec 2022][apple-prices]).
- **The one exception: $4.99 for the OC Hypercar Founder Edition** (the owner's choice, 2026-10-16). Stripe's 2.9 %
  + 30¢ takes $0.44, so we keep **$4.55**, the same as at $5. An international card costs 1.5 % more (7¢): we keep
  $4.47. A refund loses the $0.44; a dispute costs $15 plus the sale. The catalog checker accepts this price for this
  sku only, so any other price that isn't whole dollars still fails.
- **Below about $2.48**, a 15 % store cut costs less than Stripe's fee. Above it, Stripe keeps less. The break-even
  is 0.30 / (0.15 − 0.029) = $2.48.
- **A cart helps.** Three $3 packs in one checkout pay one 30¢: we keep $8.44 instead of $7.84 from three separate
  checkouts. The paywall should let people buy several items at once. Stripe's pay-what-you-want can't share a
  checkout with other items, so the tip always gets its own checkout ([Stripe pay what you want][s-pwyw]).
- **An international card** costs another 1.5 %: about 5¢ on $3, 15¢ on $10.
- **Subscriptions** add Stripe Billing's 0.7 % of billing volume on the pay-as-you-go plan, with no monthly fee
  ([Stripe Billing pricing][s-billing]).
- **Refunds and disputes cost money.** Stripe doesn't return its fee when we refund
  ([Stripe refunds][s-refunds]; [Stripe support][s-refund-fees]), so a refunded $3 sale costs us about $0.39. A card
  dispute costs a **$15** fee that we don't get back, even when we win ([Stripe disputes][s-disputes]). Contesting
  it adds a second **$15** "counter" fee, returned only if we win, on disputes opened after June 17, 2025
  ([Stripe, June 2025 dispute pricing][s-dispute-2025]), so a contested dispute we lose costs $30 in fees. Verify
  both at launch. One dispute wipes out about six $3 sales (about eleven if contested and lost). That's why refunds
  should be easy (§8).
- **Tax tools aren't needed at launch.** Stripe Tax costs 0.5 % per transaction (no-code) or $0.50 per transaction
  (API), and only where we're registered to collect ([Stripe Tax pricing][s-tax]). See §8.6 for why we aren't
  registered anywhere yet.
- **Merchant of record, later.** Stripe Managed Payments handles tax, fraud and disputes worldwide for **3.5 % on top
  of** the normal fees ([Stripe Managed Payments pricing][s-mp]). It's worth a look only if sales abroad become real.

**What the market charges** (for scale, not as a target):

| Game | Item | Price | Source |
| --- | --- | --- | --- |
| Forza Horizon 5 | A car pack (several cars) | $4.99 to $9.99 (Horizon Racing, 4 cars, $4.99; Italian Exotics, 7 cars, $9.99) | [traxion.gg][fh5-dlc]; [Deku Deals][fh5-hr]; [Forza support][fh5-ie] |
| Forza Horizon 5 | Car Pass (34 cars, one a week, plus 8 Formula Drift cars at once) | $29.99 | [GameStop][fh5-pass] |
| Rocket League | Credits; Rocket Pass Premium | 500 credits for $4.99; the pass is 1,000 credits (about $10) | [Immortal Boost, 2026][rl-credits] |
| Fortnite | V-Bucks; Battle Pass | $8.99 buys 800 V-Bucks since March 19, 2026; the pass is 800 | [Shacknews, 2026][fn-vbucks] |
| Trackmania | Standard; Club access | $9.99 a year; $29.99 a year or $59.99 for three | [Trackmania, 2020][tm-official]; [IsThereAnyDeal, Feb 2026][tm-itad] |
| WheelMates (indie RC racer) | Supporter Pack (cosmetic) | $4.99 | [Steam][wheelmates] |
| Go Kart Mania (Switch) | Livery Pack #1 | $0.99 | [Deku Deals][gkm] |
| Smash Karts (browser and iOS) | Gem packs (a premium currency: what we avoid) | $1.99 to $19.99 (its in-app items run $0.99 to $19.99) | [AppPricingLab, May 2026][smashkarts] |

Our $3 packs, $10 Founder Pack and $30-a-year club sit at or below most of these. Only the cheapest items cost less
(Go Kart Mania's $0.99 livery pack, Smash Karts' smallest items), and the fee table above is why we don't go that
low. A small local game shouldn't charge Forza prices, and doesn't need a currency to hide the price.

## 6. Where people buy

### The web (the PWA): the store lives here

- Buying through the game's web page or the installed PWA involves no app store, so there's no store cut and no
  store rule.
- The paywall sends the player to **Stripe's hosted Checkout page**. It doesn't put card fields in our page. Hosted
  Checkout gives us:
  - Apple Pay, Google Pay and Link with no extra work ([Stripe Checkout][s-checkout]).
  - Email receipts ([Stripe receipts][s-receipts]).
  - Pay-what-you-want for the tip.
  - Subscriptions, and the customer portal for the club later.
- **PCI scope** (how much card-security paperwork we carry):
  - Stripe's Checkout and Elements both collect card numbers in an iframe served from Stripe, so card data never
    touches our code. Both qualify for the shortest questionnaire, SAQ A ([Stripe PCI guide][s-pci];
    [Stripe PCI FAQ][s-pci-faq]).
  - Since the January 2025 SAQ A revision, a merchant that **embeds** the payment form must also confirm its page is
    protected from script attacks. A **redirect** to a hosted page doesn't carry that criterion
    ([Compass IT Compliance][pci-compass]; [Jscrambler on FAQ 1588, Feb 2025][pci-faq1588]).
  - So the redirect is the least work and the least risk for a one-person studio.
  - Typing card numbers into our own fields and sending them to our code would mean the full SAQ D. Never.
- **The Lumevina pattern, adapted.** Lumevina's demo validated a card form in the page (Luhn, expiry, CVC; 4242
  succeeds; nothing leaves the browser), with a single "STRIPE INTEGRATION POINT" where live payments plug in. OC
  Ultra keeps exactly that for **test mode**. In **live mode**, the same integration point redirects to Checkout
  and the card form is never shown. Section 9 has the wiring.

### iOS (an App Store wrapper, if and when there is a public one)

The 90-day plan has no iOS app: the Apple developer account is a Day 88–90 decision (`PROJECT_OC_LAUNCH_90.md` §5,
gate B2), and nothing depends on an app store in those 90 days. So the decision below waits for a public App Store
release. **Verify all of this at launch.**

- **The rule.** Digital items unlocked in an iOS app must use Apple's in-app purchase (guideline 3.1.1). On the
  **United States storefront**, since May 1, 2025, apps may include buttons and links to buy on the web
  ([Apple, May 2025][apple-may25]; [App Review Guidelines][apple-guidelines]).
- **The court case.**
  - The Ninth Circuit upheld the contempt finding against Apple in December 2025. It also said Apple may charge some
    fee on linked-out purchases, limited to its actual costs, and sent the rate back to the district court
    ([Cravath][epic-9th]; [Concurrences, Dec 2025][epic-9th-b]).
  - **Until a rate is set, the US link-out commission is zero.** Apple proposed 15 % (10 % for some programs, 5 %
    for Small Business Program apps) on August 13, 2026 ([9to5Mac, 2026-08-13][apple-15]).
  - The Supreme Court agreed on June 30, 2026 to hear Apple's appeal, on the contempt standard only. Apple filed its
    brief on September 14, 2026, and Epic's is due November 13
    ([Apple's merits brief][scotus-brief]; [MacObserver][scotus-narrow]). A decision could come as late as June 2027.
- **Outside the US storefront**, linking out needs Apple's entitlement and its commission. Otherwise use in-app
  purchase, which costs 15 % under the Small Business Program for developers with up to $1 million in proceeds in
  the prior calendar year, and no more than that in the current one ([Apple Small Business Program][apple-sbp]).
- **Unlocking web purchases inside the app.** Apple's guideline 3.1.3(b) lets an app unlock items bought elsewhere
  only if **those items are also sold as in-app purchases in the app** ([App Review Guidelines][apple-guidelines]).
  So the public iOS app either sells the same items through Apple at the same prices (Apple keeps 15 %), or relies
  on the US link-out rule.
- **Our plan.** Sell on the web. When the public iOS app ships, decide between "same items, same prices, through
  Apple" and "US-only link to the web store", based on the rate and rules in force that day. Stripe documents the
  US link-out flow for iOS digital goods with Payment Links ([Stripe iOS digital goods][s-ios]).

### Android (Google Play, a wrapper or a Trusted Web Activity)

As on iOS, the 90-day plan has no Play app (the $25 account is gate B1 at Day 88–90). **Verify all of this at
launch.**

- **In the US**, Google can't require its own billing in Play apps under the Epic v. Google injunction, which is in
  force until November 1, 2027 ([Google Play US policy update][gp-us]).
- **If the app links to our web store**, that's the external content links program, and Google charges fees.
  Developers report transactions and pay from **December 1, 2026** (moved from October 1). Rates depend on whether
  the install is new; there's also a $3.65 fee per game install that comes from a link
  ([Play Console: external content links][gp-links]).
- **If we use Google Play Billing**: from June 30, 2026 in the US, a **10 %** service fee on the first $1 million a
  year, plus a **5 %** billing fee for using Google's checkout ([Google Play lower service fees][gp-fees];
  [Android Developers Blog, June 2026][gp-blog]; [GamesBeat][gp-gamesbeat]). That's about the same 15 % as Apple's.
- **This may change.** Epic and Google filed a new settlement on March 4, 2026 asking for a revised injunction, so
  the terms may move again ([Play Console: external content links][gp-links]).
- **Our plan.** As on iOS, the store is on the web. The Android app restores your items when you sign in, and the
  in-app store button is a launch-time decision.

## 7. The money for 90 days, honestly

### Players

The 90-day plan (`PROJECT_OC_LAUNCH_90.md` §7.3) counts players who reach the menu by Day 90:

- **200**: no channel lands.
- **1,000**: one channel lands.
- **3,000**: Show HN or a creator lands.

Its calendar has the OC beta capped at 100 testers until the public opening on Day 46 (Thursday, December 3, if Day
1 is October 19), so the Founder Pack, if the owner switches it on then, sells for about four weeks before
December 31. The older business draft's 1,000 to 5,000 assumed paid ambassadors and creators (`PROJECT_OC_BUSINESS.md`
§6.3). The $0 plan has none, so its smaller counts are the honest ones.

### Buyers

The owner's brief sets 1 to 3 %. Public figures for free mobile games are around 1 to 2 % of players ever paying.
The sourcing is weak and often old, and the newer blog numbers (0.8 to 1.8 %) have no primary source
([GamesBrief][conv-gb]; [Gitnux, 2026][conv-gitnux]; [MAF][conv-maf]). We have no ads, no currency and no
pressure, so **3 % is optimistic**.

### The basket (assumptions)

- 60 % of buyers take the $10 Founder Pack. The rest buy one $3 item.
- 30 % of buyers come back for one more $3 item.
- 1 player in 400 tips $5.
- A few refunds, and one card dispute in the high case.
- The $4.99 OC Hypercar Founder Edition isn't counted. It isn't on sale until the car is in the game, and nothing
  is forecast for an item before then.

| | Low | Middle | High |
| --- | --- | --- | --- |
| Players reaching the menu by Day 90 | 200 | 1,000 | 3,000 |
| Buyers (1 % / 2 % / 3 %) | 2 | 20 | 90 |
| Founder Packs × $10 | 1 = $10 | 12 = $120 | 54 = $540 |
| First $3 items | 1 = $3 | 8 = $24 | 36 = $108 |
| Second $3 items | 0 | 6 = $18 | 27 = $81 |
| Tips × $5 | 0 | 2 = $10 | 7 = $35 |
| **Gross** | **$13** | **$172** | **$764** |
| Stripe fees ($0.59 per $10, $0.39 per $3, $0.45 per $5) | −$0.98 | −$13.39 | −$59.36 |
| Refunds (fees not returned) | $0 | −$3 (one $3) | −$16 (two $3, one $10) |
| Disputes ($15 fee plus the $10 lost; not contested) | $0 | $0 | −$25 (one) |
| **Net from the store** | **$12.02** | **$155.61** | **$663.64** |

Fees, middle case: 12 × $0.59 + 14 × $0.387 + 2 × $0.445 = $7.08 + $5.42 + $0.89 = $13.39.

### The store's own costs for 90 days

| Item | Cost | Note |
| --- | --- | --- |
| Stripe | $0 a month | Fees only, already counted above ([Stripe pricing][s-pricing]) |
| Supabase (sign-in, orders, entitlements) | **$0** on Free, or **$75** for three months of Pro at $25 | Free gives 500 MB of database, 50,000 monthly active users, two projects, and **pauses after a week with no activity**. Pro ($25 a month, with $10 of compute credit) doesn't pause ([Supabase pricing][sb-pricing]; [Supabase billing][sb-billing]) |
| Sign-in email (custom SMTP) | **$0** | Resend Free: 3,000 emails a month, 100 a day ([Resend pricing][resend]); see §8.4 |
| Domain | **about $10 a year** | Effectively required once live: sign-in links need a verified sending domain. Price per `PROJECT_OC_LAUNCH_90.md` §7.2 |
| Hosting | $0 | GitHub Pages |
| A lawyer's hour on the terms, refund policy and (later) the club terms | about $300 to $600 | The earlier draft's estimate; advised, optional |
| **Total** | **about $10 to $85**, or about $310 to $685 with the lawyer | |

### What's left

| | Low | Middle | High |
| --- | --- | --- | --- |
| Net from the store | $12 | $156 | $664 |
| After the domain only ($10) | **+$2** | **+$146** | **+$654** |
| After the domain and three months of Supabase Pro ($85) | **−$73** | **+$71** | **+$579** |
| After the 90-day plan's full optional list (about $280: domain, flyers, both store accounts, the county name filing, Supabase Pro) | **−$268** | **−$124** | **+$384** |

**Plainly:**

- At the low end the store pays for its domain and nothing else.
- In the middle it covers its own database, not the launch's optional costs.
- Only the high case clears the full optional list.
- If the owner forms a California LLC, its **$800 annual tax** is more than any of the three cases brings in
  ([California FTB, LLC][ftb-llc]).
- The old business draft's lean tier (about $1,500 in all, $900 of it for ambassadors and creators) would be lost
  money in every case.
- Whatever the store earns is taxable income. Keep records and ask an accountant.

The owner has said profit isn't the goal. These numbers agree: the store is a way for people who like the game to
support it, and a test of whether they will.

## 8. The store's rules

### 8.1 Selling honestly

- Before checkout, show the item rendered on your own car or hands, the price in dollars, and the line "Looks only:
  it changes nothing about how any car drives or scores".
- Each purchase has a confirm step. No one-tap buys with a saved card, no confusing buttons, no fake timers.
  - The FTC's $245 million order against Epic (finalised March 14, 2023) was over button layouts that caused
    unwanted charges, and over locking the accounts of people who disputed charges
    ([FTC, Dec 2022][ftc-epic]; [FTC, Mar 2023][ftc-epic-final]).
  - We never lock anyone out for a dispute.
- No loot boxes and no currency. The FTC's $20 million settlement with the maker of Genshin Impact (January 2025)
  was over loot boxes, and virtual-currency prices that hid the real cost from children and teens
  ([PocketGamer.biz][ftc-genshin]).
- Selling in-game items is allowed for the business that runs the game. Stripe's restricted list makes an exception
  for "the operator of the virtual world" ([Stripe restricted businesses][s-restricted]).
- **Say "licence", not "ownership", before checkout.** California's AB 2426 (in force since January 1, 2025, adding
  §17500.6 to the False Advertising Law) bars "buy" or "purchase" wording for a digital good that is really a
  revocable licence. The exception is a seller who either gets the buyer's acknowledgement at the sale, or shows a
  clear notice before checkout that it is a licence, with a link to the terms
  ([Greenberg Glusker][ab2426-gg]; [Greenberg Traurig, Dec 2024][ab2426-gt]; [Fasken, Feb 2025][ab2426-fasken]).
  - Our items are a licence: a refund removes them, and the game can change.
  - So the Store screen shows, next to the Buy button: "You're getting a licence to use these items in OC Ultra,
    not ownership of them. Terms."
  - Store copy never says "own forever".
  - The law firms' summaries mention exemptions (for example, freemium content offered without payment). Whether
    any of them covers paid in-game items isn't settled, so we comply either way.

### 8.2 Age: 13+ to buy, with a neutral age gate

- **The gate.** The store asks "What month and year were you born?" before it collects anything: no default, and no
  hint that 13 is the cutoff (as built in `src/store/account.ts`; the month means nobody passes early in their
  thirteenth birthday year). That's a neutral age screen in the FTC's sense: the amended COPPA rule lets
  mixed-audience services use one to decide who gets COPPA's protections. The rule took effect June 23, 2025, with
  full compliance due April 22, 2026 ([Loeb & Loeb, 2025][coppa-loeb]; [National Law Review][coppa-nlr]).
- **Under 13**: no account, no store, nothing stored but the "under 13" result on the device, so going back doesn't
  re-ask. The whole game stays free to play.
- **13 to 17**: may buy with a parent's or guardian's permission. The terms say so, and the checkout has a checkbox:
  "I'm 18 or over, or a parent or guardian has said yes".
- **Why 13.** An account holds an email address, which counts as personal information under COPPA. Collecting it
  from a child under 13 needs verifiable parental consent, which we can't do. A driving game also appeals to kids,
  so market to teens and adults, and never collect anything before the age question.
- **Minors' refunds.** California lets minors undo contracts (Family Code §6710), and settled cases have produced
  refunds of minors' in-game purchases ([Faegre Drinker, Mar 2024][minors]). Whether a single in-game purchase is a
  contract a minor can undo isn't settled (the same article argues it isn't). We refund a parent's request for a
  minor's purchase, no questions asked.
- **From January 1, 2027**, California's Digital Age Assurance Act (AB 1043, signed October 13, 2025) has operating
  systems and app stores send an age-bracket signal. Apps must ask for it on download and launch, and treat it as
  the main signal of age ([Hunton, 2025][ab1043]). The iOS and Android wrappers must read it. Verify at launch.
- **Texas's SB 2420** already applies to new Apple Accounts in Texas, since June 4, 2026: age assurance, and a
  parent's or guardian's consent for under-18 downloads and in-app purchases ([Apple, June 3, 2026][apple-tx]). It
  applies because the Fifth Circuit stayed the district court's injunction pending appeal (June 4, 2026); the appeal
  itself isn't decided ([Morrison Foerster][tx-mofo]). It is about apps in app stores, so it matters for the
  wrappers, not the web store. Other states may follow. Verify at launch.
- **Stripe's own rule** for the account owner: a Stripe account can be opened at 13, but under 18 a guardian must
  own it before it can take charges ([Stripe support][s-age]). That's about the owner's account, not the players.

### 8.3 Refunds: 14 days for unused items

- **The policy.** Ask for a refund within **14 days** of buying, if you **haven't equipped the item in a drive**. A
  "Request refund" button in Account sends the request, and the owner approves it within a few days. (The button
  isn't built yet; until it is, the terms point to a support email, TODO.)
- Accidental purchases and a minor's purchase without permission are refunded at any time on request.
- Once refunded, the items leave your account. A refunded Founder Pack takes its badge, frame and name on the roll
  with it.
- A tip can be refunded within 14 days, no reason needed.
- **How it compares:**
  - Steam refunds games within 14 days with under 2 hours played, and Valve's own in-game items within 48 hours if
    unused ([Steam refunds][steam]).
  - Fortnite lets you cancel a cosmetic until you equip it or for 24 hours, and gives three return tickets for up
    to 30 days ([Fortnite cancel purchase][fortnite]).
  - Ours is as generous as Steam's window, and simpler.
- **Why generous.** A refund costs us Stripe's ~39¢. A dispute costs $15 (§5). An easy refund is the cheaper
  outcome.

### 8.4 Receipts and sign-in email

- **Receipts.** Turn on Stripe's automatic receipts (Settings → Business → Customer emails: Successful payments and
  Refunds). Stripe then emails a receipt for every payment and every refund ([Stripe receipts][s-receipts-dash]).
- **Sign-in links** come from Supabase Auth, the way Lumevina's magic links do. Supabase's built-in mailer sends
  **2 emails an hour**, and since September 26, 2024 it only sends to the project's own team. So it can't sign in
  players ([Supabase custom SMTP][sb-smtp]; [Supabase production checklist][sb-prod]).
- **The fix.** Live mode needs a custom SMTP sender:
  - Resend's free tier gives 3,000 emails a month and 100 a day ([Resend pricing][resend]).
  - With custom SMTP, Supabase's default is 30 sign-in emails an hour, and it can be raised (as third-party setup
    guides report Supabase's Rate Limits page; check the project's own page).
  - A launch-day spike over 100 sign-ins means the $20-a-month Resend plan, for that month only.

### 8.5 Restore purchases on any device

- Your items live in Supabase, against your account. Sign in with the same email on any phone, laptop or app
  build, and the game loads your items.
- The game keeps a copy on the device, so cosmetics still show offline.
- In test mode everything lives in `localStorage` on the device, as in Lumevina's demo.
- **The pause risk on Supabase Free.** A paused project doesn't answer Stripe's webhook. Stripe retries for **up to
  three days** in live mode ([Stripe webhooks][s-webhooks]); after that, resend the event from the Dashboard. If
  failures go on, Stripe emails a warning and can disable the endpoint; re-enable it in the Dashboard (the exact
  window isn't confirmed; verify at launch). Daily
  sign-ins keep a project active, so the risk is a quiet week. Either check the project weekly, or run Pro ($25 a
  month) for the live months.

### 8.6 Taxes (verify at launch)

- **California** doesn't tax electronically delivered digital goods today.
- **SB 122** (signed June 29, 2026) taxes "digital products" from **January 1, 2027**, but excludes video games
  ([Withum][sb122-withum]; [RSM, 2026][sb122-rsm]; [PwC][sb122-pwc]).
- Whether **in-game cosmetics** count as part of the excluded "video game" isn't confirmed. The CDTFA has proposed
  emergency regulations ([Snell & Wilmer][sb122-sw]). Check them before January 1, 2027.
- **Other states** tax digital goods in different ways, but a seller registers in a state only past its
  economic-nexus threshold: $100,000 of sales into the state in most states, with some also counting 200 sales
  ([Avalara][nexus]). We won't get near either.
- So **no Stripe Tax at launch**.

### 8.7 Privacy and terms (changes needed before live mode)

Today's drafts in `PROJECT_OC_LAUNCH_KIT.md` say "nothing costs money" and "the game sends nothing". With a store,
both change:

- **Privacy.** Signing in sends your email to our database host (Supabase). Paying happens on Stripe's page. We
  never see your card; we get your email, what you bought, and when.
- **CalOPPA.** California requires a privacy policy, posted where people can find it, from any site that collects
  personal information such as an email from Californians ([Termly on CalOPPA][caloppa]).
- **Terms.** Add the store's sections: what's sold, that it's a licence and not ownership (AB 2426, §8.1), looks
  only, 13+ with a parent's OK under 18, refunds, receipts, restore, and (later) the club's renewal terms.

## 9. How the catalog files work (for the paywall build)

### `catalog.json`

An array of items:

```
{ sku, name, kind: 'pack'|'livery'|'kit'|'style'|'tip'|'club', price_cents, currency: 'usd',
  mode: 'payment'|'subscription', interval?: 'month'|'year', window?: { until: 'FOUNDER_UNTIL' },
  serial?: true, grants: [entitlement ids], description, available: true|false,
  unavailable_reason?: 'why, in words', caveat?: 'a note for the owner' }
```

- **The founder window is one constant.** `FOUNDER_UNTIL` in `src/store/founder.json` is
  `2026-12-31T23:59:59-08:00`, the last second of December 31 in Pacific time. A bare `2026-12-31` would mean
  midnight UTC, which is 4 pm Pacific on December 30. The two founder items name it, and every reader resolves it
  from that file: the store (`catalog.ts`), the server's copy (`npm run store:sync` writes the date and
  `founder_until`) and the checker.
- **`serial: true`** (the OC Hypercar Founder Edition): the server numbers each sale (migration 0002).

- **Paint packs** use `kind: 'livery'`. There is no separate paint kind.
- **The tip** adds `custom_amount: { minimum_cents, preset_cents, maximum_cents }`, which maps to Stripe's
  pay-what-you-want settings. Its `price_cents` is the suggested amount.
- **Prices come from the server, never the page.** The server looks up `price_cents` by `sku`. As built,
  `create-checkout` sends that price to Stripe as `price_data` from the server's copy of the catalog
  (`npm run store:sync`); only the tip uses a stored Stripe Price, which the function makes once under the lookup key
  `tip-fuel-the-build` (`server/README.md`).
- **`available: false`** items are never offered. The checkout refuses them, and refuses a `window` item after its
  `until` date.
- **`available: true`** means "on the launch list": the item can be bought in test mode now. In live mode the
  checkout also refuses any item whose grants aren't all `ready` in `cosmetics.json` (`CLAUDE.md`: nothing is sold
  before it exists in the game). At the 2026-10-16 check none is: every paid paint, wheel set and style is `hook`,
  and the badges, frame and roll are `build`.
- **Car-specific items** (a car's wheel set, its kit) can be bought only when that car is in the player's garage.
  The garage lives in the on-device profile today, so the server can't see it. Until the profile syncs to
  Supabase, the game makes this check, and a wrong purchase is refunded (§8.3).

### `cosmetics.json`

- `entitlements`: one entry per grant id, with what it unlocks (hexes, finish, wheel style, rim and caliper, watch
  model and dial, sleeve, nails) and a `status`:
  - `ready`: works today.
  - `hook`: a parameter the renderer has but the player can't pick yet.
  - `build`: new work.
- `free_baseline`: what never goes behind the store.
- `factory_wheels`: so paid wheel setups never repeat a factory one.

`node tools/store-check-catalog.mjs` checks the two files against each other and the code. It has no dependencies,
and exits 1 on any problem. It checks that:

- every grant resolves, and every entitlement is granted by some sku;
- kinds, modes and intervals fit the schema;
- prices are whole dollars of at least $2, except the owner's $4.99 for `hypercar-founder` (that sku, that price);
- only the two founder offers have a window, it is `FOUNDER_UNTIL`, and that ends at 23:59:59 Pacific;
- the two founder offers share no grant and no name;
- a car the store grants is sold only once it's in `src/game/cars.ts`, takes no slot and is never sold back;
- a numbered sku is a one-time payment whose counter a migration seeds;
- an entitlement marked `exclusive: X` is granted by sku X only;
- a sku that grants a car (a `vehicle`) or a server-numbered item (`serial: 'server'`) is numbered (`serial: true`)
  and sold in the founder window only;
- no available item grants something still to be built, except the badges, the frame and the roll, which are
  built with the store (it doesn't check `hook` grants; the live-mode rule above covers those);
- every store wheel style (`cosmetics.json` `wheel_styles`) is in `WheelStyle` in `car-wheel.ts` (`src/preview/`, or
  `src/game/vehicle/` if it moves). A style that type holds and the store doesn't list is valid only as a car's own
  factory wheel (a `wheel:` in `car-shape.ts`, like the OC Hypercar's car-only `multi`) and no paid setup may use it;
  a style no car wears and the store doesn't list fails. No paid wheel setup repeats a factory one;
- the tip stays above Stripe's $0.50 minimum;
- no real brand word appears.

It passed on 2026-10-16 (21 skus, 11 available, 42 entitlements), and it fails as it should on a planted $0.99
price and a missing grant. It passed again at the evening fact-check through `npm run store:check`, which also
checks the server's copy, and the store group of the regression suite now runs both (`tests/regression.mjs`).

### The wiring (Lumevina's shape, adapted)

**One payment module with one STRIPE INTEGRATION POINT.**

- In **test mode**, `process()` validates the demo card (Luhn, expiry, CVC; 4242 4242 4242 4242 succeeds), writes
  the order and the entitlements to `localStorage`, and nothing leaves the browser.
- In **live mode**, it calls a Supabase Edge Function, `create-checkout`. As built, the function takes one sku and
  the signed-in user (one item per checkout; the cart is still to build). It checks availability, the window, that a
  live item is built and in the game, the 13+ profile, the 18-or-guardian tick (and the renewal tick for the club),
  and that you don't already own everything the item grants. Then it creates a Stripe Checkout Session from the
  server-side price (`client_reference_id` = the user's id; email prefilled) and returns its URL. The page redirects
  there. Car ownership is checked in the game, not here (above).

**The simplest live start.**

- One Stripe Payment Link per sku, made in the Dashboard. The game appends `client_reference_id` and
  `prefilled_email` to the link, and Stripe passes the id back in the `checkout.session.completed` webhook
  ([Stripe Payment Link URL parameters][s-pl-params]). No session-creating server code is needed.
- This matches the studio's `PAYMENT_LINKS` convention.
- Move to Checkout Sessions when the cart is wanted (one 30¢ for several items).
- The store pass went straight to Checkout Sessions (`server/`), so Payment Links are now only a fallback.

**The webhook and the database.**

- A second Edge Function, `stripe-webhook`, verifies Stripe's signature and handles three kinds of event (as
  built):
  - `checkout.session.completed` (and `.async_payment_succeeded`): write the `purchases` row and the
    `entitlements` rows, once per Checkout Session.
  - `charge.refunded` (a full refund): mark the purchase refunded and revoke its grants, except any that another
    paid purchase of yours also grants.
  - `customer.subscription.deleted`: end the club purchase and revoke its while-subscribed grants. The
    `invoice.paid` handler for each month's club paint is still to build.
- The game reads `entitlements` after sign-in.
- Supabase row-level security: a player reads only their own rows, and only the webhook (service role) writes them.

**Sign-in**: a Supabase magic link, as in Lumevina. In test mode it signs straight in.

**Tables** (the paywall build owns the schema; as built in `server/supabase/migrations/0001_oc_ultra_store.sql`):

- `profiles`: user id, display name, `is_13_plus` (never the birth date), created at. The 18-or-guardian tick is
  recorded in each Checkout Session's metadata, not on the profile.
- `purchases`: id, user id, sku, the Stripe session, payment intent and subscription ids, amount, currency, status
  (paid, refunded or ended; 0002 adds refused, for a founder purchase the webhook refunds), the Founders roll name,
  timestamps.
- `entitlements`: user id, entitlement id, the sku that granted it, granted at, revoked at, and (0002) the serial.
- `serial_counters` and `serials` (0002): the next number per numbered sku, and every number ever issued, with its
  purchase, its owner and when it was retired. Players read their own rows; only the webhook writes, through
  `assign_serial`. The webhook's numbering is tested end to end by `server/supabase/tests/serial-webhook.mjs`, and
  `server/supabase/tests/rls-probe.sql` (run by `run-local.sh`) probes both tables and both functions as a player and
  as an anonymous visitor.
- `waitlist` and `invite_codes`, for the launch plan.
- Still to build: refund requests (no table yet; the support email until then), and, before the club,
  `club_consents`: what was shown, when it was ticked, kept three years.

## 10. Before live mode: checklist

The owner (on their own machine; never share keys in chat):

- [ ] Stripe account. Business name and statement descriptor (TODO: "OC ULTRA" or the legal name). Support email
  (TODO). Automatic receipts on.
- [ ] Supabase project. Custom SMTP (Resend) for sign-in email. Decide Free with a weekly check, or Pro for the live
  months.
- [ ] Approve the catalog's prices (TODO). The built checkout needs no Stripe Products: it sends each price as
  `price_data`, and makes the tip's Price itself the first time (`server/README.md`).
- [ ] The webhook endpoint and its signing secret set in Supabase's function secrets.
- [ ] Decide individual or LLC (the $800 a year matters at these numbers).
- [ ] A lawyer's hour: terms, refund policy, privacy policy (and the club terms before the club opens).
- [ ] Search the trademark office for "OC Ultra" before printing or selling anything under the name (free at USPTO).
  Also search "Rossini" and "Vela" in class 14 (watches) before selling the Rossini Notte, Rossini Ora and Vela
  Pulse styles. Both names are already on real watches (§3), so expect to rename the three watches.

The build (routine, Opus-class, each checked in renders and the suite):

- [ ] The hooks: wheel style, rim and caliper overrides per car; paint finishes in `setPaint` (built by the store
  pass; render review pending); driver-look overrides and watch dial colours; the badge slot (on the run card:
  built; on the profile: to build), the Founder frame (on the run card: built) and the Founders roll. Then switch on
  each item when it shows in the game.
- [ ] The Store screen: item renders on your own car or hands, the price, "Looks only", the AB 2426 licence
  notice, a cart, the age gate, the "Earn the Corsa first" lock.
- [ ] Account: sign in, your items, restore, request a refund, and (later) manage the club.
- [ ] Update `PROJECT_OC_LAUNCH_KIT.md`:
  - Store copy: "Free to play. Optional cosmetics."
  - The ambassador answer to "Is it free?": "Yes. Every freeway, every mode and every car you can earn is free. There
    are optional looks you can buy." Once the OC Hypercar Founder Edition is on sale, add: "and one founder car for
    $4.99, faster in Free Drive only."
  - The privacy and terms sections (§8.7).
- [ ] Regression checks: `tools/store-check-catalog.mjs`; a test-mode purchase with 4242 granting the right items; a
  refund removing them; an under-13 answer blocking the store; nothing in the store changing a car's `SPEC` or the
  scoring.

## 11. What this changes elsewhere

- `CLAUDE.md`: "No real money" is replaced by the store rule (done in this pass). Rule 3a still needs adding to its
  "Never sell power" line (2026-10-17: not there yet; an edit for the owner to approve), for example: "One exception
  (owner, 2026-10-16): the OC Hypercar Founder Edition runs Unleashed in Free Drive only (no clock, no rivals; its
  Unleashed runs marked on the device-only board and run cards); in Races, Time Trial and Speed Survival it runs a
  race tune at or under the best earnable car with its ability off, and its Free Drive earnings are capped at the
  race tune's top speed (`PROJECT_OC_MONETIZATION.md` rule 3a)."

- `PROJECT_OC_ROADMAP.md`:
  - "Payments stay out entirely" (P5) and the design-only weather pass (P3) are now superseded by this document.
  - The weather pass stays out, for the reason in §4.
- `PROJECT_OC_BUSINESS.md` §6.2: option 3 (cosmetics) is now the plan, sold on the web first.
- `PROJECT_OC_LAUNCH_KIT.md`: the lines listed in §10.
- The UI pass (U5): its free palette must not clash with the paid paints and wheels (§2).
- **For a Fable review** (per the triage rule in `CLAUDE.md`, security and business-rule design are Fable-class):
  the paywall's server side (webhook signature check, row-level security, server-side price lookup, refund
  revocation) and these rules. A ready prompt (the store pass queued a newer one, naming the built files, under
  "Fable queue" in `PROJECT_OC_HANDOFF.md`; use that one):

```
Fable prompt. Project OC (top-speed-ultra), store review. Read CLAUDE.md, PROJECT_OC_MONETIZATION.md,
src/store/catalog.json, src/store/cosmetics.json and the paywall code once it exists. Rules: test mode until the
owner turns live mode on; cosmetics, expansions and support only; no power, no credits, no loot boxes, no premium
currency; everything in the game today stays free; 13+ to buy. Review adversarially: can a client change a price,
buy an unavailable or expired item, buy a car-specific item without the car, keep items after a refund, read
another player's rows, or replay a webhook? Does any purchasable item change SPEC, grip, scoring, credits or XP?
Are the California renewal terms (for the club, later) and the age gate as described? Proof: a short list of
findings with file and line, the fixes for severity 4–5, and the store's regression checks passing in
`npm test`. Log in PROJECT_OC_PROGRESS.md.
```

## 12. Placeholders (TODO)

- Every price in `catalog.json` is a proposal for the owner to approve.
- The Founder window end, `FOUNDER_UNTIL` = `2026-12-31T23:59:59-08:00` in `src/store/founder.json`, shared by both
  founder offers (Day 74 on the 90-day calendar, about four weeks after the
  store can first open on Day 46): if Day 1 moves, decide before sales start whether the date or the window moves
  (§3); never extend it once sales start.
- The support email for refunds and receipts.
- The Stripe business name and statement descriptor.
- The legal seller: an individual or an LLC.
- The domain, if any.
- The lawyer's review of the terms, refund policy, privacy policy and (later) the club terms.
- The club's opening threshold (about 50 buyers) is an estimate to set, not a forecast.
- The OC Hypercar Founder Edition's promise: is it the Founder Edition and its exclusives that are never sold again,
  or the car itself (`PROJECT_OC_HYPERCAR.md` §7)? Until the owner decides, the car's copy says only "Sold until
  December 31, 2026" (the store card, the catalog, the deck), with no "never again"; the owner decides before sales
  start, and the copy then says exactly that.
- Ultra graphics as the paid tier (decision 15, 2026-10-21; `PROJECT_OC_DECISIONS.md` in the main checkout): only
  the flag exists, `ultraUnlocked()` and `ULTRA_ENTITLEMENT = 'graphics-ultra'` in `src/store/entitlements.ts`, with
  no sku, no price and no entry in `catalog.json` or `cosmetics.json`. A test-mode build unlocks it for everyone and
  owner mode unlocks it anywhere. The Ultra preset is in the game for free today, so `CLAUDE.md`'s "everything the
  game has today stays free" needs the owner's edit before Ultra is ever sold, as rule 3a does for "never sell
  power"; the price, and whether players who had Ultra before keep it, are the owner's.
- Optional hardening before live mode (from the 2026-10-19 review, not built):
  - In live mode, call `restore()` at boot when a player is signed in. Today a locally edited entitlement cache can
    keep `oc-hyper`, or show a made-up number, on that device until the next Restore (the server's rows are right;
    only that device's display is wrong).
  - A lost card dispute (`charge.dispute.closed` with status `lost`) should retire the number and take the car back,
    as a refund does. The webhook ignores dispute events today.
- Owner mode (`#owner` on the hypercar branch) unlocks the car on any test build. Before any real sale it must be
  compiled out of public builds or tied to the owner's account (`PROJECT_OC_HYPERCAR.md` §8, M0).
- The Vela E Wheel Set once the Vela E is hidden: retire it, or keep it for Vela E owners (§3).

---

## Sources

Checked on 2026-10-16 by web search. The date shown is the page's own date where it has one. Stripe pages are
undated live pages, read through search results because stripe.com couldn't be opened from this machine. A
fact-check pass the same day could open only developer.apple.com directly (the Apple lines below marked "read
directly"); every other figure stands as found by search, so re-check it at launch. A second, adversarial
fact-check the same evening re-read the Apple pages directly (unchanged) and re-checked the other figures by search;
stripe.com, supabase.com and Google's help pages still couldn't be opened from here. The sources it added are marked
"(fact-check)".

Stripe
- https://stripe.com/pricing (live page; 2.9 % + 30¢, +1.5 % international, +1 % conversion, no monthly fee)
- https://docs.stripe.com/currencies (live page; $0.50 minimum)
- https://stripe.com/billing/pricing (live page; 0.7 % of Billing volume, pay as you go)
- https://stripe.com/tax/pricing and https://support.stripe.com/questions/understanding-stripe-tax-pricing (live pages)
- https://support.stripe.com/questions/managed-payments-pricing (live page; 3.5 % on top)
- https://docs.stripe.com/refunds (live page; fees not returned)
- https://support.stripe.com/questions/understanding-fees-for-refunded-payments (live page)
- https://docs.stripe.com/disputes/how-disputes-work (live page; $15 dispute fee, not returned)
- https://support.stripe.com/questions/june-2025-pricing-updates-for-disputes (live page; a $15 counter fee on contested disputes opened after June 17, 2025, returned on a win; fact-check)
- https://docs.stripe.com/payments/checkout/pay-what-you-want (live page)
- https://stripe.com/payments/checkout (live page; Apple Pay, Google Pay, Link)
- https://docs.stripe.com/payments/checkout/receipts (live page)
- https://docs.stripe.com/receipts (live page; Customer emails settings)
- https://stripe.com/guides/pci-compliance (live page)
- https://support.stripe.com/questions/pci-compliance-faq (live page)
- https://docs.stripe.com/customer-management/configure-portal (live page)
- https://docs.stripe.com/webhooks (live page; retries up to three days in live mode)
- https://stripe.com/legal/restricted-businesses (live page; in-game items allowed for the operator)
- https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account (live page)
- https://docs.stripe.com/mobile/digital-goods/payment-links (live page; US iOS link-out)
- https://docs.stripe.com/payment-links/url-parameters (live page; client_reference_id, prefilled_email)

PCI
- https://www.compassitc.com/blog/saq-a-requirements-6.4.3-11.6.1-what-the-eligibility-change-means (2025)
- https://jscrambler.com/blog/faq-1588-saq-a-clarifications-and-questions/ (2025; FAQ 1588 of Feb 28, 2025)

Apple
- https://developer.apple.com/news/?id=9txfddzf (May 1, 2025, read directly 2026-10-16; US storefront guideline update)
- https://developer.apple.com/app-store/review/guidelines/ (last updated June 8, 2026, read directly 2026-10-16; 3.1.1, 3.1.1(a), 3.1.3(b))
- https://developer.apple.com/app-store/small-business-program/ (live page, read directly 2026-10-16; 15 %, up to $1M in proceeds)
- https://developer.apple.com/news/?id=sg176nne (June 3, 2026; Texas SB 2420 for new Apple Accounts from June 4, 2026; read directly 2026-10-16)
- https://www.apple.com/newsroom/2022/12/apple-announces-biggest-upgrade-to-app-store-pricing-adding-700-new-price-points/ (Dec 6, 2022; rounded price endings)
- https://www.cravath.com/news-insights/epic-games-ninth-circuit-win-affirming-civil-contempt-finding.html (Dec 2025)
- https://www.concurrences.com/en/bulletin/news-issues/december-2025/the-us-court-of-appeals-for-the-ninth-circuit-upholds-in-part-and-limits-in (Dec 2025)
- https://9to5mac.com/2026/08/13/apple-proposes-commissions-of-up-to-15-for-off-app-store-purchases-in-the-us/ (Aug 13, 2026)
- https://www.supremecourt.gov/DocketPDF/25/25-1311/424150/20260914154510009_2026-09-14%20No.%2025-1311%20Apple-Epic%20Merits%20Opening%20Brief.pdf (Sep 14, 2026; cert granted June 30, 2026)
- https://www.macobserver.com/news/supreme-court-apple-epic-appeal-question-1-narrow/ (2026; Epic's brief due Nov 13)

Google
- https://support.google.com/googleplay/android-developer/answer/15582165 (live page; US policy under the injunction)
- https://support.google.com/googleplay/android-developer/answer/16470497 (live page; fee reporting moved to Dec 1, 2026; $3.65 per game install; Mar 4, 2026 settlement)
- https://support.google.com/googleplay/android-developer/answer/16954621 (live page; 10 % on the first $1M from June 30, 2026)
- https://android-developers.googleblog.com/2026/06/play-expanded-billing.html (June 2026)
- https://gamesbeat.com/google-play-offers-expanded-billing-choices-and-lower-fees-for-game-devs/ (June 2026; the 5 % billing fee)

California and federal law
- https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect (2025)
- https://fenwick.com/insights/publications/california-tightens-requirements-for-automatically-renewing-subscriptions (2024)
- https://calmatters.digitaldemocracy.org/bills/CA_202320240AB2863 (AB 2863, signed Sep 24, 2024)
- https://www.fenwick.com/insights/publications/eighth-circuit-vacates-ftcs-click-to-cancel-rule (July 2025)
- https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule (May 2025)
- https://natlawreview.com/article/ftc-publishes-final-coppa-rule-amendments (2025)
- https://www.hunton.com/privacy-and-cybersecurity-law-blog/california-introduces-new-age-verification-requirements-for-software-applications (2025; signed Oct 13, 2025, operative Jan 1, 2027)
- https://www.faegredrinker.com/en/insights/publications/2024/3/does-californias-right-for-minors-to-disaffirm-contracts-apply-to-online-purchases (Mar 8, 2024)
- https://www.greenbergglusker.com/publications/new-california-law-ab-2426-licensing-disclosures-for-digital-goods (2024; AB 2426)
- https://www.gtlaw.com/en/insights/2024/12/ab-2426-new-california-law-requires-clear-licensing-disclosures-for-digital-goods (Dec 2024)
- https://fasken.com/en/knowledge/2025/02/new-california-law-requires-digital-stores-to-disclose-license-only-purchases (Feb 2025)
- https://termly.io/resources/articles/caloppa/ (live page)
- https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law (updated 2026; the Fifth Circuit's stay of the SB 2420 injunction; fact-check)
- https://www.swlaw.com/publication/cdtfa-proposes-emergency-regulations-to-implement-californias-new-sales-and-use-tax-on-digital-products/ (2026; fact-check)
- https://www.withum.com/resources/california-enacts-sb-122-sales-tax-expansion-to-digital-products/ (2026)
- https://rsmus.com/insights/tax-alerts/2026/california-expands-sales-tax-to-electronically-delivered-software.html (2026)
- https://www.pwc.com/us/en/state-local-tax/newsletters/salt-insights/assets/pwc-california-imposes-sales-and-use-tax-on-digital-products-and-saas.pdf (2026)
- https://www.avalara.com/us/en/blog/states-eliminating-economic-nexus-transaction-thresholds.html (2026)
- https://www.ftb.ca.gov/file/business/types/limited-liability-company/index.html (live page; $800 annual tax)
- https://www.ftc.gov/news-events/news/press-releases/2022/12/fortnite-video-game-maker-epic-games-pay-more-half-billion-dollars-over-ftc-allegations (Dec 19, 2022)
- https://www.ftc.gov/news-events/news/press-releases/2023/03/ftc-finalizes-order-requiring-fortnite-maker-epic-games-pay-245-million-tricking-users-making (Mar 14, 2023)
- https://www.pocketgamer.biz/hoyoverse-agrees-to-20-million-settlement-with-ftc-over-loot-boxes (Jan 2025)

Refund norms
- https://store.steampowered.com/steam_refunds/ (live page)
- https://www.fortnite.com/cancel-purchase (live page)

Prices in other games
- https://traxion.gg/a-guide-to-forza-horizon-5s-dlc/ (launch-era guide)
- https://www.dekudeals.com/items/forza-horizon-5-horizon-racing-car-pack (live listing; $4.99, 4 cars; fact-check)
- https://support.forza.net/hc/en-us/articles/19615210110483-Forza-Horizon-5-Italian-Exotics-Car-Pack-FAQ (2023; $9.99; fact-check)
- https://www.gamestop.com/video-games/xbox-series-x%7Cs/products/forza-horizon-5-car-pass-dlc/11171841.html (live listing)
- https://immortalboost.com/blog/rocket-league/rl-credits/ (2026; a secondary guide)
- https://www.shacknews.com/article/148255/fortnite-v-bucks-price-increase (March 2026)
- https://www.trackmania.com/news/956 (2020)
- https://isthereanydeal.com/game/trackmania/info (updated Feb 4, 2026)
- https://store.steampowered.com/app/5108990/WheelMates__Supporter_Pack/ (live listing)
- https://www.dekudeals.com/items/go-kart-mania-livery-pack-1 (released Aug 23, 2024)
- https://apppricinglab.com/app/apple/1473010859 (updated May 2026)

Watch names (fact-check)
- https://trademarks.justia.com/owners/zhuhai-rossini-watch-industry-ltd-2889699 (ROSSINI word mark, serial 79148981, filed May 22, 2014; status not checked)
- https://govt.chinadaily.com.cn/s/201802/13/WS5b786486498e855160e8e1d4/zhuhai-rossini-watch-industry-ltd.html (2018; Rossini watches, Citychamp since 2008)
- https://uae.sharafdg.com/product/hifuture-vela-smartwatch-black/ (live listing; the HiFuture VELA smartwatch)

Conversion rates (weakly sourced; used only to say 3 % is optimistic)
- https://gamesbrief.com/?p=9113 (2012–2013)
- https://gitnux.org/mobile-games-statistics/ (2026)
- https://maf.ad/en/blog/mobile-game-conversion-rates/ (undated)

Supabase and email
- https://supabase.com/pricing (live page; Free 500 MB, 50,000 MAU, pause after a week; Pro $25)
- https://supabase.com/docs/guides/platform/billing-on-supabase (live page)
- https://supabase.com/docs/guides/auth/auth-smtp (live page; 2 emails an hour, team-only since Sep 26, 2024)
- https://supabase.com/docs/guides/deployment/going-into-prod (live page)
- https://resend.com/pricing (live page; Free 3,000 a month, 100 a day)

[s-pricing]: https://stripe.com/pricing
[s-min]: https://docs.stripe.com/currencies
[s-billing]: https://stripe.com/billing/pricing
[s-tax]: https://stripe.com/tax/pricing
[s-mp]: https://support.stripe.com/questions/managed-payments-pricing
[s-refunds]: https://docs.stripe.com/refunds
[s-refund-fees]: https://support.stripe.com/questions/understanding-fees-for-refunded-payments
[s-disputes]: https://docs.stripe.com/disputes/how-disputes-work
[s-dispute-2025]: https://support.stripe.com/questions/june-2025-pricing-updates-for-disputes
[s-pwyw]: https://docs.stripe.com/payments/checkout/pay-what-you-want
[s-checkout]: https://stripe.com/payments/checkout
[s-receipts]: https://docs.stripe.com/payments/checkout/receipts
[s-receipts-dash]: https://docs.stripe.com/receipts
[s-pci]: https://stripe.com/guides/pci-compliance
[s-pci-faq]: https://support.stripe.com/questions/pci-compliance-faq
[s-portal]: https://docs.stripe.com/customer-management/configure-portal
[s-webhooks]: https://docs.stripe.com/webhooks
[s-restricted]: https://stripe.com/legal/restricted-businesses
[s-age]: https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account
[s-ios]: https://docs.stripe.com/mobile/digital-goods/payment-links
[s-pl-params]: https://docs.stripe.com/payment-links/url-parameters
[pci-compass]: https://www.compassitc.com/blog/saq-a-requirements-6.4.3-11.6.1-what-the-eligibility-change-means
[pci-faq1588]: https://jscrambler.com/blog/faq-1588-saq-a-clarifications-and-questions/
[apple-may25]: https://developer.apple.com/news/?id=9txfddzf
[apple-guidelines]: https://developer.apple.com/app-store/review/guidelines/
[apple-sbp]: https://developer.apple.com/app-store/small-business-program/
[apple-tx]: https://developer.apple.com/news/?id=sg176nne
[apple-prices]: https://www.apple.com/newsroom/2022/12/apple-announces-biggest-upgrade-to-app-store-pricing-adding-700-new-price-points/
[epic-9th]: https://www.cravath.com/news-insights/epic-games-ninth-circuit-win-affirming-civil-contempt-finding.html
[epic-9th-b]: https://www.concurrences.com/en/bulletin/news-issues/december-2025/the-us-court-of-appeals-for-the-ninth-circuit-upholds-in-part-and-limits-in
[apple-15]: https://9to5mac.com/2026/08/13/apple-proposes-commissions-of-up-to-15-for-off-app-store-purchases-in-the-us/
[scotus-brief]: https://www.supremecourt.gov/DocketPDF/25/25-1311/424150/20260914154510009_2026-09-14%20No.%2025-1311%20Apple-Epic%20Merits%20Opening%20Brief.pdf
[scotus-narrow]: https://www.macobserver.com/news/supreme-court-apple-epic-appeal-question-1-narrow/
[gp-us]: https://support.google.com/googleplay/android-developer/answer/15582165
[gp-links]: https://support.google.com/googleplay/android-developer/answer/16470497
[gp-fees]: https://support.google.com/googleplay/android-developer/answer/16954621
[gp-blog]: https://android-developers.googleblog.com/2026/06/play-expanded-billing.html
[gp-gamesbeat]: https://gamesbeat.com/google-play-offers-expanded-billing-choices-and-lower-fees-for-game-devs/
[ca-arl-bt]: https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect
[ca-arl-fenwick]: https://fenwick.com/insights/publications/california-tightens-requirements-for-automatically-renewing-subscriptions
[ca-ab2863]: https://calmatters.digitaldemocracy.org/bills/CA_202320240AB2863
[ftc-vacated]: https://www.fenwick.com/insights/publications/eighth-circuit-vacates-ftcs-click-to-cancel-rule
[coppa-loeb]: https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule
[coppa-nlr]: https://natlawreview.com/article/ftc-publishes-final-coppa-rule-amendments
[ab1043]: https://www.hunton.com/privacy-and-cybersecurity-law-blog/california-introduces-new-age-verification-requirements-for-software-applications
[minors]: https://www.faegredrinker.com/en/insights/publications/2024/3/does-californias-right-for-minors-to-disaffirm-contracts-apply-to-online-purchases
[caloppa]: https://termly.io/resources/articles/caloppa/
[sb122-withum]: https://www.withum.com/resources/california-enacts-sb-122-sales-tax-expansion-to-digital-products/
[sb122-rsm]: https://rsmus.com/insights/tax-alerts/2026/california-expands-sales-tax-to-electronically-delivered-software.html
[sb122-pwc]: https://www.pwc.com/us/en/state-local-tax/newsletters/salt-insights/assets/pwc-california-imposes-sales-and-use-tax-on-digital-products-and-saas.pdf
[nexus]: https://www.avalara.com/us/en/blog/states-eliminating-economic-nexus-transaction-thresholds.html
[ftb-llc]: https://www.ftb.ca.gov/file/business/types/limited-liability-company/index.html
[ftc-epic]: https://www.ftc.gov/news-events/news/press-releases/2022/12/fortnite-video-game-maker-epic-games-pay-more-half-billion-dollars-over-ftc-allegations
[ftc-epic-final]: https://www.ftc.gov/news-events/news/press-releases/2023/03/ftc-finalizes-order-requiring-fortnite-maker-epic-games-pay-245-million-tricking-users-making
[ftc-genshin]: https://www.pocketgamer.biz/hoyoverse-agrees-to-20-million-settlement-with-ftc-over-loot-boxes
[steam]: https://store.steampowered.com/steam_refunds/
[fortnite]: https://www.fortnite.com/cancel-purchase
[fh5-dlc]: https://traxion.gg/a-guide-to-forza-horizon-5s-dlc/
[fh5-pass]: https://www.gamestop.com/video-games/xbox-series-x%7Cs/products/forza-horizon-5-car-pass-dlc/11171841.html
[fh5-hr]: https://www.dekudeals.com/items/forza-horizon-5-horizon-racing-car-pack
[fh5-ie]: https://support.forza.net/hc/en-us/articles/19615210110483-Forza-Horizon-5-Italian-Exotics-Car-Pack-FAQ
[rossini-tm]: https://trademarks.justia.com/owners/zhuhai-rossini-watch-industry-ltd-2889699
[rossini-cd]: https://govt.chinadaily.com.cn/s/201802/13/WS5b786486498e855160e8e1d4/zhuhai-rossini-watch-industry-ltd.html
[vela-hifuture]: https://uae.sharafdg.com/product/hifuture-vela-smartwatch-black/
[tx-mofo]: https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law
[sb122-sw]: https://www.swlaw.com/publication/cdtfa-proposes-emergency-regulations-to-implement-californias-new-sales-and-use-tax-on-digital-products/
[rl-credits]: https://immortalboost.com/blog/rocket-league/rl-credits/
[fn-vbucks]: https://www.shacknews.com/article/148255/fortnite-v-bucks-price-increase
[tm-official]: https://www.trackmania.com/news/956
[tm-itad]: https://isthereanydeal.com/game/trackmania/info
[wheelmates]: https://store.steampowered.com/app/5108990/WheelMates__Supporter_Pack/
[gkm]: https://www.dekudeals.com/items/go-kart-mania-livery-pack-1
[smashkarts]: https://apppricinglab.com/app/apple/1473010859
[conv-gb]: https://gamesbrief.com/?p=9113
[conv-gitnux]: https://gitnux.org/mobile-games-statistics/
[conv-maf]: https://maf.ad/en/blog/mobile-game-conversion-rates/
[sb-pricing]: https://supabase.com/pricing
[sb-billing]: https://supabase.com/docs/guides/platform/billing-on-supabase
[sb-smtp]: https://supabase.com/docs/guides/auth/auth-smtp
[sb-prod]: https://supabase.com/docs/guides/deployment/going-into-prod
[resend]: https://resend.com/pricing
[ab2426-gg]: https://www.greenbergglusker.com/publications/new-california-law-ab-2426-licensing-disclosures-for-digital-goods
[ab2426-gt]: https://www.gtlaw.com/en/insights/2024/12/ab-2426-new-california-law-requires-clear-licensing-disclosures-for-digital-goods
[ab2426-fasken]: https://fasken.com/en/knowledge/2025/02/new-california-law-requires-digital-stores-to-disclose-license-only-purchases

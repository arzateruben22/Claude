# Project OC: the business plan (first draft)

Written 2026-10-15 for the owner's question: can we pay Orange County residents to be the marketing team, start as an
app before the website, make it OC-only for the first 45 days, and how does this become a business? Everything here
is a proposal for the owner to decide on. Money figures are approximate and need checking at the time. Nothing in
this document changes the game's rules: credits in the game are still earned by driving and nothing in the game costs
real money until the owner decides otherwise and a payment processor exists.

---

## 1. The product, honestly, on each screen

The owner asked for "the best realistic approach from both a mobile device app and the difference of an actual
website / video game". There are three products, and two of them are the same code:

| Tier | What it is | Realism it can reach | When |
| --- | --- | --- | --- |
| **The app** (phone) | The web game, installed: a PWA from the browser's "Add to Home Screen", and the same build wrapped for the App Store and Google Play | The game's Low and Medium presets: real freeways, real signs, real sun, procedural cars and hands. 30–60 fps on a recent phone is the target; **not yet measured on a real phone** | Weeks, not months. It is what exists today plus a wrapper |
| **The website** (laptop, desktop) | The same build at the link, on a real GPU | High and Ultra presets, plus everything the realism preview is building (anatomical hands, the four cars from every camera, NPCs at Lot 57) once it lands in the game | Same build, same day |
| **The video game** (desktop download) | A separate Unreal Engine 5 build, per `PROJECT_OC_UE5_MIGRATION.md` | Photoreal tier: Lumen, Nanite, MetaHumans | 7–12 months after a decision, with a UE-capable machine |

So "start as an app, then the website" is really: ship one build to both at once, and put the **marketing** on the app
first, because a phone install is what a local campaign can ask for in one tap. The website is the same thing with
better graphics. The UE5 game is the second act, if the first earns it.

One rule for all three: say what each is. The app is a browser-technology game, and the store listing, the screenshots
and the promoters' posts should show phone footage, not desktop footage.

---

## 2. Paying OC residents to promote it: yes, with four guard rails

Yes, you can pay people who live in Orange County to promote the game. It is ordinary marketing: brand ambassadors,
street teams, local creators. Four things keep it clean:

1. **Disclosure.** Anyone paid (money, free merch, or a prize) to post about the game must say so in the post:
   "#ad" or "paid partnership" at the top, not buried. This is the FTC's endorsement rule and the platforms' own
   rules. Put it in every ambassador agreement and check posts.
2. **No bought ratings or reviews.** Paying or rewarding people for App Store or Play ratings, or for reviews
   anywhere, is against both stores' rules and the FTC's 2024 fake-review rule. Ambassadors can ask people to *play*;
   they cannot ask for stars.
3. **Contractors, done properly.** In California, a paid promoter is usually an independent contractor, which means
   a written agreement, an invoice, and a 1099 for anyone paid $600 or more in a year. California's contractor test
   (AB5 and its exemptions) is strict; a short consultation with an accountant or lawyer before the first payment
   is worth the hour.
4. **Responsible-driving line.** The game is 200 mph on the real 405. Every piece of marketing carries one honest
   sentence ("A game. Drive the real ones at the limit.") and never shows or implies real-world speeding. This also
   protects the promoters, who are local people with their own reputations.

### 2.1 Three ways to pay them

| Model | How it works | Cost (approximate) | Best for |
| --- | --- | --- | --- |
| **Ambassadors** (5–10 people) | Monthly stipend plus deliverables: 2 posts a week, one in-person session a week (car meet, campus, coffee shop with permission), a weekly note on what players said. They are also the first real-phone testers | $200–500 per person per month; $1,000–5,000 a month for the team | The 45-day launch |
| **Creators** (per post) | Local TikTok/Instagram/YouTube car and OC accounts; one post or short per deal; they film their own exit | $100–1,000 per post by following; 5–10 posts for the launch | Reach in week 1 and week 3 |
| **Bounties** | A fixed amount per redeemed invite code attributed to the promoter (needs the small counter in §5) | $1–3 per redeemed code, capped per person | Scaling after the first 45 days |

What ambassadors get besides money: their name on a "Founders" card in the game's credits screen (no real-person
likeness in the world, by the project's rule), early access to new freeways, and the first look at the UE5 build.

### 2.2 Where OC residents actually are

The pitch is one line: **"It's your freeway."** Everyone in OC has an exit. The places to reach them, in order of
cost per player (*estimates*):

1. **Weekend car meets and cars-and-coffee mornings** (with the organiser's permission): a phone on a stand, a QR
   code, "drive your exit". The game's audience and the car crowd are the same people.
2. **Campuses:** UC Irvine, Cal State Fullerton, Chapman, Orange Coast College, Santa Ana College. Student
   ambassadors, club nights, the 405/55/57 commute jokes.
3. **Local creators** who already post OC traffic, car and food content.
4. **Local subreddits and Discords** (r/orangecounty and city subreddits have rules on self-promotion: an ambassador
   posts as a resident sharing a game about their freeway, disclosed, once).
5. **QR flyers** where the owner has permission: car washes, tyre shops, coffee shops, the taqueria's own counter.
6. **Local press and newsletters:** a one-pager with a 30-second phone clip. "Local developer builds a game of the
   405" is a story.

What not to do: no fake accounts, no astroturfing, no "live traffic" or "multiplayer" claims beyond what exists (since
2026-10-21: a live server in alpha with a cap, and live weather and freeway flow when the feeds are on; say exactly
that), no real business names in the game without a signed deal, no collecting players' addresses to "prove" they
live in OC.

**In-game billboards (2026-10-21).** Twelve panels on the 5, 57, 91 and 22 near Lot 57 and our sports bar
(`src/data/ads.json`). They carry our own venues. A real business can take a slot only with a signed deal that names
the creative, the dates and the price; the owner decides the price (a local car wash or taqueria is a different deal
from a brewery). Nothing in a creative may claim live data or a partnership that doesn't exist.

---

## 3. The 45-day OC-only launch

### 3.1 How "OC-only" works without a backend or anyone's address

- **Invite codes.** Every ambassador, creator, flyer and event has its own code (`IRVINE-405`, `CSUF-57`, …). The
  game asks for a code on first launch during the launch window. Codes are checked on the device against a list in
  the build (anyone determined can find it; that is fine for a promotion, this is a velvet rope, not a lock).
- **TestFlight and Play closed testing** are invite-only by design: the iOS beta goes to people the ambassadors add
  (TestFlight allows up to 10,000 external testers), and the Android closed-testing track needs a Play invite link.
  Google also requires a new developer account to run a closed test with at least 12 testers for 14 days before a
  public release, so the ambassadors are the testers that unlock the store listing.
- **A ZIP-code question**, not a location permission: "What's your home ZIP?" is enough for the honour system and
  for knowing which parts of the county are playing. Store nothing but the first three digits, on the device, and
  say so.
- **The web link stays unlisted** for 45 days: the hosted page keeps working for anyone who has it, and the public
  URL and the store listings go live on day 46.

### 3.2 The features that make a local launch work (small, all possible in the current game)

| Feature | Why | Effort (*estimate*) |
| --- | --- | --- |
| **Start at your exit.** Pick any real exit, not just 12 starts; the network already has every ramp and its sign text | The one feature every OC resident asks for first | 2–4 days |
| **Run cards.** After a run, a share image: "I-405 North · 148 mph · 41 s clean streak" over a screenshot, with the honesty line and #TopSpeedOC; the phone's share sheet | Free, organic reach; no backend | 2–3 days |
| **Invite code and ZIP** on first launch during the window; a "Founders" badge in the profile for those 45 days | The exclusivity mechanic and the test fleet | 1–2 days |
| **Send feedback** button: opens a form or an email with the device, the preset and the last 30 s of stats (`__game.stats`) pasted | Real-phone performance data at last | 1 day |
| **PWA manifest and offline cache** so "Add to Home Screen" gives an icon and works offline | The fastest "app" | 1 day |
| **Store wrappers** (Capacitor or a Trusted Web Activity for Android) with the single-file build bundled, so it is a self-contained game, not a thin web view | App Store and Play listings | 3–5 days plus store review |
| **Policies and rating:** privacy policy (nothing leaves the device except what the player shares), terms, an age rating through the stores' questionnaire | Required by both stores | 1–2 days of drafting; a lawyer's read is advised |

### 3.3 A 45-day calendar

| Days | What happens |
| --- | --- |
| −21 to −1 | Build the features above. Recruit 5–10 ambassadors; sign agreements; give them TestFlight/Play access first. Collect their phone fps numbers and fix the worst. Make the kit (§4). Apple and Google accounts, listings in review. |
| 1–7 | Soft launch: ambassadors and the first creator posts. Codes at two car meets and two campuses. Daily check of crashes and fps reports; a fix build every few days. |
| 8–21 | Second wave: more creators, flyers, the local press one-pager. Weekly "most driven freeway" post from the ambassadors' own screenshots (never a claim of live data). |
| 22–35 | Hold: fix, tune, add the most-asked exit starts; run a "fastest clean streak" challenge judged from run cards, prizes are merch or credits-in-game, never money. |
| 36–45 | Founders wrap-up: the credits screen, the badge locked in; the public listing and link prepared. |
| 46 | Public: the web link, the store listings, the first LA County teaser. |

### 3.4 What to measure (all available without a backend, from store consoles and the counter in §5)

Installs by week; codes redeemed per channel; TestFlight and Play crash rates; the fps reports by device; runs per
player and day-1/day-7 return rate (the stores report these); run cards shared (count the hashtag by hand); the
store rating (never solicited); the ambassadors' weekly notes on what players asked for.

Targets for the window (*estimates to set, not predictions*): 1,000 installs, 30% day-7 return, 10 reports per
device class, one fix build a week.

---

## 4. The marketing kit (things that can be made here, now)

- A one-page press sheet: what it is, the real-freeway angle, the data credit, phone screenshots, the honesty lines.
- Ambassador guide: the disclosure rule, the responsible-driving line, what to say about traffic and weather (simulated,
  say so), the dos and don'ts above, the code list, a weekly report template.
- QR flyers and table cards (print-ready HTML/PDF), one per channel code.
- A 30-second phone capture script for creators (the app's own recording works on both platforms).
- Store listing copy and screenshot frames for both stores.
- The in-game "Founders" credits screen and the run card design, in the Chrome noir style.

---

## 5. The smallest possible infrastructure

Today nothing leaves the player's device, which is a privacy story worth keeping. The launch needs exactly one small
thing: an invite-code counter so bounties and channels can be measured. A single serverless function with a key-value
store (free tiers cover a launch) that takes `code` and returns `ok`, counting redemptions; no accounts, no names, no
addresses. A global "OC leaderboard" is tempting and should wait: without accounts and anti-cheat it would be
gamed in a day, and the game currently labels its board "this device only" for that reason.

---

## 6. Money

### 6.1 What it costs to launch (approximate)

| Item | Lean | Standard | Heavy |
| --- | --- | --- | --- |
| Apple developer account ($99/yr), Google Play ($25 once) | $124 | $124 | $124 |
| Domain and hosting (GitHub Pages or Cloudflare Pages are free) | $15 | $15 | $15 |
| Ambassadors, 45 days | 3 × $200 = $600 | 6 × $400 = $2,400 | 10 × $500 = $5,000 |
| Creators | 2 posts, $300 | 6 posts, $1,500 | 12 posts, $5,000 |
| Flyers, QR cards, event table | $100 | $300 | $800 |
| Merch and prizes (no cash prizes) | $0 | $500 | $1,500 |
| Accountant/lawyer hour for contractor agreements and policies | $0–300 | $300–600 | $600–1,200 |
| **Total** | **about $1,500** | **about $5,500** | **about $14,000** |

A California LLC, if the owner wants the business separate from themselves before paying people: about $70 to file
plus California's $800-a-year minimum franchise tax, and a trademark search for the game's name before spending on
it (a USPTO search is free; a filing is about $350 per class).

### 6.2 How it could make money (options; none changes the game yet)

The game's rule today is "no real money anywhere", which is the right rule for a launch built on trust with local
players. When the owner decides to earn, these fit the product and the rules, in order of least risk:

1. **The UE5 desktop game as a paid download** (Steam at $9.99–19.99) with the free phone/web game as the funnel.
   The honest split: free is the real freeways on your phone; paid is the photoreal version on your PC.
2. **Local sponsors on the freeway's billboards and the taproom's screens**, with a signed agreement: a real OC
   business's name in the world is fine when they pay for it and approve the art. Priced per month, a handful of
   sponsors, sold by the ambassadors. This is the only way a real brand gets into the world.
3. **Cosmetics** (paint, wheels, nail colours, cockpit trims; the designed-only weather pass) through the stores'
   own purchase systems, once a payment processor exists and the stores' rules are met. Never pay-to-win, never
   loot boxes, credits stay earned.
4. **Merch** for the Founders and the car-meet crowd: the "R" badge, "It's your freeway", the freeway shields.
5. **Grants and partnerships** later: tourism boards and transport agencies do fund local projects; the OSM/Overture
   data story and the real-exit feature are the pitch.

What to refuse: selling player data (there is none to sell), gambling-like mechanics, real-money races, anything
that pays for ratings.

### 6.3 The one-year shape (*an estimate to argue with, not a forecast*)

- Months 1–2: the OC launch above; 1,000–5,000 installs; cost about $5,000; revenue $0.
- Months 3–6: LA County in the web game (the pipeline exists; about 1.2 MB of data per county), the first two
  sponsors, the UE5 Phase 1 prototype on one stretch; cost: a UE-capable machine and the engineer's time.
- Months 7–12: the UE5 game toward a paid desktop release; a second launch wave in LA with the same ambassador
  model; sponsors in both counties.

---

## 7. Risks

| Risk | What to do |
| --- | --- |
| The game runs badly on mid-range Android phones (unmeasured today) | The ambassadors' fps reports in the first week decide the default preset; the Low preset exists for this |
| Store review rejects a web-technology game as a "thin wrapper" | Bundle the whole game offline in the app, add the native share sheet and haptics, show it is a complete game; Android's Trusted Web Activity is the safe path if iOS review stalls |
| "Speeding on real roads" reads badly to a store reviewer, a reporter or a parent | The responsible-driving line everywhere; no real-world footage; the age rating answered honestly |
| A promoter forgets the disclosure or over-claims (multiplayer, live traffic) | The guide, a weekly post check, and a one-strike clause in the agreement |
| Someone else owns the name | The trademark search before printing anything |
| Two products (web and UE5) drift apart | The data and the numbers are the shared truth (the UE5 doc's Phase 0); features are specified once |

---

## 8. Decisions for the owner

1. Launch name and the trademark search: "Top Speed OC" is the working title; "Project OC" is the codename.
2. Budget tier for the 45 days (§6.1): lean, standard or heavy.
3. Whether to form an LLC before paying promoters.
4. Approve the four guard rails in §2 as the ambassador agreement's core.
5. Approve the launch feature list in §3.2 so it can be built ahead of the NPC and UI work, or after it.
6. Whether an invite-code counter (the one piece of infrastructure) is acceptable, given the "nothing leaves the
   device" story.

## 9. What can be done from here, now

- The launch features in §3.2 (exit starts, run cards, invite code and ZIP, feedback, PWA, store wrapper scaffolds),
  with the regression suite extended for each.
- The whole kit in §4 as drafts for the owner to edit.
- Store listing copy, privacy policy and terms as drafts (a lawyer's read is advised).
- Not from here: store accounts, contracts, payments, and anything that needs the owner's credentials; the owner does
  those on their own machine, and never shares passwords or keys in chat.

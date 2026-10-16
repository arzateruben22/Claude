# OC Ultra: the 90-day launch plan

Written 2026-10-16 for the owner's ask: a "full proof" 30–90 day plan for launch, how to pump the game out, what needs
doing, all free with minimum up-front cost, and no expectation of profit. It builds on `PROJECT_OC_BUSINESS.md` (the
45-day OC exclusive with invite codes and ambassadors) and re-plans it for **$0 up front**. Prices come from
`PROJECT_OC_MONETIZATION.md`. Store copy, policies and the press sheet come from `PROJECT_OC_LAUNCH_KIT.md`.
Pre-launch posting comes from `PROJECT_OC_MARKETING.md`.

"Full proof" means every step below names four things: **who** does it, what it **costs** ($0 unless stated), the
**proof** that it worked, and **what to do if it didn't**. Gates move the calendar. Dates don't. If a gate fails, the
whole calendar slides as a block, and no marketing happens before the game runs on real phones.

---

## 0. The honest shape

- **What this is.** It's a hobby-scale launch of a free browser game for Orange County, played on phones and installed
  from the browser ("Add to Home Screen"). It should cost about nothing and earn about nothing. The point is
  players: people in OC driving their own exit, coming back, and telling us what broke.
- **What it costs.** $0 is required. Every paid item in §7 is optional and has a trigger: spend only when that
  trigger happens.
- **What it earns.** At realistic player counts, the store brings in **$0 to about $850 over 90 days, most likely
  under $100** (the arithmetic is in §7.3; the monetization doc's mixed basket of $10 and $3 items, with refunds and
  a dispute, gives about $12 to $660 for the same player counts). That's less than the optional costs would be if
  the owner bought them all. Say so to anyone who asks.
- **The money rule (owner, 2026-10-16).** Payments are built but stay in **test mode**. Nothing is charged until the
  owner connects Stripe and Supabase and turns live mode on. The store sells cosmetics, expansions and support
  only. It never sells power: no cars faster than earnable ones, no grip or score boosts. It never sells the earned
  credits. There are no random paid rewards (no loot boxes) and no paid premium currency. Everything the game has
  today stays free. No ads at launch, purchases are 13+, and nothing is sold or pre-sold before it's in the game.
  *(`CLAUDE.md` on this branch already carries this rule in place of the old "No real money" line. This plan
  doesn't change `CLAUDE.md`.)*
- **Who does what.** **Claude** builds: code, pages, copy drafts, clips, triage, reports. The **owner** handles
  accounts, credentials, posting, meets, talking to players and every decision. Claude never holds the owner's
  passwords or live keys. Those go into the dashboards and the server's secret store, never into chat.
- **Owner time.** About 8 hours a week in weeks 1–2, about 6 during the beta, about 15 in launch week, and 4–6 after
  that. *(This is an estimate. Protect it: a solo builder who burns out on day 50 loses the whole plan.)*

### Calendar used below

Day 1 is the day the owner says go. The dates assume **Monday 19 October 2026**; shift them as a block.

| Phase | Days | Dates (if Day 1 = Mon 19 Oct 2026) |
| --- | --- | --- |
| 1. Foundations | 1–14 | Mon 19 Oct – Sun 1 Nov |
| 2. OC closed beta (invite codes) | 15–45 | Mon 2 Nov – Wed 2 Dec (Thanksgiving is Thu 26 Nov, Day 39) |
| 3. Public OC launch | 46–60 | Thu 3 Dec – Thu 17 Dec |
| 4. Beyond OC and the decision gates | 61–90 | Fri 18 Dec – Sat 16 Jan 2027 (the holidays fall on Days 64–77; California's new digital-tax law starts Fri 1 Jan, Day 75) |

### The 30-day cut (if the owner wants it shorter)

Do Phase 1 exactly as written, and only cut once Gate 0 (§1) passes. Then shorten the beta to two weeks (Days 15–28,
25–50 testers), launch publicly on Day 29, and move Phase 4 to "later". Nothing in Phase 1 can be skipped. Every
item there is either a legal requirement or the proof that the game runs on phones.

---

## 1. Days 1–14: foundations

**Gate 0, before any marketing.** The owner's first phone run (2026-10-16) only got as far as the loading screen.
Before anything is posted, the game must **reach the menu at a playable frame rate on three phones**. That means:

- **The phones:** the owner's own, one other iPhone and one Android (borrowed from family or friends, $0).
- **The test:** each phone does three runs on Wi-Fi.
- **To pass, every run must:**
  - reach the menu in under 20 seconds;
  - hold a median of at least 30 fps on the Low preset over 60 seconds of Free Drive on the I-405 North with
    Moderate traffic;
  - finish with no reload and no crash.
- **Proof:** the nine reports, pasted into `PROJECT_OC_PROGRESS.md`.

The thresholds are this plan's own (an estimate of "playable"). The owner may tighten them but should not loosen
them.

One catch: the Feedback report lives in the Pause menu and the Driver panel (`src/ui/App.tsx`), so a phone that
stalls on the loading screen can't reach it. That's why step F5 adds a boot report to the loading screen itself.

| # | Step | Who | Cost | Proof it worked | If it didn't |
| --- | --- | --- | --- | --- | --- |
| F1 | **Pick Day 1 and the weekly time budget.** Write both at the top of this file. | Owner | $0 | The date is in this file | Nothing else starts |
| F2 | **Name and trademark check.** Search the USPTO's free Trademark Search (it replaced TESS on 30 Nov 2023) for OC ULTRA, OCULTRA and TOP SPEED, in class 9 (downloadable game software), class 41 (online games, entertainment) and class 28. Also search the App Store, Google Play, Steam, itch.io and the web, and check that the domain and the #OCUltra tag are free. Claude writes the search list and reads the results with the owner. | Owner (Claude drafts) | $0 | Screenshots of each search saved privately, and a one-paragraph result in `PROJECT_OC_PROGRESS.md` | **Known overlap: "Top Speed" is an existing racing game** (T-Bull, iOS since July 2015, Switch since March 2020, marked "Top Speed™"). Recommendation: the public name is **OC Ultra** alone until a lawyer says otherwise. "Top Speed" stays at most an in-game tagline. If a live mark for "OC Ultra" or something close turns up in classes 9 or 41, stop. Print nothing, pick from five backup names Claude proposes, and re-search. A filing ($350 per class) is optional (§7.2). |
| F3 | **Accounts and handles**, all on free tiers, with 2FA and a password manager: a project email; a **free GitHub organization** for the game (see F4); Supabase; Stripe (test mode only, no activation yet); Cloudflare (Web Analytics); a Discord server; Kit for email (optional, see F9); TikTok, Instagram, YouTube; Reddit; Hacker News; Product Hunt (a **personal** account, because Product Hunt bans company accounts); itch.io. Use the same handle everywhere. | Owner | $0 | A private table of handle, URL and "2FA on" for each. Claude gets access to the deploy repo through the session's GitHub tool, never through a password | If the handle is taken anywhere, use one fallback everywhere (for example `ocultragame`). Consistency matters more than the perfect handle |
| F4 | **Hosting on GitHub Pages, away from the client site.** The studio repo's Pages site is the Los Güeros client site. Put the game on its own organization's Pages site: a **public** repo holding only the built files, because Pages on a free account needs a public repo. The source stays where it is. Separate hosting also gives the game its own browser origin, so its saves never mix with the client site's storage. Claude writes a deploy script (`dist/` → the deploy repo, plus the manifest, service worker and icons). | Owner enables Pages. Claude builds the script | $0 | The org's URL loads the current build on the owner's phone **over cellular** | Check the Pages settings. Fallback: Cloudflare Pages (free; 20,000 files and 25 MiB per file on the free plan, and the game is one file of about 3.4 MB, this branch's build on 2026-10-16) |
| F5 | **Boot diagnostics, the PWA, and Gate 0.** Claude adds four things. (1) The loading screen names its current stage (script, WebGL, road data, terrain, first frame, menu) with a timer. (2) After 20 s on one stage it offers **"Copy boot report"**. (3) A safe mode (`?safe=1`): Low preset, pixel ratio 1, no shadows, short draw distance, audio only after a tap. (4) PWA install: a manifest, a service worker with an offline cache, and icons from the OC wordmark. The game has none of these today (checked in this worktree on 2026-10-16). Claude also self-hosts the fonts, which today load from Google Fonts. The owner runs the nine Gate 0 runs. The first test is the owner's phone on the **new URL**, not only the claude.ai test link, because a hosted iframe may behave differently (a hypothesis to test, not a known cause). | Claude builds. Owner runs the phones | $0 | Nine reports pasted in the progress log, all "reached menu" at ≥ 30 fps on Low | **No marketing.** Claude works on the stage the boot reports name (memory, shader compile, road-data decode and WebGL context loss are the suspects to check, not conclusions). Re-test every 2–3 days. If Gate 0 isn't passed by Day 14, the beta slips week by week |
| F6 | **Waitlist page with invite codes and the ZIP self-check.** The page shows the wordmark, a 20-second phone clip, and "Join the OC beta". The form takes an email, the home ZIP and an invite code if the visitor has one. The ZIP is checked **on the device** against Orange County's ZIP areas. Claude builds that list from the Census Bureau's 2020 ZCTA-to-county file, counting every ZIP area that touches the county. Three-digit prefixes don't work: 906 and 907 are shared with LA County, and 928 with Riverside County (Corona, Norco). The page stores only "in OC: yes/no" and the first three digits. A visitor outside OC sees "OC-only until [Day 46]; we'll tell you when it opens" and can still join. Supabase tables: the waitlist (insert-only for the public key, no reads); invite codes (channel, uses, cap); and a redeem function. If Supabase isn't connected, the build falls back to checking codes against a list on the device (a velvet rope, not a lock, as the business draft said). | Claude builds. Owner reviews copy and makes 10 test sign-ups from a phone | $0 | Ten test rows, each showing zip3 only. A code redeems once per device, and its channel count goes up | Fallback for the week: the waitlist is "join the Discord and post your city" |
| F7 | **Privacy and terms pages**, from the launch kit drafts (§4–5) and **rewritten for what now leaves the device**: the waitlist email, ZIP3, invite codes, anonymous stats (F9), and accounts and purchases once live. The store terms must also cover: (a) what a purchase is, under California's AB 2426 (in force since 1 Jan 2025: a seller of a digital good that is only a licence may say "buy" only with a clear notice before checkout or the buyer's acknowledgement); (b) a refund policy and a contact address (Stripe requires both before it activates an account); (c) purchases 13+ only, with a neutral age question before anything is collected (COPPA; the amended rule was published on 22 Apr 2025, took effect on 23 Jun 2025, and full compliance has been required since 22 Apr 2026); (d) the honesty lines (no live traffic, weather or multiplayer). | Claude drafts. Owner approves | $0 (a lawyer's read is optional, §7.2) | Both pages live and linked from the waitlist, the game's Settings and the store | Collect no email until both pages are up |
| F8 | **Supabase and Stripe in test mode.** Follow the paywall pass's go-live guide (`server/README.md`, which the paywall pass writes; it wasn't on this branch at the 2026-10-16 check, so until it lands use `PROJECT_OC_MONETIZATION.md` §10's checklist) up to, **but not including**, live keys: create the project, run the migration, add the test secrets, deploy the functions, add the Stripe test webhook. | Owner clicks. Claude writes each step and checks it | $0 | One purchase with the test card **4242 4242 4242 4242** writes an order through the webhook, and the founder paint appears in the garage. The decline card **4000 0000 0000 0002** grants nothing | The store stays in local demo mode (Lumevina's pattern: nothing leaves the browser). Nothing else is blocked |
| F9 | **Measurement.** *Cloudflare Web Analytics* (free, no DNS change, up to 10 sites not proxied through Cloudflare) counts page visits. It isn't built for custom game events (its FAQ says custom integrations with its endpoint aren't supported), so the game's events go to one anonymous Supabase table: boot stage reached, frame-rate bucket, first play, "came back on day 1", "came back on day 7", session start, device class and preset. There is no ID: the device keeps its first-play date and sends each return flag once. The game asks once, on first launch, "Send anonymous load and frame-rate stats?", and says so in the privacy page. *Email list (optional):* Kit's free plan covers up to 10,000 subscribers. Launch announcements are commercial email under CAN-SPAM, so every one needs a postal address in the footer: a street address, a USPS P.O. box or a private mailbox (§7.2). The $0 alternative is to announce on Discord and the site and keep the waitlist emails for the invite itself. | Claude builds. Owner adds the site in Cloudflare and decides on email | $0 | The owner's own test session appears in both places within an hour | Until it's fixed, Feedback reports cover performance and retention is unknown. Fix it before the beta |
| F10 | **Discord.** Channels: #announcements, #feedback, #bugs, #run-cards and #founders. Turn on rules screening, verification level Medium (Discord suggests Medium as a reasonable default for small servers), AutoMod keyword and spam filters, and 2FA for anyone who moderates. | Owner sets up. Claude writes the rules and the welcome post | $0 | A test account joins, accepts the rules and posts in #feedback | Feedback goes by email reply in the meantime |
| F11 | **Start the pre-launch marketing** (the detail is in `PROJECT_OC_MARKETING.md`). The owner joins the target communities **as a person**, commenting usefully and not linking. Reddit's own etiquette page gives a 9:1 rule of thumb (one in ten of your posts may be your own content), so a history built in weeks 1–6 is what makes a Day 46 post welcome. Post the first three clips. | Owner posts. Claude makes clips with the game's own capture tools and drafts captions | $0 | Three clips live, and sign-ups counted by each post's code | Change the hook (an exit-specific clip), not the frequency |
| F12 | **Day 14 review.** Is Gate 0 passed? Are there ≥ 50 waitlist sign-ups? Does the Feedback flow work end to end? Does the test purchase work? | Owner decides. Claude writes the one-page status | $0 | A go/no-go line in this file | No-go: slip a week and repeat F12 |

---

## 2. Days 15–45: the OC closed beta

The game is invite-only during the beta. A code is needed on first launch, and the gate **turns itself off at
00:00 Pacific on Day 46** (a date in the build, so the switch needs no deploy). The beta runs with 25 testers at
first and 100 at most. Builds ship every Thursday. Each week fixes the top five problems, and content goes out three
times a week.

| # | Step | Who | Cost | Proof it worked | If it didn't |
| --- | --- | --- | --- | --- | --- |
| B1 | **Wave 1 (Day 15): 25 invites.** These go to OC sign-ups from the waitlist and the owner's own circle, with one code per channel. | Owner sends. Claude generates codes and the message | $0 | ≥ 15 of 25 redeemed within 7 days | Send a personal follow-up and test the code flow on a fresh phone. If that's fine, widen the wave to 50 |
| B2 | **The weekly build, every Thursday** (§6 is the release routine). | Claude builds. Owner says go | $0 | The version in the Feedback report matches the patch notes, and the suite log is green | A red suite means no deploy that week: the previous build stays |
| B3 | **The top five each week.** Claude ranks Feedback reports, #bugs, and the boot and frame-rate stats by players affected × severity. The owner approves the five on Monday. | Claude triages. Owner approves | $0 | Five items fixed or explained in the patch notes | If there are more than five critical items, crashes and performance come first. Features never jump ahead of fixes |
| B4 | **Content three times a week** (Mon, Wed, Fri), following the marketing doc's places and content plan (`PROJECT_OC_MARKETING.md` §2.2 and §4). Every post carries "A game. Drive the real ones at the limit." | Owner posts. Claude makes the clips and captions | $0 | The posts are live, and sign-ups by code are counted | If there's no response after three weeks, change the hook, not the volume |
| B5 | **Waves 2 and 3 (Days 22 and 29)** take the beta to 50, then 100 testers, but **only if** load success is ≥ 90%. | Owner | $0 | Redemptions, and load success holding | Below 90%, hold the wave and spend the week on B3 |
| B6 | **The Founders crew: 5–10 unpaid testers who post.** The paid ambassadors in the business draft wait until there is money for them (never in these 90 days unless the owner decides to spend). Rewards: their name on the Founders credits screen and early builds. A free Founder Pack, if the owner offers one, is a perk, so that crew member's posts **must disclose it**. The FTC treats free products as a material connection, says "ambassador" alone isn't a disclosure, and wants it in the video itself, not only the caption. No one ever asks for ratings or reviews. | Owner recruits. Claude adapts the launch kit's ambassador guide | $0 | Every perk-holder's post carries "#ad" or "got this free" | Ask for an edit. A second miss ends the perk |
| B7 | **Store dry run (Days 30–40).** Testers try the test-mode store and say what confused them. The test-mode card form **accepts only Stripe's test numbers**, says so, and never sends what was typed, so no one types a real card. | Claude builds. Owner invites | $0 | ≥ 10 test purchases, and no real card number accepted | Fix the copy and run it again |
| B8 | **Security review before any live switch.** The Fable queue item in `PROJECT_OC_HANDOFF.md` (committed on `claude/always-on` as 1090f05, not yet on this branch; the same prompt is in `PROJECT_OC_MONETIZATION.md` §11): can a player grant themselves an item? Can a price come from the client? Is the webhook signed and idempotent? Do refunds revoke? Is there a secret in `dist/`? Is the 13+ gate in place? | A Fable session (the owner starts it) | $0 | The review is logged in `PROJECT_OC_PROGRESS.md`, and `npm test -- --only=store` passes | Fix the findings first. The Founder Pack waits; the launch doesn't |
| B9 | **Launch prep (Days 38–45).** Claude drafts the Show HN post, the Product Hunt page, the Reddit posts (one per community, each to that community's rules), and the press pitch (the launch kit's one-pager, renamed OC Ultra). The owner asks car-meet organisers for permission. Claude updates every piece of copy that says "nothing costs money" to the truth, "free to play, optional cosmetics", if the store will go live. This touches the launch kit's store copy, ambassador answers, age-rating answers ("no purchases"), terms ("There are no purchases") and privacy page. After F2, the run card's **#TopSpeedOC** tag and share title (`src/ui/runCard.ts`) and the kit's hashtags change to the chosen name's tag. Claude also stands up a second host (F4's fallback) and runs a **rollback drill**. | Both | $0 | The rollback drill takes the live URL back one build in under 5 minutes | No launch until the drill passes |

---

## 3. Days 46–60: the public OC launch

| # | Step | Who | Cost | Proof it worked | If it didn't |
| --- | --- | --- | --- | --- | --- |
| L1 | **Day 46 (Thu 3 Dec): the gate opens, and Show HN goes up.** Show HN's rules ask for something people can try "without barriers such as signups or emails" and call sign-up pages off topic, so the invite gate must be off and the store must not stand in the way. Suggested title: "Show HN: OC Ultra – drive Orange County's real freeways in your phone's browser". The owner answers comments for the day. Never ask anyone to upvote. | Owner posts. Claude drafts | $0 | A fresh phone with no code reaches the menu, and the post is live | If it sinks, move to the next channel. No reposting campaigns |
| L2 | **Reddit, Days 46–55: one community a day**, each post written for that community, from the owner's own account, after reading its rules that morning. Rules change, and this plan couldn't load the subreddits' rule pages. r/WebGames describes itself as games "with no downloads, signups, or plugins". Never ask for votes: Reddit's etiquette page says vote-asking messages "will result in a ban from the admins". | Owner | $0 | Each post stays up, and the visits and codes from it are counted | A removed post: read the reason, never repost elsewhere the same day, and go on to the next community |
| L3 | **Product Hunt, Day 51 (Tue 8 Dec)**, from the personal account, launching at 12:01 a.m. Pacific (the usual practice; third-party guides). Product Hunt is free. It forbids asking for upvotes and paid "hunters"; ask for comments and feedback instead. | Owner posts. Claude makes the gallery images and the maker's comment | $0 | The page is live, the comments are answered and the visits are counted | It's one day's traffic, not a verdict. Log it and move on |
| L4 | **Local press.** Pitches go out Day 43 (Mon 30 Nov) to the outlets in the marketing doc, with the updated one-pager and a phone clip. | Owner sends. Claude drafts | $0 | Replies, and any story | Follow up once, after a week. Never twice |
| L5 | **Car meets, the weekends of Dec 5–6 and 12–13.** Get the organiser's permission first. Bring a phone on a stand and the QR code (on the phone's screen, or a few home-printed sheets). Never imply that the event endorses the game. | Owner | $0 (flyers optional, §7.2) | People played, and the meet's code is counted | If the organiser says no, play as a guest and don't pitch |
| L6 | **The Founder Pack goes live, if the owner flips the switch.** Preconditions, all of them: Gate 0 holding; B8 done; every item the pack grants is built and shows in the game (at the 2026-10-16 check, five of its paints were still "hook" and the badge, frame and Founders roll "build" in `cosmetics.json`; `CLAUDE.md`: nothing is sold before it exists); the Stripe account activated (Stripe wants contact details, a refund policy and a full description of the goods on the site, and it lists in-game items as restricted unless the seller runs the game, which we do; verify at activation); the domain and a mail sender for sign-in links (§7.2); card entry on **Stripe's hosted Checkout page**, never a card form on our pages (GitHub says Pages sites "shouldn't be used for sensitive transactions like sending passwords or credit card numbers", and the studio's house rule agrees); the AB 2426 notice at checkout; the 13+ gate; receipts; a tested store off-switch; and the **owner's own real purchase, refunded end to end**. | Owner flips. Claude checks the list | Stripe's fee per sale only (§7.3) | The first real order row exists, and the owner's refund removed the item | Switch the store back to test mode (config), refund anyone affected and post what happened in #announcements |
| L7 | **Launch-week watch.** Claude reads load success, the boot stages and errors whenever the owner opens a session. The owner posts status in Discord. | Both | $0 | Load success ≥ 90% across the public mix | A crash rate above that, or a broken build: roll back (B9's drill), then fix |

---

## 4. Days 61–90: beyond OC, the rhythm, and the decision gates

| # | Step | Who | Cost | Proof it worked | If it didn't |
| --- | --- | --- | --- | --- | --- |
| P1 | **Web game portals.** *itch.io* (Days 61–63): free. Upload a zip with `index.html` at the root, at most 1,000 files and 500 MB unpacked. itch's own docs say HTML5 games take payments only as donations, so the itch build hides our store. *CrazyGames* (Days 64–70): only ads through its SDK; in-game purchases only for games it selects; app-store links never allowed in-game; content must fit PEGI 12. New games start in a "Basic launch" and move to full launch on playtime and retention. That calls for a separate build with our store and install prompts removed, and no ad calls while `CLAUDE.md`'s "no ads at launch" rule stands (ask CrazyGames whether a game without ads can reach full launch). *Poki:* it prefers web-exclusive deals, which its pages put at 5 or 7 years (two versions disagree). That clashes with our own site, so skip it unless Poki makes an offer, and read the terms then. | Owner submits. Claude makes the portal builds | $0 | The itch page is live, and CrazyGames has accepted or sent feedback | Log their reasons. Fix in the monthly update and resubmit once |
| P2 | **The first cosmetic drop (week 9, before the holidays)**, from the catalog in `PROJECT_OC_MONETIZATION.md`, only if the store has run clean for 10 days. | Claude builds. Owner approves | $0 | The drop is live, and no support message waits more than 48 h | No live store: ship it as a free, earnable paint set, so players still get it |
| P3 | **The monthly update.** From Day 60, weekly builds become hotfix-only and a named build ships on the **first Thursday of each month**, starting Thu 7 Jan 2027 (Day 81). It brings one headline item from the most-asked list, patch notes and a clip. | Claude builds. Owner announces | $0 | It ships on the date | If it slips, ship what's ready on the date and move the headline to next month |
| P4 | **The holiday weeks (Days 64–77).** Press and communities are quiet. Keep up the run-card clips, launch nothing big, and do the progress backup (P7). | Owner (light). Claude | $0 | Two posts a week | Not a failure. Expect low numbers |
| P5 | **Money and paperwork before 1 Jan 2027 (Day 75).** (a) California's SB 122 taxes electronically delivered software from 1 Jan 2027. Law-firm summaries say its definition leaves out video games. Whether that covers paid in-game items isn't settled (`PROJECT_OC_MONETIZATION.md` §8.6), and the CDTFA's rules are still drafts: check before Day 75. (b) Selling under "OC Ultra" as a sole owner means a fictitious business name statement (§7.2). (c) Store income is taxable even if no Form 1099-K arrives (IRS). | Owner | $0 to check (§7.2 for filing) | A note in this file of what was checked and when | If unsure, switch the store to test mode until it's resolved. The game is unaffected |
| P6 | **Optional extras, only if the gates call for them.** Web push for home-screen players (iOS 16.4+ supports it for home-screen web apps, which makes a $0 "it's live" notice possible without email). A "back up my progress" export, because saves live on the device. | Claude | $0 | Works on one iPhone and one Android | Skip it. Nothing depends on it |
| P7 | **The Day 90 report and the decision gates** (§5). | Claude writes. Owner decides | $0 | The decisions are written in this file | — |

---

## 5. The decision gates (Day 88–90)

These thresholds are this plan's own, set from §8's targets. They are not industry rules, and the owner can move
them before Day 60, never on the day.

| Gate | Go if | Then | Otherwise |
| --- | --- | --- | --- |
| **A. Keep the web build as the product** | Load success ≥ 90% on phones, D7 return ≥ 6%, and ≥ 300 players reached the menu in the last 30 days | Keep the monthly rhythm. Next 90 days: LA County (the pipeline exists; about 1.2 MB of data per county), more exits and races | Load success under 90%: a performance-only month. D7 under 3% with good load success: the hook or the game loop is wrong. Build the three most-asked features, test one new hook, or pause and say so |
| **B1. Buy the Google Play account ($25, one time)** | ≥ 150 Android players a week, Android load success ≥ 90%, and **12 testers** willing to stay opted in for 14 days | Register (it can take up to 48 h). Wrap the PWA as a Trusted Web Activity (Bubblewrap or PWABuilder, both free; add `assetlinks.json`). New personal accounts must run a closed test with ≥ 12 testers opted in for 14 straight days before production, so the listing comes about 3 weeks after buying. From 1 Jan 2027 a store app must also read California's OS age signal (AB 1043; `PROJECT_OC_MONETIZATION.md` §8.2) | Stay on the PWA and re-check monthly |
| **B2. Buy the Apple Developer account ($99 a year)** | ≥ 200 iOS players a week, ≥ 25 players asking for an App Store version, iOS load success ≥ 90% on two iPhone generations, and a plan for Guideline 4.2 | Build the native wrapper with real native features (haptics, offline, share, Game Center), not a website in a frame: apps "not sufficiently different from a mobile browsing experience" are rejected under 4.2. **Check the purchase rules first**: US-storefront apps may link out to web checkout (since 1 May 2025), but the commission Apple may charge on those sales is still in court (the Ninth Circuit sent the rate back to the district court in Dec 2025; the Supreme Court agreed on 30 Jun 2026 to hear Apple's appeal, and a decision could come as late as June 2027; `PROJECT_OC_MONETIZATION.md` §6). The AB 1043 age signal applies here too. Verify at launch | Stay on the PWA. Home-screen web apps already install, work offline and can get push |
| **C. Start the UE5 track** (`PROJECT_OC_UE5_MIGRATION.md`) | Phase 0 only (the spec pack and the engine-free core, doable in cloud sessions at $0) if the web game holds ≥ 1,000 monthly players and the owner wants the desktop game. Phase 1 only once there is a UE-capable PC (RTX 4070 class, 32 GB) or a cloud GPU at about $1–1.50 an hour (that doc's estimate), and the web build's monthly rhythm has held for two months | Phase 0: 2–3 weeks. Phase 1: 4–8 weeks for one engineer (that doc's estimates) | No. The web game is the product; revisit at Day 180 |

---

## 6. How to pump it out: the release routine

Every build, beta or public, follows the same eight steps. Claude runs it; the owner says go at step 5.

1. Run the regression suite on the change: `npm run build && npm test` (10–13 minutes in this sandbox), plus the
   store group once the store exists.
2. Re-run Gate 0's phone checks if the change touched rendering, loading or memory (the owner, two phones minimum).
3. Bump the version, which the Feedback and boot reports print. Write patch notes in plain words.
4. Build the portal variants if any portals are live.
5. **Owner: go.**
6. Deploy to the org's Pages repo. Then smoke-test the live URL on a phone over cellular: menu reached, a 60-s drive
   and, if the store is live, a test-mode purchase on a staging copy.
7. Post the patch notes in #announcements and on the site.
8. If anything is broken: roll back (revert the deploy commit; the drill's under-5-minute path), then fix.

**Bandwidth.** GitHub Pages has a 100 GB-a-month soft limit, about 29,000 first loads of this branch's 3.4 MB build
(about 27,000 at the UI pass's 3.6 MB build; both measured 2026-10-16, uncompressed, and the JS gzips to about half). The service
worker makes repeat visits nearly free. A Show HN front page has brought individual projects around 11,000 visitors
in a day (one maker's report), which fits. A bigger spike would mean the second host, and that switch is only clean
if the owner owns the domain (§7.2).

---

## 7. Money

### 7.1 Required: $0

| What | Price | Free-tier limits that matter |
| --- | --- | --- |
| GitHub Pages (org site, public repo) | $0 | ≤ 1 GB site, 100 GB/month soft bandwidth, 10 builds/hour soft. Not for a site "primarily directed at … commercial transactions"; a free game with an optional store reads as within that, but it's GitHub's call (§9) |
| Supabase Free | $0 | 500 MB database, 50,000 monthly active users, 500K function calls, 1 GB files, 5 GB egress (its docs disagree on egress), 2 active projects. **Pauses after a week with no activity** (§9). Built-in auth email is limited to 2 an hour, meant for testing, and since 26 Sep 2024 sends only to the project's own team members, so it can't sign in players |
| Stripe | $0 a month | You pay only per live sale (§7.3). Test mode is free and moves no money |
| Cloudflare Web Analytics | $0 | Up to 10 sites not proxied through Cloudflare. No custom events |
| Discord | $0 | — |
| Kit (email, optional) | $0 | Up to 10,000 subscribers |
| Resend (mail sender for sign-in links, when live) | $0 | 3,000 emails a month, 100 a day. Sends to other people only from a domain you verify |
| itch.io, CrazyGames, Product Hunt, Show HN, Reddit | $0 | Their rules, §3 and §4 |

### 7.2 Optional costs and the trigger to spend

| Item | Price (checked 2026-10-16) | Spend when |
| --- | --- | --- |
| **Domain** (e.g. ocultra.com, if free) | About $10.46 a year (.com at Cloudflare's at-cost price, per a listing of Oct 2026); about $10–12 elsewhere | **Before the Founder Pack goes live** (sign-in links need a verified sending domain) **or before printing any QR code**, whichever comes first. Free path: stay on the github.io URL forever and print that |
| **QR flyers or table cards** | About $25–50 per 100 in colour at a copy shop (a rough estimate from weak sources; get a quote) | After Gate 0 passes and the URL is final, for a meet that said yes. Free path: show the QR on a phone or print a few at home |
| **Google Play developer account** | $25 once | Gate B1 |
| **Apple Developer Program** | $99 a year (it renews automatically) | Gate B2 |
| **USPTO trademark filing** | $350 per class (base application, since 18 Jan 2025); +$100 per class if information is missing, +$200 per class for wording not from the ID Manual | After Day 90, if Gate A says keep going, and before spending on stores or merch. Two classes (9, 41) = $700 |
| **Fictitious business name (Orange County)** | $23 for one name and one registrant (extra names and registrants are $7 each; see the county's fee schedule), plus a newspaper notice once a week for four weeks (the price varies by paper; the county lists adjudicated papers). It lasts five years | Before the first **live** sale under the name "OC Ultra" if the owner sells as themself, not as an LLC (verify with the county) |
| **A mailing address for marketing email** | A USPS P.O. box or private mailbox (price varies by location; verify) | Only if the owner sends launch emails and won't put a home address in the footer (CAN-SPAM) |
| **Supabase Pro** | $25 a month | Only if the free tier's limits or the weekly pause become a real problem with real players |
| **A lawyer's read of the terms and the name** | Varies; the business draft estimated $300–600 for an hour | Before the stores (Gate B), or before live sales if the owner wants certainty |
| **City business licence** | Varies by OC city (verify with the owner's city) | Before live sales |

If the owner buys only the domain, the 90 days cost about **$10**. If the owner buys everything on this list except
the lawyer and the trademark, the items with known prices come to about $260–280: $10.46 + $25–50 + $25 + $99 + $23
+ three months of Supabase Pro at $75. The newspaper notice, the mailbox and the city licence come on top, at prices
that vary.

### 7.3 What it could earn (the arithmetic)

Assumptions:

- **Price:** the $10 Founder Pack, as every buyer's one purchase (a simplification). The real prices are set in
  `PROJECT_OC_MONETIZATION.md` and `src/store/catalog.json`; that doc's mixed basket (most buyers on the $10 pack,
  the rest on $3 items, with refunds and a dispute) gives **$12.02, $155.61 and $663.64** for 200 players at 1%,
  1,000 at 2% and 3,000 at 3%.
- **Stripe fee:** 2.9% + 30¢ per US card sale, corroborated by third parties because Stripe's page couldn't be loaded
  here. International cards reportedly add 1.5% and a dispute costs $15.
- **Net per sale:** $10.00 − $0.29 − $0.30 = **$9.41**.
- **Buyer rate:** 1–3% of players, an assumption to test, not a benchmark.

| Players who reached the menu by Day 90 | Buyers at 1% | Net at 1% | Buyers at 3% | Net at 3% |
| --- | --- | --- | --- | --- |
| 200 (no channel lands) | 2 | $18.82 | 6 | $56.46 |
| 1,000 (one channel lands) | 10 | $94.10 | 30 | $282.30 |
| 3,000 (Show HN or a creator lands) | 30 | $282.30 | 90 | $846.90 |

So the range is **$0 to about $850, most likely under $100**, against $0–300 of optional costs and the owner's time.
That makes this a near-zero-profit launch, as the owner expected. One more point: Stripe's minimum charge is
$0.50, and its fee takes about a third of a $0.99 sale (2.9% + 30¢ = 33¢), which is why tiny prices don't work (the
monetization doc has the full table).

---

## 8. The metrics that matter

Each metric is measured without accounts or personal IDs (F9). The benchmarks behind the return targets come from
GameAnalytics' mobile reports: top-quartile games keep about 27–30% of players on day 1, the median keeps just
under 4% on day 7 and the top quartile 6–8%. Those are app installs; browser visitors usually leave faster.

| Metric | How it's measured | Target by Day 45 | Target by Day 90 | If below |
| --- | --- | --- | --- | --- |
| **Load success on phones** | "Menu reached" ÷ "boot started" events, from phones | ≥ 90% | ≥ 95% | Stop inviting and stop posting. Fix the stage the boot reports name most |
| **Playable frame rate** | Median fps bucket on phones after 60 s | ≥ 30 fps on Low on the three Gate 0 phones | ≥ 30 fps on Low for 80% of phone sessions | Make Low lighter (draw distance, trees, pixel ratio) and the default on phones |
| **D1 return** | "Came back on day 1" ÷ first plays the day before | ≥ 25% (testers chose to join) | ≥ 20% (public mix) | Look at the first five minutes: start at your exit, the first drive, clarity |
| **D7 return** | "Came back on day 7" ÷ first plays a week before | ≥ 10% | ≥ 6% | Give a reason to return: weekly challenge runs, new exits, the monthly update |
| **Sessions per player per week** | Session events ÷ active devices | ≥ 2 | ≥ 1.5 | As for D7 |
| **Waitlist size** | Waitlist rows | ≥ 50 by Day 14, ≥ 300 by Day 45 | (becomes the email list or Discord) | More exit-specific clips. The hook in the marketing doc |
| **Invite redemptions** | Codes redeemed ÷ codes sent, by channel | ≥ 60%, and 100 testers by Day 45 | — | Personal follow-up. Check the code flow on a fresh phone |
| **Feedback reports** | Reports pasted in #feedback or sent | ≥ 3 per phone class a week, ≥ 50 in total | ≥ 10 a week | Make the button easier to find. Ask in each patch note |
| **Founder Pack buyers** (if live) | Paid order rows | — | ≥ 10 (illustrative) | Check the funnel (store opened → checkout → paid). **Never** answer low sales with power, loot boxes or a premium currency |
| **Players who reached the menu** | First-play events | 100 testers | ≥ 1,000 | Gate A's rule |

---

## 9. Risks and what we do about them

| Risk | How likely | Mitigation |
| --- | --- | --- |
| **The game runs badly on phones** (the first real run stopped on the loading screen) | High until Gate 0 passes | Gate 0 before any marketing. The boot report and safe mode (F5). Low as the phone default. Waves held below 90% load success |
| **A crash or a bad build on launch day** | Medium | Build freeze from the launch build on Day 44 (Tue 1 Dec), two days before Day 46. The rollback drill (B9). A store off-switch. A second host ready. Patch notes and status in Discord |
| **Platform rules change** (Apple, Google, Stripe, Supabase's free tier, portals, subreddits) | Medium over 90 days | Nothing depends on an app store in these 90 days. Re-read each channel's rules the day you post. Every price and limit here is marked "checked 2026-10-16"; re-check at each gate |
| **A name clash** ("Top Speed" is already a racing game; "Ultra" marks exist in gaming) | Medium | F2 before anything is printed. "OC Ultra" alone in public. Backup names ready. An optional lawyer's opinion before the stores |
| **Harassment through a public leaderboard** | High if a public board ships | **No public leaderboard in these 90 days.** The board stays "this device only" and run cards do the sharing. If one ships later: no free-text names (names drawn from a word list, like "Amber 405"), no chat, a report button, removal by the owner, and rate limits. Discord gets AutoMod, verification level Medium and rules screening (F10) |
| **Supabase's free project pauses** after a week of no activity | Medium in quiet weeks | Once players exist, their events keep it active. Before that, the owner does one test sign-up a week. The game never depends on Supabase to drive: sign-in and the store say "offline" and driving carries on |
| **Sign-in emails don't arrive** (built-in auth email: 2 an hour, testing only, and only to the project's team members) | Certain if live without a mail sender | During the beta, accounts stay in demo mode (Lumevina's pattern). Live sign-in needs the domain and a mail sender with link-tracking off (L6) |
| **GitHub's commercial-use clause, or the bandwidth limit** | Low | The store is optional and cards are entered on Stripe's own page. If GitHub objects, or traffic spikes, move to Cloudflare Pages, which is clean only with our own domain |
| **iPhone saves get wiped** (Safari clears a site's storage after seven days of Safari use without a visit; home-screen apps have their own counter, and a 2022 WebKit bug report describes losses anyway) | Low to medium | Ask iPhone players to install to the Home Screen. Purchases are tied to the account and can be restored. Add the progress backup (P6) |
| **A promoter forgets the disclosure, or someone pays for reviews** | Medium | The crew guide (B6). Never reward ratings: the FTC's fake-review rule (in force 21 Oct 2024) allows civil penalties of up to $53,088 per violation (the figure the FTC gave in Dec 2025; it's adjusted for inflation each January, so verify the current one) |
| **"Speeding on real roads" reads badly** | Medium | The honesty line in every post. No real-world driving footage, ever |
| **The owner burns out** | Medium | The weekly time budget (F1). Hotfix-only builds and a monthly update after Day 60 (P3). Holiday weeks kept light |
| **A payment or entitlement bug** | Medium before review | B8's adversarial review before any live switch. Test mode until the owner flips it. Refund first, investigate second |

---

## 10. The 13 weeks

**Exit check** is what must be true to start the next week as planned; if not, the "if it didn't" column of the
step concerned applies.

| Week | Days · dates | Owner | Claude | Exit check |
| --- | --- | --- | --- | --- |
| 1 | 1–7 · Oct 19–25 | Pick Day 1 and the hours (F1). USPTO and store name search (F2). Create the accounts, the org and the handles (F3). Enable Pages (F4). First phone run on the new URL, with the boot report | Boot stages, the boot report, safe mode. The PWA manifest, service worker and icons. Self-hosted fonts. The deploy script. A draft waitlist page. The OC ZIP list from the Census file | The site loads at the org's URL. The first boot report is in hand |
| 2 | 8–14 · Oct 26–Nov 1 | The nine Gate 0 runs on three phones. Supabase and Stripe in test mode (F8). Cloudflare Web Analytics. Discord (F10). Approve privacy and terms. Post three clips. Start commenting in the target communities | Fix what Gate 0 shows. The waitlist backend and invite codes. Anonymous stats. The privacy and terms pages. The test-mode store wired in. The Discord rules. Clips and captions. The Day 14 status page | **Gate 0 passed.** ≥ 50 sign-ups. A 4242 test purchase works (F12) |
| 3 | 15–21 · Nov 2–8 | Wave 1: 25 invites. Three posts. Discord for 15 minutes a day | Build 1 (Thu Nov 5). Triage and the top five. The first weekly report (metrics against §8) | ≥ 15 redeemed. ≥ 10 Feedback reports |
| 4 | 22–28 · Nov 9–15 | Wave 2 (to 50) if load success ≥ 90%. Recruit the Founders crew. Three posts. Scout one car meet as a player | Build 2 (Thu Nov 12). The top five. The crew guide. Run-card polish | D1 measured. ≥ 30 active testers |
| 5 | 29–35 · Nov 16–22 | Wave 3 (to 100) if load success ≥ 90%. Three posts. Testers try the test-mode store | Build 3 (Thu Nov 19). Store dry-run fixes. The press one-pager updated to OC Ultra | D7 measured for wave 1. The store dry run under way (B7) |
| 6 | 36–42 · Nov 23–29 (Thanksgiving) | Decide whether the Founder Pack goes live on Day 46. If yes, buy the domain and activate Stripe. Ask the car-meet organisers. Draft the Product Hunt page. Lighter posting | Build 4 (Tue Nov 24, before the holiday). The Fable store review queued (B8). The copy changed to "optional cosmetics" if the store goes live. Drafts for Show HN, Reddit and the press. The second host. The rollback drill | Drill under 5 min. ≥ 10 test purchases by Day 40 (B7). B8 logged, or the Founder Pack deferred |
| 7 | 43–49 · Nov 30–Dec 6 | Press pitches (Mon Nov 30). **Day 46 (Thu Dec 3): the gate opens, Show HN goes up**, and the owner answers comments all day. Reddit, one community a day. A car meet at the weekend. If the switch is flipped: the owner's real purchase and refund, then the Founder Pack goes live | The launch build (Tue Dec 1, then a freeze). Hotfixes. A daily stats summary when a session is open | No rollback needed, or one done in under 5 min. ≥ 300 new players |
| 8 | 50–56 · Dec 7–13 | **Product Hunt (Tue Dec 8).** Reddit continues. A car meet. Answer the press | A hotfix build. The top five. A FAQ page from real questions | Load success ≥ 90% on the public mix |
| 9 | 57–63 · Dec 14–20 | Approve the first cosmetic drop. The itch.io page. Three posts | The drop's build. The itch.io zip (store hidden). The CrazyGames build (our store and app links removed, no ad calls) | The drop is live and clean. The itch page is live |
| 10 | 64–70 · Dec 21–27 (holidays) | Light: two posts and Discord checks | The CrazyGames submission package. Optional: web push and the progress backup | CrazyGames submitted |
| 11 | 71–77 · Dec 28–Jan 3 | The paperwork check before Jan 1 (P5: SB 122, the fictitious business name, an income record). Light posting. If live, the Founder Pack's sale ends Thu Dec 31, 23:59 Pacific (Day 74), as the catalog sets it | Prep for the January build. The retention analysis for the public cohort | The January headline chosen. P5 noted |
| 12 | 78–84 · Jan 4–10 | **The January update (Thu Jan 7)**: announce it, post a clip. One car meet | The January build: the monthly rhythm starts. A first draft of the gate data | The January build is live |
| 13 | 85–91 · Jan 11–17 | **Decision day, Day 90 (Sat Jan 16): Gates A, B1, B2 and C** | The Day 90 report (every metric against target, costs, revenue, what players asked for) and a next-90-days proposal | The decisions are written in this file |

---

## 11. For the presentation (plan.html)

The launch deck's plan page mirrors Lumevina's: seven sections that reveal as you scroll, and a calculator. The
seven sections, in order:

1. **The honest shape** (§0): $0 required, about $0 earned, the point is players, the money rule.
2. **Foundations** (§1): Gate 0 first, then F1–F12 as an animated step sequence.
3. **The closed beta** (§2): invite waves, the Thursday build, the top five, three posts a week.
4. **The public launch** (§3): Day 46 Show HN, Reddit, Day 51 Product Hunt, press, meets, the Founder Pack switch
   with its checklist.
5. **Beyond OC** (§4 and §5): the portals, the first drop, the monthly update, the four gates.
6. **The 13 weeks** (§10): owner and Claude tracks side by side.
7. **The numbers** (§7 and §8): the metric targets, plus the calculator.

The calculator uses the same arithmetic as §7.3 and the monetization doc:

- **Inputs:** players, buyer rate (default 1%), average price (default from the catalog), and a tick box for each
  optional cost.
- **Net per sale** = price − (0.029 × price + 0.30).
- **Revenue** = players × buyer rate × net per sale.
- **Result** = revenue − ticked costs, shown with the line "a hobby launch: expect about zero".

---

## Sources

All checked on **2026-10-16** through web search result summaries. Direct page fetches were blocked in this session,
so anything marked "verify at launch" should be opened and read by the owner on the day it matters. Where a page
carried its own date, it's given.

**Fact-check pass (later on 2026-10-16).** Re-confirmed by web search: the GitHub Pages limits (1 GB, 100 GB soft
bandwidth, 10 builds an hour); Cloudflare Pages Free (20,000 files, 25 MiB a file; a January 2026 change raised only
the paid plans, to 100,000 files); Supabase Free (500 MB, 50,000 MAU, 5 GB egress on its own pricing page, 1 GB of
files, 2 projects, the one-week pause, Pro at $25) and its 2-an-hour built-in mailer; and Cloudflare Web Analytics'
10 sites without the proxy. Then the shared search budget ran out and direct page fetches failed, so every other
figure stands as the first pass found it, and the ones that matter most are listed for the owner to verify.
Corrected against the dated sources in `PROJECT_OC_MONETIZATION.md`: the COPPA dates, the Supabase mailer's
team-only rule, the open SB 122 question, and the Supreme Court's grant in Epic v. Apple. Checked in this worktree:
every date and weekday in the calendar, the §7 arithmetic, the build size, the missing PWA files, the Google Fonts
link, where the Feedback button lives, and the catalog (`node tools/store-check-catalog.mjs` passes).

**Hosting, backend, analytics, email**
- GitHub Pages limits (size, 100 GB soft bandwidth, builds, commercial use, card numbers):
  https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Pages on free accounts is public repos only: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub custom domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits ·
  https://developers.cloudflare.com/changelog/2026-01-23-pages-file-limit-increase/ (Jan 2026; Free stays at 20,000)
- Supabase pricing (free limits, the weekly pause, Pro $25/month): https://supabase.com/pricing ·
  https://supabase.com/docs/guides/platform/org-based-billing · https://supabase.com/docs/guides/storage/serving/bandwidth
- Supabase auth email rate limits and custom SMTP (2 an hour; team members only since 26 Sep 2024, per the
  monetization doc's reading of these pages): https://supabase.com/docs/guides/auth/rate-limits ·
  https://supabase.com/docs/guides/auth/auth-smtp · https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase Edge Functions and Stripe webhook signatures: https://supabase.com/docs/guides/functions ·
  https://supabase.com/docs/guides/functions/auth
- Cloudflare Web Analytics (free, no proxy) and its limits and FAQ: https://developers.cloudflare.com/analytics/web-analytics/about/ ·
  https://developers.cloudflare.com/web-analytics/limits/ · https://developers.cloudflare.com/web-analytics/faq/
- GoatCounter (free for "reasonable public usage"; the homepage is old, and third-party summaries say non-commercial
  only; verify): https://www.goatcounter.com/
- Kit free plan, up to 10,000 subscribers: https://help.kit.com/en/articles/16627071-the-kit-free-plan · https://kit.com/pricing
- Resend free tier (3,000 a month, 100 a day) and its domain requirement: https://resend.com/pricing ·
  https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- CAN-SPAM postal address: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Discord verification levels and AutoMod: https://support.discord.com/hc/en-us/articles/216679607-Verification-Levels ·
  https://discord.com/safety/auto-moderation-in-discord
- Census 2020 ZCTA-to-county relationship file: https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html
- WebKit on home-screen web apps (web push since iOS 16.4; their own storage counter; Safari 26 opens Home Screen
  sites as web apps): https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ·
  https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ ·
  https://bugs.webkit.org/show_bug.cgi?id=237350 · https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519

**Payments**
- Stripe pricing (2.9% + 30¢, no monthly fee; Stripe's own page couldn't be read, so these are third-party
  corroborations, read June and Sept 2026): https://stripe.com/pricing · https://priceworld.com/merchant-fees/stripe/ ·
  https://toolradar.com/tools/stripe/pricing
- Stripe's minimum charge of $0.50: https://docs.stripe.com/currencies
- Stripe test cards: https://docs.stripe.com/testing
- Stripe's website requirements for activation: https://support.stripe.com/questions/business-website-for-account-activation-faq ·
  https://docs.stripe.com/get-started/checklist/website
- Stripe's restricted businesses (in-game items): https://stripe.com/legal/restricted-businesses

**App stores**
- Apple Developer Program, $99 a year: https://developer.apple.com/programs/whats-included/
- Apple Guideline 4.2 rejections of web wrappers (forum threads): https://developer.apple.com/forums/thread/95085 ·
  https://developer.apple.com/forums/thread/108931
- Google Play, $25 one-time: https://support.google.com/googleplay/android-developer/answer/6112435?hl=en
- Google Play's 12 testers for 14 days for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Trusted Web Activity tools: https://github.com/GoogleChromeLabs/bubblewrap ·
  https://developer.chrome.com/docs/android/trusted-web-activity/quick-start/
- Epic v. Apple status (verify at launch): https://www.sullcrom.com/SullivanCromwell/_Assets/PDFs/Memos/sc-publication-ninth-circuit-landmark-epic-games-apple-ruling.pdf ·
  https://macrumors.com/2026/06/11/apple-fights-back-against-epic/ ·
  https://www.supremecourt.gov/DocketPDF/25/25-1311/424150/20260914154510009_2026-09-14%20No.%2025-1311%20Apple-Epic%20Merits%20Opening%20Brief.pdf
  (Sep 14, 2026; cert granted June 30, 2026) · https://www.macobserver.com/news/supreme-court-apple-epic-appeal-question-1-narrow/
- Apple's US link-out rule since 1 May 2025: https://developer.apple.com/news/?id=9txfddzf
- California AB 1043, the OS age signal from 1 Jan 2027 (signed Oct 13, 2025):
  https://www.hunton.com/privacy-and-cybersecurity-law-blog/california-introduces-new-age-verification-requirements-for-software-applications

**Name and trademark**
- USPTO Trademark Search replaced TESS: https://www.uspto.gov/subscription-center/2023/retiring-tess-what-know-about-new-trademark-search-system
- USPTO base application fee of $350 per class from 18 Jan 2025: https://blog.altlegal.com/?tag=TEAS ·
  https://prod-web-alb-tg.uspto.gov/sites/default/files/documents/TM-ExamGuide-1-25.pdf
- The existing "Top Speed" racing game (T-Bull): https://ec.nintendo.com/apps/010082600F1AC000/US ·
  https://appgoblin.info/apps/1001516447
- Orange County fictitious business name fees and publication: https://ocrecorder.com/clerk-services/fictitious-business-name ·
  https://ocrecorder.com/sites/ocrecorder/files/2026-01/FeeSchedule.pdf

**Law and tax**
- FTC Consumer Reviews and Testimonials Rule (in force 21 Oct 2024; penalties):
  https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers ·
  https://www.ftc.gov/business-guidance/blog/2025/12/warning-letter-or-ten-businesses-comply-ftcs-consumer-review-rule
- FTC Disclosures 101 for influencers: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- COPPA amended rule (published 22 Apr 2025, in effect 23 Jun 2025, compliance due 22 Apr 2026):
  https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments ·
  https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule ·
  https://natlawreview.com/article/ftc-publishes-final-coppa-rule-amendments
- California AB 2426, digital goods as licences (1 Jan 2025): https://www.gtlaw.com/en/insights/2024/12/ab-2426-new-california-law-requires-clear-licensing-disclosures-for-digital-goods ·
  https://www.zwillgen.com/practical-advice/from-buy-to-license-california-mandates-clear-disclosures-digital-good-sales/
- California's automatic renewal law, AB 2863 (1 Jul 2025; only matters if a subscription is ever sold):
  https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect
- California SB 122, tax on digital software from 1 Jan 2027, video games left out (July 2026; CDTFA rules in draft):
  https://ktslaw.com/blog/kilpatricks-state-and-local-tax-blog/2026/7/california-expands-sales-and-use-tax-to-saas-and-electronically-delivered-software ·
  https://www.eidebailly.com/insights/alerts/2026/california-saas-tax ·
  https://www.withum.com/resources/california-enacts-sb-122-sales-tax-expansion-to-digital-products/ ·
  https://rsmus.com/insights/tax-alerts/2026/california-expands-sales-tax-to-electronically-delivered-software.html ·
  https://www.pwc.com/us/en/state-local-tax/newsletters/salt-insights/assets/pwc-california-imposes-sales-and-use-tax-on-digital-products-and-saas.pdf
- IRS Form 1099-K threshold back to $20,000 and 200 transactions (Oct 2025); the income is still taxable:
  https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000

**Channels**
- Show HN rules: https://news.ycombinator.com/showhn.html
- Show HN traffic anecdote (about 11k visitors): https://www.indiehackers.com/post/my-show-hn-reached-hacker-news-front-page-here-is-how-you-can-do-it-44c73fbdc6
- Product Hunt (free; no upvote asks; no paid hunters): https://www.producthunt.com/launch ·
  https://www.producthunt.com/launch/sharing-your-launch
- Product Hunt's 12:01 a.m. PT practice (third-party, 2026): https://app.getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026
- Reddit spam and etiquette (9:1, no vote asks): https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam ·
  https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette
- r/WebGames' description (no subreddit rule pages could be loaded): https://gummysearch.com/r/WebGames
- CrazyGames requirements: https://docs.crazygames.com/requirements/intro/ · https://docs.crazygames.com/requirements/gameplay/
- Poki deals and requirements: https://sdk.poki.com/deals · https://sdk.poki.com/requirements
- itch.io HTML5 (donations only, file limits): https://itch.io/docs/creators/html5

**Benchmarks and prices**
- GameAnalytics mobile benchmarks, 2025 and 2026 editions (D1 and D7 retention):
  https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf ·
  https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game
- Domain price ($10.46 for a .com at Cloudflare's at-cost registrar, third-party listings of Jul–Oct 2026):
  https://vpsranking.com/domain/cloudflare/ · https://wellstsai.com/en/post/transfer-domain-to-cloudflare/
- Flyer printing (rough ranges, weak sources): https://www.4over4.com/guide/where-to-print-flyers

**This project**
- `PROJECT_OC_BUSINESS.md`, `PROJECT_OC_LAUNCH_KIT.md`, `PROJECT_OC_ROADMAP.md`, `PROJECT_OC_HANDOFF.md`
  (the Fable store review) and `PROJECT_OC_UE5_MIGRATION.md` (the Phase 0 and Phase 1 estimates and hardware), as
  of 2026-10-16.

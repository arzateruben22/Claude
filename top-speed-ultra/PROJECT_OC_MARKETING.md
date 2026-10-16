# OC Ultra: pre-launch marketing for $0

Written 2026-10-16 for the owner's ask: "marketing tactics to start using before launch time … all free and minimum
up-front costs". It's the posting half of `PROJECT_OC_LAUNCH_90.md`, which owns the calendar, the gates and the
metrics. The ambassador idea comes from `PROJECT_OC_BUSINESS.md` §2. The press one-pager and the ambassador guide are
in `PROJECT_OC_LAUNCH_KIT.md`. The store and its prices are in `PROJECT_OC_MONETIZATION.md`.

**The constraint:** one person, a phone, free accounts, **$0**. Nothing below needs money. A few things get easier with
the optional $10 domain in the 90-day plan (§7.2). Each of those says so.

**How the rules were checked:** by web search on 2026-10-16. Direct page loads were blocked in this session, so every
rule here comes from search summaries of the official pages, or from mirrors and guides where no official page
surfaced. Each one is marked with its source and date. **Subreddit rules couldn't be loaded at all.** Read each
community's sidebar the morning you post, every time. Platform rules move. Wherever a rule matters, this doc says
"verify at launch".

---

## 0. One screen

- **The hook:** *Drive the real 405 at sunset, on your phone.* Everyone in OC has an exit, and the game starts at it
  (§2).
- **The cadence:** three short clips a week (Fri, Mon, Wed), plus 15 minutes a day replying in comments and
  communities. Batch-record the week's clips in one sitting after the Thursday build. Owner time is about 3–4 hours
  a week, an estimate. If a week runs over, cut the third clip first. Never cut the replies.
- **The order:**
  1. **Build in public** until the game runs on phones. That's Gate 0 in the 90-day plan. Posts carry no link and no
     "play now".
  2. **The OC-only beta** from Day 15, with the waitlist, invite codes and run cards.
  3. **The public channels** only after the invite gate opens on Day 46 (Thu 3 Dec 2026): Show HN, r/WebGames,
     Product Hunt and the portals. Show HN and r/WebGames require a game anyone can play without signing up (§3.2,
     §3.6), and the rest are planned for after the gate anyway.
- **The rules that never bend (§8):**
  - Disclose every perk.
  - Never ask for votes, stars or reviews.
  - No fake accounts.
  - No fake scarcity.
  - Never claim live traffic, live weather or multiplayer.
  - No real-world driving footage.
  - Every post ends with *"A game. Drive the real ones at the limit."*
- **What to expect.** Most clips from a new account get little reach. That's normal, not a verdict. The plan works if
  **one** channel lands: a local Reddit post, a campus club or a creator. The waitlist math in §5.4 shows why clips
  alone won't reach the 90-day plan's target of 300 sign-ups by Day 45.

---

## 1. Before the first post

### 1.1 Fix these in the game first (Claude, Opus-class, under an hour)

The UI pass in the main checkout owns these files, so these are notes for that pass, not edits made here.

| What | Where | Why |
| --- | --- | --- |
| The run card prints **#TopSpeedOC** and shares with the title "Top Speed OC" | `src/ui/runCard.ts`, lines 92 and 111 | The game is now OC Ultra. The tag has to match the posts. "Top Speed" is an existing racing game's mark (90-day plan F2), so keep it out of tags |
| The Irvine Sprint blurb says "Flat out, four lanes, **real traffic**." | `src/game/race.ts`, line 14 | Traffic is simulated. A clip that shows the course screen would show a false claim. Suggested fix: "simulated traffic" |
| The launch kit says nothing costs money, or that there are no purchases, in seven places | `PROJECT_OC_LAUNCH_KIT.md`, lines 28, 78, 114, 137, 156, 166 and 198 (counted in this worktree on 2026-10-16) | True while the store is in test mode. If the store goes live, the line becomes "Free to play. Optional cosmetics, never power." (90-day plan B9) |
| An end card for clips | New: a 1080 × 1920 PNG | The OC sunset wordmark and "A game. Drive the real ones at the limit." **Leave out the "Top Speed" line until the trademark check clears** (90-day plan F2 keeps "Top Speed" to an in-game tagline at most, and an end card is public marketing). The owner's full lockup, with "Top Speed" beneath, goes back on if F2 and a lawyer clear it. Claude makes it from the wordmark assets. The owner adds it to each clip in the phone's editor |

A clean-screen photo mode (HUD off, for one tap) would help every clip. It's optional, about an afternoon of
Opus-class UI work. Until then, use the game as it is. The driving HUD is minimal.

### 1.2 Accounts and handles (all free; this is 90-day plan F3)

- **The handle.** Use the same one everywhere: TikTok, Instagram, YouTube, Reddit, Discord, Product Hunt, itch.io. If
  `ocultra` is taken anywhere, use one fallback everywhere (for example `ocultragame`).
- **The hashtag** is **#OCUltra**. A search on 2026-10-16 found no existing OC use of "OC Ultra" or #OCUltra. Search
  each app before the first post anyway.
- **Product Hunt and Reddit need history.** Make those accounts **now**, even though you won't post the game there
  until December. A third-party Product Hunt guide says a new personal account waits a week before it can post.
  Reddit judges self-promotion by your posting history (§3.1).
- **TikTok.** Use a personal account for the game, not a Business account. Business accounts are limited
  to TikTok's Commercial Music Library. That doesn't matter much here, because every clip uses the game's own sound
  (§4.2). (An earlier draft said "creator account": TikTok's separate Creator account type appears to have been
  folded into personal accounts, so check the account types the app offers on the day.) On each clip that
  promotes the game, switch on **"Disclose commercial content" → "Your brand"**. That's TikTok's setting for
  promoting your own business. (TikTok ads help centre; Soundstripe and others on the music library; checked
  2026-10-16.)

### 1.3 The honesty lines (from the launch kit, renamed)

Every clip and every post carries the last line. The others are answers, used whenever the question comes up.

- "The roads, ramps and exit signs are real, from OpenStreetMap via Overture Maps."
- "Traffic and weather are simulated." There is **no** live traffic, **no** live weather and **no** multiplayer.
- "Scores stay on your phone." There's no online leaderboard.
- "The cars are our own makes (Rossini, Vela)." Never call one a Ferrari, or anything real.
- **"A game. Drive the real ones at the limit."**

### 1.4 How this doc reads Gate 0

The 90-day plan says nothing goes out before the game reaches the menu at a playable frame rate on three phones. The
owner's first phone run (2026-10-16) stalled on the loading screen.

This doc reads that rule as: **nothing that sends anyone to the game goes out before Gate 0.** Build-in-public clips
link nowhere and ask nobody to play, so they're fine before it. They show the game on a laptop, or as stills, and say
so.

If the owner prefers the stricter reading (nothing posted at all), record the Phase A clips and hold them. Start
posting the week Gate 0 passes.

---

## 2. The hook

### 2.1 The line

**Drive the real 405 at sunset, on your phone.**

Shorter versions for on-screen text: "The real 405." · "Your exit. Real sign." · "It's your freeway." (the launch kit's
line, still good).

Why it works:

- **Recognition beats spectacle.** Every OC viewer knows an exit. A clip that shows their exit's sign gets a comment,
  and a comment asking for *their* exit is the cheapest engagement there is (the "exit requests" loop, §4.4).
- **The facts are true and checkable.**
  - The roads: 10 freeways and 20 carriageways, with 1,247 ramp pieces and 247 real street bridges.
  - The signs: **416 real exit signs** from the map data.
  - Start at your exit: the game puts you 450 m before the sign. (Launch kit and roadmap. The 416 signs were counted
    in `src/data/oc-network.json` on 2026-10-16.)

### 2.2 The places OC will recognise (all in the game's own sign data)

| Place | Where in the game | The angle |
| --- | --- | --- |
| **The 405 North at sunset**, Jamboree → MacArthur → the 55 | I-405 N signs: "Jamboree Road", "John Wayne Airport / MacArthur Boulevard", "CA 55 North" | The hook clip. The airport sign is the most recognisable sign in central OC |
| **The El Toro Y**, where the 405 splits from the 5 in Irvine | I-5 N sign "I 405 North"; I-405 S "Lake Forest Drive" | "Where the 405 begins." Traffic there grew from 102,000 to 356,000 vehicles a day between 1975 and 2002 (Wikipedia, El Toro Y) |
| **The Orange Crush**, I-5 / SR-22 / SR-57 in Orange | I-5 N signs "Long Beach / CA 22 West", "CA 57 North / Pomona" | The Guinness World Records 2002 edition called it the world's most complex interchange (Wikipedia, Orange Crush interchange). State it as "once called", with the year |
| **The 55 / 405 tangle**, Costa Mesa | SR-55 N "San Diego / I 405 South"; I-405 "CA 55 North / CA 55 South" | Every commuter's least favourite merge |
| **The 91 to Riverside** | The Riverside Endurance race (30 km, 91 East) | The commute joke writes itself. Keep it a joke about traffic, never about speed |
| **The 73 through Newport Coast at night** | SR-73 S "Newport Coast Drive", "Bonita Canyon Drive" | Headlights, stars, the toll road's curves |
| **The 241 Foothill Toll Road** | The Foothill Sprint (10 km, 241 South) | Hills and sweepers, two lanes |
| **South county on the 5** | I-5 N "Avenida Pico", "CA 74 / Ortega Highway / San Juan Capistrano", "Basilone Road / San Onofre" | Sunrise from San Clemente |
| **Anaheim on the 5** | I-5 N "Disney Way / Katella Avenue", "Ball Road / Harbor Boulevard" | Show the sign; it's a real street. **Never** use Disney (or any brand) in captions or tags: it implies a link that doesn't exist |
| **Little Saigon on the 405** | I-405 N "Bolsa Avenue / Goldenwest Street" | An exit that a big part of the county calls home |

### 2.3 The wordmark

The OC sunset wordmark is the game's face.

- **Where it goes:** the profile picture on every account; the 1.5-second end card on every clip; the waitlist page;
  the press kit.
- **The rule:** it always sits next to the honesty line, never next to a speed number on its own.
- **Leave out "Top Speed"** in handles, tags, post titles, the profile picture, the end card and the press kit until
  the trademark check (90-day plan F2) clears. "Top Speed" is an existing racing game's mark, and F2 keeps it to an
  in-game tagline at most. Inside the game it can stay under the wordmark, as the owner designed it.

### 2.4 Never say

"Real traffic." "Live weather." "Race your friends." "Online leaderboard." "Lamborghini/Ferrari/Porsche." Disney or any
business in a tag. "Lot 57 is a real bar" (it's our own fictional venue). Anything that dares people to speed for
real.

---

## 3. The channels: what each one allows (checked 2026-10-16)

| # | Channel | Good for | When |
| --- | --- | --- | --- |
| 3.1 | Local Reddit (r/orangecounty, city and campus subreddits) | The OC players | Comment now. One post per community, after its mods say yes |
| 3.2 | r/WebGames | Web players worldwide | Day 46 or later |
| 3.3 | r/IndieGaming, r/indiegames, r/playmygame, r/IndieDev | Indie players and developers | Day 46 or later (r/playmygame needs a free build) |
| 3.4 | r/threejs | Developers. A technical post | During build in public |
| 3.5 | r/gamedev Screenshot Saturday and #ScreenshotSaturday | Developers | During build in public, weekly |
| 3.6 | Show HN | A one-day spike of technical visitors | Day 46 |
| 3.7 | Product Hunt | One day of visitors | Day 51 (account now) |
| 3.8 | itch.io | Indie players. A permanent listing | Days 61–63 |
| 3.9 | Browser portals | Reach beyond OC | Day 64 or later, optional, ad-free ones only (`CLAUDE.md`: no ads at launch) |
| 3.10 | TikTok, Reels, Shorts | The clips | From now |
| 3.11 | Discord | The players' home | Server set up in week 2 |
| 3.12 | Local press | Credibility and OC reach | Student papers in the beta. The rest on Day 43 (see §3.12 on the plan's L4) |
| 3.13 | Car meets | OC car people, face to face | As a guest now. Show the game from Gate 0, with permission. **This is earlier than the 90-day plan**, which asks organisers in Days 38–45 (B9) and shows the game on the weekends of Dec 5–6 and 12–13 (L5). The owner picks one; §5.4 shows the difference |
| 3.14 | Campus and school clubs | OC students | From Gate 0 |
| 3.15 | Creators | OC audiences | From Gate 0 |

### 3.1 Local Reddit

**r/orangecounty**, city subreddits (r/irvine and others: check each exists), and campus subreddits.

- **The rules couldn't be loaded.** The only thing that surfaced was a mirror describing r/orangecounty as "the
  Reddit community for all things related to Orange County, California". Read the sidebar.
- **Reddit-wide:**
  - Reddit treats as spam "users who contribute primarily with links to businesses they own or benefit from", and it
    judges this by behaviour and history (dev.to, quoting Reddit's help pages).
  - Many subreddit wikis quote Reddit's old guidance: about **10% or less** of your posting should link to your own
    content.
  - Vote manipulation is prohibited, including asking people for votes (reported from Reddit's rules).
- **What to do:**
  1. From now, comment as a resident in r/orangecounty and your city's subreddit a few times a week. That means
     traffic threads, food and local news, with **no links**.
  2. Before posting the game, **message the moderators** (template in §7.5). Ask whether a one-time post is welcome,
     and when.
  3. Post once per community, as a text post written for it. For example: "I built a free game of OC's freeways from
     open map data. Which exit should get the next race?"
  4. Say you made it. Answer every comment for the day.
- **Never:** paste the same text into several subreddits on the same day, or repost after a removal. Read the reason,
  thank the mods, move on.

### 3.2 r/WebGames

- **The rules,** from a mirror of its wiki, last updated unknown:
  - The game runs in a browser with no download.
  - It **must not require signing up**: no more than one form of verification.
  - A game that needs a peripheral beyond the browser ("VR, smartphone") is removed. The desktop build must play with
    a keyboard.
  - It must work with standard add-ons such as ad blockers.
  - **No referral links.**
  - No reposting a game within three months.
- **About it:** it describes itself as games with "no downloads, signups, or plugins" and has about 124k members
  (GummySearch's figure, undated; check the sidebar).
- **What to do:** post only after Day 46, with the invite gate off. Use the plain URL, no `?ref=` code. Test the
  desktop build with uBlock on first.

### 3.3 r/IndieGaming, r/indiegames, r/playmygame, r/IndieDev

| Subreddit | Its rules (source) | What to do |
| --- | --- | --- |
| **r/IndieGaming** | Rule 6, "Follow our spam and self promotion rules". Its text didn't load (wiki mirror) | Read the rule. Post after Day 46 |
| **r/indiegames** | Since Aug 2024: no promotion dressed up as a feedback request (mod post, mirror) | Post it as a game, not as "feedback?". After Day 46 |
| **r/playmygame** | From 2024 rules (mirror): one post per calendar month; the poster is on the dev team; a written description; platform flair; a playable build that's free to access | It fits the public game. Post after Day 46 |
| **r/IndieDev** | A moderator comment says self-serving promotion is against the rules; genuine feedback requests are fine | Share real dev questions during build in public |

### 3.4 r/threejs

- **The rules weren't found.** About 32k members (GummySearch's figure, undated).
- **The post that fits:** a technical one. For example: "How I turned OpenStreetMap freeways into a drivable three.js
  world in one 3.5 MB HTML file," with a GIF and two paragraphs on the method, written for developers. (The build
  measured 3.4 MB on this branch and 3.6 MB on the UI pass's on 2026-10-16; use the size of the build you post.)
- **When:** during build in public. One post. Answer the questions.

### 3.5 r/gamedev and Screenshot Saturday

- **The rules,** from a mirror of the r/gamedev wiki: self-promotion is allowed **only in the weekly threads**
  (Screenshot Saturday, Feedback Friday, Marketing Monday and others), or alongside free assets. Content should be
  "specifically meant to be consumed by other game developers". Check that week's thread exists.
- **What to do:**
  - Post one image or GIF a week in the Screenshot Saturday thread, with two lines on what changed.
  - Use the same image with #ScreenshotSaturday on any other account where you already post.
  - Comment on other people's entries too.

### 3.6 Show HN

- **The rules (HN's Show HN page):**
  - Make it easy for users to try your thing out, "ideally without barriers such as signups or emails".
  - Sign-up pages, newsletters and blog posts are off topic.
  - "Don't post landing pages or fundraisers."
- **HN's guidelines:**
  - "Don't solicit upvotes, comments, or submissions."
  - "Please don't use HN primarily for promotion."
- **What to do:**
  - Day 46 only, once anyone can play without a code (90-day plan L1).
  - The draft title and first comment are in §7.6.
  - The owner answers comments all day. Never ask anyone to upvote, anywhere.

### 3.7 Product Hunt

- **The rules:**
  - Asking for upvotes is against Product Hunt's policies. So are incentivized votes and mass messages asking for
    them. The team may ask you to remove posts that ask. (Product Hunt's "Sharing your launch" page and help centre.)
  - Company accounts can't post products; post from a personal account. This comes from an aggregator copying
    Product Hunt's help, so it's unconfirmed.
  - The day runs from 12:01 a.m. Pacific (third-party guides).
- **What to do:**
  - Make the personal account now and comment genuinely on a few launches a week.
  - Launch Day 51 (Tue 8 Dec) per the 90-day plan.
  - Ask for feedback, never for votes. The maker comment draft is in §7.7.

### 3.8 itch.io

- **The rules:**
  - Upload an HTML5 game as a zip with `index.html` inside. The limits are 1,000 files, 500 MB extracted and 200 MB
    per file (itch's docs, as quoted in its forum).
  - "Currently all HTML5 games on itch.io are set up to only take payments as donations" (docs quoted by users and
    confirmed by staff in the forum, 2020–2023).
- **What to do:**
  - The itch build hides our store.
  - It goes public after Day 46. The 90-day plan has it on Days 61–63.
  - Pre-launch, use itch's devlog only if the page is already public. Otherwise wait.

### 3.9 Browser game portals

These are optional and come after the OC launch. None helps the OC-only window.

| Portal | What it requires | Ads | Exclusivity | Verdict |
| --- | --- | --- | --- | --- |
| **CrazyGames** | From its official docs:<br>• Initial download 50 MB or less (20 MB or less for the mobile homepage); 250 MB and 1,500 files at most<br>• Content fits **PEGI 12**<br>• In-game purchases are **invite-only**, through its Xsolla account<br>• Community links (Discord, a dev site) only on the main menu, and only if they **don't lead to a playable web version**<br>• Cross-promotion of other platforms is prohibited<br>• New games get a two-week **Basic Launch** (limited audience, no monetization), judged on playtime, conversion to gameplay and retention. Full Launch needs its SDK | Only ads served through its SDK are allowed. Revenue is an ad revenue share | Optional. A third-party guide says two months of exclusivity adds 50% | **On hold: it clashes with the "no ads at launch" rule** (`CLAUDE.md`, 2026-10-16). Basic Launch has no monetization, but Full Launch means its SDK's ads. The 90-day plan has it on Days 64–70; that waits for the owner to decide whether portal ads count. If yes: a separate build with no store, no link to our site (it's a playable web version), and our Discord on the menu only |
| **Poki** | Developer tools are in closed beta, with limited access (Poki's SDK site) | Poki's model. You keep 100% of earnings from players you bring and 50% from players Poki brings | **Web-exclusive by default**: the open web, including Discord and YouTube Playables, not Steam or the app stores. The default term is **5 years** on one Poki page and **7 years** on an older one. The non-exclusive deal is a one-time flat fee | **Skip.** Exclusivity would take the game off our own site. Reconsider only if Poki makes an offer, and read the terms then |
| **Newgrounds** | A zipped HTML5 build with relative paths (third-party guide) | Ad revenue share; a game can run without ads (same guide) | None found | A free, low-effort listing after Day 46, **with ads switched off** (the no-ads rule). Verify the terms |
| **Game Jolt** | A zip with `index.html` at the top level (2019 tutorial) | Ad share; ads can be switched off (2019 tutorial). A 2026 guide mentions a 10% marketplace fee. Verify | None found | Same as Newgrounds: ads off |
| **GameDistribution** | Its SDK, syndicated across partner sites (third-party guide) | Ads through its SDK | Not checked | Skip. Our site and store don't fit ad syndication |
| **Kongregate** | Stopped accepting new games on 1 July 2020 (Wikipedia; PocketGamer.biz) | — | — | Closed |

### 3.10 TikTok, Instagram Reels, YouTube Shorts

All three take the same vertical clip. Upload the **original phone recording** to each app, not a download from
another app. In 2021 Instagram said it makes Reels with other apps' watermarks less discoverable, and in 2022 it
said it favours original content (Tubefilter; Fast Company).

| | TikTok | Instagram Reels | YouTube Shorts |
| --- | --- | --- | --- |
| **Length** | Up to 10 min recorded in the app; uploads up to 60 min (third-party guides). Our clips are 12–25 s | Up to 3 min since January 2025 (Mosseri, reported) | Up to 3 min for vertical or square uploads since 15 Oct 2024 (YouTube Help). A Short over 1 minute with an active **Content ID claim is blocked**, one more reason to use only the game's own sound |
| **Disclosure for our own posts** | "Disclose commercial content" → "Your brand" | Our own account, so no partner label is needed. Say "I made this" | Our own channel. Tick "includes paid promotion" only for a partner's post |
| **Disclosure for a crew member's post** (if they got a perk) | "Branded content", which shows a "Paid partnership" label | The paid partnership label | Tick "includes paid promotion" |
| **Hashtags** | Up to 5 (our rule) | **Reportedly capped at 5** per post and Reel since Dec 2025 (several marketing sites; no Instagram page confirmed). Use 5 at most everywhere | Up to 5 (our rule) |
| **Music** | **Game audio only.** Business accounts get only the Commercial Music Library, and the general library is for personal use | Game audio only | Game audio only |

One unverified report: an Elev8or blog says YouTube announced on 3 Sep 2026 that it will auto-label undisclosed paid
promotion. No second source was found. It doesn't change what we do, which is to disclose anyway.

**The FTC's position:** don't assume a platform's label is enough on its own; use it as well as your own disclosure
(FTC, "Disclosures 101"). The disclosure goes in the video itself, plus the caption (§6.2).

### 3.11 Discord

- **Our server** (90-day plan F10): #announcements, #feedback, #bugs, #run-cards, #founders. Rules screening on,
  verification level Medium, AutoMod.
- **Other people's servers.** Discord's Community Guidelines bar unsolicited bulk messages. Its spam filter can flag
  invite trading even when nobody complained (Discord guidelines and safety page). So:
  - Never DM people you don't know.
  - Never drop invite links in servers you haven't joined as a member.
  - In OC or car servers, post in a self-promo channel only if one exists. Otherwise ask a moderator first.
- **Server Discovery.** It needs a Community server, posted rules, a moderator team and activity thresholds that
  Discord doesn't publish consistently (support pages; check the in-app checklist). Discord's Discovery page has
  also set a minimum member count (1,000 in the version this fact-check knows; it couldn't be reloaded on
  2026-10-16). Not a launch tool. Ignore it until the server is near that size.

### 3.12 Local press

Status was checked on 2026-10-16. **Pitch timing:**

- **Student papers** during the beta (from Day 15). The OC-only beta and campus codes are their angle. (This is
  earlier than the 90-day plan's L4, which sends every pitch on Day 43. The owner decides.)
- **Everyone else** on **Mon 30 Nov (Day 43)**, with an embargo to Thu 3 Dec (90-day plan L4).

| Outlet | Status and contact (source) | Angle |
| --- | --- | --- |
| **Orange County Register** | Publishing. It advertised a local news reporter job in Dec 2025 (JournalismJobs). No tip page surfaced in search; use the "Contact Us" links on ocregister.com | "An OC developer rebuilt the county's freeways as a free phone game" |
| **Daily Pilot** (Costa Mesa, Newport Beach, Huntington Beach, Fountain Valley, Laguna Beach) | Published by the Los Angeles Times' Times Community News (Wikipedia, which lists Carol Cormaci as editor; Muck Rack lists its journalists). Verify the editor on dailypilot.com | The 55/405, the 73 and Newport Coast, the HB exits |
| **LAist** | **Rene Lynch** covers Orange County and asks for story ideas, "especially about Orange County": rlynch@laist.com (LAist profile). LAist reports funding cuts after federal clawbacks | Local, free, made by one person, built on open data |
| **OC Weekly** | **Closed in print on 27 Nov 2019** (Duncan McIntosh Co.; Deadline, LAist). An OC Weekly post on X in Jan 2023 said L.A. Weekly's CEO Brian Calle now owns it. **ocweekly.com is publishing in 2026** (music, lifestyle and review pieces, some reading as sponsored), with a contact page and a free "Submit your own event" form | A short pitch to the contact page. The event form only for a real event, such as a launch-night meet-up that has permission. **Never pay for a "sponsored" story**: it costs money and has to be labelled an ad |
| **Orange County Business Journal** | Irvine; (949) 833-8373 and a contact page (OCBJ about page). It has covered OC game studios and esports companies | The business of a one-person game: $0 launch, open data, local players. Better after launch, with numbers |
| **Student papers:** New University (UCI), Daily Titan (CSUF), The Panther (Chapman), Coast Report (OCC), Lariat (Saddleback) | New University: tips go to the relevant section on its contact page, and other inquiries to eic@newuniversity.org (verify on the live page). The others: use their contact pages | "An OC game you can drive your campus exit in; here are codes for students" |
| **Voice of OC** | A nonprofit accountability newsroom. Its tips page wants documented, newsworthy tips and says press releases don't belong in its anonymous channels (Voice of OC contact page) | **Not a fit.** Skip |

**How to pitch:**

- One personalised email per outlet. The template is in §7.1.
- Use a plain-text link to the press kit (the launch kit's one-pager, renamed OC Ultra) and a 20-second phone clip.
  No attachments over a few MB.
- Offer a code so the reporter can play.
- **One follow-up after a week, never two** (90-day plan L4). Don't send to more than one person at the same outlet
  at once.

### 3.13 OC car-meet culture

These regular, organised meets surfaced in listings. **Confirm each with its organiser before going.** Listings go out
of date.

| Meet | When and where (source) |
| --- | --- |
| South OC Cars and Coffee | Saturdays 9–11 a.m., The Outlets at San Clemente. The listing says 700–1,000 vehicles, rain or shine, no registration (Events with Cars) |
| An Irvine Saturday meet | Irvine Center Drive, 9–11 a.m. (Get Out Garage listing) |
| Donut Derelicts | Huntington Beach, Saturdays 5–8 a.m. (Enjoy OC) |
| Donuts & Dipsticks | Placentia, Saturdays 7–9 a.m. (Enjoy OC) |
| Cars, Coffee and Culture | Anaheim GardenWalk, 8 a.m.–1 p.m. on its dates (iDriveSoCal) |

**How to show up:**

1. **Go as a car person first.** Attend two or three times before showing anything. Talk cars, not the game.
2. **Ask the organiser before you show anything.** The DM template is in §7.3. If they say no, you're a guest. Don't
   pitch.
3. **If they say yes:**
   - Keep it to a phone, no table unless they offer one.
   - Show the QR code on your phone's screen.
   - Use the meet's own invite code (`SOCC-5`, for example), with the organiser's OK on the name.
4. **Never imply the event endorses the game.** Never use a meet's name, logo or photos in posts without written
   permission.
5. **Ask before you film anyone, or their car.** No plates in posts.
6. **Never go near takeovers or sideshows**, and never reply to accounts that promote them. California's 2024 law
   package lets police impound vehicles used in sideshows. AB 3 (2021) lets courts suspend a licence for up to six
   months for exhibition of speed, from 1 July 2025.
   San Jose fines people $1,000, with up to six months in jail, for **promoting** a sideshow on social media.
   San Francisco made promotion a misdemeanour. Long Beach moved to do the same. (KTLA, LAist, Insurance Journal and
   a law-firm summary, reported. Verify the state law's text before quoting it.)
7. **Never film real driving.** The game's footage is the game. That protects the owner and the meet.

### 3.14 Campus and school clubs

Each club was checked on 2026-10-16.

| School | What exists (source) | Status |
| --- | --- | --- |
| **UC Irvine** | **Video Game Development Club (VGDC)**: quarterly project pitches, "over 600 active members", and an annual Game Developers Week of industry talks (New University, 10 May 2026; UCI ICS). **UCI Esports**: the first college esports programme at a public university, since Sept 2016, with an arena in the Student Center (UCI News) | Verified |
| **Cal State Fullerton** | **Titan Esports**, a club team since 2019, about 70 students (Daily Titan, 2023), plus ASI's Titan Cup tournaments in fall 2025 (ASI). The **Video Game Design Club** (CSUFVGDC) has a Steam group founded in 2009 with comments from Aug 2025; its site is listed as csufvgdc.com | Esports verified. The game-dev club is likely active; confirm on TitanLink |
| **Chapman** | No current club found. The university's first esports league launched in Oct 2020, run by Fitness and Recreation (The Panther). Dodge College and engineering teams entered the IEEE GameSIG showcase (Chapman blogs) | **Unverified.** Check Chapman's student-organization directory |
| **Orange Coast College** | An **Esports Club** had a booth at Coast Day on 14 Apr 2026 and is working to bring esports back as an official programme (Coast Report). Campus esports run through the Mission Control app (OCC esports page) | Verified |
| **Saddleback College** | No esports or game-dev club found. A **Tabletop Club** exists (Lariat) | **Unverified.** Check the student government's club list |
| **High schools** | NASEF began in OC in 2018 as the Orange County High School Esports League (38 teams from 25 high schools), with the OC Department of Education, UCI and the Samueli Foundation (NASEF) | NASEF's current OC activity is unverified |

**How to approach them:**

- **University clubs: offer them something.**
  - A 20-minute talk ("Building OC's freeways from OpenStreetMap in three.js") at VGDC or a game-dev meeting.
  - A "drive your exit" night for an esports club.
  - A campus invite code (`UCI-405`, `CSUF-57`, `OCC-55`).
  - Email the officers. The template is in §7.4.
- **Flyers.** Every campus has rules for posting on campus. Ask the club, or the campus's student-life office, before
  posting anything. Digital first: the club's own Discord or Instagram, with their OK.
- **High schools: only through a teacher or the club's advisor, never students directly.** Never DM a student. No one
  under 13 is targeted, ever. The FTC's amended COPPA rule took effect in June 2025 with compliance due 22 Apr 2026
  (law-firm summaries). Purchases are 13+ in the store's terms (90-day plan F7). The Founders crew is 18+ (§6).

### 3.15 Creators

- **Who:** OC accounts that already post freeway or traffic jokes, car content, or "things to do in OC". Find them by
  searching #orangecounty, #ocfreeway, #the405 and city tags in each app. Make a list of 10 with follower counts and
  their last three posts.
- **The ask:** unpaid. Free access, an early code and a personal message (§7.2). **The budget is $0, so no paid
  posts.** If a creator quotes a fee, thank them and say so honestly. The paid creator tier in
  `PROJECT_OC_BUSINESS.md` §2.1 waits for a budget.
- **Disclosure:** after Day 46, if a creator gets nothing but a free game anyone can play, there's no material
  connection to disclose. **Before Day 46 the code itself is a perk:** it skips a waitlist that everyone else is on,
  and the 2023 Endorsement Guides list "early access to a product" as a material connection (16 CFR 255.0(e)). So a
  creator who posts about the beta says so, in a light way ("got an early beta code from the dev"). If they get a
  bigger perk (a free Founder Pack, merch, their name in the credits), they disclose it exactly as in §6.2.
- **Expect** one or two replies from ten messages. That's an assumption, not a benchmark. One personal message each,
  one follow-up at most. No bulk DMs.

---

## 4. The 8-week content plan

### 4.1 The calendar

Content weeks run **Thursday to Wednesday**, counted back from launch Thursday. The weekly build lands on a Thursday
(90-day plan B2), the owner records that evening, and the clips go out Friday, Monday and Wednesday.

| Week | Phase | Dates if launch is Thu 3 Dec 2026 | Post days |
| --- | --- | --- | --- |
| W−8 | A. Build in public | Thu 8 Oct – Wed 14 Oct | **Passed** |
| W−7 | A | Thu 15 Oct – Wed 21 Oct | Fri 16 (today), Mon 19, Wed 21 |
| W−6 | A | Thu 22 Oct – Wed 28 Oct | Fri 23, Mon 26, Wed 28 |
| W−5 | B. OC beta (from Gate 0) | Thu 29 Oct – Wed 4 Nov | Fri 30, Mon 2 (wave 1, Day 15), Wed 4 |
| W−4 | B | Thu 5 Nov – Wed 11 Nov | Fri 6, Mon 9 (wave 2, Day 22), Wed 11 |
| W−3 | B | Thu 12 Nov – Wed 18 Nov | Fri 13, Mon 16 (wave 3, Day 29), Wed 18 |
| W−2 | B | Thu 19 Nov – Wed 25 Nov | Fri 20, Mon 23, Wed 25 (Thanksgiving week: keep it light) |
| W−1 | C. Countdown | Thu 26 Nov – Wed 2 Dec | Fri 27 (the day after Thanksgiving, Thu 26 Nov), Mon 30 (press goes out, Day 43), Wed 2 |

**Honest note: the default calendar gives seven weeks, not eight.** W−8 has passed, and the accounts don't exist yet.

- **If launch stays on 3 Dec:** make **Mon 19 Oct** the first post with clip 8.1 (the hook). Post 7.1 on Wed 21 Oct.
  From there, follow the plan from W−6. Clips 8.2, 8.3, 7.2 and 7.3 go into the **evergreen bank**. Use them on quiet
  days: Thanksgiving week, the holiday weeks (90-day plan P4: two posts a week on Days 64–77), and any week the build
  slips.
- **If Gate 0 slips by a week,** the 90-day plan slides launch to Thu 10 Dec. Then all eight weeks fit from today,
  with W−8 = Thu 15 Oct.
- **Phase B starts when Gate 0 passes, not on a date.** Until then, keep posting Phase A clips (and the bank).

### 4.2 The capture recipe (the game's own tools, a phone, $0)

**The game's controls, all in today's build:**

| Control | Options |
| --- | --- |
| **Start panel** | Pick a freeway, or **Start at your exit** (416 signs; you start 450 m before the sign) |
| **Modes** | Free Drive, Speed Survival, Races, Time Trial |
| **Time** | Live (the sun's real position from the device clock), Sunrise, Day, Sunset, Night |
| **Weather** | Clear, Cloudy, Rain, Fog, Mist, Changing |
| **Traffic** | None, Light, Moderate, Heavy, Expert |
| **Camera button** | Driver's seat → Hood → Chase → Free look |
| **Corner window** | Road map, Sky camera (150 m up) or Off. **Use Off for clean shots** |
| **Radio** | KCST 101.5 Coast, KFWY 96.9 Freeway FM, KNYN 88.3 Canyon Radio. The music is composed in code: no licence, no Content ID risk |
| **Ability button** | Clear Path, Focus Time, Locked In. The driver's hand does a watch check (The Closer), a wave (The Ace) or a hand on the knee (The Wrench) |
| **Share run** | The run card (1080 × 1350), from the results screen. In Free Drive: Pause → End drive → Share run. **End drive is only in Free Drive's pause menu**; the other modes end on their own and go straight to the results screen |

**Recording:**

- **Phase B onward (phone):**
  - Use the phone's own screen recorder with sound on (Control Center on iPhone, Quick Settings on Android). Hold
    the phone in portrait.
  - Graphics on the preset the phone holds at 30 fps or better. That's Low until Gate 0 says otherwise. Never
    record a High-preset desktop run and caption it as the phone.
  - Trim in the phone's own editor. Add on-screen text with each app's text tool. Append the end card.
- **Phase A (before the game runs on the owner's phone):**
  - **Option 1:** a laptop or desktop browser recording, if the owner has one. Label it on screen: "dev build ·
    laptop".
  - **Option 2:** **stills.** Claude renders the game's screens headlessly (`tools/ui-shots.mjs`, at phone size) and
    makes run cards. Post them as photo carousels.
  - **Option 3, not built:** a frame-stepped clip recorder. Playwright plus the game's `window.__game.fastForward`,
    one screenshot per frame, then `ffmpeg` (installed in this sandbox). Claude could build it in an afternoon,
    Opus-class. Its speed in software rendering is untested, and its clips would be silent.

**The format:**

- 9:16, 1080 × 1920.
- **12–25 seconds.**
- The hook in the first 2 seconds.
- On-screen text kept in the middle 70% of the frame (the apps' buttons cover the edges).
- The 1.5-second end card last.

**Each caption:**

- One or two plain sentences, then the honesty line.
- **Five hashtags at most.** The core two are always **#OCUltra #OrangeCounty**, plus three from:
  - freeways: #405 #the5 #the91 #the55 #the57 #the73 #tollroad
  - cities: #Irvine #CostaMesa #Anaheim #SantaAna #HuntingtonBeach #Fullerton #Orange #SanClemente #NewportBeach
    #Tustin #LakeForest
  - type: #indiegame #webgame #racinggame #drivinggame
  - dev: #gamedev #threejs #buildinpublic #screenshotsaturday
- **Phase A captions end with:** "OC beta in November. Follow to get in."
- **Phase B captions end with:** "OC-only beta: join the waitlist (link in bio)."

### 4.3 The clips

Each clip lists its settings, its shot list (in seconds), its on-screen text, its caption and its tags. Claude drafts
the final captions each week from what the build actually does that week. **Any number on screen must come from a
real run.**

#### W−8 · "It's real" (Phase A; on the default calendar, 8.1 posts Mon 19 Oct and the rest go to the bank)

**8.1 The hook** · 18 s
- *Set:*
  - Free Drive.
  - Start at your exit: I-405 North, Jamboree Road.
  - Sunset, Moderate traffic, Driver's seat, corner Off.
- *Shots:*
  - 0–2 s: the Jamboree Road sign ahead.
  - 2–10 s: floor it, two clean passes.
  - 10–14 s: Chase camera as "John Wayne Airport / MacArthur Boulevard" goes by.
  - 14–16.5 s: back to the seat, the CA 55 split ahead.
  - 16.5–18 s: end card.
- *Text:* "The real 405. At sunset." → "Every exit is real."
- *Caption:* "I'm building Orange County's real freeways for your phone. This is the 405 North at Jamboree. A game.
  Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #405 #Irvine #gamedev

**8.2 Built from the map** · 15 s
- *Set:* Free Drive on the I-5 North approaching the El Toro Y. Day, Light traffic.
- *Shots:*
  - 0–3 s: Free look camera, turned to the split.
  - 3–11 s: Driver's seat as the "I 405 North" sign passes.
  - 11–13.5 s: the sky camera in the corner window (set it to Sky for this shot).
  - 13.5–15 s: end card.
- *Text:* "Every ramp from OpenStreetMap." → "1,247 ramp pieces. 416 real exit signs."
- *Caption:* "Every road here comes from open map data (OpenStreetMap via Overture). This is the El Toro Y, where the 405
  begins. Traffic is simulated. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #Irvine #threejs #buildinpublic

**8.3 The wordmark** · 12 s
- *Set:* Free Drive, Sunset, the 73 South near Newport Coast Drive. No traffic.
- *Shots:*
  - 0–2.5 s: the OC sunset wordmark, full screen (a still).
  - 2.5–10.5 s: the cockpit at sunset, with the sun low ahead.
  - 10.5–12 s: end card.
- *Text:* "OC Ultra."
- *Caption:* "It has a name. OC Ultra: Orange County's freeways, on your phone. Beta in November. A game. Drive the real
  ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #the73 #NewportBeach #indiegame

#### W−7 · "Your exit" (Phase A)

**7.1 Comment your exit** · 16 s. **This starts the exit-requests series (§4.4).**
- *Set:* the Start panel → Start at your exit → scroll the I-405 North list → pick Culver Drive → Drive. Day.
- *Shots:*
  - 0–5 s: the exit list scrolling, as a screen recording.
  - 5–14 s: the Culver Drive sign ahead, then pass under it.
  - 14–16 s: end card.
- *Text:* "Pick your exit." → "Comment yours. I'll drive it next."
- *Caption:* "416 real OC exits. Comment yours and I'll drive it in the next video. A game. Drive the real ones at the
  limit."
- *Tags:* #OCUltra #OrangeCounty #405 #Irvine #indiegame

**7.2 You asked for it** · 18 s
- *Set:* the most-requested exit from 7.1's comments. If there are none yet: I-5 North, Avenida Pico in San Clemente,
  Sunrise, **and drop the comment shot and every "you asked" or "requested" line**: use "Next exit: Avenida Pico" and
  "Avenida Pico, San Clemente, at sunrise. Which exit next?" A request nobody made is a false claim.
- *Shots:*
  - 0–2 s: a screenshot of the comment (with the commenter's username blurred, unless they say OK).
  - 2–15 s: drive to and past their sign.
  - 15–16.5 s: Chase camera.
  - 16.5–18 s: end card.
- *Text:* "You asked for Avenida Pico."
- *Caption:* "Requested: Avenida Pico, San Clemente, at sunrise. Next exit? A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #SanClemente #the5 #indiegame

**7.3 The Orange Crush** · 20 s
- *Set:* Free Drive on the I-5 North toward the 57, navigation set to CA-57 North. Day, Heavy traffic.
- *Shots:*
  - 0–3 s: the navigation prompt for CA-57 North (use whatever the game says on the day).
  - 3–17 s: through the interchange in the Driver's seat, with the "CA 57 North / Pomona" sign.
  - 17–18.5 s: Hood camera.
  - 18.5–20 s: end card.
- *Text:* "The Orange Crush." → "Once called the world's most complex interchange (Guinness, 2002)." Check the edition
  year in the Wikipedia article's own source before posting; if it can't be confirmed, drop the year.
- *Caption:* "The 5, the 22 and the 57, all at once. Would you take this one at rush hour? Traffic is simulated. A game.
  Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #the57 #Orange #drivinggame

#### W−6 · "Night and rain" (Phase A)

**6.1 The 73 at night** · 18 s
- *Set:* SR-73 South from Bonita Canyon Drive. Night, Light traffic. Radio: KNYN 88.3 Canyon Radio.
- *Shots:*
  - 0–2 s: headlight beams on the road.
  - 2–12 s: the curves past Newport Coast Drive.
  - 12–16.5 s: Chase camera under the stars.
  - 16.5–18 s: end card.
- *Text:* "The 73. Midnight."
- *Caption:* "The San Joaquin Hills toll road at night. The radio's music is made by the game. A game. Drive the real
  ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #the73 #NewportBeach #gamedev

**6.2 It rained in OC** · 16 s
- *Set:* SR-55 North from 22nd Street. Rain, Day, Moderate traffic.
- *Shots:*
  - 0–2 s: rain streaks on the windscreen.
  - 2–13 s: the wet road, with traffic slowing.
  - 13–14.5 s: Hood camera.
  - 14.5–16 s: end card.
- *Text:* "It rained in OC." → "(In the game.)"
- *Caption:* "Rain on the 55, for once. Weather is simulated, so it can rain whenever you want. A game. Drive the real
  ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #the55 #CostaMesa #indiegame

**6.3 The hands** (the dev post; also this week's Screenshot Saturday GIF and the r/threejs post) · 14 s
- *Set:* Free Drive on the I-405 North. Day, Light traffic. The Closer driver: their ability, Clear Path, plays
  the watch check.
- *Shots:*
  - 0–8 s: the Driver's seat; trigger Clear Path so the driver checks the gold watch at speed.
  - 8–12.5 s: the wheel and the live tachometer.
  - 12.5–14 s: end card.
- *Text:* "Hands, built from scratch."
- *Caption:* "Built the driver's hands from scratch for a browser game: watch check at speed. One HTML file, three.js. A
  game. Drive the real ones at the limit."
- *Tags:* #OCUltra #threejs #gamedev #buildinpublic #screenshotsaturday

#### W−5 · "It's on your phone" (Phase B starts the day Gate 0 passes)

**5.1 One take, on a phone** · 25 s
- *Set:* a cold start on the owner's phone (the model shown in text), on Low (or the safe mode, once 90-day plan
  F5 adds it).
- *Shots:*
  - 0–2 s: tap the home-screen icon.
  - 2–[real load time]: loading. **Keep the real time in, uncut.**
  - Then the menu → Start at your exit → drive for 8 s.
  - The last 1.5 s: end card.
- *Text:* "No download. On my [phone model]."
- *Caption:* "OC Ultra on a phone, one take, nothing cut. The OC-only beta opens Monday. Join the waitlist (link in bio).
  A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #webgame #indiegame #405

**5.2 The first 25** (posts Mon 2 Nov, wave 1) · 15 s
- *Set:* the waitlist page on the phone (a screen recording) → a driving shot.
- *Shots:*
  - 0–5 s: the page and the "You're #__" screen. Use a test sign-up's number; never a fake one.
  - 5–13.5 s: a 405 sunset shot.
  - 13.5–15 s: end card.
- *Text:* "25 invites this week." → "OC only."
- *Caption:* "The first 25 OC beta invites go out today, from the top of the waitlist. Each friend from OC who joins with
  your link moves you up. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #Irvine #Anaheim #SantaAna

**5.3 Your run card** · 14 s
- *Set:* any Speed Survival run, driven until it ends → the results screen → Share run. (Pause has no End drive in
  Speed Survival; it's only in Free Drive.)
- *Shots:*
  - 0–9 s: the last seconds of the run.
  - 9–12.5 s: the run card, centred on screen.
  - 12.5–14 s: end card.
- *Text:* the run card's own numbers, from **this** run.
- *Caption:* "Every run makes a card on your phone. Nothing is uploaded unless you post it. Show us yours: #OCUltra. A
  game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #405 #racinggame #indiegame

#### W−4 · "Speed Survival"

**4.1 Over 100 or it's over** · 22 s
- *Set:* Speed Survival on the I-405 North. Heavy traffic, Day.
- *Shots:*
  - 0–2 s: the streak counter starting.
  - 2–19 s: near misses and clean passes building the combo.
  - 19–20.5 s: Chase camera.
  - 20.5–22 s: end card.
- *Text:* "Stay over 100 mph." → "One crash ends it."
- *Caption:* "Speed Survival: near misses build the streak, one real crash ends it. In a game, on simulated traffic,
  where it belongs. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #405 #racinggame #indiegame

**4.2 The crash** · 12 s
- *Set:* the same mode. Keep a real run that ended badly.
- *Shots:*
  - 0–9 s: the last seconds and the crash.
  - 9–10.5 s: the results screen.
  - 10.5–12 s: end card.
- *Text:* "Lasted [real time] s." → "Beat it."
- *Caption:* "My best ended here. Beat it in the beta. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #the91 #racinggame #webgame

**4.3 Time Trial** · 18 s
- *Set:* Time Trial (60 s; every 2 km buys 25 more).
- *Shots:*
  - 0–2 s: the clock.
  - 2–15 s: the run, with a time bonus.
  - 15–16.5 s: the result.
  - 16.5–18 s: end card.
- *Text:* "60 seconds. Every 2 km buys 25 more."
- *Caption:* "Same seed, same start, every time. Fair for everyone. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #drivinggame #indiegame #405

#### W−3 · "Races"

**3.1 The Irvine Sprint** · 22 s
- *Set:* the race: 8 km up the 405 North from Irvine.
- *Shots:*
  - 0–4 s: the grid countdown, with rivals Marco V. (ANA), Dani K. (IRV) and Sol R. (HB).
  - 4–18 s: the race.
  - 18–20.5 s: the finish.
  - 20.5–22 s: end card.
- *Text:* "Irvine Sprint. 8 km of the 405."
- *Caption:* "Three AI rivals, eight km of the real 405. Rivals and traffic are simulated. A game. Drive the real ones at
  the limit."
- *Tags:* #OCUltra #OrangeCounty #405 #Irvine #racinggame

**3.2 The Foothill Sprint** · 20 s
- *Set:* the race: 10 km down the 241 South.
- *Shots:*
  - 0–3 s: the countdown.
  - 3–16 s: the hills and sweepers in the Hood camera.
  - 16–18.5 s: the finish.
  - 18.5–20 s: end card.
- *Text:* "The 241. Hills and sweepers."
- *Caption:* "Ten km of the Foothill toll road, two lanes, no brakes needed (in the game). A game. Drive the real ones at
  the limit."
- *Tags:* #OCUltra #OrangeCounty #the241 #LakeForest #racinggame

**3.3 The 91** · 18 s
- *Set:* the Riverside Endurance race (30 km, 91 East), Heavy traffic.
- *Shots:*
  - 0–3 s: the start.
  - 3–15 s: threading traffic.
  - 15–16.5 s: the "CA 241 South" sign.
  - 16.5–18 s: end card.
- *Text:* "A race on the 91." → "Still traffic."
- *Caption:* "Even in a game, the 91 has traffic. 30 km out toward Riverside. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #the91 #Anaheim #racinggame

#### W−2 · "The Founders" (Thanksgiving week, light)

**2.1 The crew's runs** · 15 s
- *Set:* none. A compilation of run cards that Founders crew members posted, **with their written OK**, credited by
  handle.
- *Shots:* five cards, 2.5 s each. End card.
- *Text:* "Your runs this week."
- *Caption:* "The OC beta's best runs this week. Founders crew posts are marked: they get early builds. A game. Drive
  the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #Irvine #Fullerton #CostaMesa

**2.2 What broke** · 16 s
- *Set:* a real bug from the week and its fix. Show the before and after on the same exit.
- *Shots:*
  - 0–6 s: the bug (a screen recording from a tester, with OK).
  - 6–14.5 s: the fixed build.
  - 14.5–16 s: end card.
- *Text:* "Testers found this." → "Fixed Thursday."
- *Caption:* "Beta testers found it, we fixed it. That's the deal. Thanks, [handle]. A game. Drive the real ones at the
  limit."
- *Tags:* #OCUltra #gamedev #buildinpublic #indiegame #OrangeCounty

**2.3 Where the 405 begins** · 15 s
- *Set:* I-5 North through the El Toro Y. Sunset.
- *Shots:*
  - 0–12 s: from "Lake Forest Drive" to the "I 405 North" split.
  - 12–13.5 s: Chase camera.
  - 13.5–15 s: end card.
- *Text:* "Where the 405 begins."
- *Caption:* "The El Toro Y at sunset. Thankful for open map data. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #405 #Irvine #LakeForest

#### W−1 · "Thursday" (countdown)

**1.1 Free to play** (Fri 27 Nov) · 14 s
- *Set:* the menu → the garage → a Free Drive start.
- *Shots:*
  - 0–4 s: the menu.
  - 4–9 s: the garage.
  - 9–12.5 s: driving.
  - 12.5–14 s: end card.
- *Text:* "Free to play. Thursday."
- *Caption:* If the store stays in test mode: "Free. Nothing to buy. Open to everyone Thursday." If it goes live:
  "Free to play. Optional cosmetics, never power. Open to everyone Thursday." Then: "A game. Drive the real ones at
  the limit."
- *Tags:* #OCUltra #OrangeCounty #webgame #indiegame #405

**1.2 Three days** (Mon 30 Nov) · 15 s
- *Set:* the sunrise preset on the I-5 North from Basilone Road (just south of the county line) to San Clemente.
- *Shots:*
  - 0–13.5 s: a single take.
  - 13.5–15 s: end card.
- *Text:* "Thursday, the gate opens."
- *Caption:* "The OC-only beta ends at midnight Wednesday night, Pacific. From Thursday, anyone can drive OC's real
  freeways. A game. Drive the real ones at the limit." (The gate turns off at 00:00 Pacific on Thu 3 Dec, Day 46.
  "Thursday at midnight" would read as Thursday night, a day late.)
- *Tags:* #OCUltra #OrangeCounty #SanClemente #the5 #webgame

**1.3 You picked these** (Wed 2 Dec) · 22 s
- *Set:* five exits that commenters requested, 4 s each.
- *Shots:* five signs, with the requester's handle (with OK). End card.
- *Text:* "You picked these." → "Tomorrow: yours."
- *Caption:* "Five exits you asked for. Tomorrow, drive your own. A game. Drive the real ones at the limit."
- *Tags:* #OCUltra #OrangeCounty #405 #the55 #the91

**Launch day and after** belong to the 90-day plan (L1–L7): the launch clip, Show HN, then one Reddit community a day
and Product Hunt.

### 4.4 Standing series (to fill gaps and keep the comments working)

- **Exit requests (every week):** each Monday clip answers one comment's exit. It's free and endless: there are 416 of
  them. It rewards the people who comment, and it teaches the map.
- **Screenshot Saturday:** one GIF a week to r/gamedev's thread and #ScreenshotSaturday (§3.5).
- **Patch-note clip:** when a Thursday build fixes something a tester reported, use 2.2's format.

---

## 5. The waitlist growth loop

### 5.1 The loop

1. **A clip → the link in bio → the waitlist page** (90-day plan F6). The page has the wordmark, a 20-second phone
   clip and "Join the OC beta".
2. **Sign-up:** email, home ZIP and an invite code if they have one. The ZIP is checked **on the device** against
   Orange County's ZIP areas. Only "in OC: yes/no" and the first three digits are stored.
3. **The page shows the person's real place:** "You're #212." Under it:
   - "OC-only until Thu 3 Dec."
   - "Share your link. Each friend in OC who joins moves you up 5 places." The ready-made share text says so too:
     "My OC Ultra beta link (I move up the list if you join)." Moving up is early access, which is a material
     connection (§5.3), so the link post discloses it.
4. **Invites go out in waves from the top:** 25 on Day 15, up to 50 on Day 22, up to 100 on Day 29, and the later waves
   only if load success is at least 90% (90-day plan B1, B5).
5. **Each tester gets 2 invite codes to give** (`FRIEND-xxxx`, counted under the tester's channel). A friend with a
   code skips the list.
6. **Testers share run cards** with #OCUltra, which brings new people back to step 1.
7. **Day 46:** the gate opens for everyone, and the list hears about it on Discord and the site. Email it too only if
   the owner has set up the CAN-SPAM postal-address footer (90-day plan F9).

The numbers in steps 3–5 (5 places, 2 codes) are this plan's suggestions. Change them before the page goes live,
never after.

### 5.2 The scarcity is real (keep it that way)

- **The real limits:**
  - **OC only until 00:00 Pacific on Day 46**, a date written into the build.
  - **25, then 50, then 100 testers.**
  - The Founder Pack's "sold until 31 December 2026, then never again" (store catalog).
- **Say exact numbers.** "25 invites this week" is true. Never say "only 3 spots left" unless the database counted it
  that minute.
- **No fake urgency.** No countdown timers that reset and no invented demand. The FTC's 2022 staff report "Bringing
  Dark Patterns to Light" lists false scarcity and baseless countdown timers as deceptive design (Venable and other
  law-firm summaries).
- **Keep every promise.** If the Founder Pack says "never again", it never comes back. Not as a re-release, not in a
  bundle.
- **People outside OC can still join.** They see "OC-only until Thu 3 Dec; we'll tell you when it opens." The window
  is about where the testers live, not about shutting people out.

### 5.3 Referral rewards that stay clean

- **Places on the list and one free, earned-only "Beta '26" badge.** That's all.
  - No money and no prizes. That keeps the loop simple and outside contest and sweepstakes territory. Ask a lawyer if
    that ever changes.
  - The badge is a new cosmetic for the owner to approve. It's never sold and is separate from the paid Founder '26
    badge.
- **Even these rewards are a material connection.** Places on the list mean earlier access, and the 2023 Endorsement
  Guides name "early access to a product" as one (16 CFR 255.0(e)); the FTC's guides also treat points-for-posts
  rewards as material connections (law-firm summaries of 16 CFR 255). So a post that shares a referral link says so
  in plain words: the share text in §5.1 does it for people.
- **Don't give away the paid Founder Pack as a referral prize.** It would undercut the people who paid, and it would
  make the reward, and the disclosure each referrer owes, much bigger.
- **A credit is provisional when the friend joins from an OC ZIP, and it's confirmed only when that friend reaches
  the menu** (once they're invited, or with a tester's `FRIEND` code), not when they type an email. Waiting for a
  first play alone wouldn't work in the beta: a friend on the waitlist can't play until invited, so no one would
  ever move up. The owner's hand check of the top 25 before each wave (below) drops provisional credits that look
  fake. At $0 there are no confirmation emails: Supabase's built-in auth email is limited to 2 an hour, meant for
  testing, and only sends to the project's own team (90-day plan §7.1).
- **Caps:** 10 credits per person (50 places). The owner eyeballs the top 25 by hand before each wave. Twenty
  sign-ups from one link within a minute is a bot.
- **Keep referral links out of communities that ban them** (r/WebGames does, §3.2). Use plain links in posts.

**The tech** for Claude, with F6, not built yet:

- **The waitlist table gains:** `ref_code`, `referred_by` and `credited_at`.
- **A `waitlist_position(token)` function** returns only the caller's own place. The public key still can't read the
  table.
- **A credit** is written as provisional at sign-up (`credited_at` empty), and the same redeem function that checks
  invite codes confirms it when the friend first reaches the menu.
- **Demo mode** keeps everything in localStorage, Lumevina's pattern, until Supabase is connected.

### 5.4 The honest arithmetic

The 90-day plan's targets: at least **50 sign-ups by Day 14** and **300 by Day 45**. From Mon 19 Oct (Day 1) to
Wed 2 Dec (Day 45) is 45 days, so 300 needs about **7 sign-ups a day** (6.7).

Every rate below is an **assumption**. Replace each one with real numbers after two weeks.

| Source | Assumption | Sign-ups by Day 45 |
| --- | --- | --- |
| 20 clips on three apps | 500 views each (new accounts often get less), 1% tap the link, 30% of those join | 30 |
| One r/orangecounty post (if the mods allow it) | 5,000 views, 2% click, 30% join | 30 |
| Two city or campus subreddit posts | 1,500 views each, 2% click, 30% join | 18 |
| Two campus club sessions | 40 people each, 50% join on the spot | 40 |
| Four car meets (from Gate 0, with permission) | 15 people each scan, 60% join | 36 |
| One creator post (unpaid) | 20,000 views, 0.5% join | 100 |
| Referrals (§5.3) | 1 in 4 sign-ups brings one more | +25% of the above |
| **Total** | | **about 315 with the creator; about 190 without** |
| *If the car meets wait for the 90-day plan's dates (L5: Dec 5–6 and 12–13, after Day 45)* | *drop the car-meet row* | *about 270 with the creator; about 150 without* |

(The arithmetic, checked: 30 + 30 + 18 + 40 + 36 + 100 = 254, × 1.25 = 317.5. Without the creator, 154 × 1.25 =
192.5. Without the meets, 218 × 1.25 = 272.5 and 118 × 1.25 = 147.5. The 20 clips are the posts from Mon 19 Oct to
Wed 2 Dec in §4.1.)

**What it means:** the clips alone won't get there. One creator, one local Reddit post or two campus nights matter
more than a fourth clip. That's why §3.13–3.15 get as much of the owner's time as filming does. If the owner reaches
150 with no creator, that's a real local beta, enough for the 90-day plan's 100 testers.

---

## 6. The Founders crew: the $0 ambassador programme

`PROJECT_OC_BUSINESS.md` §2 proposed paid ambassadors at $200–500 a month. At $0, it becomes the **Founders crew**
(90-day plan B6).

### 6.1 How it works

- **Who:** 5–10 volunteers who live in OC, are **18 or older** (this plan's rule: it keeps it simple and keeps
  minors out of a promotional role), already play the beta, and post anyway.
- **What they get:**
  - Their name on the Founders credits screen.
  - Builds a few days early.
  - Their own invite code (`CREW-[name]`).
  - A #founders channel.
  - Optionally, a free Founder Pack once the store is live, if the owner offers one.
  - **No money.**
- **What they do:** whatever they'd do anyway, at most two posts a week. Plus one short weekly note, using the launch
  kit's template minus the pay lines: posts, what players asked for, what broke and on which phone.
- **The four guard rails stay** (from the business draft and the launch kit):
  1. Disclose.
  2. Never ask for stars or reviews.
  3. A game, not a dare.
  4. Only true things.
- **The strike rule:** the first miss gets an edit request. A second miss ends the perks (90-day plan B6).
- **If there's ever money for paid ambassadors:** the business draft's model applies, with a written agreement and an
  invoice. **The 1099-NEC threshold rose from $600 to $2,000** for payments made from 1 Jan 2026, under the 2025
  budget law (P.L. 119-21). It's indexed for inflation from 2027. That's from accounting-firm summaries; verify at
  IRS.gov. The "$600" lines in the launch kit (§1, line 61) and the business draft (§2, line 43) are out of date.

### 6.2 The disclosure rule, exactly

**Why every crew post discloses:**

- Being in the crew is a perk: early builds, credits, maybe a free pack. Under the FTC's Endorsement Guides, free or
  discounted products are a "material connection" (FTC, "Disclosures 101", 2019; guides revised 2023).
- So the simple rule: **every crew post about the game discloses, every time.**

**Where it goes:**

- **In the video itself,** as superimposed text in the first seconds, readable and not in a corner. Say it out loud
  too if they talk. A disclosure only in the description or comments isn't enough (FTC, "Disclosures 101", which
  says a video's disclosure belongs in the video itself; law-firm summaries of the 2023 guides).
- **At the start of the caption,** not buried among hashtags. The FTC has said "#ad" in the middle or at the end is
  less likely to work, and bundling it with other tags is discouraged (FTC FAQ, via Frankfurt Kurnit).
- **Plus the platform's label:** TikTok's "Branded content" toggle, Instagram's paid-partnership label, YouTube's
  "includes paid promotion". The FTC says not to assume a platform's tool is good enough on its own; use it as well
  as your own (FTC, "Disclosures 101").

**What counts:**

| Works | Doesn't work |
| --- | --- |
| "Ad" | "#ambassador" alone. The FTC calls it ambiguous unless joined to the brand's name |
| "#ad" | "sp", "spon", "collab" or a lone "thanks": Disclosures 101 names these as vague (an earlier draft listed "#endorsement" here, which no FTC source was found for) |
| "I'm on the OC Ultra Founders crew (early builds)" | A disclosure only in the bio, profile or comments |
| "Got this free from OC Ultra" | |
| "#OCUltraAmbassador": the FTC's FAQ says a brand-joined tag *may* be enough. "#ad" or a plain sentence is safer | |

**The penalty:** the FTC's Consumer Review Rule took effect on 21 Oct 2024. It bans fake reviews, paying or rewarding
people for reviews that must say something positive (or negative), undisclosed insider reviews, and buying fake
followers or views for a business (16 CFR 465.2–465.8). Civil penalties run up to **$53,088 per violation** (the
figure reported in Dec 2025 law-firm alerts; the FTC adjusts it for inflation each January, so verify the current
one).

**Never:** ask anyone for a rating or review. Never reward one. Google Play's policy bans offering "money, goods, or
the equivalent" for a rating or review (Android Developers Blog, 2017 and 2018). Apple's App Review Guidelines bar
apps from requiring a rating or review in return for content or compensation (§3.2.2) and bar review manipulation
(§5.6.3). That's from this fact-check's knowledge of the guidelines, not a page loaded today: verify the wording and
numbers at Gate B2.

---

## 7. Templates (edit the brackets, keep them short)

If the store is live when a template goes out, keep "free" but add "optional cosmetics, never power" where the
template describes the game (90-day plan B9). While it's in test mode, "free" alone is true.

### 7.1 Press pitch (email)

**Subject:** OC developer rebuilt the county's freeways as a free phone game (start at your own exit)

> Hi [first name],
>
> I'm [name], from [city]. I built OC Ultra: a free driving game of Orange County's real freeways (the 5, 405, 55,
> 57, 91, 73 and the toll roads) that runs in a phone's browser. Every road and exit sign comes from open map data,
> so you can start at your own exit, all 416 of them.
>
> It's OC-only until Thursday, December 3, then open to everyone. Traffic and weather are simulated, and every clip
> carries the line "A game. Drive the real ones at the limit."
>
> A 20-second clip and screenshots: [link]. A code so you can play now: [CODE]. I can talk this week, any time.
>
> [name] · [phone] · [email]

Embargo line, when it applies: "Embargoed until Thursday, December 3, 12:01 a.m. Pacific." Follow up once, after a
week.

### 7.2 Creator message (DM or email, one at a time)

> Hi [name], I love your [specific post] about [the 55 / your exit]. I'm a solo developer in [city] and I built a free
> game of OC's real freeways. You can start at any real exit. Here's a code for the OC beta if you want to try it:
> [CODE]. No strings and no ask. If you ever post it, I'd love to see your run card, and since the code is early
> access, a quick "got an early code from the dev" in the post keeps it clean. — [name]

The last line applies only before Day 46, while the code skips the waitlist (§3.15). After that, drop it.

If a perk is offered (for example a free Founder Pack once the store is live), add: "If you post about it after
taking the pack, please say so in the video, like 'got this free from OC Ultra'. That's the FTC's rule, not ours."

### 7.3 Car-meet organiser (DM)

> Hi [name], I've been coming to [meet] for [a few weeks]. I'm a local developer and I built a free game of OC's real
> freeways. Would it be OK if I showed it to people on my phone at a meet? No table, no selling, and I won't use the
> meet's name or photos anywhere unless you say so. Totally fine if not. — [name]

### 7.4 Campus club officers (email)

> Hi [club] officers, I'm a solo developer in OC. I built OC Ultra, a free three.js game of Orange County's real
> freeways built from OpenStreetMap, which runs in a phone browser. Two offers, whichever helps: a 20-minute talk on
> how it's built (map data to a drivable world in one 3.5 MB HTML file), or a "drive your exit" night with a code for
> your members ([CODE]). Free, nothing to sell to your members. — [name], [link]

### 7.5 Subreddit moderators (modmail)

> Hi mods, I'm an OC resident who has been around r/[sub] for a while. I built a free browser game of our freeways
> from open map data: you can start at any real OC exit. Would a one-time text post about it be OK here, and if so,
> when and in what format? Happy to follow whatever you prefer, or skip it. Thanks.

### 7.6 Show HN (Day 46)

**Title:** "Show HN: OC Ultra – drive Orange County's real freeways in your phone's browser" (79 characters; HN cuts
titles at 80, so don't lengthen it)

**First comment, by the owner** (put in the size of the build you post; 3.4 MB on this branch on 2026-10-16):

> I built this solo. It's one HTML file (about 3.5 MB): three.js, with the road network built from OpenStreetMap via
> Overture Maps: 20 carriageways, 1,247 ramp pieces and the real exit signs. You can start at any of 416 exits.
> Traffic uses the Intelligent Driver Model and is simulated; there's no live data and no multiplayer. Physics runs at
> 120 Hz with a floating origin. Scores stay on your device. I'd most like to hear how it runs on your phone: Pause →
> Feedback copies a report. [If the store is live: "There's an optional cosmetics store; nothing in it changes how a
> car drives."]

### 7.7 Product Hunt maker comment (Day 51)

> Hi Product Hunt. OC Ultra is a free driving game of Orange County's real freeways, from open map data, in your
> phone's browser. Start at your own exit. It began as an OC-only beta with local testers, and today it's open to
> everyone. What I'd love from you: how it runs on your phone, and which part of the first two minutes confused you.
> Traffic and weather are simulated. A game. Drive the real ones at the limit.

### 7.8 Discord welcome (pinned in #announcements)

> Welcome to OC Ultra. It's a game of Orange County's real freeways. Traffic and weather are simulated, and scores
> stay on your phone. Post runs in #run-cards, bugs in #bugs (Pause → Feedback copies a report), and ideas in
> #feedback. Rules: be decent, no spam, no DMs to people who didn't ask, no real-world driving videos, and never ask
> anyone to rate or review anything. A game. Drive the real ones at the limit.

---

## 8. Community norms (for the owner, the crew, and anyone who posts for OC Ultra)

1. **One person, one account.** No second accounts, no friends posting "I just found this cool game" without saying
   they know you, and no paid comments.
2. **Never ask for votes, upvotes, stars, ratings or reviews**, anywhere, and never reward one. Reddit, HN and
   Product Hunt ban asking for votes. Both app stores ban rewarding ratings, and the FTC's Consumer Review Rule bans
   paying for reviews of a given slant (§6.2). Not asking for reviews at all is our own rule, stricter than theirs.
   Ask people to *play*, and to *tell us what broke*.
3. **No bought anything:** followers, views, upvotes, ratings, "launch services". It's against every platform's
   rules, the FTC's review rule bans buying fake followers or views for a business (16 CFR 465.8), and it costs
   money.
4. **Disclose every perk** (§6.2). When unsure, disclose.
5. **No fake scarcity** (§5.2). Real numbers only.
6. **Only true claims.** Real roads, simulated traffic and weather, no multiplayer, no online board, our own car
   makes, Lot 57 is fictional. Any number on screen comes from a real run.
7. **No real-world driving footage, ever,** and nothing that reads as a dare. Nothing near sideshows (§3.13).
8. **Read the room before posting.** Read a community's rules the day you post. Contribute before you promote. Post
   once per community. Never cross-post the same text on the same day.
9. **No unsolicited DMs** on any platform, to anyone, in bulk. One personal message, one follow-up at most.
10. **Minors:** never DM a student. Schools only through teachers or advisors. Nobody under 13 targeted. The crew is
    18+.
11. **Criticism gets thanks and a fix,** never an argument. If a post was wrong, say so in a reply and correct it.
    Don't quietly delete it.
12. **Answer within 48 hours** in Discord and comments, even if the answer is "logged, not fixed yet".

---

## 9. The pre-launch checklist

**Now (W−7: this weekend and Mon 19 Oct)**
- [ ] Handles reserved everywhere with the same name. 2FA on. Product Hunt and Reddit accounts start building history
      (§1.2).
- [ ] #OCUltra searched in TikTok, Instagram and YouTube: nobody else using it.
- [ ] The run-card tag, the "real traffic" blurb and the end card are fixed or made (§1.1). Claude, Opus-class.
- [ ] The profile picture is the OC sunset wordmark, without the "Top Speed" line until F2 clears (§2.3). The bio
      reads: "Orange County's real freeways, on your phone. A game. Drive the real ones at the limit."
- [ ] Clip 8.1 posted Mon 19 Oct, with no link and no "play now" (Phase A).
- [ ] Commenting starts in r/orangecounty and your city's subreddit, with no links (§3.1).
- [ ] The car-meet list is confirmed with organisers. Attend one as a guest (§3.13).

**Before Gate 0 (W−7 to W−6)**
- [ ] Three clips a week (Phase A, or the bank).
- [ ] One Screenshot Saturday post a week. One r/threejs post (clip 6.3).
- [ ] The campus club list is confirmed (§3.14). Officer emails are drafted, not sent until Gate 0.
- [ ] The creator list: 10 names, with notes.
- [ ] The waitlist page, invite codes and referral credits are built and tested in demo mode with 10 sign-ups
      (90-day plan F6; §5.3).
- [ ] The privacy and terms pages are live before the first email is collected (90-day plan F7).
- [ ] The Discord server is up with its rules, AutoMod and verification (§3.11).

**At Gate 0 (the day it passes)**
- [ ] Clip 5.1 is recorded on the owner's phone, one take, nothing cut.
- [ ] The bio link points to the waitlist.
- [ ] Club officer emails are sent (§7.4). Creator messages go out, two or three a week, not all at once (§7.2).
- [ ] Ask car-meet organisers for permission (§7.3), if the owner chose this doc's earlier meet timing over the
      90-day plan's (B9, L5; §3, row 3.13).
- [ ] Modmail to r/orangecounty and one city subreddit asking about a post (§7.5).

**During the beta (W−5 to W−2, each week)**
- [ ] Three clips, including one exit request.
- [ ] 15 minutes of replies a day.
- [ ] Wave invites on Days 15, 22 and 29, only if load success is at least 90%. The top 25 are checked by hand first.
- [ ] The Founders crew is recruited (week of 9 Nov) and briefed on §6.2. Every crew post is checked for disclosure.
- [ ] Student-paper pitches (§3.12).
- [ ] Sign-ups by channel code, written into the weekly report against §5.4's assumptions.

**Launch week (W−1)**
- [ ] Copy updated to the store's true state ("Free. Nothing to buy" or "Free to play. Optional cosmetics, never
      power") everywhere: bio, launch kit, press kit, store copy (90-day plan B9).
- [ ] Press pitches out on Mon 30 Nov, one per outlet, embargo to Thu 3 Dec (§7.1).
- [ ] Show HN title and first comment drafted (§7.6). Product Hunt page drafted (§7.7).
- [ ] One Reddit post per community drafted, each to that community's rules, read that morning.
- [ ] A fresh phone with no code reaches the menu on the staging build, so the gate really turns off.

**Day 46, morning**
- [ ] The gate is off on the live URL (a phone over cellular, no code).
- [ ] Show HN is up. The owner is free to answer comments all day.
- [ ] The launch clip is posted. Discord gets the "it's open" announcement.
- [ ] Nobody, anywhere, is asked to upvote.

---

## 10. For the deck (plan.html)

The launch deck's plan page mirrors Lumevina's: sections that reveal as you scroll. The marketing part fits as three
animated step-by-step guides, each one step per scroll:

1. **"A clip in six taps."**
   1. Start at your exit.
   2. Pick Sunset.
   3. Corner off.
   4. Screen record.
   5. Drive 15 s, switch to Chase.
   6. Add the end card and post.
2. **"The waitlist loop"** (§5.1). The seven steps as a circle, with the real wave sizes: 25 → 50 → 100. The gate
   opens Thu 3 Dec.
3. **"Posting day."**
   1. Read the community's rules.
   2. Post once.
   3. Disclose.
   4. Answer for an hour.
   5. Never ask for votes.
   6. Log the sign-ups by code.

The calculator gets one marketing input: **sign-ups per week**. It shows how many weeks it takes to reach 300 at that
rate, next to §5.4's table of assumptions.

---

## Sources

All sources were checked on **2026-10-16** through web search result summaries. Direct page fetches were blocked in
this session. A page's own date is given where it carried one. "Verify at launch" applies to everything here.

**Fact-check pass (later on 2026-10-16).** The shared web-search budget had run out and direct page loads were
refused, so **no web claim here was re-confirmed online in this pass.** What was checked:

- **In this worktree:** every game fact against the code and data. Confirmed: 416 signs, 20 carriageways, 1,247
  ramp pieces, 247 bridges, 10 freeways, the 450 m start, every exit sign the clips name (and their order along each
  route), the modes, times, weather, traffic levels, camera order, corner window, the 150 m sky camera, the radio
  stations, the abilities, the 1080 × 1350 card, 120 Hz physics, the IDM traffic, the floating origin, Time Trial's
  fixed seed and start, the build size (3.4 MB), and `ffmpeg`. Found and fixed: the run-card path (End drive is
  only in Free Drive), the third hand pose, the launch kit's seventh "no purchases" line, and the business draft's
  "$600" line.
- **Against the 90-day plan:** every date and weekday, the waves, Day 43/45/46/51, the 20 clips and the §5.4
  sums. Found and fixed: the Day 45 day count, the "Thursday at midnight" caption, the referral credit that couldn't
  fire during the beta, and the "Top Speed" line on public assets (F2). Flagged for the owner, not changed: car meets
  and student-paper pitches earlier than L5 and L4, and §1.4's reading of Gate 0.
- **From primary texts this pass knows but couldn't reload** (verify each): "early access to a product" as a
  material connection (16 CFR 255.0(e), 2023); Disclosures 101's wording on platform tools, video disclosures and
  vague tags; the Consumer Review Rule's scope (16 CFR 465); Apple's §3.2.2 and §5.6.3; AB 3's "up to six months";
  the 1099-NEC indexing from 2027; HN's 80-character title limit; Discord Discovery's member minimum.

**Reddit**
- Reddit spam definition (quoted): https://dev.to/sh20raj/reddit-self-promotion-framework-how-to-post-smart-and-stay-unbanned-1kfg
- Reddit 10% guideline in subreddit wikis: https://reddit.sudovanilla.org/r/amiibo/wiki/self-promotion · https://red.applefritter.com/r/surfing/wiki/rules_self_promotion
- Reddit site-wide reputation (r/modnews, 2017): https://lr.us.psf.lt/r/modnews/comments/6bj5de/state_of_spam/dhn0b45
- Reddit vote manipulation (mirror of a quote): https://reddit.sudovanilla.org/r/INeedAName/comments/1jerlac/subreddit_name
- r/orangecounty description (mirror): https://reddit.sentinel-team.org/subreddits/orangecounty
- r/WebGames wiki (mirror): https://axebps-redlib.hf.space/r/WebGames/wiki/index
- r/WebGames description and members: https://gummysearch.com/r/WebGames
- r/IndieGaming rules (mirror): https://red.applefritter.com/r/indiegaming/wiki/rules
- r/indiegames rule change, Aug 2024 (mirror): https://redlib.belloworld.it/r/indiegames
- r/playmygame rules, 2024 (mirror): https://lr.ggtyler.dev/r/playmygame/comments/1eg08dh/how_to_avoid_having_your_posts_removed_version_2
- r/IndieDev mod comment (mirror): https://redlib.hackliberty.org/r/IndieDev/comments/1kt34e7/im_upset_with_you_all/mtqynwp/?context=3
- r/threejs members: https://gummysearch.com/r/threejs
- r/gamedev posting guidelines (mirror): https://red.127.pp.ua/r/gamedev/wiki/posting_guidelines_faq

**Hacker News and Product Hunt**
- Show HN guidelines: https://news.ycombinator.com/showhn.html
- HN guidelines: https://news.ycombinator.com/newsguidelines.html
- Product Hunt, Sharing your launch: https://www.producthunt.com/launch/sharing-your-launch
- Product Hunt Community Guidelines: https://help.producthunt.com/en/articles/3615694-community-guidelines
- Product Hunt, Can I ask my community to upvote: https://help.producthunt.com/en/articles/484935-can-i-ask-my-community-friends-family-to-upvote-a-product
- Product Hunt, How do I share my post: https://help.producthunt.com/en/articles/2690626-how-do-i-share-my-post
- Product Hunt company account rule (aggregator): https://echai.ventures/startingup/from/product-hunt-help-center
- Product Hunt account wait and timing (third-party, updated 2026): https://app.getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026 · https://www.tooljunction.io/guides/product-hunt-launch-checklist-2026

**itch.io and browser portals**
- itch.io HTML5 limits (forum quoting the docs): https://itch.io/t/5327199/too-many-files-in-zip-to-load-game · https://itch.io/post/10351461
- itch.io HTML5 donations only (forum, 2020–2023): https://itch.io/t/3322706/where-is-the-donation-button-for-html5-games · https://itch.io/t/769081/require-payment-for-html5-games
- CrazyGames requirements: https://docs.crazygames.com/requirements/intro/
- CrazyGames technical requirements: https://docs.crazygames.com/requirements/technical
- CrazyGames gameplay requirements: https://docs.crazygames.com/requirements/gameplay/
- CrazyGames Basic Launch metrics: https://docs.crazygames.com/resources/basic-launch-metrics/
- CrazyGames FAQ: https://docs.crazygames.com/faq/
- CrazyGames exclusivity (third-party, 2026): https://portalready.world/portals/crazygames/ · https://app.cinevva.com/guides/publish-game-crazygames
- Poki: https://sdk.poki.com/ · https://sdk.poki.com/deals · https://sdk.poki.com/bonus
- Poki term comparison (third-party): https://playgama.com/blog/business-faqs/should-i-go-exclusive-with-one-web/
- Newgrounds, Game Jolt, GameDistribution (third-party): https://app.cinevva.com/guides/publish-web-game · https://construct.net/en/tutorials/publishing-construct-game-295
- Kongregate closure (1 Jul 2020): https://en.wikipedia.org/wiki/Kongregate · https://www.pocketgamer.biz/kongregate-layoffs-no-new-game-submissions

**Short video**
- YouTube three-minute Shorts (from 15 Oct 2024): https://support.google.com/youtube/answer/15424877
- Instagram 3-minute Reels (Jan 2025): https://www.lindseygamble.com/blog/instagram-three-minute-reels · https://routenote.com/blog/instagram-expands-reels-limit-to-3-minutes/
- Instagram 5-hashtag cap (reported, Dec 2025): https://techbuild.africa/instagram-posts-and-reels-to-five-hashtags/ · https://later.com/blog/instagram-hashtags/amp
- Instagram watermark downranking (Feb 2021): https://tubefilter.com/2021/02/10/instagram-reels-with-tiktok-watermark-less-discoverable/
- Instagram originality ranking (Apr 2022): https://www.fastcompany.com/90744109/instagram-tiktok-algorithm-adam-mosseri
- TikTok commercial content disclosure: https://ads.tiktok.com/help/article/how-to-turn-on-the-commercial-content-disclosure-setting-in-tiktok · https://ads.tiktok.com/help/article/about-the-content-disclosure-setting-for-creators
- TikTok video length (third-party, 2025): https://metricool.com/tiktok-video-length/
- TikTok Commercial Music Library: https://www.soundstripe.com/blogs/why-can-i-only-use-commercial-sounds-on-tiktok · https://nealschaffer.com/tiktok-business-account/
- YouTube paid promotion: https://diymusician.cdbaby.com/music-promotion/youtube-makes-easier-upfront-literally-fans-paid-promotions/
- YouTube auto-label (unverified, Sep 2026): https://www.elev8or.io/blog/youtube-auto-labels-undisclosed-brand-deals

**Discord**
- Community Guidelines: https://discord.com/terms/guidelines-april-2024
- Spam tips: https://DISCORDAPP.COM/safety/360044104071-tips-against-spam-and-hacking
- Server Discovery: https://support.discord.com/hc/en-us/articles/360030843331-Enabling-Server-Discovery · https://support.discord.com/hc/articles/360035969312

**Local press**
- OC Weekly closure (27 Nov 2019): https://deadline.com/2019/11/oc-weekly-orange-county-alt-weekly-closes-1202796634/ · https://laist.com/news/oc-weekly-shuts-down-publishes-last-issue · https://en.wikipedia.org/wiki/OC_Weekly
- OC Weekly ownership post (Jan 2023): https://x.com/ocweekly?lang=en
- OC Weekly in 2026: https://www.ocweekly.com/ · https://www.ocweekly.com/contact-us/ · https://www.ocweekly.com/submit-an-event/ · https://www.ocweekly.com/new-to-ramsey-elkholys-monotronic-start-with-you-dont-care-then-work-backward/
- Daily Pilot: https://en.wikipedia.org/wiki/Daily_Pilot · https://muckrack.com/media-outlet/dailypilot · https://en.wikipedia.org/wiki/Los_Angeles_Times
- LAist, Rene Lynch: https://laist.com/people/rene-lynch
- OC Register reporter job (Dec 2025): https://www.journalismjobs.com/1692199-local-news-reporter-orange-county-register
- OCBJ: https://www.ocbj.com/about/
- Voice of OC: https://voiceofoc.org/staff-contact-us/
- New University: https://newuniversity.org/2025/10/19/a-new-year-with-the-new-university/ · https://dev.newuniversity.org/apply/
- Patch tips: https://patch.com/california/lagunaniguel-danapoint/submit-tip-patch-com-news-tip-line-open-0

**Car meets and the law**
- South OC Cars and Coffee: https://eventswithcars.com/organizer/south-oc-cars-and-coffee/
- Irvine meet: https://www.getoutgarage.com/events/cars-and-coffee/ca/irvine/orange-county-cars-and-coffee-irvine-ca
- OC car shows: https://enjoyorangecounty.com/car-shows/ · https://orangecoast.com/arts-culture/o-c-events/weekly-car-meets-in-orange-county/
- Cars, Coffee and Culture: https://www.idrivesocal.com/events/cars-coffee-and-culture/2026-07-04/
- Sideshow laws (reported): https://westcoasttriallawyers.com/new-street-takeover-law · https://amp.insurancejournal.com/news/west/2024/09/30/794759.htm · https://laist.com/news/criminal-justice/long-beach-will-penalize-people-for-promoting-street-races-car-sideshows · https://ktla.com/news/local-news/los-angeles-officials-to-address-rise-in-street-takeovers/amp/ · https://cnycentral.com/news/nation-world/california-sf-cracking-down-on-dangerous-street-takeovers-by-crowds-and-drifting-cars-traffic-crime-law-enforcement-impound-seizure-gavin-newsom-san-francisco-london-breed-occupy

**Campus and school clubs**
- UCI VGDC (10 May 2026): https://newuniversity.org/2026/05/10/a-behind-the-scenes-of-burnt-out-games-kawaiian-isolation/
- UCI Informatics student groups: https://www.informatics.uci.edu/?p=93
- UCI ICS senior spotlight (Apr 2024): https://ics.uci.edu/2024/04/22/senior-spotlight-introducing-indie-game-developer-sam-hansen/
- UCI Esports (Sep 2016): https://news.uci.edu/2016/09/14/uci-to-launch-esports-arena-introduce-first-ever-varsity-league-of-legends-players · https://news.uci.edu/2021/09/21/uci-esports-celebrates-5-year-anniversary-with-fall-kickoff-event/
- CSUF esports (2023): https://dailytitan.com/sports/csuf-esports-is-more-than-just-gaming/article_de854428-925c-11ee-b42f-1f05ac29f96f.html
- CSUF Titan Cup (2025): https://asi.fullerton.edu/tag/campusgaming/
- CSUF Video Game Design Club: https://steamcommunity.com/groups/CSUFVGDC
- Chapman esports league (Oct 2020): https://www.thepanthernewspaper.org/sports/inaugural-esports-league-is-a-welcoming-sign-to-chapman-gamers
- Chapman Dodge College blog: https://blogs.chapman.edu/dodge/2012/04/27/the-intercollegiate-computer-games-showcase/
- OCC esports: https://www.orangecoastcollege.edu/life-at-occ/student-life-leadership/esports.html
- Coast Report (Apr 2026): https://www.coastreportonline.com/front/article_160e651e-6ce2-4c31-b614-d4fa722d632d.html
- Saddleback Lariat: https://lariatnews.com/
- NASEF origins (2018): https://www.nasef.org/blog/game-and-grow-new-high-school-esports-league-in-orange-county-launches-january-31 · https://www.nasef.org/blog/new-north-america-scholastic-esports-federation-launches-learning-and-gameplay-into-high-schools-nationwide

**FTC, COPPA, stores and tax**
- FTC Disclosures 101 (Nov 2019): https://www.ftc.gov/business-guidance/blog/2019/11/disclosures-101-new-ftc-resources-social-media-influencers
- "#ambassador" and #ad placement (FTC FAQ via law firms): https://advertisinglaw.fkks.com/post/102eo7i/ftc-updates-endorsement-guide-faqs-and-settles-first-ever-action-against-individu · https://www.infolawgroup.com/blog/2017/09/articles/ftc/ftc-revises-endorsement-guide-faqs
- 2023 Endorsement Guides, video disclosures: https://www.dglaw.com/wp-content/uploads/2023/07/Advertising_The_Deep_Dive-FTC_Updates_Endorsement_Guides-for_Modern_Marketing_and_Advertising-2.pdf · https://www.law.cornell.edu/cfr/text/16/255.0
- Referral and points-for-posts: https://www.bclplaw.com/en-US/events-insights-news/part-3-what-the-ftcs-final-rule-means-for-incentivized-reviews.html · https://www.prefinery.com/blog/ftc-endorsement-guides-for-referral-programs/
- FTC Disclosures 101 for influencers (platform tools, video disclosures, vague tags; not reloaded in the
  fact-check pass): https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- Consumer Review Rule, scope (16 CFR 465; not reloaded in the fact-check pass):
  https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- Apple App Review Guidelines §3.2.2 and §5.6.3 (not reloaded in the fact-check pass):
  https://developer.apple.com/app-store/review/guidelines/
- Consumer Review Rule (21 Oct 2024; $53,088 per violation, Dec 2025): https://wsgr.com/en/insights/ftc-issues-final-rule-banning-fake-and-misleading-consumer-reviews-and-testimonials.html · https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/ftc-warns-companies-of-potential-violations-of-the-consumer-review-rule · https://www.khlaw.com/insights/ftc-warns-10-companies-comply-consumer-review-rule
- FTC dark patterns report (Sep 2022): https://www.venable.com/insights/blogs/2022/09/the-ftc-brings-more-light-to-dark-patterns-in-new
- COPPA amendments (Apr 2025; compliance 22 Apr 2026): https://www.finnegan.com/en/insights/articles/coppas-amended-rule-is-now-in-full-effect-what-operators-need-to-know.html · https://www.ashurstperkinscoie.com/en/insights/ftc-finally-publishes-amended-coppa-rule-compliance-deadlines-set/
- Google Play incentivized ratings (2017, 2018): https://android-developers.googleblog.com/2017/06/google-plays-policy-on-incentivized.html · https://android-developers.googleblog.com/2018/12/in-reviews-we-trust-making-google-play.html
- 1099-NEC $2,000 threshold (2026): https://www.anchin.com/articles/faqs-new-1099-nec-and-1099-misc-rules-beginning-in-2026/ · https://1800accountant.com/blog/irs-1099-reporting-changes-2026

**The places**
- Orange Crush interchange: https://en.wikipedia.org/wiki/Orange_Crush_interchange
- El Toro Y: https://en.wikipedia.org/wiki/El_Toro_Y · https://mbakerintl.com/project/i-5i-405-el-toro-y-interchange
- Game facts (416 signs, carriageways, races, cameras, presets): this repo, `src/data/oc-network.json`, `src/game/settings.ts`, `src/game/race.ts`, `src/game/Game.ts`, `PROJECT_OC_LAUNCH_KIT.md` and `PROJECT_OC_ROADMAP.md`, read on 2026-10-16
- The pause menu and results screen (End drive, Share run), the driver poses and the radio: `src/ui/App.tsx`, `src/game/drivers.ts`, `src/game/audio/Radio.ts`, read in the fact-check pass on 2026-10-16

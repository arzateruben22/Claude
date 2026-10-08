# Post Desk

An X (Twitter) posting desk that runs on your computer. Claude drafts posts in your voice, you
approve them, and the desk sends them out on a schedule. Then it measures what worked and adjusts.

It's the "Claude does 95% of the work, you approve" setup:

- **Writes** original posts (takes, lists, how-tos, questions, short stories, data points) and
  quote-post takes on things catching on in your niche, using free news feeds and a small,
  budgeted X search for ideas.
- **Checks** every draft against X's automation rules and your own: no @mentions, no engagement
  bait, no repeats, no avoided topics, links off by default, a source for any number.
- **Waits for you.** Nothing posts until you approve it, unless you later choose to let clean
  original posts go out on their own. Quote posts always wait for you.
- **Posts** in slots spread across your active hours, and over time moves most slots to the hours
  that work for your account while still testing others.
- **Measures** views, engagement and followers, and compares formats and hours fairly. Formats
  are judged at equal hours and hours at equal formats, and reach is counted per follower, so
  growth doesn't flatter later posts.
- **Reviews** itself every night: lessons with numbers, short notes the writer reads before its
  next batch, and at most one suggested change to the settings, which it never applies for you.
- **Tracks money**: progress toward X's creator payouts, a media kit for sponsors, the income
  you log, and every cent spent on X and Claude, all with hard daily and monthly caps.

It never likes, follows, replies to or mentions anyone. X's automation rules forbid automating
those, so the code for them doesn't exist.

```
python -m postdesk run --demo     # try it now: a make-believe account, no keys needed
```

---

## 1. Try the demo (2 minutes)

```bash
cd post-desk
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m postdesk run --demo
```

The dashboard opens at http://127.0.0.1:8788. The demo simulates two weeks first so the charts
have something to show. After that, one simulated hour passes every minute.

The demo account, its audience and every number in it are invented. Its sample posts are
hand-written, and nothing is posted anywhere. Its audience has hidden preferences (some formats
and hours do better), and you can watch the desk find them from the numbers alone. If you leave
a draft untouched for two simulated hours, a stand-in "demo reviewer" approves or rejects it so
the demo keeps moving. Your real desk has no such thing.

Other ways to look at it:

```bash
python -m postdesk sim --days 14     # two demo weeks, headless (about 15 seconds)
python -m postdesk stats --demo      # what's working, media kit, payout progress
python -m postdesk review --demo     # the nightly review, now
python -m postdesk replay            # the demo as one HTML file you can open anywhere
```

## 2. Connect your account

You need three things: an X developer app, X API credits, and (for the writer) a Claude API key.

**X developer app**

1. Go to [developer.x.com](https://developer.x.com) and sign in with the account that will post.
2. Create a project and an app. In the app's **User authentication settings**:
   - App permissions: **Read and write**
   - Type of app: **Web App, Automated App or Bot**
   - Callback URI / Redirect URL: `http://127.0.0.1:8789/callback` (exactly this)
   - Website URL: your site or your X profile URL
3. Under **Keys and tokens**, copy the **OAuth 2.0 Client ID** and **Client Secret**.
4. The X API is pay-per-use: add credits in the developer console (a few dollars covers a
   week or two, see section 5).

X moves these menus around now and then. The names above are what to look for.

**Claude**: create an API key at [console.anthropic.com](https://console.anthropic.com).

**Put the keys in `.env`**. They stay on your computer, and `.env` is in `.gitignore`.

```bash
cp .env.example .env      # then fill in X_CLIENT_ID, X_CLIENT_SECRET, ANTHROPIC_API_KEY
python -m postdesk auth   # opens X, you approve, the sign-in is saved to .secrets/ (only you can read it)
python -m postdesk doctor --online
```

Never paste these keys into a chat, an issue or a commit.

## 3. Make it yours: `desk.toml`

Everything the desk believes lives in `desk.toml`. Edit it, then restart the desk. The parts
that matter most:

| Section | What to set |
|---|---|
| `[account]` | `handle` (**TODO**), `niche`, `audience`, `voice`, and `notes`: true things about you the writer may use. Without notes it never mentions your own projects or results, because it never invents experiences. |
| `[topics]` | `include` / `avoid` topics, `keywords` the scout searches, `watch_accounts`, `curated_reposts` (the only accounts it may repost), free `rss` feeds for ideas |
| `[schedule]` | `posts_per_day` (default 8), `active_hours`, `min_gap_minutes`, daily caps for quotes and reposts |
| `[approval]` | `mode = "review"` (you approve everything) or `"auto_originals"` (clean original posts go out on their own; anything flagged, and every quote, still waits for you) |
| `[writer]` | Claude model and effort, formats, `max_chars`, `links = "never"`, `ai_daily_usd` |
| `[budget]` | hard X spending caps per day and month, and the share the scout may use for reading |
| `[money]` | payout thresholds (copy them from Creator Studio), `verified_followers` (**TODO**: copy it now and then, since the API can't count it), affiliate domains and the disclosure tag |

Unknown settings are rejected with a clear message, so a typo can't silently do nothing.

## 4. Day to day

```bash
python -m postdesk run          # the desk and its dashboard; leave it running
```

**The dashboard** at http://127.0.0.1:8788:

- **Status bar**: ON AIR during your hours, followers, views this week, posts today, what's waiting, spend.
- **Rundown**: today's slots on a 24-hour strip. Posted (colored by format), next (red), missed (dashed).
- **Airtime wheel**: the last 7 days of posts on a 24-hour dial, bar length = views.
- **Approval queue**: every draft with its format, who wrote it, why, and any flags. **Approve**,
  **Edit**, **Post now** or **Reject**. Write your own post at the top; it goes through the same checks.
- **Panels**: on-air log, what the scout found, formats, best hours, growth, money and spend.
- **Nightly review**: lessons, and today's proposal if there is one.

The dashboard only listens on your own computer (127.0.0.1). Its buttons need a key that's
written into the page when you open it, so other websites can't press them.

**A good routine:** open the dashboard once in the morning and approve or edit a day's worth
of drafts (five minutes). Glance at the review at night. When you find yourself approving almost
everything, the review will suggest `auto_originals`. That choice is yours.

**Without the dashboard:**

```bash
python -m postdesk queue                  # drafts waiting, with their ids
python -m postdesk approve a1b2c3 d4e5f6  # or: reject <id>
python -m postdesk add "your own post"    # approved, into the next open slot
python -m postdesk draft --n 3            # ask the writer for drafts now
python -m postdesk stats                  # formats, hours, media kit, payout progress
python -m postdesk earned 40 --source sponsor   # log income (x payout | sponsor | affiliate | product)
```

**Running it all day:** the desk posts only while it's running. A laptop that sleeps will miss
slots, and the desk logs each missed one. For steady posting, run it on an always-on machine
(a small cloud server, a Raspberry Pi) and open the dashboard through an SSH tunnel
(`ssh -L 8788:127.0.0.1:8788 your-server`). Approved originals wait as long as it takes;
unapproved drafts and approved quotes expire after `expire_hours`.

## 5. What it costs

X's API charges per call (rates in `[budget]`; check the developer console, since they change):
about $0.015 a post, $0.20 a post with a link, $0.005 per post read, and $0.001 for reading your own
posts' numbers. The demo's two weeks, with the default settings, used:

| | per day |
|---|---|
| 8 posts | ~$0.12 |
| scout (X search every 4 hours + curated accounts) | ~$0.35–0.50 |
| your posts' numbers and follower count | ~$0.15 |
| **X total** | **~$0.60–0.80** (about $20–24 a month; capped at $1.00/day, $25/month) |
| Claude (writer + nightly review, Opus 5.5) | ~$0.20–0.35, capped at `ai_daily_usd` ($0.50) |

To spend less: scout less often (`every_minutes = 480`), read fewer posts (`max_results = 10`),
use `claude-sonnet-5-5` for the writer, or turn keywords off and rely on the free RSS feeds.
When a cap is reached the desk stops that kind of spending until the next day (or month), says
so in the log, and always keeps posting money aside from reading money.

## 6. Playing by X's rules

The desk is built around [X's automation rules](https://help.x.com/en/rules-and-policies/x-automation):

- **Turn on the Automated label.** On X: Settings → Your account → Account information →
  Automation, and name the account that runs it. A bio line like "Posts drafted with AI,
  approved by me" is a good idea too.
- **Never automated:** likes, follows, unfollows, replies, mentions, DMs. Reply to people
  yourself. That's where real relationships (and sponsors) come from.
- **No duplicate content.** Repeats of recent posts are blocked. Use one account per desk.
- **No trend-jacking.** Hashtags are capped (default 1), and the scout only looks within your niche.
- **Reposts are limited** to accounts you curate, a few a day. Quote posts need real commentary
  and always wait for your approval.
- **Disclose paid links.** Posts with your affiliate domains need the disclosure tag.

You're responsible for what your account posts. The guard catches common mistakes, but read
what you approve.

## 7. Money: what's realistic

X pays creators through Creator Studio from views by Premium users on your posts, once you meet
its thresholds (`[money]` holds whatever you copy from Creator Studio; at the time of writing
those were reported as Premium, around 500 verified followers and 500K+ views in 90 days, but
check). For most new accounts that takes months, and the payouts are modest at first. Sponsors,
affiliate links and your own products usually earn more. The **media kit** line in `stats` and on
the dashboard is what sponsors ask for.

The desk can make posting consistent, cheap and measured. It can't promise followers or income.
The demo's growth numbers are invented and say nothing about your account.

## 8. What it doesn't do (yet)

- Images, video, polls and threads. It posts text only.
- Replies and conversations. Those are yours to do, on purpose.
- Verified-follower counts and payout amounts, which the API doesn't provide. Copy them from
  Creator Studio, and log payouts with `earned`.
- Run in the cloud by itself. It's a program you keep running (see "Running it all day").

## Files

```
desk.toml            your settings
.env                 your keys (never committed)
.secrets/            your X sign-in (never committed, readable only by you)
output/live/         desk.db (drafts, numbers, spend, income) and lessons.md
output/demo/         the same, for the demo
postdesk/            the code: guard, writer, scout, schedule, analyst, review, desk, server, web/
tests/               python -m pytest
```

| Module | Job |
|---|---|
| `guard.py` | every rule a draft must pass |
| `writer.py` | Claude (structured output), demo samples, or nothing when there's no key |
| `xapi.py` | the official X API v2: post, quote, repost, search, your numbers, OAuth 2.0 PKCE |
| `xsim.py` | the make-believe X used by the demo and the tests |
| `budget.py` | prices every call and refuses once a cap is reached |
| `schedule.py` | posting slots: spread out first, then mostly your best hours |
| `analyst.py` | format and hour effects, payouts progress, media kit |
| `review.py` | the nightly review: lessons, writer notes, at most one proposal |
| `desk.py` | the loop that ties it together, and your actions |
| `server.py` | the local dashboard server |

## Placeholders to fill in (TODO)

- `[account] handle`: your X handle
- `[account] notes`: true facts about you the writer may use
- `[money] verified_followers` and the payout thresholds: from Creator Studio
- `[topics]` keywords, watch accounts, curated reposts and feeds: the defaults are examples for an AI-tools niche
- `.env`: X_CLIENT_ID, X_CLIENT_SECRET, ANTHROPIC_API_KEY

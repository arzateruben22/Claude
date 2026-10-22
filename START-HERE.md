# Start here

Three things run on one small always-on computer:

- **Paper trading.** Memecoins, big coins (BTC, ETH, SOL, XRP, ADA, DOGE) and stocks, all with
  fake money and real prices. Nothing can place a real order.
- **Your X account.** Claude writes the posts, you approve them, and the desk posts them on schedule.
- **The paper book.** One page with every paper profit and loss.

Plan on about an hour the first time. After that it runs by itself.

---

## Part 1: Get the computer (15 minutes, about $5 a month)

1. Sign up at a cloud provider: **DigitalOcean**, **Hetzner**, **Vultr** or **AWS Lightsail**.
2. Create the smallest server with **Ubuntu 24.04** (1 CPU, 1 GB of memory is enough).
3. The provider shows its **IP address**. Connect to it:
   - **Mac:** open Terminal and type `ssh root@THE-IP`
   - **Windows:** open PowerShell and type the same
   - **Phone:** the Termius app works too

## Part 2: Start paper trading (5 minutes)

Paste these three lines into the server, one at a time:

```bash
git clone -b claude/always-on https://github.com/arzateruben22/Claude.git desks
cd desks
sudo bash server/setup.sh
```

**Memecoins and big coins are now paper trading.** They need no account and no keys. Each desk
starts with $100 of paper money.

**Twenty desks, and a proving ground.** On 22 October the clear losers were retired on the evidence, and four
new stock ideas and one new big-coin idea took their place. Each desk still runs on its own $100 of paper money.

| Market | Running | Retired on 22 Oct, and why |
|---|---|---|
| Memecoins | **strict**, **sniper**, **momentum**, **patient**, **scalper**, **whale**, **runner**, **tiny**, all on trial to the month end | **main** (−35% over 164 live trades) and **wild** (−76% in two days) |
| Big coins | **daily**, **slow**, **loose** (the three that lost least in a year when holding lost 46%) and the new **trend** filter: Bitcoin and Ethereum only while they're above their 150-day average, cash otherwise | **hourly**, **4h**, **fast**, **tight**, **btc**, **alts**, **single**: each lost 24–60% over the past year |
| Stocks | **main** (on notice: first live, but it lost every month of the summer replay), **fade**, **hold**, **cheap**, and four new ones that wait out the opening swings: **confirm** (buy at 10:00 only if still above the open), **orb** and **orb5** (buy a break of the first 15 or 5 minutes' high), **failed** (short at 10:00 only gaps already below their open) | **wild**, **quick**, **early**, **bigcap**, **tight**, **highvol**: each lost money in every month from June to September |

The retired rulebooks are kept, word for word, in each market's `retired/` folder, with the reason. Their paper
records stay on the server. The server never runs them, but a history test can still replay one by name.

**The rule for keeping a desk** is written on the Proving Ground page, and the page applies it for you. A rulebook
is a **candidate** when it made money over a long history test, made money in at least two thirds of its periods
(quarters for big coins, months for stocks), had enough trades, and, for big coins, never fell more than 25% from a
high. It's on **watch** when it made money overall or in at least half its periods, and it's a **cut** when it did
neither. Passing is necessary, not sufficient: a candidate still has to repeat it live, on paper. Memecoins can't
be replayed, because nobody keeps a history of brand-new coins, so they're judged on their live results only.

**To run every history test,** one at a time in the background so the live desks aren't disturbed:

```bash
bash server/prove.sh            # big coins over four years, stocks since 2 January; about an hour the first time
bash server/prove.sh status     # how far it has got
```

You can close Termius while it runs. The results appear on the **Proving Ground** page (`/proving`, linked from the
deck) and in `bash server/status.sh`. Four years of big-coin prices cover the 2022 crash, the 2023–24 run-up and
this year's fall, so a rule that only works in one kind of market shows up.

The plan stays the same: a **first look on Friday 23 October**, the **assessment at the end of October**, and after
that the survivors keep running until one desk shows a **green week**: traded on three or more of the last seven
days, net up over the seven, and no single day's loss bigger than the week's gain. With twenty variations, a few
will look good by Friday from luck alone. The month-end read, the proving ground and the green week are what count.

None of this adds to a Claude bill: the twenty running desks judge and review by rules alone.

**To read the standings at any time:** `bash server/status.sh` ranks every desk with its last seven days, then
prints each rulebook's history grade. The same table is at `http://127.0.0.1:8790/standings` next to the deck. Your
phone gets a push the moment any desk has a green week, and again if it keeps the streak (×2, ×3...).

**To retire another desk later:** move its rulebook into its market's `retired/` folder with a line saying why,
take its `--with <name>` out of `server/systemd/nightdesk.service` (and its line in `nightdesk-review.service`) or
`majors.service`, delete its section from `paper-book/book.toml`, and run `sudo bash server/setup.sh`. A stock desk
only needs the move: the scanner runs every `criteria-*.toml` left in its folder. Nothing is deleted.

**To start counting from zero on a day you choose:** `sudo bash server/fresh-start.sh`. It moves
everything so far into an archive folder (nothing is deleted) and restarts every desk at $100.

**For stocks** (free, 5 more minutes):
1. Sign up at **alpaca.markets** and switch to the **Paper** account.
2. Create API keys.
3. On the server, run `bash server/keys.sh` and paste the two Alpaca keys when asked. Press Enter
   to skip the other questions for now.

Stocks start at the next weekday morning scan (5:35am Pacific).

**Alerts on your phone (2 minutes, free):** run `bash server/alerts.sh`, install the **ntfy** app and
subscribe to the topic it prints. You get a push if a desk stops, keeps crashing, goes quiet or loses
10% of its bank in a day, plus a summary every evening at 8pm with BTC bought-and-held for comparison.

**Backups:** the server saves a copy of every desk's paper records each night (kept 30 days). For a copy
that survives losing the server itself, turn on **Backups** for your Droplet in DigitalOcean (about
$1.20 a month on the $6 plan).

**To see your results at any time:**

```bash
bash server/status.sh
```

**To watch it:** the **Trading Deck** is one screen with every desk as a lane of light: its paper profit
since day one, every trade as a spark, its own day-28 finish line, sorted live so the order is the
scoreboard. It replays from day one when it opens. From there, the **Trade Crawler** (`/crawler`) walks
every paper trade and finishes with a list of **flags to check** before any real money, and the **Paper
Galaxy** (`/galaxy`) draws the same trades as a universe that grows. Open them on your phone after step 6
of Part 3 (`sudo bash server/phone.sh`), at the address it prints, port 8790.

## Part 3: Start posting on X (about 30 minutes, once)

1. **Make the X app.** Go to **developer.x.com**, sign in with the account that will post, and
   create a project and an app.
   - Under **User authentication settings**, choose **Read and write** and **Web App, Automated
     App or Bot**.
   - Set the callback URL to `http://127.0.0.1:8789/callback`.
   - For the website, use your X profile link.
2. **Add credits.** X's API is pay-per-use: about $13 a month at the default settings. A few
   dollars covers the first week or two.
3. **Get a Claude key.** At **console.anthropic.com** create an API key and add about $10 of credit.
4. **Give the keys to the server:** run `bash server/keys.sh` and paste the X Client ID, the X
   Client Secret, the Claude key and your X handle.
5. **Connect X:** run `bash server/connect-x.sh`.
   - Open the link it prints on your phone and press **Approve**.
   - Your browser lands on a page that won't load. That's normal.
   - Copy the whole address from the address bar, paste it back into the server, and press Enter.
6. **Approve from your phone (optional):** run `sudo bash server/phone.sh` and follow what it
   prints. Install the Tailscale app, sign in, and open the addresses it gives you: Post Desk
   on port 8788, and the Trading Deck on port 8790.
7. **On X:** turn on the **Automated** label (Settings → Your account → Account information →
   Automation).

Drafts start arriving within minutes. **Nothing posts until you approve it.**

## Every day (10–20 minutes)

- **Morning:** open the Post Desk dashboard and approve, edit or reject the day's drafts.
- **Any time:** reply *yourself* to bigger accounts in your niche for about 15 minutes. That's how
  a new account gets seen, and it's the one thing a bot must never do for you.
- **Whenever you're curious:** `bash server/status.sh` shows the paper trading.

## What it costs per month

| | |
|---|---|
| the server | about $5 |
| X API | about $13 (hard cap $18) |
| Claude | about $6–10 (hard cap $0.40 a day) |
| X Premium (needed for creator payouts; get it once you're posting daily) | X's price |
| paper trading | free |

## If something looks wrong

```bash
bash server/status.sh               # what's running, what's waiting
journalctl -u postdesk -n 50        # Post Desk's recent messages (or: majors, nightdesk, paperbook)
git pull && sudo bash server/setup.sh   # get the newest version
```

More detail on each part: `server/README.md`, `post-desk/README.md`, `majors-desk/README.md`,
`paper-book/README.md`.

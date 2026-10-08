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

**To watch it:** the **Trade Crawler** sends a sixteen-legged crawler through every paper trade,
one desk at a time. Wins light up, big losses get flagged in pink, and it finishes with a list of
**flags to check** before any real money. The **Paper Galaxy** (`/galaxy`) draws the same trades as
a universe that grows. Open both on your phone after step 6 of Part 3
(`sudo bash server/phone.sh`), at the address it prints, port 8790.

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
   on port 8788, and the Trade Crawler on port 8790.
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

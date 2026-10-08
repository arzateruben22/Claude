# Always-on machine

Everything on one small Linux machine that never sleeps:

| Service | What it does | Starts |
|---|---|---|
| `postdesk` | your X account: drafts, your approvals, scheduled posts | once you've connected X (step 5) |
| `nightdesk` | coins, paper money, live prices, 24/7 | right away |
| `scanner-scan` / `scanner-grade` | stocks, paper picks before the open, graded after the close | once your Alpaca paper keys are in (step 6) |
| `paperbook` | one ledger of every paper trade, refreshed every 15 minutes | right away |
| `nightdesk-review` | Night Desk's daily lessons, risk officer and scorecard | right away |

Paper money only for coins and stocks: nothing here can place a real order.

## 1. Get a machine

Either:
- **A small cloud server** (a VPS) running Ubuntu 24.04. 1 CPU and 1 GB of memory is enough.
  Hetzner, DigitalOcean, Vultr and AWS Lightsail all sell one for roughly $4–7 a month.
- **A computer at home that stays on**: an old laptop, a mini PC or a Raspberry Pi 4 or 5 running
  Ubuntu. Turn off sleep.

You'll connect to it with `ssh you@your-server`. The provider shows the address and user name.

## 2. Get the code onto it

```bash
git clone -b claude/always-on https://github.com/arzateruben22/Claude.git desks
cd desks
```

If the repository is private, GitHub asks you to sign in. Use a
[personal access token](https://github.com/settings/tokens) with read access as the password, or
add the server's key as a read-only deploy key in the repository settings.

## 3. Install and start

```bash
sudo bash server/setup.sh
```

It installs Python and the packages, then starts the coin desk and the paper book. It also sets
up the stock timers, which wait for your keys. Check on everything any time with
`bash server/status.sh`.

## 4. Fill in your settings

```bash
nano post-desk/desk.toml      # at least: [account] handle
```

## 5. Connect your X account (Post Desk)

First create the X developer app and add credits (see `post-desk/README.md`, section 2). The app's
callback URL must be `http://127.0.0.1:8789/callback`. Then put your keys in `post-desk/.env`:

```bash
cp post-desk/.env.example post-desk/.env
nano post-desk/.env           # X_CLIENT_ID, X_CLIENT_SECRET, ANTHROPIC_API_KEY
```

X needs a browser to approve the app, and the server has none, so borrow your computer's.
On **your computer**:

```bash
ssh -L 8789:127.0.0.1:8789 you@your-server
```

and in that same SSH window, on the server:

```bash
cd desks/post-desk && ../.venv/bin/python -m postdesk auth --no-browser
```

Open the link it prints in your computer's browser and approve. X sends you back to
`127.0.0.1:8789`, and the tunnel carries that to the server. Then:

```bash
../.venv/bin/python -m postdesk doctor --online
sudo systemctl start postdesk
```

## 6. Turn on stocks

Sign up at alpaca.markets (free), open the **Paper** account and create API keys. Then:

```bash
cp premarket-scanner/.env.example premarket-scanner/.env
nano premarket-scanner/.env   # ALPACA_API_KEY, ALPACA_SECRET_KEY
cd premarket-scanner && ../.venv/bin/python -m scanner doctor
```

Nothing else to start: the next weekday scan picks the keys up (5:35 and 6:02 am Pacific, plus
5:02 pm for the evening before). Picks are graded at 1:45 pm.

## 7. Look at it

From your computer, open a tunnel to the dashboards:

```bash
ssh -L 8788:127.0.0.1:8788 -L 8787:127.0.0.1:8787 you@your-server
```

- http://127.0.0.1:8788: **Post Desk**. Approve drafts here, ideally once in the morning.
- http://127.0.0.1:8787: **Night Desk**, the coin desk.
- Paper book: `bash server/status.sh` prints the totals. The full report is
  `paper-book/output/paper-book.html`; copy it to your computer with
  `scp you@your-server:desks/paper-book/output/paper-book.html .`

**From your phone:** the simplest way is [Tailscale](https://tailscale.com) (free for personal
use). Install it on the server and your phone, then point Post Desk at the server's Tailscale
address. Change its service line to `ExecStart=... -m postdesk run --no-browser --host 100.x.y.z`
with `sudo systemctl edit --full postdesk`. The dashboard then only answers on your private
Tailscale network, and its buttons still need the key that's written into the page.

## Day to day

```bash
bash server/status.sh                    # what's running, next stock scans, paper totals
journalctl -u postdesk -f                # live log of one service (nightdesk, paperbook...)
sudo systemctl restart postdesk          # after editing desk.toml
git pull && sudo bash server/setup.sh    # update to the newest code
```

## What it costs per month (roughly)

| | |
|---|---|
| the server | $4–7 |
| X API (8 posts a day, the scout, your numbers) | about $13, capped at $18 |
| Claude (writer and nightly review) | about $6–10, capped at $0.40 a day |
| X Premium (needed for payouts; get it once the posting habit sticks) | X's current price |
| coins and stocks | free data, paper money |

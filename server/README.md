# Always-on machine

The short version is in [`START-HERE.md`](../START-HERE.md). This page has the details.

Everything on one small Linux machine that never sleeps:

| Service | What it does | Starts |
|---|---|---|
| `postdesk` | your X account: drafts, your approvals, scheduled posts | once you've connected X (step 5) |
| `nightdesk` | memecoins (new Solana coins), paper money, live prices, 24/7 | right away |
| `majors` | big coins (BTC, ETH, SOL, XRP, ADA, DOGE), paper money, Coinbase prices, hourly | right away |
| `scanner-scan` / `scanner-grade` | stocks, paper picks before the open, graded after the close | once your Alpaca paper keys are in (step 6) |
| `paperbook` | one ledger of every paper trade, refreshed every 15 minutes, plus the Trade Crawler and Paper Galaxy on port 8790 | right away |
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

It installs Python and the packages, then starts the memecoin desk, the big-coin desk and the
paper book. It also sets up the stock timers, which wait for your keys. Check on everything any
time with `bash server/status.sh`.

## 4. Your keys

```bash
bash server/keys.sh
```

It asks for each key in turn: Alpaca (stocks), the X app's Client ID and Secret, Claude, and your X
handle. Press Enter to skip any you don't have yet, and run it again later for the rest. Keys are
saved in `.env` files only your user can read. Never paste them into a chat.

The X app comes first: create it and add credits (`post-desk/README.md`, section 2). Its callback
URL must be `http://127.0.0.1:8789/callback`.

## 5. Connect your X account (Post Desk)

```bash
bash server/connect-x.sh
```

1. Open the link it prints on your phone or computer, signed in to the account that will post,
   and approve.
2. Your browser lands on a `127.0.0.1` page that won't load. That's expected.
3. Copy the whole address from the address bar and paste it back right away.

It checks the connection and starts Post Desk.

If you'd rather not copy the address, use a tunnel: on your computer run
`ssh -L 8789:127.0.0.1:8789 you@your-server`, then on the server run
`cd desks/post-desk && ../.venv/bin/python -m postdesk auth --no-browser`, and open the link
on your computer.

## 6. Stocks

Once `keys.sh` has your Alpaca paper keys, check them with
`cd premarket-scanner && ../.venv/bin/python -m scanner doctor`. Nothing else to start: the next
weekday scan picks them up (5:35 and 6:02 am Pacific, plus 5:02 pm for the evening before). Picks
are graded at 1:45 pm.

## 7. Look at it

From your computer, open a tunnel to the dashboards:

```bash
ssh -L 8788:127.0.0.1:8788 -L 8787:127.0.0.1:8787 -L 8790:127.0.0.1:8790 you@your-server
```

- http://127.0.0.1:8788: **Post Desk**. Approve drafts here, ideally once in the morning.
- http://127.0.0.1:8790: **Trade Crawler**, which crawls every paper trade and ends with the flags to
  check. The galaxy is at `/galaxy` and the paper book at `/book`.
- http://127.0.0.1:8787: **Night Desk**, the memecoin desk.
- Paper book: `bash server/status.sh` prints the totals. The full report is
  `paper-book/output/paper-book.html`; copy it to your computer with
  `scp you@your-server:desks/paper-book/output/paper-book.html .`

**From your phone:** `sudo bash server/phone.sh`. It puts the server on your private
[Tailscale](https://tailscale.com) network (free for personal use) and moves Post Desk's dashboard
there. Install the Tailscale app on your phone, sign in with the same account, and open the address
it prints. Only your own devices can reach it, and its buttons still need the key written into
the page. After this, the SSH tunnel to port 8788 no longer applies.

## Day to day

```bash
bash server/status.sh                    # what's running, next stock scans, paper totals
journalctl -u postdesk -f                # live log of one service (nightdesk, paperbook...)
sudo systemctl restart postdesk          # after editing desk.toml
git pull && sudo bash server/setup.sh    # update to the newest code
sudo bash server/fresh-start.sh          # start counting from zero today (archives, never deletes)
```

Each desk starts with $100 of paper money (`start_bank` in `night-desk/desk.toml`,
`majors-desk/majors.toml` and `paper-book/book.toml`). After changing it, run `fresh-start.sh` so the
desks don't carry on from their old bank.

## What it costs per month (roughly)

| | |
|---|---|
| the server | $4–7 |
| X API (8 posts a day, the scout, your numbers) | about $13, capped at $18 |
| Claude (writer and nightly review) | about $6–10, capped at $0.40 a day |
| X Premium (needed for payouts; get it once the posting habit sticks) | X's current price |
| memecoins, big coins and stocks | free data, paper money |

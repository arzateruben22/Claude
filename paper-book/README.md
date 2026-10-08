# Paper Book

Every paper trade from both desks in one ledger, with one running total. Paper money only:
nothing in this repo can place a real order.

| Desk | What it trades | Paper money | When it trades |
|---|---|---|---|
| **Coins**: Night Desk (`night-desk/`) | brand-new Solana coins that pass its rug checks | $1,000 bank | nonstop, 24/7, while it's running |
| **Stocks**: premarket scanner (`premarket-scanner/`) | US stocks gapping up before the open | $100 a pick, out of $1,000 | picks before the open; graded after the close, weekdays |

```bash
python paper-book/paperbook.py             # the ledger and the report, now
python paper-book/paperbook.py --watch 15  # ...every 15 minutes
```

It writes `paper-book/output/ledger.csv` (one row per closed paper trade, both desks) and
`paper-book/output/paper-book.html`: net profit and loss overall and per desk, the curve since
the start, each day's result, win rate, profit factor, worst drop, open positions, and the
latest trades.

## Start paper trading on your computer (Mac or Linux)

One-time setup, from the repo folder:

```bash
python3 -m venv .venv
.venv/bin/pip install -r night-desk/requirements.txt -r premarket-scanner/requirements.txt
```

**Coins: no keys needed.**

```bash
paper-book/start.sh      # starts the coin desk and the paper book in the background
paper-book/stop.sh       # stops them; open coin positions are saved and resume on the next start
```

The coin desk's own dashboard is at http://127.0.0.1:8787. It only trades while the computer is
awake. On a Mac, `caffeinate -i -w $(cat paper-book/run/coins.pid) &` keeps it awake for as long
as the desk runs.

**Stocks: need free Alpaca paper keys** (alpaca.markets → sign up → Paper account → API keys).

```bash
cd premarket-scanner
cp .env.example .env        # put ALPACA_API_KEY and ALPACA_SECRET_KEY in .env (never in a chat)
../.venv/bin/python -m scanner doctor
```

Then schedule it: `crontab -e` and paste the lines from `premarket-scanner/deploy/crontab.txt`
(change the folder path). It scans at 5:35 and 6:02 am Pacific, grades the day's picks at 1:45 pm,
and runs its nightly review at 1:55 pm. The paper book picks the grades up on its next refresh.

**Windows**: run each in its own window: `cd night-desk` then `python -m nightdesk run`, and
`cd paper-book` then `python paperbook.py --watch 15`. Schedule the scanner with Task Scheduler
at the same times as the crontab.

## Running it in Claude's cloud instead

The cloud environment blocks market-data sites by default. To allow them, open the environment's
settings (the cloud environment menu in the session's title bar, then Edit) and add these under
Allowed domains:

- coins: `api.dexscreener.com`, `api.geckoterminal.com`, `api.rugcheck.xyz`
- stocks: `data.alpaca.markets`, `paper-api.alpaca.markets`, `api.alpaca.markets`, `www.nasdaqtrader.com`

Put `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` in the environment's secrets as well (never in a chat).

The stocks fit the cloud well, because they only need a few short runs on weekdays. Cloud sessions
aren't always-on servers, though, so the coin desk (which watches prices every 15 seconds) belongs on
a computer that stays on.

## What the numbers mean

- **Coins** are priced from the pool's live price, with swap fees and price impact included, so
  they're close to what a real swap would get. No order ever reaches the market.
- **Stocks** buy at the 9:30 ET open and sell at the scanner's target, its stop or the close,
  whichever comes first, minus the scanner's cost for spread and slippage. When one five-minute
  bar touches both, it counts as the stop.
- **Open** coin positions are marked at the last price, before exit costs. Stock picks show as
  waiting until their trade day is graded.
- Paper results flatter real trading: real fills, gaps, outages and nerves are all worse.
  Before any real money, each desk has its own scorecard (`python -m nightdesk scorecard`,
  `python -m scanner scorecard`), and both need weeks of results first.

`python paper-book/paperbook.py --demo` builds the same report from the desks' demo markets
(after `python -m nightdesk sim` and `python -m scanner backtest --demo`), labelled as demo.

# Paper Book

Every paper trade from both desks in one ledger, with one running total. Paper money only:
nothing in this repo can place a real order.

| Desk | What it trades | Paper money | When it trades |
|---|---|---|---|
| **Memecoins**: Night Desk (`night-desk/`) | brand-new Solana coins that pass its rug checks | $100 bank | nonstop, 24/7, while it's running |
| **Big coins**: Majors Desk (`majors-desk/`) | BTC, ETH, SOL, XRP, ADA, DOGE, hourly trend following | $100 bank | every hour, 24/7, while it's running |
| **Stocks**: premarket scanner (`premarket-scanner/`) | US stocks gapping up before the open | $100 bank, split equally between each weekday's picks | picks before the open; graded after the close, weekdays |

```bash
python paper-book/paperbook.py             # the ledger and the report, now
python paper-book/paperbook.py --watch 15  # ...every 15 minutes
```

It writes `paper-book/output/ledger.csv` (one row per closed paper trade, both desks) and
`paper-book/output/paper-book.html`: net profit and loss overall and per desk, the curve since
the start, each day's result, win rate, profit factor, worst drop, open positions, and the
latest trades.

## The bar to clear: BTC bought and held

Every refresh also prices $100 of BTC bought the moment the desks started and simply held (Coinbase's
public prices, no key). The paper book, `server/status.sh`, the crawler's results and the evening summary
all show it beside the big-coin desk. If a desk can't beat just holding, it isn't earning its keep. The
start is saved in `output/benchmark.json`; `server/fresh-start.sh` resets it with everything else.

## The Trade Crawler

Every refresh also writes `output/crawler.html`, a sixteen-legged crawler that reads the paper book
one trade at a time.

- **Clusters:** one per desk (memecoins, big coins, stocks), then the open positions, then the
  patterns. The camera walks from cluster to cluster along a glowing trail.
- **Nodes:** each closed trade, in the order it closed. As the crawler reaches each trade, its
  tentacles touch it. Wins glow in the desk's colour, losses stay grey, and **flags** turn pink: a
  rug exit, or a loss of half the stake or more. The core flares on every flag.
- **Panels:** the trade log, progress per desk, an edge radar (win rate, profit factor, win size
  against loss size, drawdown control, green days, sample size), a heat grid, the paper P&L curve
  with a paper score out of 100, and `crawler.py` typing itself as it goes.
- **Ship:** at the end, a list of flags to check before trusting any desk with real money. Examples:
  a profit factor under 1, rug exits, losses that blew through the stop, one symbol carrying a
  desk, long losing streaks, deep drawdowns, positions down a fifth, and desks with too few
  trades to judge. **Copy flags** puts the list on your clipboard.
- Tabs jump to any cluster. Space pauses, and **1x** cycles the speed. Each desk walks its last 240
  trades; the older ones are counted in one step.

Flags and the score describe what happened. They are not forecasts, and nothing here changes a desk.

## The Paper Galaxy

Every refresh also writes `output/galaxy.html`: the same trades drawn as a universe.

- **Galaxies:** one per desk. Add a desk to the ledger and it becomes a new galaxy.
- **Stars:** each coin or stock a desk has traded. Size shows how often it's been traded. A bright
  core means it made money; red means it lost.
- **Planets:** each closed trade orbits its star. A pulsing ring marks a position that's open now.
- **Growth:** new symbols join on the outer arms, so a galaxy grows outward as the desk trades more.
- **Silk:** every star is tied to its nearest neighbours, and threads brighten as their stars trade,
  so the web grows outward with the galaxy.
- **The spider:** Night Desk's crawler, loose in the galaxy. During the replay it walks to the biggest
  trades as they close, and it jumps between galaxies on a dragline. At "now" it checks on open
  positions. Every walk spins a fresh thread. **Follow spider** rides along with it.
- **Timeline:** replays everything from the first trade to now. The biggest moves flash as they happen.
- **Constellations:** patterns in the trades, such as how exits went, holding time, time of day,
  which symbols carried the profit, streaks, and whether two desks win and lose on the same days.
  Each is spun as an orb web between its stars (a silk bridge, for two desks).
  Each one stays locked, showing a progress bar, until there are enough trades to say anything.
  They describe what happened, not what will happen.

`python paperbook.py --serve 8790` serves the crawler at http://127.0.0.1:8790, the galaxy at `/galaxy`
and the paper book at `/book`. Both pages check for new trades every two minutes. The crawler
finishes its pass and shows the flags, then crawls again with the new trades a minute later (or
right away with **Crawl new trades**). On the always-on machine, `server/phone.sh` puts all three on
your phone.

## Start paper trading on your computer (Mac or Linux)

One-time setup, from the repo folder:

```bash
python3 -m venv .venv
.venv/bin/pip install -r night-desk/requirements.txt -r majors-desk/requirements.txt \
  -r premarket-scanner/requirements.txt
```

**Memecoins and big coins: no keys needed.**

```bash
paper-book/start.sh      # starts both coin desks and the paper book in the background
paper-book/stop.sh       # stops them; open positions are saved and resume on the next start
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

**Windows**: run each in its own window: `cd night-desk` then `python -m nightdesk run`,
`cd majors-desk` then `python -m majors run`, and `cd paper-book` then `python paperbook.py --watch 15`. Schedule the scanner with Task Scheduler
at the same times as the crontab.

## Running it in Claude's cloud instead

The cloud environment blocks market-data sites by default. To allow them, open the environment's
settings (the cloud environment menu in the session's title bar, then Edit) and add these under
Allowed domains:

- memecoins: `api.dexscreener.com`, `api.geckoterminal.com`, `api.rugcheck.xyz`
- big coins: `api.exchange.coinbase.com`
- stocks: `data.alpaca.markets`, `paper-api.alpaca.markets`, `api.alpaca.markets`, `www.nasdaqtrader.com`,
  and for float data `query1.finance.yahoo.com`, `query2.finance.yahoo.com`, `fc.yahoo.com`

Put `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` in the environment's secrets as well (never in a chat).

The stocks fit the cloud well, because they only need a few short runs on weekdays. Cloud sessions
aren't always-on servers, though, so the coin desk (which watches prices every 15 seconds) belongs on
a computer that stays on.

## What the numbers mean

- **Big coins** fill at the hour's closing price on Coinbase, with the exchange fee and slippage
  charged on each buy and sell.
- **Memecoins** are priced from the pool's live price, with swap fees and price impact included, so
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
(after `python -m nightdesk sim`, `python -m majors sim` and `python -m scanner backtest --demo`),
labelled as demo.

On an always-on machine, `server/setup.sh` runs all of this for you: see `START-HERE.md`.

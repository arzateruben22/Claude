# Paper Book

Every paper trade from every desk in one ledger, with one running total. Paper money only:
nothing in this repo can place a real order.

| Desk | What it trades | Paper money | When it trades |
|---|---|---|---|
| **Memecoins**: Night Desk (`night-desk/`) | brand-new Solana coins that pass its rug checks | $100 bank | nonstop, 24/7, while it's running |
| **Big coins**: Majors Desk (`majors-desk/`) | BTC, ETH, SOL, XRP, ADA, DOGE, hourly trend following | $100 bank | every hour, 24/7, while it's running |
| **Stocks**: premarket scanner (`premarket-scanner/`) | US stocks gapping up before the open | $100 bank, split equally between each weekday's picks | picks before the open; graded after the close, weekdays |
| **Wild memecoins**: Night Desk's wild rulebook (`night-desk/desk-wild.toml`) | the same coins and rug checks, with looser entry rules and bigger, longer bets | its own $100 bank | alongside the memecoin desk |
| **Wild stocks**: the scanner's wild rules (`premarket-scanner/criteria-wild.toml`) | smaller gaps, no news needed, +20% / −8% exits | its own $100 bank | a minute after each stock scan |
| **Fade stocks**: the scanner's fade rules (`premarket-scanner/criteria-fade.toml`) | the stock desk's picks, sold short at the open: gains when they fall | its own $100 bank | two minutes after each stock scan |
| **Strict memecoins**: Night Desk's strict rulebook (`night-desk/desk-strict.toml`) | older coins with real money behind them, half-size bets, quicker exits | its own $100 bank | alongside the memecoin desk |
| **Big coins 4h**: Majors Desk's 4-hour rulebook (`majors-desk/majors-4h.toml`) | the same coins and rules on 4-hour candles: fewer trades, less in fees | its own $100 bank | once per finished 4-hour candle |
| **Quick stocks**: the scanner's quick rules (`premarket-scanner/criteria-quick.toml`) | the stock desk's picks, +5% / −3% | its own $100 bank | with the stock scans |
| **Early-out stocks**: the scanner's early rules (`premarket-scanner/criteria-early.toml`) | the stock desk's picks, sold by 10:30 New York time | its own $100 bank | with the stock scans |
| **Seven more memecoin desks**: sniper, momentum, patient, scalper, whale, runner, tiny (`night-desk/desk-<name>.toml`) | the same coins and rug checks under seven more rulebooks | $100 each | alongside the memecoin desk |
| **Eight more big-coin desks**: daily, fast, tight stop, loose, Bitcoin only, alt coins only, one bet, slow (`majors-desk/majors-<name>.toml`) | the same coins and prices under eight more rulebooks, on hourly, 4-hour or daily candles | $100 each | at each one's own candle close |
| **Five more stock desks**: big-cap, tight-stop, hold, cheap, high-volume (`premarket-scanner/criteria-bigcap.toml`...) | the scanner's picks under five more rulebooks | $100 each | with the stock scans |

On 22 October 2026 the clear losers were retired on the evidence and their sections removed from `book.toml`;
their rulebooks are kept in each market's `retired/` folder and their paper records stay on disk. Fifteen of the
thirty remain, joined by five new ones: the big-coin trend filter and four stock rulebooks that wait out the opening
swings. In the table above, Memecoins, Big coins, Wild memecoins, Wild stocks, Big coins 4h, Quick stocks and
Early-out stocks are among the retired. A desk is in the book when `book.toml` has a section for it.

Later that day four more joined, for twenty-four, and every bank went from $100 to $1,000 (the table above shows
the old amounts): **Rush coins** (twenty Coinbase coins, a 7-day breakout in an uptrend) and three stock desks
that hold for days or weeks on the Majors Desk engine with Alpaca's daily bars: **Index trend filter** (SPY and
QQQ above their 150-day average), **Sector breakouts** and **Leader breakouts**. They sit in `book.toml` with
`kind = "coins"` (their records have the coin desks' shape) and `market = "stocks"`, so the deck shows them with
the stocks and the Proving Ground grades them quarter by quarter in their own section, like the big coins.

**Market weather** (`weather.py`): the deck's top line, the paper book, the standings, the Proving Ground and the
evening push say where the big trends stand. Bitcoin, SPY and QQQ against their 150-day averages (the trend desks'
line) with the date each last crossed, how many of the rush coins, leaders and sector funds are above their own
rulebook's average (shown only with prices for at least half of each list), and the crypto Fear & Greed index from
alternative.me, fetched at most every six hours, only its number kept. The prices are the ones the desks already
cache; in demo mode every number is invented and labelled so. `/weather.json` serves it.

**The Proving Ground** (`proving.py`, written with every refresh as `output/proving.html`, served at `/proving` and
linked from the deck) reads each running rulebook's newest history test and grades it by one stated rule: a
**candidate** made money over the test, made money in at least two thirds of its periods (quarters for big coins,
months for stocks), had enough trades and, for big coins, never fell more than 25% from a high; **watch** made money
overall or in half its periods; **cut** did neither. It draws a heatmap of every period, with holding the same coins
beside each big-coin quarter. `bash server/prove.sh` runs the tests; `python paper-book/paperbook.py --proving`
prints the grades. Memecoins can't be replayed and are judged live only.

**The plan**, as `[report] checkpoints` in `book.toml`: a first look on **Fri 23 Oct**, the assessment at **month
end, Sat 31 Oct**, and after that the survivors run until one shows a **green week** (`deck.week`): traded on three
or more of the last seven days, net up over the seven, no single day's loss bigger than the week's gain.

```bash
python paper-book/paperbook.py             # the ledger and the report, now
python paper-book/paperbook.py --watch 15  # ...every 15 minutes
python paper-book/paperbook.py --standings # every desk ranked, with its last seven days and the green weeks
```

Every build also writes `output/standings.txt` (served at `/standings`), and the watchdog pushes to your phone the
moment a desk has a green week, then again for each week it keeps the streak (×2, ×3...).

It writes `paper-book/output/ledger.csv` (one row per closed paper trade, every desk) and
`paper-book/output/paper-book.html`: net profit and loss overall and per desk, the curve since
the start, each day's result, win rate, profit factor, worst drop, open positions, and the
latest trades.

## The bar to clear: BTC bought and held

Every refresh also prices BTC bought the moment the desks started and simply held (Coinbase's
public prices, no key). The paper book, `server/status.sh`, the crawler's results and the evening summary
all show it beside the big-coin desk. If a desk can't beat just holding, it isn't earning its keep. The
start is saved in `output/benchmark.json`; `server/fresh-start.sh` resets it with everything else.

## Home: both apps on one screen

The first page on port 8790 (`home.py`) is **Desks**: a Trading card (every desk's paper profit so far and today,
open positions, the best desk, green weeks, the market weather, the next read date, and buttons for every view)
and a Post Desk card (on air or not, drafts waiting for you with the first two, today's posts, the next slot,
followers and views, and a button to its dashboard on port 8788 of the same address). The trading numbers come
from each refresh (`output/home.json`); the Post Desk card reads the summary the running desk saves every half
minute (`post-desk/output/live/status.json`) when the page is asked for, and says plainly when Post Desk isn't
connected yet or has stopped. The page reloads itself every minute while it's open, reads fine without
JavaScript, and has a web-app manifest and icon (`web/icon.svg`, rendered to `web/icon-180.png` and
`icon-512.png`), so a phone can add it to its home screen like an app.

## The Trading Deck

At `/deck` on port 8790 (`output/deck.html`): every desk as a lane of light on one time axis, from day one to
now. Each lane's ribbon is that desk's paper profit over time, every closed trade is a spark (up for a win, down for
a loss, pink when flagged), and each lane carries its own **day 28** flag, the end of its four-week test. The lanes
sort themselves by return, so the order *is* the scoreboard, and a replay runs from day one to now when the page
opens (drag across the lanes or use the arrow keys to scrub; space pauses). All lanes share one scale, so a desk
up 0.5% looks flat next to one down 60%, which is the truth. A gold thread shows BTC bought and held across the
coin lanes once the coin desks have cached its prices. The ticker at the foot is the latest closed trades. The page
checks for new trades every two minutes.

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

`python paperbook.py --serve 8790` serves the home screen at http://127.0.0.1:8790, the deck at `/deck`, the crawler at `/crawler`, the
galaxy at `/galaxy` and the paper book at `/book`. Both pages check for new trades every two minutes. The crawler
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

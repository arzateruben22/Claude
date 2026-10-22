# Majors Desk

Paper trading on the big coins: BTC, ETH, SOL, XRP, ADA and DOGE (change the list in
`majors.toml`). It uses Coinbase's public prices, so there's no account and no key, and paper money,
so nothing here can place a real order.

```bash
pip install -r requirements.txt
python -m majors backtest --days 180   # first: how would these rules have done lately, vs just holding?
python -m majors run                   # then: paper trade live, one decision per coin every hour
python -m majors status                # the paper bank, open positions, latest trades
```

## How it trades

It follows trends on hourly prices. It's a different game from Night Desk, which hunts brand-new
Solana coins: the big coins can't rug, trade around the clock on deep markets, and move in long
waves.

- **Buy** when a coin's hourly close is above its 100-hour average (the trend is up) *and* above
  the highest price of the previous 48 hours (a breakout).
- **Sell** when it closes 3 "normal hourly moves" (ATR) below its best close since buying (a
  trailing stop), or below the lowest price of the previous 24 hours (the trend is over).
- **Size**: each trade risks 1% of the bank between the buy and the stop, never more than 25% of
  the bank in one coin, and at most 4 coins at once. After a sell it waits 6 hours before buying
  that coin again.
- **Costs**: 0.40% exchange fee plus 0.05% slippage on every buy and every sell, charged to the
  paper bank. Change them to your exchange's real fees in `[costs]`.

Expect most trades to lose a little and a few long trends to pay for them; a win rate around 35–40%
is normal for this style. Long sideways stretches lose slowly to fees.

## The 4-hour rulebook: `majors-4h.toml`

The same trend following, deciding once per finished **4-hour candle** (built from Coinbase's hourly prices,
aligned to midnight UTC) instead of every hour, on its own $100 of paper money. Fewer trades, longer holds,
and the exchange fee bites far less. Every window in the file is still in hours (200 hours = 50 candles).

```bash
python -m majors run --book 4h                 # live, results in output/4h/
python -m majors backtest --days 365 --book 4h # the 4-hour rules over the past year, vs just holding
python -m majors why --book 4h                 # every command takes --book 4h
```

## The rulebooks still running, one process

On 22 October 2026 the rulebooks that lost 24–60% over the past year were retired: hourly (`majors.toml`, kept in
place as the reference), 4h, fast, tight, btc, alts and single. Their files are in `retired/` with the reason, and
every command still finds them by name for a history test. Still running, each on its own $1,000 (raised from
$100 the same day, so every rulebook can size its bets the way it's written):

- **daily** (`majors-daily.toml`): daily candles. Made +3.3% in a year when holding lost 46%, on few trades.
- **slow** (`majors-slow.toml`): daily candles, the longest windows. Flat in that year.
- **loose** (`majors-loose.toml`): 4-hour candles, wide stops. Lost 9% in that year.
- **trend** (`majors-trend.toml`), new: Bitcoin and Ethereum only while each closes above its 150-day average, cash
  otherwise, with a trailing stop four daily moves below the best close for a crash between decisions. It uses
  `breakout_hours = 0` (no breakout needed), `exit_hours = 0` (no window-low exit) and `exit_below_trend = true`.
- **rush** (`majors-rush.toml`), new: twenty coins (BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, LTC, DOT, XLM, HBAR,
  BCH, AAVE, UNI, QNT, NEAR, ATOM, ETC, FIL) on daily candles. A coin is bought when it closes above its 50-day
  average and above its high of the previous 7 days, and sold on a close below its 5-day low or a trailing stop
  three daily moves under its best close. Up to four at once, a quarter of the bank at most each. It's the "QNT had
  a good week" desk: it rides a run and gets out when it stalls. Slippage is set at 0.15% a side for the thinner
  coins. A coin Coinbase doesn't list is left out of a replay (and said so), not fatal.

## Stocks held for days: the same engine on Alpaca's daily bars

`source = "alpaca"` in `[desk]` swaps Coinbase for Alpaca's daily stock bars (split- and dividend-adjusted, the
consolidated feed the free paper account may read up to 15 minutes back). The keys are the stock scanner's, read
from the environment or `../premarket-scanner/.env` (`bash server/keys.sh` puts them there). Each trading day is one
24-hour candle dated by its New York date, so a 150-candle average is 150 trading days, and a day only counts once
it's finished: the desk decides just after midnight UTC (5pm Pacific), on that day's close. No commission.

- **index** (`majors-index.toml`): SPY and QQQ only while each closes above its 150-day average, cash otherwise.
- **sectors** (`majors-sectors.toml`): the eleven sector funds and the chip-makers' fund (XLK XLF XLE XLV XLI XLY
  XLP XLU XLB XLRE XLC SMH), bought on a close above the 100-day average and the previous 55 days' high, sold on a
  close below the 20-day low. Up to four at once.
- **leaders** (`majors-leaders.toml`): the twenty biggest US companies, bought on a close above the 100-day average
  and the previous 20 days' high, sold on a close below the 10-day low. Up to five at once, 1% of the bank at risk
  each. **Its list was picked today, with hindsight**: these are the biggest companies because they went up, so any
  history test of it flatters. Its live paper record is the one to trust.

Without the keys, `run` says "Not starting [index]: no Alpaca keys" and runs the coin rulebooks as usual; after
adding them, restart (`sudo systemctl restart majors`). If Alpaca has a hiccup, a stock desk decides on the prices
already on disk and asks again the next day; refused keys are said plainly instead.

```bash
python -m majors run --book daily --with slow --with loose --with trend --with rush \
    --with index --with sectors --with leaders                               # what the server runs
python -m majors backtest --days 1460 --book trend                         # four years against just holding
python -m majors backtest --days 1460 --book leaders                       # needs the Alpaca keys
python -m majors why --book index                                          # each fund against its line, now
```

Every backtest now ends with a period table, by year past two years and by quarter otherwise: the desk's change in
each period next to the same coins bought in equal parts and held. `periods.json` in the backtest's folder keeps
both the quarters and the years for the paper book's Proving Ground. One thing worth knowing about the daily
rulebook: its 1% risk per trade against a stop three daily moves away often asked for less than the $10 minimum
ticket on the old $100 bank, so it only bought the calmer coins in calm weeks. On $1,000 that limit no longer bites.

The price cache keeps only finished hours. Before 22 Oct 2026 it could keep the hour still trading, half made, which
then stuck; a cache saved before then has its last 40 days fetched again the first time it's read.

## Read the backtest honestly

`backtest` runs the exact same rules over real past prices (kept on disk after the first download)
and always compares them with **just holding** the same coins. If the rules don't beat holding, and
in a strong bull run they often won't, that's worth knowing before any real money. Past prices don't
predict future ones: a backtest that loses is a reason to stop, and one that wins is only a reason
to keep paper trading.

`python -m majors sim --days 30` does the same on an invented market (`--demo` on `backtest` too).
Those prices are made up and say nothing about real coins.

## Files

```
majors.toml            every rule and cost
output/live/           trades.csv and state.json from `run` (the paper book reads these)
output/backtests/      one folder per backtest: trades.csv and summary.md
output/cache/          downloaded prices: hourly coins (BTC-USD.json.gz), daily stocks (stock-SPY-1d.json.gz)
```

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
every command still finds them by name for a history test. Still running, each on its own $100:

- **daily** (`majors-daily.toml`): daily candles. Made +3.3% in a year when holding lost 46%, on few trades.
- **slow** (`majors-slow.toml`): daily candles, the longest windows. Flat in that year.
- **loose** (`majors-loose.toml`): 4-hour candles, wide stops. Lost 9% in that year.
- **trend** (`majors-trend.toml`), new: Bitcoin and Ethereum only while each closes above its 150-day average, cash
  otherwise, with a trailing stop four daily moves below the best close for a crash between decisions. It uses
  `breakout_hours = 0` (no breakout needed), `exit_hours = 0` (no window-low exit) and `exit_below_trend = true`.

```bash
python -m majors run --book daily --with slow --with loose --with trend     # what the server runs
python -m majors backtest --days 1460 --book trend                         # four years against just holding
```

Every backtest now ends with a period table, by year past two years and by quarter otherwise: the desk's change in
each period next to the same coins bought in equal parts and held. `periods.json` in the backtest's folder keeps
both the quarters and the years for the paper book's Proving Ground. One thing worth knowing about the daily
rulebook: its 1% risk per trade against a stop three daily moves away often asks for less than the $10 minimum
ticket on a $100 bank, so it only buys the calmer coins in calm weeks. That's part of why it trades so rarely.

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
output/cache/          downloaded hourly prices
```

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

## Eight more rulebooks, one process

Each `majors-<name>.toml` is the main rulebook with a few numbers changed, on its own $100 of paper money and its
own `output/<name>/`: **daily** (daily candles, long windows), **fast** (short windows, 2 ATR stop), **tight**
(hourly, 1.5 ATR stop), **loose** (4-hour candles, 5 ATR stop, 96-candle exit), **btc** (Bitcoin only, 4-hour
candles, 80% of the bank in one position), **alts** (SOL, XRP, ADA, DOGE only), **single** (one position, 80% of
the bank, 2% risk) and **slow** (daily candles, the longest windows). The server runs all ten in one process:

```bash
python -m majors run --with 4h --with daily --with fast --with tight --with loose --with btc --with alts --with single --with slow
python -m majors sim --days 30 --book slow     # every command takes --book <name>
```

Every rulebook shares the hourly price cache in `output/cache/`; one process reads Coinbase once an hour for all
of them, and each desk decides when its own candle closes (hourly, 4-hour or daily, aligned to midnight UTC).

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

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

# Night Desk

A crew of small bots that watches brand-new Solana coins all night, stomps
the scams, and trades the survivors **with paper money**. A live dashboard
shows the crawler's web, every agent at work, the balance, and the full rule
sheet for whichever coin is on the desk.

> **Paper money only.** Night Desk has no wallet, holds no keys, and cannot
> send a real order: that code was never written. Treat it as a way to find
> out whether a set of rules works before risking anything.

## Try it (2 minutes, no accounts)

Needs Python 3.10+.

```bash
cd night-desk
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python -m nightdesk run --demo   # opens the dashboard in your browser
```

`--demo` runs a made-up market at 20x speed: coins launch every ~45 seconds,
and each is secretly a scam, a rug, a real pump, a slow bleed, or a dud. The
desk never sees which; it only sees prices, trades and safety reports, the
same as live.

## The crew

| Agent | Job |
|---|---|
| **CRAWLER** | Sweeps for new pools every minute |
| **VET** | Runs the kill list: mint/freeze authority, whale wallets, dev bag, pool lock, danger flags |
| **SCAN** | Is the buying real, recent, and not already spent? |
| **SOCIAL** | Website, X, Telegram: is anyone home? |
| **JUDGE** | Final yes/no. Claude if you add a key, otherwise a scoring rule |
| **SIZE** | Ticket = 10% of the bank, never more than 1% of the pool |
| **FILLS** | Paper buys and sells with price impact, fees and slippage |
| **RISK** | +40% target, −20% stop, trailing stop, 2-hour limit, rug exit, daily loss limit |
| **CHIEF** | Runs the tick, keeps the books |

On the web: **blue** = watching, **red ✗** = stomped, **green** = holding,
**gold** = sold, **grey** = passed on.

## Live mode (real coins, fake money)

```bash
python -m nightdesk run
```

Uses three free, keyless data sources: GeckoTerminal (new pools), DexScreener
(prices, volume, trades) and RugCheck (safety reports). Results save to
`output/live/`, and the desk picks up where it left off after a restart.

**Add the AI judge (optional):** copy `.env.example` to `.env` and paste an
Anthropic API key. Only coins that clear every rule reach the judge, usually
a few per hour. With the default model at low effort, each decision should
cost around a cent (my estimate: check your usage page). For the tiny, cheaper
judge, set `model = "claude-haiku-4-5"` in `desk.toml`. Without a key, the
scoring rule decides and the dashboard says so.

## Other commands

```bash
python -m nightdesk check <mint address>   # put one coin through every rule, right now
python -m nightdesk report                 # paper results: win rate, profit factor, exits, kills
python -m nightdesk report --demo
python -m nightdesk replay                 # record a demo night into one HTML file (phone-friendly)
```

## The rulebook: `desk.toml`

Every number the desk believes is in one file, in three kinds of rule:

- **`[kill]`** rug signs. Break one and the coin is stomped for good.
- **`[ready]`** not-yet rules (age, pool size, volume, market cap, trades). The coin waits and is re-checked.
- **`[scan]`** 0–1 scores for "worth a trade right now": buying over the last hour *and* last 5 minutes, how much of the move is already spent, whether it's still trading, whether the pool can take your ticket, socials.

Then `[judge]`, `[size]` and `[risk]` decide the trade. Change a number,
restart, compare `report` results.

## How the paper fills work

Buys and sells are priced like a real constant-product pool (pump.fun,
Raydium): spending $X into a pool holding $L makes your average price 2X/L
worse. On top of that, each side pays a 1% fee and 1% slippage. Exits fill
at whatever the price is when the desk next looks (every 15 seconds), so a
crash gaps straight through a stop, the way it does in real life.

## What this can't do

- **It can't catch every rug.** Some scams look perfectly clean until the creator pulls the pool. The demo shows it: one rug exit at −95% can erase a night of wins.
- **Paper beats reality.** Real trades also lose to sandwich bots, failed transactions and priority-fee wars. Expect real results to be worse than paper.
- **The demo market is invented.** Its results say nothing about real markets; it exists to show the machinery working.
- **Short samples lie.** A few nights, or the "$100 → $17,608 in four nights" kind of post, prove nothing. Judge it on hundreds of paper trades over weeks.

## Why there's no real-money mode

Deliberately not built. If the paper results hold up over weeks, real trading
would need a separate burner wallet with only what you can lose, hard
spending caps, and code you've read line by line. **Never give a seed phrase
or private key to a bot you found online.** That is how most "free trading
bot" scams empty wallets.

## Tests

```bash
pip install pytest && python -m pytest
```

Not financial advice.

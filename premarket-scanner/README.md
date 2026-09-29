# Pre-market scanner

Finds small-cap momentum stocks before the open, and after-hours movers the
night before. It filters the whole US market by your rules, attaches the news
catalyst, sends the list to your phone, and keeps a paper-trading journal that
grades every pick after the close.

```
Pre-market scan · Mon Sep 28, 5:45 AM PT · demo  [DEMO DATA — fake tickers]
Rules: $2-$20 · gap >= +10% · RVOL >= 3x · float <= 20M · vol >= 50k · news catalyst

#  Symbol  Price  Gap     RVOL   Volume  Float  Session high  Catalyst
1  DMBIO   $5.02  +61.9%  26.2x  649.9k  8.5M   $5.09         fda
2  DMAI    $7.27  +34.6%  11.3x  438.9k  14.0M  $7.36         contract, crypto_ai
3  DMEV    $9.23  +18.4%  6.2x   352.9k  11.0M  $9.37         earnings
4  DMFRT   $6.95  +15.9%  7.2x   157.1k  18.0M  $7.08         ⚠ dilution

Near misses (fail one rule):
  DMSHP     $5.78   +28.5%  ✗ no news
  DMGLD    $14.57   +21.4%  ✗ float 85.0M > 20.0M
  ...
```

> A scanner only filters. It does not give you an edge by itself. Paper trade
> it for 3–4 weeks (`grade` / `stats` below) before risking real money. Not
> financial advice.

## 1. Try it in 2 minutes (no account needed)

Needs Python 3.10+ (`python3 --version`).

```bash
cd premarket-scanner
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python -m scanner scan --demo      # fake tickers, the whole pipeline
```

## 2. Connect real data

Real-time pre-market data costs money. Free data is 15 minutes behind, which is
fine for building a watchlist but not for timing entries. Start free and
upgrade only if the delay bothers you.

| | **Alpaca** (start here) | **Massive**, formerly Polygon.io |
|---|---|---|
| Cost | Free | Paid Stocks plan (snapshots aren't on the free tier) |
| Delay | 15 min (`delayed_sip`); real time on Alpaca's paid plan | Real time on higher tiers, 15 min on lower |
| Coverage | Whole US market (SIP) | Whole US market (SIP) |
| News | Included (Benzinga) | Included |
| Float | No: uses free yfinance data | Yes: its free-float endpoint |
| Bonus | Paper-trading account | One call covers the whole market |

**Alpaca setup:** sign up at alpaca.markets, open the **Paper** account, click
*Generate API keys*. Then:

```bash
cp .env.example .env               # paste ALPACA_API_KEY and ALPACA_SECRET_KEY
python -m scanner doctor           # checks keys and connectivity
python -m scanner scan             # picks the session from the clock
```

## 3. The rules (`criteria.toml`)

| Rule | Default | How it's measured |
|---|---|---|
| Price | $2–$20 | Last trade this session |
| Gap | +10% | vs the **last regular close**: yesterday's 4pm close in the morning, today's 4pm close at night. That's the number tomorrow's gap is measured against, so both scans agree |
| Relative volume | 3x | This session's volume vs the average of the last 10 days **at the same time of day**. 300k shares by 5:45am vs a normal 20k by 5:45am = 15x |
| Float | ≤ 20M shares | Massive free float, else yfinance. If unknown, the stock is kept and flagged |
| Catalyst | required | A headline in the last 24h. Roundup articles tagging 5+ tickers don't count |
| Session volume | ≥ 50k shares | Keeps out names you couldn't get in and out of |

Headlines are tagged (fda, earnings, deal, contract…). **Offering / reverse
split / warrants** headlines get a ⚠ because those gaps often get sold into.
Stocks that miss exactly one rule are listed as **near misses**, which helps
you tune the rules. Change any number in `criteria.toml`; no code changes needed.

## 4. Daily routine (Pacific time)

| When | Command | Why |
|---|---|---|
| **5:00 pm**, night before | `scan` | After-hours has ended: earnings, news and AH movers |
| **5:35 am** and **6:00 am** | `scan` | Pre-market picture before the 6:30 open (free data: add 15 min) |
| **1:45 pm** | `grade` | Scores today's picks against what actually happened |
| Weekly | `stats` | Is it working? |

Each scan saves `output/watchlists/<date>_<time>_<session>.md` + `.csv`,
overwrites `output/latest.md`, and adds new picks to `output/journal.csv`.
Add `--notify` to push the list to your phone.

### Run it automatically

Pick one:

- **Mac / Linux:** paste `deploy/crontab.txt` into `crontab -e`. The computer
  must be awake. On a Mac, `sudo pmset repeat wakeorpoweron MTWRF 05:25:00`
  wakes it each weekday morning.
- **Windows:** Task Scheduler, *Create Basic Task*, weekly Mon–Fri, action
  `cmd /c "cd /d C:\path\to\premarket-scanner && .venv\Scripts\python -m scanner scan --notify"`.
  Make one task per time.
- **Cloud, free, computer off:** put this folder in its own **private** GitHub
  repo and follow `deploy/github-actions.yml`. Results reach you through
  `--notify`, and the journal is committed back to the repo.

### Phone alerts

Easiest: install the free **ntfy** app, subscribe to a topic name nobody would
guess, and put `NTFY_TOPIC=that-name` in `.env`. Or use
`DISCORD_WEBHOOK_URL=` for a Discord channel.

## 5. Paper trading

```bash
python -m scanner grade      # after 1:30pm PT: fills in how each pick did
python -m scanner stats      # the scoreboard
python -m scanner journal    # last 15 picks
```

The simulator assumes you **bought the 9:30 ET open** of the trade day (evening
picks trade the next morning) and sold at **+10% or −5%**, whichever came first,
else at the close. If one 5-minute bar touched both, it counts as the loss.
`stats` breaks results down by session and catalyst type, e.g. do FDA gappers
actually beat earnings gappers for you? Change `target_pct` / `stop_pct` in
`criteria.toml`.

Treat it as a filter check, not a P&L forecast: real fills, slippage and halts
are worse than the sim. Wait for 15–20+ trade days before trusting any number.

## Commands

```
python -m scanner scan [--session auto|premarket|regular|afterhours]
                       [--notify] [--no-save] [--window 05:25-06:20]
                       [--provider alpaca|massive|demo] [--demo] [--at "2026-09-29 05:45"]
python -m scanner grade | stats | journal | doctor
```

`--window` makes a scheduled run exit quietly outside a Pacific-time window.
`--at` replays a time, demo only (live snapshots can't be rewound).

## How it works

```
screen      one pass over ~10k symbols (snapshot): price + rough gap
pre-filter  loose price/gap cut → top 60 gappers
bars        5-min bars incl. extended hours, last ~10 trading days
metrics     exact gap, time-of-day RVOL, session volume/high      (metrics.py)
enrich      news + float, only for names within one rule of passing
judge       criteria.toml → picks, near misses → terminal / files / phone / journal
```

Code map: `scanner/providers/` (alpaca, massive, demo), `engine.py`,
`metrics.py`, `criteria.py`, `report.py`, `journal.py`. Tests:
`pip install -r requirements-dev.txt && python -m pytest`.

## Known limits (v1)

- Early 1pm closes (day after Thanksgiving, Christmas Eve) aren't modelled.
  Update the holiday list in `scanner/market.py` each December.
- yfinance float data is unofficial and sometimes missing (shows as `?`).
- Halts, short-sale restrictions, and borrow availability aren't checked.

"""Possibility Lab No. 010, "Every shuffle is new": every number the episode says or shows.

  orders of a deck      52!                                  (exact integer arithmetic)
  shuffles in history   people * seconds * 1 per second      (a thought experiment: every person alive, one shuffle a second, since the Big Bang)
  coverage              shuffles / 52!
  collision             N^2 / (2 * 52!)                      (birthday bound: the chance any two of those shuffles ever match)

Inputs are CANDIDATE values; claims.json says which were read. compile.py imports RESULTS.   Run:  python3 -I calc.py
"""
import math

POP = 8.2e9               # people (UN World Population Prospects 2024: about 8.2 billion)
AGE_YR = 13.8e9           # years since the Big Bang (NASA Science: "around 13.8 billion years ago")
YEAR_S = 365.25 * 86400   # seconds in a year
CARDS = 52

ORDERS = math.factorial(CARDS)


def compute(pop=POP, age_yr=AGE_YR):
    n = pop * age_yr * YEAR_S
    return {"orders": ORDERS, "log10_orders": math.log10(ORDERS), "digits": len(str(ORDERS)), "shuffles": n,
            "coverage": n / ORDERS, "collision": n * n / (2 * ORDERS)}


V = compute()
SENS = {f"{k}x people": compute(POP * k) for k in (1, 1000, 1e6)}


def sci(x):
    e = math.floor(math.log10(x)); return (round(x / 10 ** e, 1), e)


RESULTS = {
    "orders_m": round(ORDERS / 10 ** (len(str(ORDERS)) - 1), 1),     # 8.1 (x 10^67)
    "orders_e": len(str(ORDERS)) - 1,                                 # 67
    "digits": V["digits"],                                            # 68
    "shuffles": sci(V["shuffles"]),                                   # (3.6, 27)
    "coverage": sci(V["coverage"]),                                   # (4.4, -41)
    "collision": sci(V["collision"]),                                 # (8.0, -14)
    "sens_cov": [sci(v["coverage"]) for v in SENS.values()],
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:14s} {v:.6g}" if not isinstance(v, int) else f"{k:14s} {v}")
    for k, v in SENS.items():
        print(f"  {k}: coverage {v['coverage']:.2e}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:14s} {v}")

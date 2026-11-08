"""Possibility Lab No. 012, "Catch all the lightning": every number the episode says or shows.

  flashes a year     rate * seconds in a year                       (rate: about 44 flashes a second worldwide)
  energy a year      flashes * energy per flash                     (about 1e9 J, a wide range: 1e8 to 1e10 J)
  vs world electricity   energy / (world electricity a year)       (about 30,000 TWh)
  days of power      share * 365.25

Everything is an order-of-magnitude estimate and is said so. Inputs are CANDIDATES; claims.json says which were read.
compile.py imports RESULTS.   Run:  python3 -I calc.py
"""
import math

RATE = 44.0               # flashes per second, whole Earth, cloud-to-ground plus in-cloud (Christian et al. 2003, NASA OTD)
E_FLASH_J = 1.0e9         # J, an order-of-magnitude energy of one flash (Rakov & Uman 2003; NOAA and NWS say about a billion joules); range 1e8-1e10
WORLD_TWH = 30_000.0      # TWh a year of world electricity generation (Ember / IEA, about 2023)
YEAR_S = 365.25 * 86400
J_PER_TWH = 3.6e15
J_PER_KWH = 3.6e6


def compute(e=E_FLASH_J, rate=RATE):
    n = rate * YEAR_S
    j = n * e
    twh = j / J_PER_TWH
    share = twh / WORLD_TWH
    return {"flashes": n, "joules": j, "twh": twh, "kwh_bn": j / J_PER_KWH / 1e9, "share": share, "days": share * 365.25,
            "times": 1 / share}


V = compute()
SENS = {f"{e:.0e} J a flash": compute(e) for e in (1e8, 1e9, 1e10)}

RESULTS = {
    "rate": int(RATE),
    "flashes_bn": round(V["flashes"] / 1e9, 1),               # 1.4 billion a year
    "joules_e18": round(V["joules"] / 1e18, 1),               # 1.4 x 10^18 J
    "twh": int(round(V["twh"], -1)),                          # about 390 TWh
    "kwh_bn": int(round(V["kwh_bn"], -1)),                    # about 390 billion kWh
    "share_pct": round(100 * V["share"], 1),                  # 1.3 %
    "days": round(V["days"]),                                 # about 5 days
    "times": int(round(V["times"], -1)),                      # about 80 times more
    "sens_days": [round(v["days"], 1) for v in SENS.values()],  # 0.5, 4.7, 47
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:12s} {v:.6g}")
    for k, v in SENS.items():
        print(f"  {k}: {v['twh']:.1f} TWh, {100 * v['share']:.2f}% of a year, {v['days']:.1f} days")
    print()
    for k, v in RESULTS.items():
        print(f"{k:12s} {v}")

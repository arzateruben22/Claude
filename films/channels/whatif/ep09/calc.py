"""Possibility Lab No. 009, "A rope around the Earth": every number the episode says or shows.

  rope round the Earth   C = 2 * pi * R
  lifted by h            C' = 2 * pi * (R + h)
  extra rope             C' - C = 2 * pi * h        (R cancels: the answer does not depend on the planet)

Inputs are CANDIDATE values; each is listed in claims.json (SOURCE-READ where the builder read the page).
compile.py imports RESULTS.   Run:  python3 -I calc.py
"""
import math

R_EARTH_KM = 6_378.0      # km, Earth's equatorial radius (NASA Earth Facts: equatorial diameter 12,756 km)
R_SUN_KM = 695_000.0      # km, about half the Sun's diameter (NASA Sun Facts: about 1.4 million km)
R_BALL_M = 0.12           # m, a basketball's radius (about 24 cm across; assumption for the sensitivity row)
LIFT_M = 1.0              # m, the lift
PERSON_M = 1.7            # m, an adult's height (assumption: the anchor)


def extra(h=LIFT_M):
    return 2 * math.pi * h


def circumference_km(r_km):
    return 2 * math.pi * r_km


V = {
    "c_earth_km": circumference_km(R_EARTH_KM),
    "extra_m": extra(),
    "extra_10m": extra(10.0),
    "extra_1cm_m": extra(0.01),
    "people": extra() / PERSON_M,
    "extra_sun_m": circumference_km(R_SUN_KM + LIFT_M / 1000) * 1000 - circumference_km(R_SUN_KM) * 1000,
    "extra_ball_m": 2 * math.pi * (R_BALL_M + LIFT_M) - 2 * math.pi * R_BALL_M,
    "extra_earth_m": circumference_km(R_EARTH_KM + LIFT_M / 1000) * 1000 - circumference_km(R_EARTH_KM) * 1000,
    "ratio_ppb": extra() / (circumference_km(R_EARTH_KM) * 1000) * 1e9,       # extra rope as a share of the whole rope, parts per billion
}

RESULTS = {
    "c_earth_km": int(round(V["c_earth_km"], -2)),         # about 40,100 km (the equator is 40,075)
    "extra_m": round(V["extra_m"], 1),                     # 6.3 m
    "people": round(V["people"]),                          # about 4 of you
    "extra_10m": int(round(V["extra_10m"])),               # 63 m
    "extra_cm_per_cm": round(V["extra_1cm_m"] * 100, 1),   # 6.3 cm for a 1 cm lift
    "ppb": int(round(V["ratio_ppb"])),                     # about 157 parts in a billion
    "sens_m": [round(V["extra_ball_m"], 1), round(V["extra_earth_m"], 1), round(V["extra_sun_m"], 1)],   # ball, Earth, Sun: all 6.3 m
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:16s} {v:.8g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:16s} {v}")

"""Possibility Lab No. 007, "Walking to the Moon": every number the episode says or shows.

  hours nonstop      distance / pace
  years nonstop      hours / (24 * 365.25)
  years at 8 h/day   hours / 8 / 365.25
  days at 10,000 steps a day   distance / (10,000 steps * stride)

Inputs are CANDIDATE values from the sources named below; each is listed OPEN in claims.json until a person opens
the source. compile.py imports RESULTS, so the voice, captions, spine readout and claims.json can't disagree.
Run it to print every value:  python3 -I calc.py
"""
import math

MOON_KM = 384_400.0       # km, the Moon's mean distance from Earth (NASA Moon fact sheet)
EARTH_D_KM = 12_756.0     # km, Earth's equatorial diameter (NASA Earth fact sheet)
EARTH_C_KM = 40_075.0     # km, Earth's equatorial circumference (NASA Earth fact sheet)
PACE_KMH = 5.0            # km/h, an easy walking pace (about 1.4 m/s; gait studies give about 1.3-1.4 m/s)
HOURS_A_DAY = 8.0         # assumption: walking hours in a day (the rest eating, sleeping, resting)
STEPS_A_DAY = 10_000      # the popular daily step goal
STRIDE_M = 0.75           # assumption: one step of an adult, in metres (about 0.4 x height)
YEAR = 365.25
APOLLO_DAYS = 3.0         # Apollo 11: launch to lunar orbit, about three days (NASA)


def compute(pace=PACE_KMH, hours_day=HOURS_A_DAY):
    h = MOON_KM / pace
    return {
        "hours_nonstop": h, "years_nonstop": h / 24 / YEAR, "days_nonstop": h / 24,
        "years_8h": h / hours_day / YEAR, "days_8h": h / hours_day,
        "earths": MOON_KM / EARTH_D_KM, "laps": MOON_KM / EARTH_C_KM,
        "steps": MOON_KM * 1000 / STRIDE_M,
        "km_per_day_steps": STEPS_A_DAY * STRIDE_M / 1000,
        "days_steps": MOON_KM / (STEPS_A_DAY * STRIDE_M / 1000),
        "years_steps": MOON_KM / (STEPS_A_DAY * STRIDE_M / 1000) / YEAR,
        "km_per_day_8h": pace * hours_day,
        "speedup_vs_apollo": h / 24 / APOLLO_DAYS,
    }


V = compute()
SENS = {f"{p:g} km/h": compute(p) for p in (4.0, 5.0, 6.0)}


def sig(x, n=2):
    e = math.floor(math.log10(abs(x)))
    return round(x, -e + n - 1)


RESULTS = {
    "moon_km": int(MOON_KM),
    "earths": int(round(V["earths"])),                    # about thirty Earths side by side
    "hours": int(round(V["hours_nonstop"])),              # 76,880 h
    "years_nonstop": int(round(V["years_nonstop"])),      # about 9
    "years_8h": int(round(V["years_8h"])),                # about 26
    "years_steps": int(round(sig(V["years_steps"], 2))),  # about 140
    "km_per_day_steps": round(V["km_per_day_steps"], 1),  # 7.5
    "steps_bn": round(V["steps"] / 1e9, 1),               # about 0.5 billion
    "sens_years_8h": [int(round(v["years_8h"])) for v in SENS.values()],   # 4, 5, 6 km/h
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:20s} {v:.6g}")
    for k, v in SENS.items():
        print(f"  {k}: {v['years_8h']:.2f} yr at 8 h/day, {v['years_nonstop']:.2f} yr nonstop")
    print()
    for k, v in RESULTS.items():
        print(f"{k:20s} {v}")

"""Possibility Lab No. 008, "Everyone holds hands": every number the episode says or shows.

  chain length   people * spacing        (spacing: one outstretched arm span, about a body height)
  laps           chain / equator
  moon trips     chain / Moon distance   (one way)

Inputs are CANDIDATE values; each is OPEN in claims.json until a person opens the source. compile.py imports
RESULTS so the voice, captions, spine readout and claims.json can't disagree.   Run:  python3 -I calc.py
"""
import math

POP = 8.2e9               # people, mid-2025 (UN World Population Prospects 2024: about 8.2 billion)
SPAN_M = 1.6              # assumption: one arm span, metres, averaged over adults and children (adult arm span is about body height)
EQUATOR_KM = 40_075.0     # km (NASA Earth fact sheet)
MOON_KM = 384_400.0       # km, mean distance (NASA Moon fact sheet)


def compute(span=SPAN_M, pop=POP):
    km = pop * span / 1000
    return {"km": km, "laps": km / EQUATOR_KM, "moon_trips": km / MOON_KM, "per_lap": EQUATOR_KM * 1000 / span,
            "people_for_one_lap": EQUATOR_KM * 1000 / span, "share_for_lap": EQUATOR_KM * 1000 / span / pop}


V = compute()
SENS = {f"{s:g} m": compute(s) for s in (1.4, 1.6, 1.7)}


def sig(x, n=2):
    e = math.floor(math.log10(abs(x)))
    return round(x, -e + n - 1)


RESULTS = {
    "pop_bn": 8.2,
    "span_m": SPAN_M,
    "km_m": round(V["km"] / 1e6, 1),                         # 13.1 million km
    "laps": int(round(V["laps"], -1)),                       # about 330 times round the equator
    "moon_trips": int(round(V["moon_trips"])),               # about 34 trips
    "per_lap_m": round(V["per_lap"] / 1e6, 1),               # 25 million people make one lap
    "sens_laps": [int(round(v["laps"], -1)) for v in SENS.values()],
    "sens_km_m": [round(v["km"] / 1e6, 1) for v in SENS.values()],
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:20s} {v:.6g}")
    for k, v in SENS.items():
        print(f"  {k}: {v['km'] / 1e6:.2f} million km, {v['laps']:.0f} laps, {v['moon_trips']:.1f} Moon trips")
    print()
    for k, v in RESULTS.items():
        print(f"{k:20s} {v}")

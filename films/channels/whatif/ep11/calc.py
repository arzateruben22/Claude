"""Possibility Lab No. 011, "All the water in one ball": every number the episode says or shows.

  ball diameter   d = (6 V / pi)^(1/3)          (a sphere of volume V; liquid, ice and vapour all counted at the same density, 1 g/cm^3)
  vs the Moon     d / Moon diameter
  vs the Earth    d / Earth diameter, and a basketball's worth
  share of Earth  V / (4/3 pi R^3)

Inputs are CANDIDATE values; claims.json says which were read. compile.py imports RESULTS.   Run:  python3 -I calc.py
"""
import math

V_WATER_KM3 = 1.386e9     # km^3, all of Earth's water: oceans, ice, groundwater, lakes, rivers, air (USGS Water Science School; Gleick 1996)
FRESH_SHARE = 0.025       # about 2.5% of it is fresh (USGS)
MOON_D_KM = 3_480.0       # km (NASA Moon Facts: radius about 1,740 km)
EARTH_D_KM = 12_756.0     # km (NASA Earth Facts: equatorial diameter)
BASKETBALL_CM = 24.0      # cm, a size-7 ball's diameter (assumption: the anchor)


def ball(v):
    return (6 * v / math.pi) ** (1 / 3)


V = {
    "d_km": ball(V_WATER_KM3),
    "d_fresh_km": ball(V_WATER_KM3 * FRESH_SHARE),
    "moon_ratio": ball(V_WATER_KM3) / MOON_D_KM,
    "earth_ratio": ball(V_WATER_KM3) / EARTH_D_KM,
    "ball_cm": ball(V_WATER_KM3) / EARTH_D_KM * BASKETBALL_CM,
    "earth_vol_km3": 4 / 3 * math.pi * (EARTH_D_KM / 2) ** 3,
}
V["share_pct"] = 100 * V_WATER_KM3 / V["earth_vol_km3"]

RESULTS = {
    "v_bn": 1.4,                                   # 1.386 billion km^3, said "one point four billion"
    "d_km": int(round(V["d_km"], -1)),             # about 1,380 km; said "about fourteen hundred"
    "d_say": 1400,
    "moon_pct": int(round(100 * V["moon_ratio"])), # 40% of the Moon's width
    "earth_pct": round(100 * V["earth_ratio"]),    # 11% of Earth's width
    "ball_cm": round(V["ball_cm"], 1),             # 2.6 cm next to a 24 cm basketball
    "fresh_km": int(round(V["d_fresh_km"], -1)),   # about 400 km
    "share_pct": round(V["share_pct"], 2),         # 0.13% of Earth's volume
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:14s} {v:.6g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:14s} {v}")

"""Back of the Envelope No. 006, "Every raindrop at once": every number the episode says or shows.

All the rain, snow and hail that falls on Earth in an ordinary day, falling instead in a single second, on the
same places it would have fallen anyway (the thought experiment: the same day's rain, squeezed in time).

  daily volume     P_year / 365.25          (Rodell et al. 2015, NASA's water-cycle budget)
  pour rate        daily volume / 1 s       compared with the Amazon at its mouth (about 206,000 m^3/s)
  average depth    daily volume / Earth's surface area

compile.py imports RESULTS, so the voice, captions, spine readout and claims.json can't disagree.
Run it to print every value:  python3 -I calc.py
"""
import math

P_OCEAN = 403_500.0       # km^3 a year of precipitation over the ocean (Rodell et al. 2015, J. Climate 28, 8289)
P_LAND = 116_500.0        # km^3 a year over land (same)
R_EARTH = 6371.0          # km, mean radius (NASA Earth fact sheet)
AMAZON = 206_000.0        # m^3/s, the Amazon's mean discharge at its mouth (IRD/HyBAm: 205,000-208,000, +-6%)
ONTARIO = 1_640.0         # km^3, Lake Ontario's volume (US EPA, Great Lakes physical features)
DAY = 365.25              # days a year


def compute(p_year=P_OCEAN + P_LAND):
    day_km3 = p_year / DAY
    area_km2 = 4 * math.pi * R_EARTH ** 2
    rate_m3s = day_km3 * 1e9 / 1.0                    # the whole day in one second
    depth_mm = day_km3 / area_km2 * 1e6               # km -> mm
    return {
        "p_year_km3": p_year, "day_km3": day_km3, "day_t": day_km3 * 1e9,     # tonnes (1 m^3 of water ~ 1 t)
        "area_km2": area_km2, "rate_m3s": rate_m3s, "amazons": rate_m3s / AMAZON,
        "ontarios": day_km3 / ONTARIO, "depth_mm": depth_mm,
        "land_share": P_LAND / (P_OCEAN + P_LAND),
        "real_rate_m3s": day_km3 * 1e9 / 86_400,      # the same rain at its real, all-day pace
    }


V = compute()
SENS = {f"{k} km^3 a year": compute(k) for k in (486_000.0, 520_000.0, 577_000.0)}   # other budgets (Trenberth 2007; this one; the widest)


def sig(x, n=1):
    e = math.floor(math.log10(abs(x)))
    return round(x, -e + n - 1)


RESULTS = {
    "day_km3": int(sig(V["day_km3"], 2)),                    # 1,400 km^3
    "ontario_pct": int(round(100 * V["ontarios"], -1)),       # about 90% of a Lake Ontario
    "rate_tn": round(V["rate_m3s"] / 1e12, 1),               # 1.4 trillion m^3 in one second
    "amazons_m": int(round(V["amazons"] / 1e6)),              # about 7 million Amazons
    "depth_mm": round(V["depth_mm"], 1),                      # 2.8 mm on average
    "land_pct": int(round(100 * V["land_share"])),            # 22% lands on land
    "sens_depth_mm": [round(v["depth_mm"], 1) for v in SENS.values()],
    "sens_amazons_m": [int(round(v["amazons"] / 1e6)) for v in SENS.values()],
    "real_amazons": round(V["real_rate_m3s"] / AMAZON),     # on a real day the rain pours at about 80 Amazons
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:16s} {v:.6g}")
    for k, v in SENS.items():
        print(f"  {k}: depth {v['depth_mm']:.2f} mm, {v['amazons'] / 1e6:.2f} million Amazons")
    print()
    for k, v in RESULTS.items():
        print(f"{k:16s} {v}")

"""Back of the Envelope No. 002, "Everyone, one place": every number the episode says or shows.

Everyone alive, standing together at a comfortable crowd density, then packed as bodies alone. Inputs
(SI units, sources in claims.json):

  N          8.2e9 people, mid-2024 (UN World Population Prospects 2024)
  D_SAFE     2 people per m^2: crowds move comfortably below about this (crowd-safety literature: Fruin's
             levels of service as summarised by Still; danger begins around 4-5 per m^2 standing)
  D_TIGHT    4 per m^2: the edge of safe, for the sensitivity row only (never shown as a goal)
  M_BODY     62 kg, the world's average ADULT body mass (Walpole et al. 2012); children weigh less, so
             using it for everyone overestimates: the volumes below are upper bounds
  RHO        1,000 kg/m^3: a body is about as dense as water (0.97-1.06 g/cm^3 across sources)
  A_LONDON   1,572 km^2, Greater London's administrative area (Britannica)
  A_LAND     148.9e6 km^2, Earth's land area
  H_BURJ     828 m, the Burj Khalifa's height (the volume's human-scale anchor)

compile.py imports RESULTS, so the voice, captions, spine readout and claims.json can't disagree.
  python3 -I calc.py
"""
N = 8.2e9
D_SAFE, D_TIGHT = 2.0, 4.0
M_BODY = 62.0
RHO, RHO_LO, RHO_HI = 1000.0, 970.0, 1060.0
A_LONDON = 1572.0          # km^2
A_LAND = 148.9e6           # km^2
H_BURJ = 828.0             # m


def compute():
    area_safe = N / D_SAFE / 1e6                 # km^2
    area_tight = N / D_TIGHT / 1e6
    side_safe = area_safe ** 0.5                 # km, a square
    vol = N * M_BODY / RHO                       # m^3
    cube = vol ** (1 / 3)                        # m
    cube_lo, cube_hi = (N * M_BODY / RHO_HI) ** (1 / 3), (N * M_BODY / RHO_LO) ** (1 / 3)
    return {
        "area_safe_km2": area_safe, "area_tight_km2": area_tight, "side_safe_km": side_safe,
        "londons_safe": area_safe / A_LONDON, "londons_tight": area_tight / A_LONDON,
        "land_frac": area_safe / A_LAND,
        "vol_m3": vol, "vol_km3": vol / 1e9, "cube_m": cube, "cube_lo_m": cube_lo, "cube_hi_m": cube_hi,
        "cube_vs_burj": cube / H_BURJ,
    }


V = compute()
RESULTS = {
    "population_bn": 8.2,
    "area_safe_km2": round(V["area_safe_km2"], -2),        # ≈ 4,100
    "side_safe_km": round(V["side_safe_km"]),              # ≈ 64
    "londons_safe": round(V["londons_safe"], 1),            # ≈ 2.6
    "area_tight_km2": round(V["area_tight_km2"], -2),      # ≈ 2,100
    "land_pct": round(100 * V["land_frac"], 3),             # ≈ 0.003 %
    "vol_km3": round(V["vol_km3"], 1),                      # ≈ 0.5
    "cube_m": round(V["cube_m"], -1),                       # ≈ 800
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:16s} {v:.6g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:16s} {v}")

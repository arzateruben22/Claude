"""Back of the Envelope No. 003, "All the ants": every number the episode says or shows.

Put every ant on Earth on one side of a scale and every human on the other. Biomass is compared as carbon
(dry weight's carbon), the unit both censuses use, so no conversion factor is assumed. Inputs (sources in
claims.json):

  N_ANTS     2.0e16 ants (Schultheiss et al., PNAS 2022: "20 × 10^15", a conservative estimate)
  ANTS_C     12 Mt of carbon (same paper); published estimates span about 3.6-50 Mt (Fayle & Klimeš, PNAS comment)
  HUMANS_C   60 Mt of carbon = 0.06 Gt C (Bar-On, Phillips & Milo, PNAS 2018)
  N_PEOPLE   8.2e9 (UN WPP 2024), for "ants per person" only
  WILSON     the 1994 estimate (Hölldobler & Wilson, Journey to the Ants): about 1e16 ants, about equal to
             humanity's weight

compile.py imports RESULTS.   python3 -I calc.py
"""
N_ANTS = 2.0e16
ANTS_C = 12.0          # Mt C
ANTS_C_LO, ANTS_C_HI = 3.6, 50.0
HUMANS_C = 60.0        # Mt C
N_PEOPLE = 8.2e9
N_WILSON = 1.0e16


def compute():
    return {
        "ratio": ANTS_C / HUMANS_C,
        "ratio_lo": ANTS_C_LO / HUMANS_C, "ratio_hi": ANTS_C_HI / HUMANS_C,
        "ants_per_person": N_ANTS / N_PEOPLE,
        "carbon_per_ant_mg": ANTS_C * 1e15 / N_ANTS,             # Mt → mg (1 Mt = 10^15 mg)
        "count_vs_wilson": N_ANTS / N_WILSON,
    }


V = compute()
RESULTS = {
    "ants_quadrillion": 20,
    "ratio_pct": round(100 * V["ratio"]),                 # 20 %
    "ratio_fraction": "a fifth",
    "ants_per_person_m": round(V["ants_per_person"] / 1e6 * 2) / 2,   # 2.44 million, said and shown as "about 2.5 million" (to the nearest half)
    "count_vs_wilson": round(V["count_vs_wilson"]),      # 2×
    "ratio_hi_pct": round(100 * V["ratio_hi"]),           # 83 %: even the highest estimate is under us
    "ratio_lo_pct": round(100 * V["ratio_lo"]),           # 6 %
}

if __name__ == "__main__":
    for k, v in V.items():
        print(f"{k:20s} {v:.6g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:20s} {v}")

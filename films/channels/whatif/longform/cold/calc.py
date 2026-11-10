"""Possibility Lab long form, Season 3 episode 3, "What If It Got Colder Every Second and Couldn't Stop?": every number the film says or shows.

A thought experiment: the temperature around you falls steadily, from a mild 20 degrees C toward absolute zero, and nothing can stop it; you wear an imaginary suit that keeps you alive,
so the film is about what the cold does to the WORLD. One big live number: the temperature (degrees C, with kelvin and degrees F under it). Milestones are phase changes at one atmosphere.

  kelvin K = C + 273.15;   F = 1.8 C + 32;   C and F agree at -40.
  liquid air layer   h = (p0 / g) / rho_liquid_air       (if all the air condensed into a liquid film over the planet)
  the Earth's atmosphere: p0 = 101,325 Pa, g = 9.80665 m/s^2, liquid air density about 870 kg/m^3
  zero point         T -> 0 K is approached but never reached (third law of thermodynamics)
Inputs are CANDIDATE values; claims.json says which were read (none has been opened by a person).
"""
import math

P0, G, RHO_LAIR = 101_325.0, 9.80665, 870.0
C2K = 273.15
POINTS = {                                   # degrees C at one atmosphere
    "freezing": 0.0, "sea_water": -1.9, "c_equals_f": -40.0, "co2_dry_ice": -78.5, "vostok": -89.2, "co2_frost_in_air": -141.0,
    "oxygen_boils": -183.0, "argon_boils": -185.9, "nitrogen_boils": -195.8, "hydrogen_boils": -252.9, "helium_boils": -268.9, "zero": -273.15,
}
K = {k: v + C2K for k, v in POINTS.items()}
F = {k: 1.8 * v + 32 for k, v in POINTS.items()}
LIQ_AIR_M = P0 / G / RHO_LAIR
BOOMERANG_K = 1.0
LAB_PK = 38.0                                # the coldest temperature reported in a lab, picokelvin
RESULTS = {
    "kelvin": {k: round(v, 2) for k, v in K.items()}, "fahrenheit": {k: round(v, 1) for k, v in F.items()},
    "liquid_air_m": round(LIQ_AIR_M, 1), "t0_c": 20.0, "t0_k": 20.0 + C2K, "lab_pk": LAB_PK, "boomerang_k": BOOMERANG_K,
    "ratio_he_to_zero_k": round(K["helium_boils"], 2),
}
if __name__ == "__main__":
    for k, v in RESULTS.items():
        print(k, v)


# ---- v2: air is a MIXTURE (Clausius-Clapeyron + Raoult; rough estimates, redo from NIST curves) ----
import math as _m
_R = 8.314462618
def _psat(T, Lv, Tb, P0=101325.0):
    return P0 * _m.exp(-Lv / _R * (1 / T - 1 / Tb))
_N2 = (5570.0, 77.36); _O2 = (6820.0, 90.19)
_xn, _xo = 0.788, 0.212            # N2/O2 only (argon dissolves in the liquid)
def _mix_psat(T):                  # liquid ~ air composition
    return _xn * _psat(T, *_N2) + _xo * _psat(T, *_O2)
def _solve(f, lo, hi):
    for _ in range(80):
        mid = (lo + hi) / 2
        (lo, hi) = (mid, hi) if f(mid) < 0 else (lo, mid)
    return (lo + hi) / 2
BUBBLE_K = _solve(lambda T: _mix_psat(T) - 101325.0, 60, 100)
# dew point: sum(y_i P / Psat_i) = 1 at total P = 1 atm with y = air
DEW_K = _solve(lambda T: -(_xn * 101325 / _psat(T, *_N2) + _xo * 101325 / _psat(T, *_O2) - 1.0), 60, 100)
GAS_LEFT = {c: round(min(1.0, _mix_psat(c + 273.15) / 101325.0), 3) for c in (-196, -200, -203, -210, -216, -223)}
PARTIAL_PA = {"Ne": 18.2e-6 * 101325, "H2": 0.55e-6 * 101325, "He": 5.24e-6 * 101325}
_TR = {"Ne": (1730.0, 27.07), "H2": (900.0, 20.28), "He": (83.0, 4.22)}
TRACE_FROST_K = {g: round(_solve(lambda T, g=g: _psat(T, *_TR[g]) - PARTIAL_PA[g], 0.3, 40), 2) for g in _TR}
if __name__ == "__main__":
    print("bubble", round(BUBBLE_K, 1), "K =", round(BUBBLE_K - 273.15, 1), "C; dew", round(DEW_K, 1), "K =", round(DEW_K - 273.15, 1), "C")
    print("gas left (fraction of air) at C:", GAS_LEFT)
    print("trace partial Pa:", {k: round(v, 3) for k, v in PARTIAL_PA.items()}, "frost K:", TRACE_FROST_K)

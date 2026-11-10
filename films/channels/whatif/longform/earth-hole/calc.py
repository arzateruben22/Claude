"""Possibility Lab long form, Season 3 episode 2, "What If You Fell Into a Hole Through the Earth?": every number the film says or shows.

A frictionless, airless tube from pole to pole through the centre; you let go at the surface. Inside a UNIFORM-density Earth the pull is g(x) = g0 x / R (x = your distance from the centre), so you
move in simple harmonic motion:   x(t) = R cos(w t),  w = sqrt(GM / R^3) = sqrt(g0 / R)
  period            T = 2 pi / w            (the same as a low orbit's period)
  fall to far side  T / 2
  speed at depth d  v = w sqrt(R^2 - (R - d)^2),  peak v = w R at the centre
  time to depth d   t = acos((R - d) / R) / w
Real Earth is denser at the core (PREM): the pull is a little stronger down to the core, so the trip is a little faster and shorter; claims.json carries that as an OPEN source.
Inputs are CANDIDATE values; everything else is arithmetic.
"""
import math

GM = 3.986004418e14       # m^3 / s^2
R = 6_371_000.0           # m, mean radius
G0 = GM / R**2
W = math.sqrt(GM / R**3)
T = 2 * math.pi / W
V_MAX = W * R
DEPTHS_KM = {"crust": 35.0, "moho_deep": 70.0, "mantle_mid": 1500.0, "cmb": 2890.0, "icb": 5150.0, "centre": 6371.0}


def at_depth(d_km):
    d = d_km * 1000.0
    x = R - d
    v = W * math.sqrt(max(0.0, R * R - x * x))
    t = math.acos(max(-1.0, min(1.0, x / R))) / W
    g = G0 * x / R
    return {"depth_km": d_km, "t_s": t, "t_min": t / 60, "v_ms": v, "v_kmh": v * 3.6, "g": g}


ROWS = {k: at_depth(d) for k, d in DEPTHS_KM.items()}
RESULTS = {
    "g0": round(G0, 2), "T_min": round(T / 60, 1), "half_min": round(T / 120, 1), "vmax_kms": round(V_MAX / 1000, 2), "vmax_kmh": round(V_MAX * 3.6 / 100) * 100,
    "orbit_min": round(2 * math.pi * math.sqrt(R**3 / GM) / 60, 1),
    "after_60s": {"depth_km": round(0.5 * G0 * 60**2 / 1000, 1), "v_ms": round(G0 * 60)},
    "rows": {k: {"depth_km": v["depth_km"], "t_min": round(v["t_min"], 1), "v_kms": round(v["v_ms"] / 1000, 2), "v_kmh": round(v["v_kmh"] / 100) * 100, "g": round(v["g"], 2)} for k, v in ROWS.items()},
    "oscillations_per_day": round(86400 / T, 1),
}
if __name__ == "__main__":
    for k, v in RESULTS.items():
        print(k, v)


# ---- PREM-like real Earth: speed at the centre from v = sqrt(2 * integral g dr) (rough; g anchors from PREM) ----
# (radius km, g m/s^2): centre, inner-core boundary, core-mantle boundary, mid-mantle, surface
_G = [(0, 0.0), (1221.5, 4.40), (3480.0, 10.68), (4925.0, 10.05), (6371.0, 9.82)]
PREM_INT_G = sum((a[1] + b[1]) / 2 * (b[0] - a[0]) * 1e3 for a, b in zip(_G, _G[1:]))
PREM_V_CENTRE_KMS = (2 * PREM_INT_G) ** 0.5 / 1e3
if __name__ == "__main__":
    print("PREM-like: integral g dr = %.3e m2/s2, v_centre = %.2f km/s (uniform Earth 7.91)" % (PREM_INT_G, PREM_V_CENTRE_KMS))

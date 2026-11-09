"""Possibility Lab long-form pilot, "What If Earth Spun Faster and Couldn't Stop?": every number the film says or shows.

Inputs are CANDIDATE values (claims.json says which were read; none has been opened by a person yet). Everything else is arithmetic.

  speed at the equator      v = 2 pi R / T
  centrifugal acceleration  a = (2 pi / T)^2 R        (the push outward that you feel as lost weight)
  pull of gravity           g0 = GM / R^2             (mass attraction only, at the equator radius)
  you weigh                 w = 1 - a / g0
  float / orbital speed     a = g0  =>  T_orb = 2 pi sqrt(R^3 / GM), v_orb = sqrt(GM / R)
  ocean potential rise      dh = (w^2 - w0^2) R^2 / (2 g0)   equator vs pole (the extra height the sea "wants" at the equator
                            relative to the pole, before the ground adjusts; far more than the ocean is deep, so it drains toward the equator)
  wind relative to ground   (v_new - v_old) if the air has not yet been dragged along (first hours only)
  spin energy               E = 1/2 I w^2, I = 0.3307 M R^2 (the Earth is denser at the core)
"""
import math

GM = 3.986004418e14          # m^3 / s^2, Earth's gravitational parameter
R = 6_378_137.0              # m, equatorial radius
T0 = 86_164.0905             # s, sidereal day today (23 h 56 min 4 s)
M = 5.9722e24                # kg
I_FACTOR = 0.3307            # moment of inertia / (M R^2)
SOLAR = 1361.0               # W/m^2 at Earth
YEAR = 365.25 * 86400
G0 = GM / R**2
W0 = 2 * math.pi / T0
STEPS_H = [23.934, 12.0, 6.0, 3.0, 2.0, 1.5]   # the day lengths the film passes through, in hours


def at(T):
    w = 2 * math.pi / T
    a = w * w * R
    return {"T_h": T / 3600, "v_ms": w * R, "v_kmh": w * R * 3.6, "a": a, "weight": 1 - a / G0,
            "dh_km": (w * w - W0 * W0) * R * R / (2 * G0) / 1000, "wind_ms": w * R - W0 * R,
            "sun_cross_min": T / 2 / 60}


T_ORB = 2 * math.pi * math.sqrt(R**3 / GM)
V_ORB = math.sqrt(GM / R)
E_NOW = 0.5 * I_FACTOR * M * R**2 * W0**2
W_ORB = 2 * math.pi / T_ORB
E_ORB = 0.5 * I_FACTOR * M * R**2 * W_ORB**2
SUN_POWER = SOLAR * math.pi * R**2
V = {k: at(h * 3600) for k, h in zip(["now", "h12", "h6", "h3", "h2", "h1_5"], STEPS_H)}

RESULTS = {
    "g0": round(G0, 2), "t_orb_min": round(T_ORB / 60, 1), "t_orb_h": round(T_ORB / 3600, 2), "v_orb_kms": round(V_ORB / 1000, 2),
    "v_now_ms": round(V["now"]["v_ms"]), "v_now_kmh": round(V["now"]["v_kmh"]), "weight_now_pct": round(100 * V["now"]["weight"], 2),
    "ocean_now_km": round(V["now"]["dh_km"], 1),
    "rows": {k: {"T_h": v["T_h"], "v_kms": round(v["v_ms"] / 1000, 2), "v_kmh": round(v["v_kmh"]), "weight_pct": round(100 * v["weight"], 1),
                 "dh_km": round(v["dh_km"]), "wind_ms": round(v["wind_ms"]), "sun_min": round(v["sun_cross_min"])} for k, v in V.items()},
    "e_now_j": E_NOW, "e_orb_j": E_ORB, "ratio": E_ORB / E_NOW, "sun_years_my": E_ORB / SUN_POWER / YEAR / 1e6,
}

if __name__ == "__main__":
    for k, v in RESULTS.items():
        print(k, v)

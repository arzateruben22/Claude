"""Back of the Envelope No. 001, "Through the Earth": every number the episode says or shows.

A straight tunnel through Earth's centre, no air, no heat, no spin (the honesty badges). Three
models of Earth's interior, each a fall time from the surface to the far surface:

  uniform     every layer as dense as the average: simple harmonic motion, T = pi*sqrt(R^3/GM)
              (Cooper 1966, the textbook "42 minutes")
  prem        the Preliminary Reference Earth Model's density, from seismology (Dziewonski &
              Anderson 1981): g(r) = G*M(<r)/r^2, speed from energy, time = 2*integral dr/v
              (Klotz 2015: about 38 minutes)
  constant g  gravity stays at its surface value all the way down (Klotz's shortcut: 38 min flat)

compile.py imports RESULTS, so the voice, captions, spine readout and claims.json can't disagree.
Run it to print every value and the sensitivity table:  python3 -I calc.py
SI units throughout; only RESULTS rounds, the way the film says it.
"""
import math

G = 6.6743e-11            # m^3 kg^-1 s^-2, CODATA 2018 (NIST)
R = 6371.0e3              # m, Earth's volumetric mean radius (NASA Earth fact sheet)
M_FACT = 5.9722e24        # kg, Earth's mass (NASA Earth fact sheet), for the uniform model
G_SURF = 9.80             # m/s^2, mean surface gravity used for "constant g" (NASA: 9.80 m/s^2)
CAR = 100.0 / 3.6         # m/s, driving at 100 km/h, the human-scale anchor

# PREM density, g/cm^3, as polynomials in x = r / 6371 km (Dziewonski & Anderson 1981, table 1).
PREM = [  # (r_top km, coefficients a0, a1, a2, a3)
    (1221.5, (13.0885, 0.0, -8.8381, 0.0)),           # inner core
    (3480.0, (12.5815, -1.2638, -3.6426, -5.5281)),   # outer core
    (5701.0, (7.9565, -6.4761, 5.5283, -3.0807)),     # lower mantle
    (5771.0, (5.3197, -1.4836, 0.0, 0.0)),            # transition zone
    (5971.0, (11.2494, -8.0298, 0.0, 0.0)),
    (6151.0, (7.1089, -3.8045, 0.0, 0.0)),
    (6346.6, (2.6910, 0.6924, 0.0, 0.0)),             # LVZ and lid
    (6356.0, (2.900, 0.0, 0.0, 0.0)),                 # lower crust
    (6368.0, (2.600, 0.0, 0.0, 0.0)),                 # upper crust
    (6371.0, (1.020, 0.0, 0.0, 0.0)),                 # ocean
]


def rho_prem(r):
    """PREM density at radius r (m), in kg/m^3."""
    km, x = r / 1e3, r / R
    for top, a in PREM:
        if km <= top:
            return 1000.0 * (a[0] + a[1] * x + a[2] * x * x + a[3] * x ** 3)
    return 0.0


def prem_profile(n=200_000):
    """Radius grid, enclosed mass and gravity for PREM (midpoint shells)."""
    dr = R / n
    rs, ms, gs, m = [0.0], [0.0], [0.0], 0.0
    for i in range(n):
        r0, r1 = i * dr, (i + 1) * dr
        rm = 0.5 * (r0 + r1)
        m += 4 * math.pi * rm * rm * rho_prem(rm) * dr
        rs.append(r1); ms.append(m); gs.append(G * m / (r1 * r1))
    return rs, ms, gs


def fall_time(rs, gs):
    """Surface to far surface along a diameter: v(r)^2 = 2*integral_r^R g dr, t = 2*integral_0^R dr/v."""
    n = len(rs) - 1
    pot = [0.0] * (n + 1)                      # integral from r to R of g
    for i in range(n - 1, -1, -1):
        pot[i] = pot[i + 1] + 0.5 * (gs[i] + gs[i + 1]) * (rs[i + 1] - rs[i])
    t = 0.0
    for i in range(n - 1):                     # the last cell (v -> 0 at the surface) analytically:
        v = math.sqrt(2 * 0.5 * (pot[i] + pot[i + 1]))
        t += (rs[i + 1] - rs[i]) / v
    dr_last, g_s = rs[n] - rs[n - 1], gs[n]
    t += math.sqrt(2 * dr_last / g_s)          # from rest, under ~constant g, across the last cell
    return 2 * t, math.sqrt(2 * pot[0])        # (trip time s, speed at the centre m/s)


def compute():
    rs, ms, gs = prem_profile()
    t_prem, v_prem = fall_time(rs, gs)
    m_prem = ms[-1]
    t_uniform = math.pi * math.sqrt(R ** 3 / (G * M_FACT))
    v_uniform = math.sqrt(G * M_FACT / R)
    t_constg = 2 * math.sqrt(2 * R / G_SURF)
    v_constg = math.sqrt(2 * G_SURF * R)
    t_orbit_half = math.pi * math.sqrt(R ** 3 / (G * M_FACT))       # half a surface-skimming orbit
    core_r = 3480e3
    core_mass_frac = ms[int(len(ms) * core_r / R)] / m_prem
    core_vol_frac = (core_r / R) ** 3
    rho_mean = m_prem / (4 / 3 * math.pi * R ** 3)
    rho_core_mean = ms[int(len(ms) * core_r / R)] / (4 / 3 * math.pi * core_r ** 3)
    rho_crust_mantle = (m_prem - ms[int(len(ms) * core_r / R)]) / (4 / 3 * math.pi * (R ** 3 - core_r ** 3))
    g_max = max(gs); r_gmax = rs[gs.index(g_max)]
    drive_h = 2 * R / CAR / 3600
    # sensitivity: scale the core's density by +-10% (mantle unchanged) and recompute
    sens = {}
    for k in (0.9, 1.1):
        def rho_k(r, k=k):
            return rho_prem(r) * (k if r < core_r else 1.0)
        n, dr = 50_000, R / 50_000
        rr, gg, m = [0.0], [0.0], 0.0
        for i in range(n):
            rm = (i + 0.5) * dr
            m += 4 * math.pi * rm * rm * rho_k(rm) * dr
            rr.append((i + 1) * dr); gg.append(G * m / ((i + 1) * dr) ** 2)
        sens[f"core density x{k}"] = fall_time(rr, gg)[0]
    return {
        "R_m": R, "diameter_m": 2 * R,
        "M_prem_kg": m_prem, "M_fact_kg": M_FACT, "mass_check": m_prem / M_FACT,
        "rho_mean": rho_mean, "rho_core_mean": rho_core_mean, "rho_crust_mantle_mean": rho_crust_mantle,
        "core_mass_frac": core_mass_frac, "core_vol_frac": core_vol_frac,
        "g_max": g_max, "r_gmax_km": r_gmax / 1e3,
        "t_prem_s": t_prem, "v_prem_ms": v_prem,
        "t_uniform_s": t_uniform, "v_uniform_ms": v_uniform,
        "t_constg_s": t_constg, "v_constg_ms": v_constg,
        "t_orbit_half_s": t_orbit_half,
        "drive_h": drive_h,
        "sensitivity_s": sens,
    }


V = compute()

# What the film says and shows, rounded the way it is said. compile.py reads these.
RESULTS = {
    "diameter_km": round(V["diameter_m"] / 1e3, -2),           # "about twelve thousand seven hundred km"
    "drive_days": round(V["drive_h"] / 24),                    # nonstop at 100 km/h
    "t_prem_min": round(V["t_prem_s"] / 60),                   # 38
    "t_uniform_min": round(V["t_uniform_s"] / 60),             # 42
    "t_constg_min": round(V["t_constg_s"] / 60),               # 38
    "v_prem_kms": round(V["v_prem_ms"] / 1e3),                 # top speed at the centre
    "v_uniform_kms": round(V["v_uniform_ms"] / 1e3, 1),
    "core_density_ratio": round(V["rho_core_mean"] / V["rho_crust_mantle_mean"], 1),
    "core_mass_pct": round(100 * V["core_mass_frac"]),
    "core_vol_pct": round(100 * V["core_vol_frac"]),
    "sens_core_minus10_min": round(V["sensitivity_s"]["core density x0.9"] / 60),
    "sens_core_plus10_min": round(V["sensitivity_s"]["core density x1.1"] / 60),
}

if __name__ == "__main__":
    for k, v in V.items():
        if isinstance(v, dict):
            for kk, vv in v.items():
                print(f"  {k}[{kk}] = {vv:.1f} s = {vv / 60:.2f} min")
        else:
            print(f"{k:24s} {v:.6g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:24s} {v}")

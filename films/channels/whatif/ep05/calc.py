"""Back of the Envelope No. 005, "Everybody jump": every number the episode says or shows.

Everyone alive gathers in one place (the badge: a thought experiment; spread round the globe, the pushes
would point in different directions and mostly cancel) and jumps straight up at the same instant. Momentum
is conserved: while we are in the air, the Earth moves the other way so the shared centre of mass stays put,

  Earth's shift  d = N * m * h / M_earth

and when we land it comes back. Everything here is that one line, its inputs with units and sources, and
the comparisons the film shows (an atom, the jump itself), plus a sensitivity table.

compile.py imports RESULTS, so the voice, captions, spine readout and claims.json can't disagree.
Run it to print every value:  python3 -I calc.py
"""
import math

N = 8.2e9                 # people, mid-2024 (UN World Population Prospects 2024), as No. 002
M_BODY = 62.0             # kg, the world's average ADULT body mass (Walpole et al. 2012); children weigh less: an upper bound
H_JUMP = 0.40             # m, the rise of a standing jump: adult norms run about 0.30-0.50 m (men about 0.45, women 0.30)
M_EARTH = 5.9722e24       # kg (NASA Earth fact sheet)
G = 9.81                  # m/s^2
A0 = 5.29177210544e-11    # m, the Bohr radius (CODATA 2022, NIST); a hydrogen atom is about 2 a0 across
ATOM = 2 * A0             # m, "the width of an atom" (hydrogen, the smallest)


def shift(n=N, m=M_BODY, h=H_JUMP):
    """How far the Earth moves (m) while everyone is at the top of the jump."""
    return n * m * h / M_EARTH


def compute():
    m_all = N * M_BODY
    d = shift()
    v_off = math.sqrt(2 * G * H_JUMP)                      # take-off speed of a jump that rises h
    v_earth = m_all * v_off / M_EARTH                      # the Earth's recoil speed at take-off
    t_air = 2 * v_off / G                                  # seconds in the air
    sens = {
        "jump 0.30 m": shift(h=0.30),
        "jump 0.50 m": shift(h=0.50),
        "everyone 31 kg (half)": shift(m=M_BODY / 2),
        "everyone 62 kg, jump 0.5 m, 10 bn people": shift(n=10e9, h=0.50),
    }
    return {
        "m_all_kg": m_all, "earth_over_us": M_EARTH / m_all, "shift_m": d, "atoms_per_shift": ATOM / d,
        "shift_over_atom": d / ATOM, "jump_over_shift": H_JUMP / d,
        "v_off_ms": v_off, "v_earth_ms": v_earth, "t_air_s": t_air,
        "sensitivity_m": sens, "sens_atoms_min": ATOM / max(sens.values()), "sens_atoms_max": ATOM / min(sens.values()),
    }


V = compute()


def sci(x, sig=1):
    """x as (mantissa, exponent) to `sig` significant figures: 2.5e-14 -> (2.5, -14)."""
    e = math.floor(math.log10(abs(x)))
    m = round(x / 10 ** e, sig - 1)
    if m >= 10:
        m, e = m / 10, e + 1
    return (int(m) if sig == 1 else m), e


# What the film says and shows, rounded the way it is said. compile.py reads these.
RESULTS = {
    "population_bn": 8.2,
    "body_kg": int(M_BODY),
    "jump_cm": int(round(H_JUMP * 100)),
    "m_all_tn": round(V["m_all_kg"] / 1e12, 1),              # all of us: 0.5 trillion kg
    "m_all_mt": int(round(V["m_all_kg"] / 1e9, -1)),         # ... = 510 million tonnes (1e9 kg = 1 Mt)
    "earth_kg_sci": sci(M_EARTH, 2),                          # (6.0, 24)
    "earth_over_us_sci": sci(V["earth_over_us"], 1),          # (1, 13): ten trillion times heavier
    "shift_sci": sci(V["shift_m"], 1),                        # (3, -14) m
    "atom_pm": int(round(ATOM * 1e12, -1)),                   # 110 pm (hydrogen)
    "atoms_per_shift": int(round(V["atoms_per_shift"], -2)),  # an atom is ~3,000 times wider than the shift
    "air_s": round(V["t_air_s"], 1),
    "sens_atoms_min": int(round(V["sens_atoms_min"], -2)),
    "sens_atoms_max": int(round(V["sens_atoms_max"], -2)),
}

if __name__ == "__main__":
    for k, v in V.items():
        if isinstance(v, dict):
            for kk, vv in v.items():
                print(f"  {k}[{kk}] = {vv:.3g} m  (an atom is {ATOM / vv:,.0f}x wider)")
        else:
            print(f"{k:24s} {v:.6g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:24s} {v}")

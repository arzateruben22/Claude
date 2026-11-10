"""Reality Rulebook long-form pilot (folder lf01): "Slow Down One Second Until Light Stands Still".

Every number the film says or draws comes from this file. Run:  python3 -I films/channels/physics/lf01/calc.py
It asserts the arithmetic, prints the table the script quotes, and writes calc.json (the compiler and the scene read it).

Inputs (all hedged in the script; ranges are the honest uncertainty, the film uses one round value):
  - speed of light in vacuum c = 299,792,458 m/s (exact, by definition of the metre)
  - speed of sound in air at 20 C: 343 m/s
  - hummingbird wingbeat: about 50 per second (small species run higher; the film says "about fifty")
  - housefly wingbeat: about 200 per second
  - the bullet of Edgerton's famous bullet-through-apple photo: a .30-calibre bullet at about 2,800 ft/s = 850 m/s (rifle bullets run about 700-1,000 m/s); apple width 8 cm; a 1 m table
  - a soap film retracts when it pops at v = sqrt(2 gamma / (rho h)) (Taylor-Culick), gamma = 0.025 N/m, rho = 1000 kg/m3, h = 1 micrometre
  - lightning stepped leader: steps tens of metres long taking about a microsecond, pauses of tens of microseconds (the film says "about")
  - return stroke: about one third of the speed of light
  - a 3 GHz processor ticks every 1/3 nanosecond
  - the kitchen is 5 m across
The slow-motion factor F means: one second of real time is stretched to F seconds on screen.
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
C = 299_792_458.0
V_SOUND = 343.0
HUMMING_HZ, FLY_HZ, MOSQUITO_HZ = 50.0, 200.0, 500.0
BULLET_MS, APPLE_M, TABLE_M = 850.0, 0.08, 1.0
GAMMA, RHO_W, H_FILM = 0.025, 1000.0, 1.0e-6
BUBBLE_R = 0.025            # a bubble about as wide as an egg: diameter 5 cm
KITCHEN_M = 5.0
LEADER_STEP_S, LEADER_STEP_M = 1.0e-6, 50.0
RETURN_V = C / 3
CPU_HZ = 3.0e9
SNAIL_MS = 1.0e-3
FACTORS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12]


def human(seconds):
    """'1 real second now lasts ...' in the words the counter shows."""
    units = [("second", 1), ("minute", 60), ("hour", 3600), ("day", 86400), ("year", 365.25 * 86400)]
    best = units[0]
    for u in units:
        if seconds >= u[1]:
            best = u
    n = seconds / best[1]
    if best[0] == "year" and n >= 1000:
        return f"{n:,.0f} years", n
    if n >= 100:
        s = f"{n:,.0f}"
    elif n >= 10:
        s = f"{n:.0f}"
    else:
        s = f"{n:.1f}".rstrip("0").rstrip(".")
    return f"{s} {best[0]}{'' if s == '1' else 's'}", n


rows = []
for F in FACTORS:
    txt, n = human(F)
    rows.append({"factor": F, "lasts": txt, "lasts_s": F})
# the beats ---------------------------------------------------------------------------------------------------------
out = {"c": C, "rows": rows}
out["wings"] = {k: {"hz": hz, "per_slow_s_at": {str(int(F)): hz / F for F in (1, 10, 100)}} for k, hz in
                (("hummingbird", HUMMING_HZ), ("housefly", FLY_HZ), ("mosquito", MOSQUITO_HZ))}
assert out["wings"]["hummingbird"]["per_slow_s_at"]["10"] == 5.0 and out["wings"]["housefly"]["per_slow_s_at"]["100"] == 2.0
v_pop = math.sqrt(2 * GAMMA / (RHO_W * H_FILM))                       # Taylor-Culick speed of the bursting hole's edge
t_bubble = (math.pi * BUBBLE_R) / v_pop                              # the hole's edge runs from the puncture to the far side: half a great circle, pi R
out["bubble"] = {"v": v_pop, "t_s": t_bubble, "slow_1000_s": t_bubble * 1e3}
t_room_sound = KITCHEN_M / V_SOUND
out["sound"] = {"room_s": t_room_sound, "slow_1000_s": t_room_sound * 1e3, "slow_1e4_s": t_room_sound * 1e4}
t_apple = APPLE_M / BULLET_MS
out["bullet"] = {"v": BULLET_MS, "apple_m": APPLE_M, "t_s": t_apple, "slow_1e4_s": t_apple * 1e4, "mach": BULLET_MS / V_SOUND, "table_s": TABLE_M / BULLET_MS, "table_slow_1e4_s": TABLE_M / BULLET_MS * 1e4}
DESCENT_S = 20e-3          # the whole stepped-leader descent takes tens of milliseconds (20 ms used)
out["leader"] = {"step_s": LEADER_STEP_S, "step_m": LEADER_STEP_M, "slow_1e6_step_s": LEADER_STEP_S * 1e6,
                 "pause_slow_1e6_s": [30e-6 * 1e6, 50e-6 * 1e6], "descent_s": DESCENT_S, "descent_slow_1e6_s": DESCENT_S * 1e6, "descent_slow_1e6_h": DESCENT_S * 1e6 / 3600}
out["return"] = {"v": RETURN_V, "km3_s": 3000 / RETURN_V, "slow_1e6_s": 3000 / RETURN_V * 1e6}
out["light"] = {"m_per_ns": C * 1e-9, "room_s": KITCHEN_M / C,
                "at": {str(int(F)): {"speed_m_per_slow_s": C / F, "room_slow_s": KITCHEN_M / C * F} for F in (1e6, 1e8, 1e9, 1e10, 1e11, 1e12)}}
assert abs(out["light"]["m_per_ns"] - 0.2998) < 1e-4
assert abs(out["light"]["at"]["1000000000"]["speed_m_per_slow_s"] - 0.2998) < 1e-4          # 30 cm per second at a billion times slower
assert abs(out["light"]["at"]["1000000000000"]["speed_m_per_slow_s"] - 0.0002998) < 1e-7    # 0.3 mm per second at a trillion times slower
out["light"]["snail_ratio_1e12"] = out["light"]["at"]["1000000000000"]["speed_m_per_slow_s"] / SNAIL_MS
out["cpu"] = {"hz": CPU_HZ, "tick_s": 1 / CPU_HZ, "ticks_per_slow_s_at_1e9": CPU_HZ / 1e9, "ticks_per_slow_s_at_1e8": CPU_HZ / 1e8}
assert abs(out["cpu"]["ticks_per_slow_s_at_1e9"] - 3.0) < 1e-9
out["hair"] = {"m": 1.0e-4, "light_s": 1.0e-4 / C, "slow_1e12_s": 1.0e-4 / C * 1e12}
assert abs(out["hair"]["slow_1e12_s"] - 0.3336) < 1e-3
out["thunder"] = {"s_per_km": 1000.0 / V_SOUND}
out["femto"] = {"fps": 1e12, "playback_fps": 30.0, "slow_factor_playback": 1e12 / 30.0}
if __name__ == "__main__":
    (HERE / "calc.json").write_text(json.dumps(out, indent=1))
    print("factor            1 real second now lasts")
    for r in rows:
        print(f"{r['factor']:>16,.0f}  {r['lasts']}")
    print(f"wings: hummingbird {HUMMING_HZ:.0f}/s -> {HUMMING_HZ/10:.0f}/s at 10x; fly {FLY_HZ:.0f}/s -> {FLY_HZ/100:.0f}/s at 100x; mosquito {MOSQUITO_HZ:.0f}/s -> {MOSQUITO_HZ/100:.0f}/s at 100x")
    print(f"soap film hole speed {v_pop:.1f} m/s; a 5 cm wide bubble (R 2.5 cm) pops in ~{t_bubble*1e3:.0f} ms -> {t_bubble*1e3:.0f} s at 1,000x")
    print(f"sound across {KITCHEN_M:.0f} m: {t_room_sound*1e3:.1f} ms -> {t_room_sound*1e3:.1f} s at 1,000x, {t_room_sound*1e4:.0f} s at 10,000x")
    print(f"bullet {BULLET_MS:.0f} m/s through {APPLE_M*100:.0f} cm: {t_apple*1e6:.0f} microseconds -> {t_apple*1e4:.2f} s at 10,000x (Mach {BULLET_MS/V_SOUND:.1f}); a {TABLE_M:.0f} m table: {TABLE_M/BULLET_MS*1e3:.2f} ms -> {TABLE_M/BULLET_MS*1e4:.1f} s at 10,000x")
    print(f"whole stepped-leader descent ~{DESCENT_S*1e3:.0f} ms -> {DESCENT_S*1e6/3600:.1f} hours at 1,000,000x; pauses 30-50 microseconds -> 30-50 s")
    print(f"leader step {LEADER_STEP_S*1e6:.0f} microsecond -> {LEADER_STEP_S*1e6:.0f} s at 1,000,000x; return stroke 3 km in {3000/RETURN_V*1e6:.0f} microseconds -> {3000/RETURN_V*1e6:.0f} s at 1,000,000x")
    print(f"light: {C*1e-9*100:.1f} cm per nanosecond; at 1e9x {C/1e9*100:.0f} cm per slowed second, room in {KITCHEN_M/C*1e9:.1f} s; at 1e12x {C/1e12*1000:.2f} mm per slowed second, room in {KITCHEN_M/C*1e12/3600:.1f} h, {out['light']['snail_ratio_1e12']:.2f} of a snail's pace")
    print(f"at 1e8x a flash crosses the room in {KITCHEN_M/C*1e8:.2f} s; the chip ticks {CPU_HZ/1e8:.0f} times per slowed second")
    print(f"3 GHz processor tick every {1e9/CPU_HZ:.2f} ns -> {CPU_HZ/1e9:.0f} ticks per slowed second at 1e9x")
    print(f"light crosses a 0.1 mm hair in {out['hair']['light_s']*1e12:.2f} ps -> {out['hair']['slow_1e12_s']:.2f} s at 1e12x; sound: {out['thunder']['s_per_km']:.1f} s per km")
    print(f"a trillion frames a second played back at 30 fps is {out['femto']['slow_factor_playback']:.2e}x")

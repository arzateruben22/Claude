"""calc.py: every number in "The Moon Starts Coming Closer. It Won't Stop." (long01), from its inputs.

Run: python3 -I calc.py          (prints the table; writes calc.json; asserts the headline numbers)

INPUTS (each a claim in claims.json; NASA fact sheets, read by a person before OK):
  D0   mean Earth-Moon distance           384,400 km    (NASA NSSDC Moon fact sheet)
  RM   Moon mean radius                    1,737.4 km   (same)
  RE   Earth equatorial radius             6,378.137 km (NASA NSSDC Earth fact sheet; the 6,371 km mean radius is used for Roche)
  rhoM Moon mean density                   3,344 kg/m3  (Moon fact sheet)
  rhoE Earth mean density                  5,514 kg/m3  (Earth fact sheet)
  GME  Earth GM                            398,600.4 km3/s2
  c    speed of light                      299,792.458 km/s
  REC  recession today                     3.8 cm/yr    (NASA/JPL, lunar laser ranging)
  SUN  Sun's angular diameter              ~0.53 deg    (mean; rounded)
Everything else is arithmetic: OWN INFERENCE, marked so in claims.json.
"""
import json, math

D0, RM, RE, RE_MEAN = 384_400.0, 1_737.4, 6_378.137, 6_371.0
rhoM, rhoE, GME, C = 3_344.0, 5_514.0, 398_600.4, 299_792.458
REC_CM_YR = 3.8
SUN_DEG = 0.53

def ang_deg(d): return 2 * math.degrees(math.atan(RM / d))          # Moon's angular diameter at centre distance d
def size_x(d): return ang_deg(d) / ang_deg(D0)                       # width in the sky vs today
def tide_x(d): return (D0 / d) ** 3                                  # tide-raising force vs today (1/d^3)
def light_x(d): return (D0 / d) ** 2                                 # full-Moon light vs today (1/d^2, same phase)
def period_h(d): return 2 * math.pi * math.sqrt(d ** 3 / GME) / 3600  # orbit period at distance d (Kepler, Earth's GM)
def light_s(d): return d / C

k = (rhoE / rhoM) ** (1 / 3)
ROCHE_FLUID = 2.44 * RE_MEAN * k                                     # Earth-centre distance, fluid-like Moon
ROCHE_RIGID = 1.26 * RE_MEAN * k                                     # rigid Moon
SYNC = (GME * (86164.1 / (2 * math.pi)) ** 2) ** (1 / 3)             # geostationary radius (sidereal day)

rows = []
for name, d in [("today", D0), ("3/4", D0 * 0.75), ("half", D0 / 2), ("150k", 150_000), ("100k", 100_000), ("70k", 70_000), ("50k", 50_000), ("Roche fluid", ROCHE_FLUID)]:
    rows.append(dict(name=name, km=round(d), angle_deg=round(ang_deg(d), 2), size_x=round(size_x(d), 1), tide_x=round(tide_x(d), 1),
                     light_x=round(light_x(d)), period_h=round(period_h(d), 1), light_s=round(light_s(d), 3)))

def over_km(d): return d - RE                                            # overhead: one Earth radius closer than centre-to-centre
def over_deg(d): return ang_deg(over_km(d))
# when does the Moon cross the geostationary radius? (it would rise in the west and set in the east below that)
out = dict(rows=rows, roche_fluid_km=round(ROCHE_FLUID), roche_rigid_km=round(ROCHE_RIGID), sync_km=round(SYNC),
           yrs_at_today_rate_to_half=round((D0 / 2) * 1e5 / REC_CM_YR / 1e6, 1),   # million years to move 192,200 km at 3.8 cm/yr
           recession_km_per_century=round(REC_CM_YR * 100 / 1e5, 6))
json.dump(out, open("calc.json", "w"), indent=1)
for r in rows: print(r)
print({k: v for k, v in out.items() if k != "rows"})

# asserts the script leans on
assert 18_000 < ROCHE_FLUID < 18_800 and 9_300 < ROCHE_RIGID < 9_800
assert abs(tide_x(D0 / 2) - 8) < 1e-9
assert 0.50 < ang_deg(D0) < 0.54
assert 20 < size_x(18_000) < 23                      # ~21x wider at 18,000 km
assert 400 < light_x(18_000) < 500                   # ~456x more light, same phase
assert 6 < period_h(18_000) < 7.5                    # ~6.7 h: faster than Earth turns
assert 42_000 < SYNC < 42_400
assert abs(size_x(D0*0.75)-1.333)<0.01 and 2.3 < tide_x(D0*0.75) < 2.4     # chapter 2
assert 2.5 < size_x(150_000) < 2.6 and 6.4 < light_x(150_000) < 6.7 and 6 < period_h(150_000)/24 < 7   # chapter 4 (~6.7 days)
assert 3.7 < size_x(100_000) < 3.9                 # chapter 5
assert 5.3 < size_x(70_000) < 5.7 and 160 < tide_x(70_000) < 170   # chapter 6
assert 7.5 < size_x(50_000) < 7.9 and 450 < tide_x(50_000) < 460   # chapter 7
assert 0.9 < light_s(D0*0.75) < 1.0 and 1.27 < light_s(D0) < 1.29   # light time
assert 10 < ang_deg(18_000) < 11.5 and 16 < over_deg(18_000) < 18 and 30 < over_deg(18_000) / ang_deg(D0) < 35   # horizon view 11 deg; overhead ~17 deg, ~33x                  # a fist at arm's length is ~10 deg

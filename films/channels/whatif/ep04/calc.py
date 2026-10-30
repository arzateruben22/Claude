"""Back of the Envelope No. 004, "Count to a billion": every number the episode says or shows.

Two ways to count from one to 1,000,000,000 out loud:

  naive   one number a second, nonstop: 10^9 s
  real    every number said in full in American English ("three hundred forty-seven million, ..."),
          at the pace of the one person who actually counted to a million on camera (Jeremy Harper,
          2007: 89 days, about 16 hours a day), awake and counting 16 hours a day, like him

Harper is the calibration, in syllables a second: the syllables of every number from one to a million,
divided by his counting time. Big numbers are long words, so the real count grows faster than the
numbers do. The syllable counts are exact (every group of three digits, counted by code, not sampled).

compile.py imports RESULTS, so the voice, captions, spine readout and claims.json can't disagree.
Run it to print every value and the sensitivity table:  python3 -I calc.py
"""

N = 10 ** 9                              # the target
YEAR_S = 365.25 * 86400                  # s, a Julian year
HARPER_DAYS = 89                         # Harper's count: 18 June to 14 September 2007 (Wikipedia; NPR)
HARPER_H_PER_DAY = 16                    # hours a day he counted (Wikipedia; Guinness's entry: live broadcasts)
HARPER_N = 10 ** 6                       # he counted to one million
AWAKE_H = 16                             # counting hours a day in the "real" model: Harper's own schedule
LIFE_YR = 73.3                           # world life expectancy at birth, 2024 (UN World Population Prospects 2024)

# syllables of the American English number words (no "and": "one hundred one")
ONES = {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 1, 9: 1, 10: 1, 11: 3, 12: 1, 13: 2, 14: 2, 15: 2,
        16: 2, 17: 3, 18: 2, 19: 2}
TENS = {2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 2, 9: 2}          # twenty ... ninety
HUNDRED, SCALE = 2, 2                                             # "hundred"; "thousand", "million", "billion"


def s3(n):
    """Syllables of 0 <= n < 1000 said in words (0 says nothing)."""
    h, r = divmod(n, 100)
    s = (ONES[h] + HUNDRED) if h else 0
    if r == 0:
        return s
    if r < 20:
        return s + ONES[r]
    t, o = divmod(r, 10)
    return s + TENS[t] + (ONES[o] if o else 0)


def syl(n):
    """Syllables of 1 <= n <= 10^9 said in full."""
    if n == N:
        return ONES[1] + SCALE                                     # "one billion"
    m, rest = divmod(n, 10 ** 6)
    k, u = divmod(rest, 1000)
    return (s3(m) + SCALE if m else 0) + (s3(k) + SCALE if k else 0) + s3(u)


S3 = [s3(x) for x in range(1000)]
T3 = sum(S3)                                                       # one group of three digits, all values
NZ = 999                                                           # nonzero groups


def total_to_billion():
    """Exact syllables from 1 to 10^9: each group (millions, thousands, units) takes every value 10^6
    times; a nonzero millions or thousands group adds its scale word."""
    return 10 ** 6 * (T3 + SCALE * NZ) + 10 ** 6 * (T3 + SCALE * NZ) + 10 ** 6 * T3 + syl(N)


def total_to_million():
    """Exact syllables from 1 to 10^6 (Harper's count)."""
    return 1000 * (T3 + SCALE * NZ) + 1000 * T3 + (ONES[1] + SCALE)


def compute():
    tb, tm = total_to_billion(), total_to_million()
    assert tm == sum(syl(n) for n in range(1, HARPER_N + 1))                       # brute force agrees
    harper_s = HARPER_DAYS * HARPER_H_PER_DAY * 3600
    rate = tm / harper_s                                                           # syllables a second, counting
    talk_s = tb / rate                                                             # seconds of counting to a billion
    real_yr = talk_s / (AWAKE_H * 3600) / 365.25                                   # calendar years at 16 h a day
    naive_yr = N / YEAR_S
    sens = {
        "nonstop (no sleep), Harper's pace": talk_s / YEAR_S,
        "twice Harper's pace, 16 h a day": real_yr / 2,
        "8 h a day (a working day)": talk_s / (8 * 3600) / 365.25,
    }
    return {
        "syl_total_billion": tb, "syl_total_million": tm,
        "syl_mean_billion": tb / N, "syl_mean_million": tm / HARPER_N,
        "syl_billion_word": syl(N), "syl_longest": syl(777_777_777),                     # one of the longest: 31 syllables
        "harper_s": harper_s, "harper_s_per_number": harper_s / HARPER_N, "rate_syl_s": rate,
        "talk_s": talk_s, "real_yr": real_yr, "naive_yr": naive_yr, "naive_days_to_million": HARPER_N / 86400,
        "s_per_number_late": syl(987_654_321) / rate,
        "lifetimes": real_yr / LIFE_YR,
        "sensitivity_yr": sens,
    }


V = compute()

# What the film says and shows, rounded the way it is said. compile.py reads these.
RESULTS = {
    "naive_yr": round(V["naive_yr"]),                              # 32: one a second, nonstop
    "harper_days": HARPER_DAYS, "harper_h": HARPER_H_PER_DAY,
    "harper_s_per_number": round(V["harper_s_per_number"], 1),     # his average seconds per number
    "rate_syl_s": round(V["rate_syl_s"], 1),                       # his pace in syllables a second
    "syl_mean_million": round(V["syl_mean_million"]),              # a typical number below a million
    "syl_mean_billion": round(V["syl_mean_billion"]),              # a typical number below a billion
    "s_per_number_late": round(V["s_per_number_late"]),            # seconds to say one late, long number
    "real_yr": int(round(V["real_yr"], -1)),                       # about N years, two figures
    "lifetimes": round(V["lifetimes"], 1),
    "life_yr": round(LIFE_YR),
    "sens_nonstop_yr": int(round(V["sensitivity_yr"]["nonstop (no sleep), Harper's pace"], -1)),
    "sens_double_yr": int(round(V["sensitivity_yr"]["twice Harper's pace, 16 h a day"], -1)),
}

if __name__ == "__main__":
    for k, v in V.items():
        if isinstance(v, dict):
            for kk, vv in v.items():
                print(f"  {k}[{kk}] = {vv:.1f} yr")
        else:
            print(f"{k:24s} {v:.6g}")
    print()
    for k, v in RESULTS.items():
        print(f"{k:24s} {v}")

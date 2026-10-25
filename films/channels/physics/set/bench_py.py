"""Python ports of the Bench's closed-form blocks, for the episodes' compile.py (films/channels/physics/set).

  Clock      kits/cinema/sci/clock.js (tau, tOf): copied unchanged from ep01/compile.py, checked against clock.js in
             Node by each episode's qa/clockcheck.mjs
  Pendulum   set/swing.js (the exact simple pendulum, Jacobi elliptic functions), checked against it in Node
             by ep02/qa/swingcheck.mjs

    sys.path.insert(0, str(HERE.parent / "set")); from bench_py import Clock, Pendulum, period_ratio
"""
import math

class Clock:
    def __init__(self, keys, tau0=0.0):
        ks = sorted(({"ramp": 0.0, "curve": "auto", **k} for k in keys), key=lambda k: k["t"])
        S, prev = [], ks[0]["rate"]
        for i, k in enumerate(ks):
            nxt = ks[i + 1]["t"] if i + 1 < len(ks) else math.inf
            ramp = max(0.0, min(k["ramp"], nxt - k["t"]))
            curve = k["curve"] if k["curve"] != "auto" else ("log" if prev > 0 and k["rate"] > 0 else "lin")
            if ramp > 0 and prev != k["rate"]:
                S.append({"t0": k["t"], "t1": k["t"] + ramp, "r0": prev, "r1": k["rate"], "curve": curve})
            elif ramp > 0:
                S.append({"t0": k["t"], "t1": k["t"] + ramp, "r0": k["rate"], "r1": k["rate"], "curve": "lin"})
            S.append({"t0": k["t"] + ramp, "t1": nxt, "r0": k["rate"], "r1": k["rate"], "curve": "lin"})
            prev = k["rate"]
        acc = 0.0
        for sg in S:
            sg["tau0"] = acc
            acc += 0.0 if sg["t1"] == math.inf else self._area(sg, 1.0)
            sg["tau1"] = math.inf if sg["t1"] == math.inf else acc
        self.ks, self.S = ks, S
        self.off = tau0 - self._raw(0.0)

    @staticmethod
    def _area(sg, u):
        d, r0, r1 = sg["t1"] - sg["t0"], sg["r0"], sg["r1"]
        if d <= 0 or u <= 0:
            return 0.0
        if sg["curve"] == "log":
            k = math.log(r1 / r0)
            return r0 * d * u if abs(k) < 1e-12 else d * r0 * (math.exp(k * u) - 1) / k
        return d * (r0 * u + (r1 - r0) * u * u / 2)

    @staticmethod
    def _reach(sg, a):
        d, r0, r1 = sg["t1"] - sg["t0"], sg["r0"], sg["r1"]
        if a <= 0:
            return 0.0
        if a > sg["tau1"] - sg["tau0"] + 1e-12:
            return None
        if sg["curve"] == "log" and abs(math.log(r1 / r0)) > 1e-12:
            k = math.log(r1 / r0)
            u = math.log(1 + a * k / (d * r0)) / k
        elif abs(r1 - r0) < 1e-15:
            u = a / (d * r0) if r0 > 0 else 0.0
        else:
            Aq, Bq, Cq = (r1 - r0) / 2, r0, -a / d
            disc = max(0.0, Bq * Bq - 4 * Aq * Cq)
            u = (-Bq + math.sqrt(disc)) / (2 * Aq)
            if not u >= 0:
                u = (-Bq - math.sqrt(disc)) / (2 * Aq)
        return min(d, max(0.0, u * d))

    def _raw(self, t):
        k0 = self.ks[0]
        if t < k0["t"]:
            return -k0["rate"] * (k0["t"] - t)
        for sg in self.S:
            if t < sg["t1"]:
                return sg["tau0"] + (sg["r0"] * (t - sg["t0"]) if sg["t1"] == math.inf else self._area(sg, (t - sg["t0"]) / (sg["t1"] - sg["t0"])))
        return self.S[-1]["tau0"]

    def tau(self, t):
        return self._raw(t) + self.off

    def tOf(self, tau):
        x = tau - self.off
        k0 = self.ks[0]
        if x < 0:
            return k0["t"] - (0 - x) / k0["rate"] if k0["rate"] > 0 else -math.inf
        for sg in self.S:
            if sg["t1"] == math.inf:
                return sg["t0"] + (x - sg["tau0"]) / sg["r0"] if sg["r0"] > 0 else (sg["t0"] if x <= sg["tau0"] + 1e-12 else math.inf)
            if x <= sg["tau1"] + 1e-12:
                dt = self._reach(sg, x - sg["tau0"])
                if dt is not None:
                    return sg["t0"] + dt
        return math.inf


G = 981.0
SECONDS_L = 99.4


def _agm(a, b):
    for _ in range(40):
        if abs(a - b) <= 1e-15 * a:
            break
        a, b = (a + b) / 2, math.sqrt(a * b)
    return (a + b) / 2


def ellipK(m):
    return math.pi / (2 * _agm(1.0, math.sqrt(1 - m)))


def ellipj(u, m):
    """[sn, cn, dn] by the AGM (Abramowitz & Stegun 16.4), as set/swing.js."""
    if m < 1e-14:
        return math.sin(u), math.cos(u), 1.0
    a, c, b, n = [1.0], [math.sqrt(m)], math.sqrt(1 - m), 0
    while abs(c[n]) > 1e-15 and n < 30:
        an, cn = (a[n] + b) / 2, (a[n] - b) / 2
        b = math.sqrt(a[n] * b)
        n += 1
        a.append(an)
        c.append(cn)
    phi = 2 ** n * a[n] * u
    for j in range(n, 0, -1):
        phi = (math.asin(c[j] / a[j] * math.sin(phi)) + phi) / 2
    sn = math.sin(phi)
    return sn, math.cos(phi), math.sqrt(1 - m * sn * sn)


def period_ratio(theta0):
    k = math.sin(abs(theta0) / 2)
    return 2 * ellipK(k * k) / math.pi


class Pendulum:
    """Released from rest at theta0 (radians; + toward +x) at tau = 0, held there before; pivot [x, y, z] in cm."""

    def __init__(self, L=SECONDS_L, theta0=0.0, g=G, pivot=(0.0, 0.0, 0.0)):
        self.L, self.theta0, self.pivot = L, theta0, list(pivot)
        self.s = 1.0 if theta0 >= 0 else -1.0
        self.k = math.sin(abs(theta0) / 2)
        self.m, self.w0 = self.k * self.k, math.sqrt(g / L)
        self.K = ellipK(self.m)
        self.T = 4 * self.K / self.w0

    def theta(self, tau):
        if tau <= 0 or self.k == 0:
            return self.theta0
        sn = ellipj(self.K - self.w0 * tau, self.m)[0]
        return self.s * 2 * math.asin(max(-1.0, min(1.0, self.k * sn)))

    def pos(self, tau):
        a = self.theta(tau)
        return [self.pivot[0] + self.L * math.sin(a), self.pivot[1] - self.L * math.cos(a), self.pivot[2]]

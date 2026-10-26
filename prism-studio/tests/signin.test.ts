// Sign-in protection: backoff, lockouts, the studio-wide ceiling, parallel requests, and audit entries without the
// passphrase. The throttle is pure (injected clock); one test writes through the real audit_log.
import { afterAll, describe, expect, it } from "vitest";
import { attemptSignIn, clientKey, SIGNIN, SignInThrottle, type SignInDeps } from "../src/domain/signin";
import { checkPassword, checkPasswordAsync, hashPassword } from "../src/lib/auth";
import { audit } from "../src/domain/core";
import { freshDb, eq, S } from "./helpers";

const SEC = 1_000, MIN = 60_000, HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 26, 12);

function fails(t: SignInThrottle, client: string, n: number, at: number) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = t.begin(client, at);
    if (!g.ok) throw new Error(`refused at failure ${i + 1}: ${g.reason}`);
    const f = t.fail(client, at);
    out.push(f);
    at += f.waitMs;
  }
  return { out, at };
}

describe("sign-in throttle", () => {
  it("backs off 1, 2, 4, 8 s, then locks for 15 min on the 5th failure", () => {
    const t = new SignInThrottle();
    const { out, at } = fails(t, "a", 5, T0);
    expect(out.map((f) => f.waitMs)).toEqual([1 * SEC, 2 * SEC, 4 * SEC, 8 * SEC, 15 * MIN]);
    expect(out.map((f) => f.locked)).toEqual([false, false, false, false, true]);
    // during the lockout every try is refused, uncounted
    const r = t.begin("a", at - 1);
    expect(r).toMatchObject({ ok: false, reason: "locked" });
    expect(t.stats().recentFailures).toBe(5);
    expect(t.begin("a", at).ok).toBe(true);
  });

  it("refuses a try before the backoff has passed", () => {
    const t = new SignInThrottle();
    t.begin("a", T0); t.fail("a", T0);                       // wait 1 s
    t.begin("a", T0 + SEC); t.fail("a", T0 + SEC);           // wait 2 s
    expect(t.begin("a", T0 + 2 * SEC)).toMatchObject({ ok: false, reason: "wait", retryAfterMs: SEC });
    expect(t.begin("a", T0 + 3 * SEC).ok).toBe(true);
  });

  it("doubles each further lockout, up to 24 hours", () => {
    const t = new SignInThrottle();
    let at = T0;
    const locks: number[] = [];
    for (let i = 0; i < 9; i++) {
      const r = fails(t, "a", 5, at);
      locks.push(r.out[4].waitMs);
      at = r.at;
    }
    expect(locks.map((ms) => ms / MIN)).toEqual([15, 30, 60, 120, 240, 480, 960, 1440, 1440]);
  });

  it("a success, or a quiet day after the last lockout, starts the client again", () => {
    const t = new SignInThrottle();
    const r = fails(t, "a", 4, T0);
    t.begin("a", r.at); t.succeed("a");
    expect(fails(t, "a", 1, r.at).out[0].waitMs).toBe(SEC);

    const u = new SignInThrottle();
    const l = fails(u, "b", 5, T0);                          // locked until l.at
    const l2 = fails(u, "b", 5, l.at);                       // locked again, for longer, until l2.at
    expect(l2.out[4].waitMs).toBe(30 * MIN);
    expect(fails(u, "b", 5, l2.at + SIGNIN.forgetMs - 1).out[4].waitMs).toBe(60 * MIN);   // not quite a quiet day
    const v = new SignInThrottle();
    const m = fails(v, "c", 5, T0), m2 = fails(v, "c", 5, m.at);
    expect(fails(v, "c", 5, m2.at + SIGNIN.forgetMs).out[4].waitMs).toBe(15 * MIN);       // a quiet day after it ended
  });

  it("one check at a time per client: a parallel try is turned away and not counted", () => {
    const t = new SignInThrottle();
    expect(t.begin("a", T0).ok).toBe(true);
    expect(t.begin("a", T0)).toMatchObject({ ok: false, reason: "busy" });
    expect(t.begin("b", T0).ok).toBe(true);                  // another client is independent
    t.fail("a", T0); t.succeed("b");
    expect(t.stats()).toMatchObject({ inFlight: 0, recentFailures: 1 });
  });

  it("caps failures studio-wide at 20 an hour, whatever the address", () => {
    const t = new SignInThrottle();
    for (let i = 0; i < SIGNIN.globalMaxFailures; i++) { expect(t.begin(`10.0.0.${i}`, T0 + i).ok).toBe(true); t.fail(`10.0.0.${i}`, T0 + i); }
    const r = t.begin("10.0.1.1", T0 + 100);
    expect(r).toMatchObject({ ok: false, reason: "ceiling" });
    expect(!r.ok && r.retryAfterMs).toBe(HOUR - 100);
    expect(t.begin("10.0.1.1", T0 + HOUR + 1).ok).toBe(true);   // the oldest failure left the window
  });

  it("counts checks in flight against the ceiling, so a parallel burst can't overshoot it", () => {
    const t = new SignInThrottle();
    for (let i = 0; i < 18; i++) { t.begin(`c${i}`, T0); t.fail(`c${i}`, T0); }
    const burst = Array.from({ length: 50 }, (_, i) => t.begin(`burst${i}`, T0 + SEC));
    expect(burst.filter((g) => g.ok)).toHaveLength(2);
    expect(burst.filter((g) => !g.ok && g.reason === "ceiling")).toHaveLength(48);
  });

  it("keeps memory bounded when the client key is spoofed, without dropping a live lockout", () => {
    const t = new SignInThrottle({ ...SIGNIN, maxClients: 10, globalMaxFailures: 1_000 });
    fails(t, "locked", 5, T0);
    for (let i = 0; i < 100; i++) { t.begin(`s${i}`, T0 + 20 * SEC + i * 2 * SEC); t.fail(`s${i}`, T0 + 20 * SEC + i * 2 * SEC); }
    expect(t.stats().clients).toBeLessThanOrEqual(10);
    expect(t.begin("locked", T0 + 300 * SEC)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("takes the address the nearest proxy saw", () => {
    expect(clientKey("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientKey(null, "198.51.100.2")).toBe("198.51.100.2");
    expect(clientKey(undefined)).toBe("direct");
    expect(clientKey("x".repeat(500))).toHaveLength(64);
  });
});

describe("attemptSignIn", () => {
  const PASS = "correct horse battery staple";
  const deps = (t: SignInThrottle, entries: { action: string; detail: Record<string, unknown> }[], o: Partial<SignInDeps> = {}): SignInDeps => ({
    throttle: t, client: "203.0.113.9", passphrase: "wrong guess",
    check: async (p) => p === PASS,
    audit: async (action, detail) => { entries.push({ action, detail }); },
    sleep: async () => {},
    ...o,
  });

  it("audits failures and the lockout with counts and times, never the passphrase", async () => {
    const t = new SignInThrottle(), entries: { action: string; detail: Record<string, unknown> }[] = [];
    let now = T0;
    for (let i = 0; i < 5; i++) {
      const r = await attemptSignIn(deps(t, entries, { now: () => now, passphrase: `guess-number-${i}` }));
      expect(r.ok).toBe(false);
      now += 20 * SEC;
    }
    expect(entries.map((e) => e.action)).toEqual(["auth.sign_in_failed", "auth.sign_in_failed", "auth.sign_in_failed", "auth.sign_in_failed", "auth.sign_in_failed", "auth.locked"]);
    expect(entries[5].detail).toMatchObject({ client: "203.0.113.9", minutes: 15, lockouts: 1 });
    expect(JSON.stringify(entries)).not.toMatch(/guess-number/);
    // locked: the right passphrase is refused too, and nothing is checked
    let checked = 0;
    const locked = await attemptSignIn(deps(t, entries, { now: () => now, passphrase: PASS, check: async () => { checked++; return true; } }));
    expect(locked).toMatchObject({ ok: false });
    expect(!locked.ok && locked.message).toMatch(/locked for \d+ min/);
    expect(checked).toBe(0);
  });

  it("signs in with the right passphrase and audits it", async () => {
    const t = new SignInThrottle(), entries: { action: string; detail: Record<string, unknown> }[] = [];
    expect(await attemptSignIn(deps(t, entries, { passphrase: PASS }))).toEqual({ ok: true });
    expect(entries).toEqual([{ action: "auth.sign_in", detail: { client: "203.0.113.9" } }]);
  });

  it("parallel requests from one client get one check between them", async () => {
    const t = new SignInThrottle(), entries: { action: string; detail: Record<string, unknown> }[] = [];
    let checks = 0;
    const slow = async () => { checks++; await new Promise((r) => setTimeout(r, 20)); return false; };
    const all = await Promise.all(Array.from({ length: 25 }, (_, i) => attemptSignIn(deps(t, entries, { check: slow, passphrase: `p${i}` }))));
    expect(checks).toBe(1);
    expect(all.filter((r) => !r.ok && /Still checking/.test(r.message))).toHaveLength(24);
    expect(entries.filter((e) => e.action === "auth.sign_in_failed")).toHaveLength(1);
  });

  it("a failure never answers faster than the floor, and an over-long passphrase is a failure without a check", async () => {
    const t = new SignInThrottle(), waits: number[] = [];
    let checked = false;
    const r = await attemptSignIn(deps(t, [], { passphrase: "x".repeat(SIGNIN.maxPassphrase + 1), check: async () => (checked = true), sleep: async (ms) => { waits.push(ms); } }));
    expect(r.ok).toBe(false);
    expect(checked).toBe(false);
    expect(waits[0]).toBeGreaterThan(SIGNIN.minFailMs - 50);
  });

  it("a broken audit store doesn't break sign-in", async () => {
    const t = new SignInThrottle();
    const r = await attemptSignIn({ ...deps(t, [], { passphrase: PASS }), audit: async () => { throw new Error("db down"); } });
    expect(r).toEqual({ ok: true });
  });
});

describe("passphrase check", () => {
  it("async and sync agree; malformed hashes never match", async () => {
    const h = hashPassword("correct horse");
    expect(await checkPasswordAsync("correct horse", h)).toBe(true);
    expect(await checkPasswordAsync("correct hors", h)).toBe(false);
    expect(checkPassword("correct horse", h)).toBe(true);
    for (const bad of ["", "scrypt:16384:8:1:abc:12", `scrypt:x:8:1:${"a".repeat(32)}:${"b".repeat(64)}`, h.replace(/^scrypt/, "md5")]) {
      expect(await checkPasswordAsync("correct horse", bad)).toBe(false);
      expect(checkPassword("correct horse", bad)).toBe(false);
    }
  });
});

describe("sign-in audit rows", () => {
  let end: () => Promise<void> = async () => {};
  afterAll(() => end());
  it("land in audit_log without the passphrase", async () => {
    const f = await freshDb();
    end = f.end;
    const t = new SignInThrottle();
    let now = T0;
    for (let i = 0; i < 5; i++) {
      await attemptSignIn({
        throttle: t, client: "198.51.100.7", passphrase: `secret-attempt-${i}`, check: async () => false, sleep: async () => {}, now: () => now,
        audit: (action, detail) => audit(f.db, action === "auth.sign_in" ? "owner" : "system", action, "owner", "", detail),
      });
      now += 20 * SEC;
    }
    const rows = await f.db.select().from(S.auditLog).where(eq(S.auditLog.entity, "owner"));
    expect(rows.map((r) => r.action).sort()).toEqual(["auth.locked", ...Array(5).fill("auth.sign_in_failed")]);
    expect(rows.every((r) => r.actor === "system")).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/secret-attempt/);
  });
});

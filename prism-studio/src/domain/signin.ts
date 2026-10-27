// Owner sign-in protection, kept in the one web process (one web container; a restart forgets it, which only ever
// makes it gentler). Three limits, all checked and reserved synchronously before anything awaits, so a burst of
// parallel requests can't slip past any of them:
//   - one check at a time per client (a second request while one is being checked is turned away, uncounted);
//   - per client, exponential backoff (1, 2, 4, 8 s) and on the 5th failure a lockout of 15 min that doubles with
//     each further lockout (up to 24 h); a success, or a quiet day after its last lockout, starts that client again;
//   - studio-wide, at most 20 failures an hour, counting checks in flight, so many addresses can't add up to many
//     guesses. A device the owner signed in on before (its signed `prism_device` mark) is let past this ceiling, so
//     strangers keeping it full can't lock the owner out; its own address is still held to the backoff and lockouts.
// `attemptSignIn` runs one try and writes the audit entries: the client, counts and times, never the passphrase.
// `safeNextPath` keeps the redirect after sign-in on this site.

export const SIGNIN = {
  baseDelayMs: 1_000,             // failure n (1–4) waits 2^(n-1) s before that client may try again
  failuresPerLockout: 5,
  lockoutMs: 15 * 60_000,
  maxLockoutMs: 24 * 3_600_000,
  forgetMs: 24 * 3_600_000,       // a day with no failure after its last wait or lockout ends: the client starts again
  globalWindowMs: 3_600_000,
  globalMaxFailures: 20,
  maxClients: 2_000,              // memory bound when the client key is spoofed
  minFailMs: 400,                 // a failure never answers faster than this
  maxPassphrase: 1_024,
} as const;
export type SignInLimits = { readonly [K in keyof typeof SIGNIN]: number };

type Client = { failures: number; lockouts: number; notBefore: number; locked: boolean; lastFailure: number; busy: boolean };
export type Refusal = { ok: false; reason: "busy" | "wait" | "locked" | "ceiling"; retryAfterMs: number };
export type Failure = { failures: number; lockouts: number; waitMs: number; locked: boolean; ceilingReached: boolean };

export class SignInThrottle {
  private clients = new Map<string, Client>();
  private recent: number[] = [];       // failure times, studio-wide, oldest first
  private inFlight = 0;
  constructor(readonly limits: SignInLimits = SIGNIN) {}

  /** Reserve one check for this client, or say why not and for how long. Synchronous on purpose. A known device (one
   *  the owner signed in on before) skips the studio-wide ceiling, never the per-client limits. */
  begin(client: string, now: number, o: { knownDevice?: boolean } = {}): { ok: true } | Refusal {
    const L = this.limits;
    let c = this.clients.get(client);
    if (c && !c.busy && now - c.notBefore >= L.forgetMs) { this.clients.delete(client); c = undefined; }   // a quiet day after its last wait
    if (c?.busy) return { ok: false, reason: "busy", retryAfterMs: 1_000 };
    if (c && c.notBefore > now) return { ok: false, reason: c.locked ? "locked" : "wait", retryAfterMs: c.notBefore - now };
    this.expire(now);
    if (!o.knownDevice && this.recent.length + this.inFlight >= L.globalMaxFailures) {
      const retryAfterMs = this.recent.length >= L.globalMaxFailures ? this.recent[this.recent.length - L.globalMaxFailures] + L.globalWindowMs - now : 1_000;
      return { ok: false, reason: "ceiling", retryAfterMs: Math.max(1_000, retryAfterMs) };
    }
    if (!c) {
      this.makeRoom(now);
      c = { failures: 0, lockouts: 0, notBefore: 0, locked: false, lastFailure: 0, busy: false };
    }
    this.clients.delete(client);                 // re-insert: the map's order is least recently used first
    this.clients.set(client, c);
    c.busy = true;
    this.inFlight++;
    return { ok: true };
  }

  /** The reserved check passed: this client starts again. */
  succeed(client: string) {
    if (this.clients.get(client)?.busy) this.inFlight--;
    this.clients.delete(client);
  }

  /** The reserved check failed: count it and set the client's next allowed time. */
  fail(client: string, now: number): Failure {
    const L = this.limits;
    const c = this.clients.get(client) ?? { failures: 0, lockouts: 0, notBefore: 0, locked: false, lastFailure: 0, busy: false };
    if (c.busy) this.inFlight--;
    c.busy = false;
    c.failures++;
    c.lastFailure = now;
    let waitMs: number;
    if (c.failures >= L.failuresPerLockout) {
      waitMs = Math.min(L.lockoutMs * 2 ** c.lockouts, L.maxLockoutMs);
      c.lockouts++;
      c.failures = 0;
      c.locked = true;
    } else {
      waitMs = L.baseDelayMs * 2 ** (c.failures - 1);
      c.locked = false;
    }
    c.notBefore = now + waitMs;
    this.clients.set(client, c);
    this.expire(now);
    this.recent.push(now);
    return { failures: c.locked ? L.failuresPerLockout : c.failures, lockouts: c.lockouts, waitMs, locked: c.locked, ceilingReached: this.recent.length === L.globalMaxFailures };
  }

  /** For tests and the audit detail. */
  stats() { return { clients: this.clients.size, recentFailures: this.recent.length, inFlight: this.inFlight }; }

  private expire(now: number) {
    const cut = now - this.limits.globalWindowMs;
    let i = 0;
    while (i < this.recent.length && this.recent[i] <= cut) i++;
    if (i) this.recent.splice(0, i);
  }

  private makeRoom(now: number) {
    if (this.clients.size < this.limits.maxClients) return;
    for (const [k, c] of this.clients) {          // least recently used first; never drop a check in flight or a live lockout
      if (this.clients.size < this.limits.maxClients) break;
      if (!c.busy && c.notBefore <= now) this.clients.delete(k);
    }
    for (const [k, c] of this.clients) {          // still full (all locked): drop the oldest that isn't in flight
      if (this.clients.size < this.limits.maxClients) break;
      if (!c.busy) this.clients.delete(k);
    }
  }
}

export function waitText(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.ceil(ms / 1000))} s`;
  if (ms < 2 * 3_600_000) return `${Math.ceil(ms / 60_000)} min`;
  return `${Math.ceil(ms / 3_600_000)} h`;
}

export function refusalMessage(r: Refusal): string {
  switch (r.reason) {
    case "busy": return "Still checking the last try. Wait a moment.";
    case "wait": return `Wait ${waitText(r.retryAfterMs)} before trying again.`;
    case "locked": return `Too many wrong tries. Sign-in is locked for ${waitText(r.retryAfterMs)}.`;
    case "ceiling": return `Too many wrong tries on this studio lately. Try again in ${waitText(r.retryAfterMs)}, or from a device you've signed in on before.`;
  }
}

/** The client key: the address the nearest proxy (Caddy) saw, else "direct". Spoofable without a proxy, which is
 *  why the studio-wide ceiling exists. */
export function clientKey(forwardedFor: string | null | undefined, realIp?: string | null): string {
  const last = forwardedFor?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return (last || realIp?.trim() || "direct").slice(0, 64);
}

export type SignInDeps = {
  throttle: SignInThrottle;
  client: string;
  /** the request carries a valid device mark from an earlier sign-in */
  knownDevice?: boolean;
  passphrase: string;
  check: (passphrase: string) => Promise<boolean>;
  audit: (action: string, detail: Record<string, unknown>) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** One sign-in try: refuse early if a limit applies, otherwise check, count, audit, and answer. */
export async function attemptSignIn(d: SignInDeps): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = d.now ?? Date.now, sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const L = d.throttle.limits, started = now();
  const gate = d.throttle.begin(d.client, started, { knownDevice: d.knownDevice });
  if (!gate.ok) return { ok: false, message: refusalMessage(gate) };
  let good = false;
  try {
    good = d.passphrase.length > 0 && d.passphrase.length <= L.maxPassphrase && (await d.check(d.passphrase));
  } catch {
    good = false;
  }
  const quietly = async (action: string, detail: Record<string, unknown>) => {
    try { await d.audit(action, detail); } catch { console.error(`sign-in: could not write the ${action} audit entry`); }
  };
  if (good) {
    d.throttle.succeed(d.client);
    await quietly("auth.sign_in", { client: d.client, knownDevice: !!d.knownDevice });
    return { ok: true };
  }
  const t = now(), f = d.throttle.fail(d.client, t);
  await quietly("auth.sign_in_failed", { client: d.client, knownDevice: !!d.knownDevice, failures: f.failures, waitSeconds: Math.ceil(f.waitMs / 1000) });
  if (f.locked) await quietly("auth.locked", { client: d.client, lockouts: f.lockouts, minutes: Math.ceil(f.waitMs / 60_000), until: new Date(t + f.waitMs).toISOString() });
  if (f.ceilingReached) await quietly("auth.ceiling", { client: d.client, failuresLastHour: L.globalMaxFailures });
  const rest = L.minFailMs - (now() - started);
  if (rest > 0) await sleep(rest);
  return {
    ok: false,
    message: f.locked
      ? `That passphrase didn't match. Too many wrong tries: sign-in is locked for ${waitText(f.waitMs)}.`
      : "That passphrase didn't match.",
  };
}

/** Where to go after signing in: a path on this site, else "/". Parsed the way a browser will (which drops tabs and
 *  newlines and reads "\" as "/"), and refused when it would leave the site: "//host", "/\host", "/\t/host". */
export function safeNextPath(next: string | null | undefined): string {
  const raw = String(next ?? "");
  if (!raw.startsWith("/") || /[\s\x00-\x1f\x7f\\]/.test(raw)) return "/";
  const base = "http://studio.invalid";
  try {
    const u = new URL(raw, base);
    return u.origin === base ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

// Lumevina — what every Skin Intelligence function shares: who is asking,
// the audit log, rate limits, the private image bucket, replies.
//
// Who is asking, always from the verified token, never from the body:
//   clientOf(req)  a signed-in person (Supabase Auth). The anon key is not a person.
//   staffOf(req)   a signed-in person with an active row in `staff`, signed in
//                  with multifactor (the token's aal is aal2). The shared
//                  STUDIO_KEY is not accepted here, ever: it names no one.
// Every read of an image or a record by staff, and every change by anyone,
// goes in audit_log (actor, role, action, client, record), never the content.
//
// The handlers take their database, storage, clock and notifier as `deps`
// so they run unchanged under Deno (index.ts) and in the tests (Node, PGlite).

// deno-lint-ignore-file no-explicit-any
import { normEmail } from "./skin/core/validate.js";

export const BUCKET = "skin-images";

export type Env = (k: string) => string | undefined;
export type Deps = {
  db: any;                                   // a service-role supabase-js client (or the tests' stand-in)
  env: Env;
  notify?: (db: any, a: { kind: string; title: string; body?: string; url?: string }) => Promise<unknown>;
  now?: () => Date;
};
export type Person = { id: string; email: string; aal: string };
export type Staff = Person & { role: "practitioner" | "admin"; name: string };

export class HttpError extends Error {
  status: number; reason: string; extra: Record<string, unknown>;
  constructor(status: number, reason: string, extra: Record<string, unknown> = {}) {
    super(reason); this.status = status; this.reason = reason; this.extra = extra;
  }
}

export function corsHeaders(env: Env) {
  return {
    "Access-Control-Allow-Origin": (env("SITE_URL") || "*").replace(/\/$/, ""),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export const json = (env: Env, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(env), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** The JWT's claims. Only called on a token getUser() has just verified. */
export function claimsOf(jwt: string): Record<string, any> {
  try {
    const part = jwt.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64));
  } catch { return {}; }
}

const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

export async function clientOf(req: Request, deps: Deps): Promise<Person> {
  const jwt = bearer(req);
  if (!jwt || jwt === deps.env("SUPABASE_ANON_KEY")) throw new HttpError(401, "sign_in");
  const { data, error } = await deps.db.auth.getUser(jwt);
  const user = data?.user;
  if (error || !user?.id || !user.email) throw new HttpError(401, "sign_in");
  const claims = claimsOf(jwt);
  return { id: user.id, email: normEmail(user.email), aal: String(claims.aal ?? "aal1") };
}

export async function staffOf(req: Request, deps: Deps): Promise<Staff> {
  const p = await clientOf(req, deps);
  const { data: s } = await deps.db.from("staff").select("user_id, role, display_name, active").eq("user_id", p.id).maybeSingle();
  if (!s || !s.active) {
    await audit(deps, req, { actor_user_id: p.id, actor_role: "client", action: "studio.denied", outcome: "denied", detail: { reason: "not_staff" } });
    throw new HttpError(403, "not_staff");
  }
  if (p.aal !== "aal2") throw new HttpError(403, "mfa_required");
  return { ...p, role: s.role, name: s.display_name };
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One audit row. Never throws: a failed audit write is logged, and the error is returned for the caller to decide. */
export async function audit(deps: Deps, req: Request | null, a: {
  actor_user_id: string | null; actor_role: string; action: string; profile_id?: string | null;
  record_table?: string; record_id?: string; outcome?: "ok" | "denied" | "error"; detail?: Record<string, unknown>;
}) {
  const ip = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const salt = deps.env("AUDIT_SALT") || deps.env("SUPABASE_SERVICE_ROLE_KEY") || "";
  const row = {
    actor_user_id: a.actor_user_id, actor_role: a.actor_role, action: a.action, profile_id: a.profile_id ?? null,
    record_table: a.record_table ?? null, record_id: a.record_id ?? null, outcome: a.outcome ?? "ok", detail: a.detail ?? null,
    ip_hash: ip ? (await sha256Hex(salt + ip)).slice(0, 32) : null,
    user_agent: (req?.headers.get("user-agent") ?? "").slice(0, 200) || null,
  };
  const { error } = await deps.db.from("audit_log").insert(row);
  if (error) console.error("audit", error);
  return error ?? null;
}

/** Refuse when the caller has used up their allowance for this kind of call. */
export async function limit(deps: Deps, key: string, capacity: number, perMinute: number) {
  const { data, error } = await deps.db.rpc("take_token", { p_key: key, p_capacity: capacity, p_per_minute: perMinute });
  if (error) { console.error("rate limit", error); return; }   // never lock people out because the limiter failed
  if (data === false) throw new HttpError(429, "slow_down");
}

export async function setting(deps: Deps, key: string, fallback: any) {
  const { data } = await deps.db.from("skin_settings").select("value").eq("key", key).maybeSingle();
  return data ? data.value : fallback;
}

export async function urlSeconds(deps: Deps) {
  const s = Number(await setting(deps, "signed_url_seconds", 300));
  return Math.max(60, Math.min(900, Number.isFinite(s) ? s : 300));
}

export async function signedUrls(deps: Deps, paths: string[], seconds: number) {
  if (!paths.length) return new Map<string, string>();
  const { data, error } = await deps.db.storage.from(BUCKET).createSignedUrls(paths, seconds);
  if (error) throw new HttpError(500, "storage");
  return new Map<string, string>((data ?? []).filter((d: any) => d.signedUrl).map((d: any) => [d.path, d.signedUrl]));
}

export async function signedUpload(deps: Deps, path: string) {
  const { data, error } = await deps.db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(500, "storage");
  return { url: data.signedUrl as string, token: data.token as string, path };
}

/** The stored object's size and type, or null when nothing was uploaded there. */
export async function storedObject(deps: Deps, path: string): Promise<{ size: number; mimetype: string } | null> {
  const dir = path.split("/").slice(0, -1).join("/"), name = path.split("/").pop();
  const { data, error } = await deps.db.storage.from(BUCKET).list(dir, { search: name, limit: 5 });
  if (error) throw new HttpError(500, "storage");
  const o = (data ?? []).find((x: any) => x.name === name);
  return o ? { size: Number(o.metadata?.size ?? 0), mimetype: String(o.metadata?.mimetype ?? "") } : null;
}

export async function body(req: Request) {
  if (req.headers.get("content-length") && Number(req.headers.get("content-length")) > 200_000) throw new HttpError(413, "too_large");
  try { return await req.json(); } catch { throw new HttpError(400, "bad_json"); }
}

/** Runs a handler, turning HttpErrors into replies and anything else into a logged 500. */
export async function serve(req: Request, deps: Deps, fn: () => Promise<unknown>) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(deps.env) });
  if (req.method !== "POST") return json(deps.env, { reason: "method" }, 405);
  try {
    return json(deps.env, await fn());
  } catch (e) {
    if (e instanceof HttpError) return json(deps.env, { reason: e.reason, ...e.extra }, e.status);
    console.error("skin", e);
    return json(deps.env, { reason: "failed" }, 500);
  }
}

export const today = (deps: Deps) => (deps.now ? deps.now() : new Date()).toISOString().slice(0, 10);
export const nowIso = (deps: Deps) => (deps.now ? deps.now() : new Date()).toISOString();

/** Throws unless the query succeeded; returns its data. */
export function must<T>(res: { data: T; error: any }, what = "db"): T {
  if (res.error) { console.error(what, res.error); throw new HttpError(500, "failed"); }
  return res.data;
}

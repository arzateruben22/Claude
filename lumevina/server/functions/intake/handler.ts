// Lumevina — the pre-visit form reaches the server (functions/intake)
//
//   POST { name, email, answers, signature, form_version }
//   Authorization: Bearer <access token> when signed in (optional)
//
// Signed in: the email comes from the token and they can update their form.
// Not signed in: a first form saves for the email they typed; changing an
// existing form needs sign-in, so no one can rewrite someone else's
// allergies or medications by typing their email. The answers stay where
// schema.sql always meant them to be (intake_forms), read by Evelyn's
// Appointments, the morning priorities and the chat's client file.

// deno-lint-ignore-file no-explicit-any
import { body, HttpError, limit, must, nowIso, serve, type Deps } from "../_shared/skin.ts";
import { isEmail, normEmail } from "../_shared/skin/core/validate.js";

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Every answer bounded: up to 80 fields, strings up to 2000 characters, lists up to 20 short items. */
export function cleanAnswers(a: any) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const out: Record<string, string | string[] | boolean> = {};
  for (const [k, v] of Object.entries(a).slice(0, 80)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(k)) continue;
    if (typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => clip(x, 200)).filter(Boolean);
    else if (v != null) out[k] = clip(v, 2000);
  }
  return out;
}

export function handle(req: Request, deps: Deps) {
  return serve(req, deps, async () => {
    const b = await body(req);
    const db = deps.db;
    // who: a verified token when there is one (never the anon key), otherwise the typed email
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    let signedIn: { id: string; email: string } | null = null;
    if (jwt && jwt !== deps.env("SUPABASE_ANON_KEY")) {
      const { data } = await db.auth.getUser(jwt);
      if (data?.user?.email) signedIn = { id: data.user.id, email: normEmail(data.user.email) };
      else throw new HttpError(401, "sign_in");
    }
    const email = signedIn?.email ?? normEmail(b.email);
    if (!isEmail(email)) throw new HttpError(400, "invalid", { errors: { email: "A valid email." } });
    await limit(deps, `intake:${email}`, 6, 0.5);
    const name = clip(b.name, 120), signature = clip(b.signature, 120);
    const answers = cleanAnswers(b.answers);
    const errors: Record<string, string> = {};
    if (!name) errors.name = "Your name.";
    if (!answers) errors.answers = "The form's answers.";
    if (!signature || signature.toLowerCase() !== name.toLowerCase()) errors.signature = "Sign with the same name.";
    if (Object.keys(errors).length) throw new HttpError(400, "invalid", { errors });

    const existing = must(await db.from("intake_forms").select("email").eq("email", email).maybeSingle());
    if (existing && !signedIn) throw new HttpError(409, "sign_in_to_update");
    const { data: c } = signedIn ? await db.from("clients").select("id").eq("id", signedIn.id).maybeSingle() : { data: null };
    const row = { email, name, answers, signature, client_id: c?.id ?? null, form_version: clip(b.form_version, 20) || null, signed_at: nowIso(deps), updated_at: nowIso(deps) };
    must(existing
      ? await db.from("intake_forms").update(row).eq("email", email)
      : await db.from("intake_forms").insert(row));
    return { saved: true, updated: !!existing };
  });
}


// Lumevina — Evelyn's client list (the contacts table): everyone who books
// or buys, and everyone she imports from GlossGenius. Keyed by email.

// deno-lint-ignore-file no-explicit-any
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();

export async function getContact(db: any, email: string) {
  const { data } = await db.from("contacts").select("*").eq("email", norm(email)).maybeSingle();
  return data ?? null;
}

/** Adds them if they're new; fills in a name or phone that was missing. Returns the row. */
export async function upsertContact(db: any, c: { email: string; name?: string; phone?: string; sms_ok?: boolean; source?: string }) {
  const email = norm(c.email);
  if (!EMAIL.test(email)) return null;
  const had = await getContact(db, email);
  if (!had) {
    const row = { email, name: c.name?.trim() || null, phone: c.phone?.trim() || null, sms_ok: !!c.sms_ok, source: c.source ?? "website" };
    const { data, error } = await db.from("contacts").insert(row).select("*").maybeSingle();
    if (error) { console.error("contact", error); return (await getContact(db, email)) ?? row; }
    return data ?? row;
  }
  const patch: Record<string, unknown> = {};
  if (c.name?.trim() && !had.name) patch.name = c.name.trim();
  if (c.phone?.trim() && c.phone.trim() !== had.phone) patch.phone = c.phone.trim();
  if (c.sms_ok && !had.sms_ok) patch.sms_ok = true;
  if (Object.keys(patch).length) await db.from("contacts").update(patch).eq("email", email);
  return { ...had, ...patch };
}

/** Their referral code (GLOW-XXXX), made the first time it's asked for. */
export async function refCodeFor(db: any, email: string) {
  const c = await upsertContact(db, { email });
  if (c?.ref_code) return String(c.ref_code);
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 6; tries++) {
    let code = "GLOW-";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const { error } = await db.from("contacts").update({ ref_code: code }).eq("email", norm(email)).is("ref_code", null);
    if (!error) return (await getContact(db, email))?.ref_code ?? code;
  }
  return "";
}

/** A short, unguessable token for one email (unsubscribe links). */
export async function emailToken(email: string) {
  const secret = Deno.env.get("PREFS_SECRET") || Deno.env.get("STUDIO_KEY") || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(norm(email)));
  return Array.from(new Uint8Array(mac)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function unsubscribeUrl(email: string) {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  return `${base}/functions/v1/client-prefs?e=${encodeURIComponent(norm(email))}&t=${await emailToken(email)}`;
}

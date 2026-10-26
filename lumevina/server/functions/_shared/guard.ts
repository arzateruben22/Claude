// Lumevina — a small brake on the public functions.
//
// Anyone on the internet can call create-checkout, book and ask. Each call
// costs something: a pending order, a held time slot (for half an hour), or
// a Claude answer. This counts recent calls per caller (their IP, and an
// email when they gave one) in request_log (schema.sql) and says when it's
// too many, so a script can't hold every slot, pile up orders or run up the
// assistant's bill. Real clients never get near the limits.
//
//   if (await tooMany(db, req, "book", 6, 30)) return json({ reason: "slow_down" }, 429);
//
// Old rows are cleared on the way through, so the table stays small.

// deno-lint-ignore-file no-explicit-any

/** The caller's address, as the platform saw it. */
export const ipOf = (req: Request) =>
  (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

/**
 * Note this call and say whether the caller has made more than `max` of this
 * kind in the last `minutes`. Fails open: if the table is missing or the
 * database is slow, the call goes through (the brake is a backstop, not the lock).
 */
export async function tooMany(db: any, req: Request, what: string, max: number, minutes: number, email?: string | null): Promise<boolean> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const keys = [`${what}:ip:${ipOf(req)}`, ...(email ? [`${what}:email:${email.toLowerCase()}`] : [])];
  try {
    await db.from("request_log").insert(keys.map((key) => ({ key })));
    for (const key of keys) {
      const { count } = await db.from("request_log").select("key", { count: "exact", head: true }).eq("key", key).gte("at", since);
      if ((count ?? 0) > max) return true;
    }
    if (Math.random() < 0.05) await db.from("request_log").delete().lt("at", new Date(Date.now() - 864e5).toISOString());
  } catch (e) {
    console.error("request_log", String(e));
  }
  return false;
}

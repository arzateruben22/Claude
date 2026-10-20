// Lumevina — calling Stripe's REST API (no SDK needed in Deno).
//
//   stripe("checkout/sessions", { mode: "payment", ... })   POST, form-encoded
//   stripe("payment_intents/pi_123")                         GET
//
// Nested objects and arrays are flattened the way Stripe expects:
// { line_items: [{ price_data: { currency: "usd" } }] } → line_items[0][price_data][currency]=usd
// Resolves { ok, status, data }; data.error carries Stripe's message when ok is false.
//
// Secrets: STRIPE_SECRET_KEY

// deno-lint-ignore-file no-explicit-any
export type StripeReply = { ok: boolean; status: number; data: any };

const flatten = (f: URLSearchParams, key: string, v: unknown) => {
  if (v === undefined || v === null) return;
  if (Array.isArray(v)) v.forEach((x, i) => flatten(f, `${key}[${i}]`, x));
  else if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(f, `${key}[${k}]`, x);
  else f.append(key, String(v));
};

export async function stripe(path: string, params?: Record<string, unknown>, opts: { method?: string; idempotency?: string } = {}): Promise<StripeReply> {
  const method = opts.method ?? (params ? "POST" : "GET");
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) flatten(f, k, v);
  const headers: Record<string, string> = { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY") ?? ""}` };
  if (method !== "GET") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (opts.idempotency) headers["Idempotency-Key"] = opts.idempotency;
  const url = `https://api.stripe.com/v1/${path}` + (method === "GET" && params ? "?" + f.toString() : "");
  try {
    const res = await fetch(url, { method, headers, body: method === "GET" ? undefined : f });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("stripe", path, data?.error?.code ?? res.status, data?.error?.message ?? "");
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error("stripe", path, String(e));
    return { ok: false, status: 0, data: { error: { message: "unreachable" } } };
  }
}

/** "Visa •••• 4242" for a payment method, or "" */
export async function cardLabel(paymentMethod: string | null | undefined) {
  if (!paymentMethod) return "";
  const r = await stripe(`payment_methods/${paymentMethod}`);
  const c = r.data?.card;
  return c ? `${String(c.brand ?? "card").replace(/^\w/, (x: string) => x.toUpperCase())} •••• ${c.last4}` : "";
}

/** A Stripe customer for this email: the one on file, or a new one. */
export async function customerFor(email: string, name: string, existing?: string | null) {
  if (existing) return existing;
  const r = await stripe("customers", { email, name: name || undefined, metadata: { source: "lumevina" } });
  return r.ok ? String(r.data.id) : null;
}

/**
 * Charge the card on file now (the visit, a tip, a fee). Resolves
 * { ok, id } or { ok: false, reason } where reason is Stripe's decline code
 * ("card_declined", "authentication_required", …): Evelyn then sends a pay link.
 */
export async function chargeOnFile(o: { customer: string; paymentMethod: string; cents: number; description: string; metadata: Record<string, string>; key: string }) {
  const r = await stripe("payment_intents", {
    amount: o.cents, currency: "usd", customer: o.customer, payment_method: o.paymentMethod,
    off_session: "true", confirm: "true", description: o.description, metadata: o.metadata,
  }, { idempotency: o.key });
  if (r.ok && r.data.status === "succeeded") return { ok: true as const, id: String(r.data.id) };
  const err = r.data?.error ?? {};
  return { ok: false as const, reason: String(err.decline_code ?? err.code ?? r.data?.status ?? "failed") };
}

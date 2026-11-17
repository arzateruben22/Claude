// A small in-memory stand-in for the Supabase client: just the calls the booking code makes.
export function makeDb(seed = {}) {
  const tables = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  const T = (n) => (tables[n] ??= []);
  let n = 0;
  const from = (name) => {
    const q = { op: "select", filters: [], patch: null, rows: null, single: false, maybe: false, returning: false, count: false, head: false };
    const b = {
      select(_c, o) { q.returning = true; if (o?.count) { q.count = true; q.head = !!o.head; } return b; },
      insert(r) { q.op = "insert"; q.rows = Array.isArray(r) ? r : [r]; return b; },
      update(p) { q.op = "update"; q.patch = p; return b; },
      delete() { q.op = "delete"; return b; },
      eq(k, v) { q.filters.push((r) => r[k] === v); return b; },
      neq(k, v) { q.filters.push((r) => r[k] !== v); return b; },
      in(k, a) { q.filters.push((r) => a.includes(r[k])); return b; },
      is(k, v) { q.filters.push((r) => (r[k] ?? null) === v); return b; },
      gte(k, v) { q.filters.push((r) => r[k] >= v); return b; },
      lte(k, v) { q.filters.push((r) => r[k] <= v); return b; },
      order() { return b; }, limit() { return b; },
      maybeSingle() { q.maybe = true; return b; },
      single() { q.single = true; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    const run = () => {
      const t = T(name);
      const hit = () => t.filter((r) => q.filters.every((f) => f(r)));
      if (q.op === "insert") {
        const added = q.rows.map((r) => ({ id: r.id ?? `${name}-${++n}`, ...r }));
        t.push(...added);
        return q.single || q.maybe ? { data: added[0], error: null } : { data: q.returning ? added : null, error: null };
      }
      if (q.op === "update") {
        const rows = hit();
        rows.forEach((r) => Object.assign(r, q.patch));
        if (q.single) return rows.length ? { data: { ...rows[0] }, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
        return { data: q.returning ? rows.map((r) => ({ ...r })) : null, error: null };
      }
      if (q.op === "delete") { const rows = hit(); rows.forEach((r) => t.splice(t.indexOf(r), 1)); return { data: null, error: null }; }
      const rows = hit();
      if (q.count && q.head) return { data: null, count: rows.length, error: null };
      if (q.single) return rows.length ? { data: { ...rows[0] }, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
      if (q.maybe) return { data: rows[0] ? { ...rows[0] } : null, error: null };
      return { data: rows.map((r) => ({ ...r })), count: rows.length, error: null };
    };
    return b;
  };
  return { from, rpc: async () => ({ data: null, error: null }), tables };
}

// A stand-in for the network: Stripe, the email service. Stripe remembers an idempotency key, like the real one.
export function makeNet() {
  const net = { stripe: [], emails: [], mode: "ok", keys: new Map(), pis: 0 };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : init.body ? JSON.parse(init.body) : {};
    const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (u.includes("api.stripe.com/v1/payment_intents") && init.method === "POST") {
      const key = init.headers?.["Idempotency-Key"];
      if (key && net.keys.has(key)) return net.keys.get(key);
      net.stripe.push({ kind: "charge", amount: Number(body.amount), customer: body.customer, pm: body.payment_method, off_session: body.off_session, key, description: body.description });
      const res = net.mode === "ok"
        ? json(200, { id: `pi_${++net.pis}`, status: "succeeded" })
        : json(402, { error: { code: "card_declined", decline_code: "insufficient_funds", message: "declined" } });
      if (key) net.keys.set(key, res);
      return res;
    }
    if (u.includes("api.stripe.com/v1/refunds")) {
      net.stripe.push({ kind: "refund", payment_intent: body.payment_intent, key: init.headers?.["Idempotency-Key"] });
      return json(200, { id: "re_1", status: "succeeded" });
    }
    if (u.includes("api.resend.com/emails")) {
      net.emails.push({ to: body.to, subject: body.subject, text: String(body.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
      return json(200, { id: "em_1" });
    }
    if (u.includes("api.stripe.com")) return json(200, {});
    throw new Error("unexpected network call in test: " + u);
  };
  return net;
}

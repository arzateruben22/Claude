// Lumevina — Supabase Edge Function: studio-book (v3)
//
// Evelyn's appointments, from her dashboard (Lumevina Studio → Appointments).
// Everything takes her studio key (x-studio-key).
//
// POST { action: "list", from, to }      → { bookings }  with each client's card, phone, notes,
//                                           pre-visit form, membership and points
// POST { action: "quote", id, services?, products?, tip_cents?, discount_cents?, gift_code?, points? }
//                                         → { quote }  what's due, line by line, before charging
// POST { action: "checkout", id, method: "card" | "cash" | "other" | "link", ...the same }
//   card: charged to the card on file now. link: a Stripe page the client pays on
//   their phone (→ { url }); the webhook finishes it. cash / other: recorded.
//   → { ok, quote, points } or { reason } (a declined card: try the link instead)
// POST { action: "fee", id, kind: "late_cancel" | "no_show", cents? }  charges the card on file
//   ($43 unless she says otherwise); a no-show is marked no-show either way
// POST { action: "no_show", id }        marks it, without a fee
// POST { action: "cancel", id, refund? }  Evelyn cancels: the deposit is refunded (unless refund: false),
//                                          a membership facial comes back, the client is told
// POST { action: "book", services, date, start_min, name, email, phone?, sms_ok?, note?,
//        use_membership?, request_card? }  she books for a client (any time, her hours don't apply)
// POST { action: "card_link", id }      emails the client a page to put a card on file
// POST { action: "waitlist" }           → { waitlist } upcoming days
// POST { action: "waitlist_remove", id }
//
// Deploy:  supabase functions deploy studio-book --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { studioOk } from "../_shared/studio.ts";
import { EMAIL, getContact, norm, upsertContact } from "../_shared/contacts.ts";
import { chargeOnFile, customerFor, stripe } from "../_shared/stripe.ts";
import { cancelBooking, confirmBooking, fmtWhen, LATE_FEE_CENTS, names, priceVisit, sendBookingMessage, site } from "../_shared/bookings.ts";
import { completeVisit, quoteVisit } from "../_shared/visits.ts";
import { memberFor, PLANS } from "../_shared/membership.ts";
import { esc, money, page, sendEmail } from "../_shared/mail.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-studio-key" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!studioOk(req)) return json({ reason: "studio_key" }, 401);

  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const one = async () => {
    const { data } = await db.from("bookings").select("*").eq("id", String(body.id ?? "")).maybeSingle();
    return data ?? null;
  };
  const input = () => ({
    services: Array.isArray(body.services) ? body.services.map(String) : undefined,
    products: Array.isArray(body.products) ? body.products : [],
    tip_cents: body.tip_cents, discount_cents: body.discount_cents, gift_code: body.gift_code, points: body.points,
  });
  /** the card that pays: the booking's, else the client's on file, else their membership's */
  const cardOf = async (b: any) => {
    if (b.stripe_customer && b.payment_method) return { customer: b.stripe_customer, pm: b.payment_method, label: b.card_label };
    const c = await getContact(db, b.guest_email);
    if (c?.stripe_customer && c.payment_method) return { customer: c.stripe_customer, pm: c.payment_method, label: c.card_label };
    const m = await memberFor(db, b.guest_email);
    if (m?.stripe_customer_id && m.payment_method) return { customer: m.stripe_customer_id, pm: m.payment_method, label: m.card_label };
    return null;
  };

  switch (body.action) {
    case "list": {
      const from = DAY.test(body.from) ? body.from : new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
      const to = DAY.test(body.to) ? body.to : new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);
      const { data } = await db.from("bookings").select("*").gte("date", from).lte("date", to)
        .in("status", ["held", "completed", "no_show", "cancelled"]).order("date").order("start_min").limit(400);
      const rows = data ?? [];
      const emails = [...new Set(rows.map((b: any) => norm(b.guest_email)).filter(Boolean))];
      const [{ data: cs }, { data: forms }, { data: ms }] = await Promise.all([
        db.from("contacts").select("email, phone, notes, card_label, visits, last_visit, source").in("email", emails),
        db.from("intake_forms").select("email, signed_at").in("email", emails),
        db.from("memberships").select("email, plan, status, credits").in("email", emails).neq("status", "cancelled"),
      ]);
      const by = (list: any[] | null, e: string) => (list ?? []).find((x: any) => x.email === e) ?? null;
      return json({ bookings: rows.map((b: any) => {
        const e = norm(b.guest_email), c = by(cs, e), m = by(ms, e);
        return {
          id: b.id, date: b.date, start_min: b.start_min, dur_min: b.dur_min, services: b.services, names: names(b.services),
          name: b.guest_name, email: e, phone: b.phone || c?.phone || null, note: b.note, status: b.status, source: b.source,
          deposit_cents: b.deposit_cents, paid_cents: b.paid_cents ?? 0, total_cents: b.total_cents,
          card: b.card_label || c?.card_label || null, member: m ? { plan: PLANS[m.plan]?.name, credits: m.credits } : null,
          membership_facial: !!b.membership_id, intake: !!by(forms, e), notes: c?.notes ?? null, visits: c?.visits ?? 0,
          from_glossgenius: c?.source === "glossgenius", cancel_kind: b.cancel_kind, fee_cents: b.fee_cents, fee_kind: b.fee_kind,
          balance_paid_cents: b.balance_paid_cents, tip_cents: b.tip_cents, checkout: b.checkout ? { method: b.checkout.method, charged_cents: b.checkout.charged_cents } : null,
          link_pending: !!b.checkout?.pending,
        };
      }) });
    }

    case "quote": {
      const b = await one();
      if (!b) return json({ reason: "not_found" }, 404);
      const q = await quoteVisit(db, b, input());
      const card = await cardOf(b);
      return json({ quote: { ...q, card: card?.label ?? null } });
    }

    case "checkout": {
      const b = await one();
      if (!b) return json({ reason: "not_found" }, 404);
      if (!["held", "no_show"].includes(b.status)) return json({ reason: "status" }, 409);
      const method = ["card", "cash", "other", "link"].includes(body.method) ? body.method : "cash";
      const q = await quoteVisit(db, b, input());
      if (method === "card") {
        const card = await cardOf(b);
        if (!card) return json({ reason: "no_card" }, 409);
        if (q.charge_cents > 0) {
          const r = await chargeOnFile({ customer: card.customer, paymentMethod: card.pm, cents: q.charge_cents,
            description: `Visit · ${names(q.services)}${q.tip_cents ? " + tip" : ""}`, metadata: { kind: "visit", booking_id: b.id },
            key: `visit-${b.id}-${q.charge_cents}` });
          if (!r.ok) return json({ reason: r.reason }, 402);
          if (!b.card_label) await db.from("bookings").update({ card_label: card.label, stripe_customer: card.customer, payment_method: card.pm }).eq("id", b.id);
          return json(await completeVisit(db, { ...b, card_label: card.label }, input(), { method, charge_id: r.id, charged_cents: q.charge_cents }));
        }
        return json(await completeVisit(db, b, input(), { method: "other", charged_cents: 0 }));
      }
      if (method === "link") {
        if (q.charge_cents <= 0) return json(await completeVisit(db, b, input(), { method: "other", charged_cents: 0 }));
        const c = await getContact(db, b.guest_email);
        const customer = await customerFor(norm(b.guest_email), b.guest_name ?? "", c?.stripe_customer);
        const items: any[] = [{ quantity: 1, price_data: { currency: "usd", unit_amount: q.due_cents, product_data: { name: `Your visit · ${names(q.services)}` } } }];
        if (q.tip_cents) items.push({ quantity: 1, price_data: { currency: "usd", unit_amount: q.tip_cents, product_data: { name: "Tip for Evelyn" } } });
        const s = await stripe("checkout/sessions", {
          mode: "payment", customer: customer ?? undefined, line_items: q.due_cents ? items : items.slice(1),
          success_url: `${site()}/?paid=1`, cancel_url: `${site()}/`, metadata: { kind: "visit", booking_id: b.id },
          payment_intent_data: { setup_future_usage: "off_session", metadata: { kind: "visit", booking_id: b.id } },
        });
        if (!s.ok || !s.data?.url) return json({ reason: "payment_unavailable" }, 502);
        await db.from("bookings").update({ checkout: { pending: input(), session: s.data.id } }).eq("id", b.id);
        return json({ url: s.data.url, quote: q });
      }
      return json(await completeVisit(db, b, input(), { method, charged_cents: q.charge_cents }));
    }

    case "fee": {
      const b = await one();
      if (!b) return json({ reason: "not_found" }, 404);
      const kind = body.kind === "no_show" ? "no_show" : "late_cancel";
      if (b.fee_cents) return json({ reason: "already" }, 409);
      const cents = Math.max(100, Math.min(50000, Math.round(Number(body.cents) || LATE_FEE_CENTS)));
      const card = await cardOf(b);
      if (!card) return json({ reason: "no_card" }, 409);
      const r = await chargeOnFile({ customer: card.customer, paymentMethod: card.pm, cents,
        description: kind === "no_show" ? "No-show fee" : "Late cancellation fee", metadata: { kind: "fee", booking_id: b.id }, key: `fee-${b.id}` });
      if (!r.ok) return json({ reason: r.reason }, 402);
      await db.from("bookings").update({ fee_cents: cents, fee_kind: kind, ...(kind === "no_show" && b.status === "held" ? { status: "no_show" } : {}) }).eq("id", b.id);
      await sendEmail(norm(b.guest_email), kind === "no_show" ? "Your missed Lumevina appointment" : "Your late cancellation at Lumevina",
        page(kind === "no_show" ? "We missed you." : "About your cancellation.",
          `<p style="font-size:15px;line-height:1.55">${esc(names(b.services))}, ${esc(fmtWhen(b.date, b.start_min))}. As the booking policy says, a ${money(cents)} fee was charged to ${esc(card.label ?? "your card on file")}.</p>` +
          `<p style="font-size:15px;line-height:1.55">Questions? Just reply to this email.</p>`), Deno.env.get("OWNER_EMAIL") ?? undefined);
      return json({ ok: true, cents });
    }

    case "no_show": {
      const b = await one();
      if (!b || b.status !== "held") return json({ reason: "status" }, 409);
      await db.from("bookings").update({ status: "no_show" }).eq("id", b.id);
      return json({ ok: true });
    }

    case "cancel": {
      const b = await one();
      if (!b) return json({ reason: "not_found" }, 404);
      const r = await cancelBooking(db, b, "evelyn", { refund: body.refund !== false });
      return r.ok ? json(r) : json({ reason: r.reason }, 409);
    }

    case "book": {
      const email = norm(body.email), name = clip(body.name, 120);
      if (!EMAIL.test(email) || !name) return json({ reason: "email" }, 400);
      const date = String(body.date ?? ""), start = Math.round(Number(body.start_min));
      if (!DAY.test(date) || !(start >= 0 && start < 1440)) return json({ reason: "time" }, 400);
      const price = await priceVisit(db, { services: Array.isArray(body.services) ? body.services.map(String) : [], date, start, email,
        signedIn: true, useMember: body.use_membership !== false });
      if (!price.ok) return json({ reason: price.reason }, 400);
      const c = await upsertContact(db, { email, name, phone: clip(body.phone, 40), sms_ok: !!body.sms_ok, source: "studio" });
      const m = price.covered ? price.member : null;
      const { data: b, error } = await db.from("bookings").insert({
        guest_name: name, guest_email: email, phone: clip(body.phone, 40) || null, sms_ok: !!body.sms_ok, note: clip(body.note, 500) || null,
        date, start_min: start, dur_min: price.dur_min, services: price.services, total_cents: price.total_cents, deposit_cents: 0,
        source: "admin", membership_id: m?.id ?? null,
      }).select("*").single();
      if (error) {
        const taken = String(error.message ?? "").includes("no_overlap") || error.code === "23P01";
        return json({ reason: taken ? "slot_taken" : "failed" }, taken ? 409 : 500);
      }
      const onFile = m?.payment_method ? { customer: m.stripe_customer_id, payment_method: m.payment_method, card_label: m.card_label }
        : c?.payment_method ? { customer: c.stripe_customer, payment_method: c.payment_method, card_label: c.card_label } : {};
      const done = await confirmBooking(db, b.id, { ...onFile, paid_cents: 0 }, { firstBooking: false, quiet: true });
      let cardUrl: string | null = null;
      if (done.ok && !("payment_method" in onFile) && body.request_card) cardUrl = await cardLink(db, done.booking);
      return json({ ok: done.ok, id: b.id, card: (onFile as any).card_label ?? null, card_link_sent: !!cardUrl });
    }

    case "card_link": {
      const b = await one();
      if (!b || b.status !== "held") return json({ reason: "status" }, 409);
      const url = await cardLink(db, b);
      return url ? json({ ok: true, url }) : json({ reason: "payment_unavailable" }, 502);
    }

    case "waitlist": {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await db.from("waitlist").select("*").gte("date", today).in("status", ["waiting", "offered"]).order("date").limit(100);
      return json({ waitlist: (data ?? []).map((w: any) => ({ ...w, names: names(w.services ?? []) })) });
    }
    case "waitlist_remove": {
      await db.from("waitlist").update({ status: "removed" }).eq("id", String(body.id ?? ""));
      return json({ ok: true });
    }
    default:
      return json({ error: "unknown action" }, 400);
  }
});

/** A Stripe page where the client puts a card on file for a booking Evelyn made; emailed to them. */
async function cardLink(db: any, b: any) {
  const c = await getContact(db, b.guest_email);
  const customer = await customerFor(norm(b.guest_email), b.guest_name ?? "", c?.stripe_customer);
  if (customer && !c?.stripe_customer) await db.from("contacts").update({ stripe_customer: customer }).eq("email", norm(b.guest_email));
  const s = await stripe("checkout/sessions", {
    mode: "setup", currency: "usd", customer: customer ?? undefined,
    success_url: `${site()}/?card=saved`, cancel_url: `${site()}/`,
    metadata: { kind: "card", booking_id: b.id }, setup_intent_data: { metadata: { kind: "card", booking_id: b.id } },
    custom_text: { submit: { message: "Nothing is charged now. Your card holds the time; a $43 fee applies only to a late cancellation or a no-show." } },
  });
  if (!s.ok || !s.data?.url) return null;
  await sendBookingMessage(db, b, "card", { url: s.data.url });
  return String(s.data.url);
}

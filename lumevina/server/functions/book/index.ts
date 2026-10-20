// Lumevina — Supabase Edge Function: book (v3)
//
// Booking on the website, for real. The calendar (js/booking.js) sends the
// visit here; this function prices it from the server's own menu, checks
// her hours and both calendars, holds the time, and hands the client to
// Stripe's page to pay the deposit and keep the card on file (or just keep
// the card, when nothing is due). Stripe sends them back with ?booked=<token>
// and the webhook confirms it (../_shared/bookings.ts → confirmBooking). A
// member's facial, or a signed-in client with a card already on file and
// nothing due, is confirmed right away.
//
// POST { action: "create", services, date, start_min, name, email, phone?, sms_ok?, note?,
//        consent: { signature }, flash?, ref_code?, points?, gift_code?, use_member?, returnUrl }
//   → { url } (Stripe) or { confirmed: true, booking } or { reason }
//     reasons: services, time, hours, slot_taken, email, consent, payment_unavailable
// POST { action: "get", token }                       → { booking }   (the link in every email)
// POST { action: "cancel", token }                    → { kind: in_time | late, booking }
// POST { action: "reschedule", token, date, start_min } → { booking } or { reason }
//   (48 hours ahead or more, never a Saturday: the policy)
// POST { action: "release", token }   back from Stripe without finishing: frees the time
// POST { action: "waitlist", date, services, name, email, phone?, sms_ok? }
// POST { action: "mine" }  + the client's sign-in → { bookings } upcoming and recent
//
// Deploy:  supabase functions deploy book --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, SITE_URL (+ the email, text and calendar ones)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { CATALOG } from "../_shared/catalog.ts";
import { addBooking, isBusy, removeBooking } from "../_shared/google.ts";
import { fitsHours, loadHours } from "../_shared/hours.ts";
import { EMAIL, getContact, norm, upsertContact } from "../_shared/contacts.ts";
import { balance, BLOCK_CENTS, BLOCK_POINTS } from "../_shared/points.ts";
import { customerFor, stripe } from "../_shared/stripe.ts";
import { notifyOwner } from "../_shared/notify.ts";
import {
  CANCEL_HOURS, cancelBooking, confirmBooking, fmtWhen, hoursUntil, isSaturday, names, priceVisit, sendBookingMessage, site,
} from "../_shared/bookings.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN = /^[0-9a-f]{32}$/;
const AHEAD_DAYS = 62;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** What the website shows about a booking (never the card itself). */
const view = (b: any) => ({
  token: b.manage_token, status: b.status, date: b.date, start_min: b.start_min, dur_min: b.dur_min,
  services: b.services, names: names(b.services), when: fmtWhen(b.date, b.start_min),
  name: b.guest_name, deposit_cents: b.deposit_cents, paid_cents: b.paid_cents ?? 0, total_cents: b.total_cents,
  member: !!b.membership_id, card: b.card_label ?? null, points_earned: b.points_earned ?? 0, first_bonus: !!b.first_bonus,
  cancel_kind: b.cancel_kind ?? null,
  free_change: b.status === "held" && hoursUntil(b.date, b.start_min) >= CANCEL_HOURS && !isSaturday(b.date),
  saturday: isSaturday(b.date),
});

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // a signed-in client (their own token, not the public key)
  let signedIn: string | null = null, clientId: string | null = null;
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await db.auth.getUser(jwt);
    if (data.user?.email) { signedIn = norm(data.user.email); clientId = data.user.id; }
  }
  const byToken = async () => {
    const t = String(body.token ?? "");
    if (!TOKEN.test(t)) return null;
    const { data } = await db.from("bookings").select("*").eq("manage_token", t).maybeSingle();
    return data ?? null;
  };

  switch (body.action) {
    case "create": {
      const email = norm(body.email);
      const name = clip(body.name, 120);
      if (!EMAIL.test(email) || !name) return json({ reason: "email" }, 400);
      if (signedIn && signedIn !== email) return json({ reason: "email" }, 400);   // signed in: books as themselves
      if (!clip(body.consent?.signature, 200)) return json({ reason: "consent" }, 400);
      const date = String(body.date ?? ""), start = Math.round(Number(body.start_min));
      if (!DAY.test(date) || !(start >= 0 && start < 1440) || start % 30) return json({ reason: "time" }, 400);
      const lead = hoursUntil(date, start);
      if (lead < 2 || lead > AHEAD_DAYS * 24) return json({ reason: "time" }, 400);

      const price = await priceVisit(db, {
        services: Array.isArray(body.services) ? body.services.map(String) : [], date, start, email,
        signedIn: !!signedIn, flash: !!body.flash, refCode: body.ref_code, useMember: body.use_member !== false,
      });
      if (!price.ok) return json({ reason: price.reason }, 400);

      // her hours, then her other calendar (GlossGenius appointments and personal blocks)
      if (!fitsHours(await loadHours(db), date, start, price.dur_min)) return json({ reason: "hours" }, 409);
      try {
        if (await isBusy(date, start - 30, price.dur_min + 60)) return json({ reason: "slot_taken" }, 409);
      } catch (e) { console.error("google", String(e)); }   // unreachable: the database still guards website bookings

      // what's due now: the deposit, less points (signed in, up to half), a gift and a carried-over deposit
      const contact = await upsertContact(db, { email, name, phone: clip(body.phone, 40), sms_ok: !!body.sms_ok });
      let due = price.deposit_cents, points = 0, gift = 0, giftCode: string | null = null, credit = 0;
      if (signedIn && Number(body.points) > 0 && due > 0) {
        const blocks = Math.min(Math.floor(Number(body.points) / BLOCK_POINTS), Math.floor((await balance(db, email)) / BLOCK_POINTS), Math.floor(due / 2 / BLOCK_CENTS));
        points = Math.max(0, blocks) * BLOCK_POINTS;
        due -= (points / BLOCK_POINTS) * BLOCK_CENTS;
      }
      const code = clip(body.gift_code, 20).toUpperCase();
      if (code) {
        const { data: g } = await db.from("gift_cards").select("*").eq("code", code).maybeSingle();
        if (g && g.status === "active" && g.balance_cents > 0) {
          giftCode = code;
          if (g.kind === "service") { if (price.services.includes(g.service_id)) due = 0; }   // used up at the visit
          else { gift = Math.min(g.balance_cents, due); due -= gift; }
        }
      }
      if (due > 0 && contact?.deposit_credit_cents > 0 && contact.deposit_credit_until && date <= contact.deposit_credit_until) {
        credit = Math.min(contact.deposit_credit_cents, due);
        due -= credit;
      }

      // hold the time (the database refuses an overlap, cleaning time included)
      const m = price.covered ? price.member : null;
      const { data: b, error } = await db.from("bookings").insert({
        client_id: clientId, guest_name: name, guest_email: email, phone: clip(body.phone, 40) || null, sms_ok: !!body.sms_ok,
        note: clip(body.note, 500) || null, consent: { signature: clip(body.consent?.signature, 200), signedAt: new Date().toISOString() },
        date, start_min: start, dur_min: price.dur_min, services: price.services,
        total_cents: price.total_cents, deposit_cents: price.deposit_cents, points_redeemed: points,
        flash: price.flash, referral_code: price.referral, source: body.source === "app" ? "app" : "web",
        membership_id: m?.id ?? null, gift_code: giftCode, gift_applied_cents: gift, credit_applied_cents: credit,
      }).select("*").single();
      if (error) {
        const taken = String(error.message ?? "").includes("no_overlap") || error.code === "23P01";
        if (!taken) console.error("booking", error);
        return json({ reason: taken ? "slot_taken" : "failed" }, taken ? 409 : 500);
      }

      // nothing due and a card already on file (a member's, or theirs when signed in): booked now
      const onFile = m?.payment_method ? { customer: m.stripe_customer_id, payment_method: m.payment_method, card_label: m.card_label }
        : signedIn && contact?.payment_method ? { customer: contact.stripe_customer, payment_method: contact.payment_method, card_label: contact.card_label } : null;
      if (due === 0 && onFile) {
        const done = await confirmBooking(db, b.id, { ...onFile, paid_cents: 0 });
        return json({ confirmed: true, booking: view(done.ok ? done.booking : b), points: done.ok ? done.points : null });
      }

      // Stripe's page: pay the deposit and keep the card, or just keep the card
      const back = /^https:\/\//.test(String(body.returnUrl ?? "")) && (!site() || String(body.returnUrl).startsWith(site()))
        ? String(body.returnUrl).split(/[?#]/)[0] : site() + "/";
      const customer = await customerFor(email, name, contact?.stripe_customer);
      if (customer && !contact?.stripe_customer) await db.from("contacts").update({ stripe_customer: customer }).eq("email", email);
      const what = `${names(price.services)}, ${fmtWhen(date, start)}`;
      const meta = { kind: "booking", booking_id: b.id };
      const params: Record<string, unknown> = {
        customer: customer ?? undefined, customer_email: customer ? undefined : email,
        success_url: `${back}?booked=${b.manage_token}`, cancel_url: `${back}?booked=cancelled&b=${b.manage_token}#book`,
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60, metadata: meta,
      };
      if (due > 0) Object.assign(params, {
        mode: "payment",
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: due, product_data: { name: `Deposit · ${names(price.services)}`, description: fmtWhen(date, start) + ". It goes toward your total." } } }],
        payment_intent_data: { setup_future_usage: "off_session", description: `Deposit · ${what}`, metadata: meta },
        custom_text: { submit: { message: "Your card stays on file for this visit. Change or cancel up to 48 hours ahead and your deposit moves with you." } },
      });
      else Object.assign(params, {
        mode: "setup", currency: "usd",
        setup_intent_data: { description: `Card on file · ${what}`, metadata: meta },
        custom_text: { submit: { message: "Nothing is charged now. Your card holds the time; a $43 fee applies only to a late cancellation or a no-show." } },
      });
      const s = await stripe("checkout/sessions", params);
      if (!s.ok || !s.data?.url) {
        await db.from("bookings").update({ status: "cancelled" }).eq("id", b.id).eq("status", "pending");
        return json({ reason: "payment_unavailable" }, 502);
      }
      await db.from("bookings").update({ stripe_session: s.data.id }).eq("id", b.id);
      return json({ url: s.data.url, token: b.manage_token, due_cents: due });
    }

    case "get": {
      const b = await byToken();
      if (!b) return json({ reason: "not_found" }, 404);
      return json({ booking: view(b) });
    }

    case "release": {
      const b = await byToken();
      if (b?.status === "pending") {
        await db.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", b.id).eq("status", "pending");
        if (b.stripe_session) await stripe(`checkout/sessions/${b.stripe_session}/expire`, {});
      }
      return json({ ok: true });
    }

    case "cancel": {
      const b = await byToken();
      if (!b) return json({ reason: "not_found" }, 404);
      const r = await cancelBooking(db, b, "client");
      if (!r.ok) return json({ reason: r.reason }, 409);
      const { data: after } = await db.from("bookings").select("*").eq("id", b.id).maybeSingle();
      return json({ kind: r.kind, booking: view(after ?? b) });
    }

    case "reschedule": {
      const b = await byToken();
      if (!b) return json({ reason: "not_found" }, 404);
      if (b.status !== "held") return json({ reason: "status" }, 409);
      if (isSaturday(b.date)) return json({ reason: "saturday" }, 409);
      if (hoursUntil(b.date, b.start_min) < CANCEL_HOURS) return json({ reason: "late" }, 409);
      const date = String(body.date ?? ""), start = Math.round(Number(body.start_min));
      if (!DAY.test(date) || !(start >= 0 && start < 1440) || start % 30) return json({ reason: "time" }, 400);
      const lead = hoursUntil(date, start);
      if (lead < 2 || lead > AHEAD_DAYS * 24) return json({ reason: "time" }, 400);
      if (!fitsHours(await loadHours(db), date, start, b.dur_min)) return json({ reason: "hours" }, 409);
      try {
        if (b.google_event_id) await removeBooking(b.google_event_id);   // its own time shouldn't count against it
        if (await isBusy(date, start - 30, b.dur_min + 60)) {
          if (b.google_event_id) await addBooking({ id: b.id, date: b.date, start_min: b.start_min, dur_min: b.dur_min, title: `${names(b.services)} · ${b.guest_name}` }).catch(() => null);
          return json({ reason: "slot_taken" }, 409);
        }
      } catch (e) { console.error("google", String(e)); }
      const from = fmtWhen(b.date, b.start_min);
      const { data: moved, error } = await db.from("bookings").update({ date, start_min: start, google_event_id: null }).eq("id", b.id).select("*").single();
      if (error) {
        const taken = String(error.message ?? "").includes("no_overlap") || error.code === "23P01";
        return json({ reason: taken ? "slot_taken" : "failed" }, taken ? 409 : 500);
      }
      try {
        const id = await addBooking({ id: b.id, date, start_min: start, dur_min: b.dur_min, title: `${names(b.services)} · ${b.guest_name}`, note: b.note ?? "" });
        if (id) await db.from("bookings").update({ google_event_id: id }).eq("id", b.id);
      } catch (e) { console.error("google", String(e)); }
      await sendBookingMessage(db, moved, "moved", { from });
      await notifyOwner(db, { kind: "booking", url: "dashboard.html#appointments", title: `Moved: ${b.guest_name}`, body: `${names(b.services)}: ${from} → ${fmtWhen(date, start)}.` }).catch(() => {});
      return json({ booking: view(moved) });
    }

    case "waitlist": {
      const email = norm(body.email), name = clip(body.name, 120), date = String(body.date ?? "");
      if (!EMAIL.test(email) || !name) return json({ reason: "email" }, 400);
      if (!DAY.test(date) || hoursUntil(date, 1439) < 0) return json({ reason: "time" }, 400);
      const services = (Array.isArray(body.services) ? body.services : []).map(String).filter((id: string) => CATALOG[id]?.offered).slice(0, 4);
      const { data: had } = await db.from("waitlist").select("id").eq("email", email).eq("date", date).in("status", ["waiting", "offered"]).maybeSingle();
      if (!had) {
        await db.from("waitlist").insert({ date, services, name, email, phone: clip(body.phone, 40) || null, sms_ok: !!body.sms_ok });
        await upsertContact(db, { email, name, phone: clip(body.phone, 40), sms_ok: !!body.sms_ok });
        await notifyOwner(db, { kind: "waitlist", url: "dashboard.html#appointments", title: `Waitlist: ${name}`, body: `Wants ${fmtWhen(date, 720).replace(/ at .*/, "")}${services.length ? " · " + names(services) : ""}.` }).catch(() => {});
      }
      return json({ ok: true });
    }

    case "mine": {
      if (!signedIn) return json({ reason: "sign_in" }, 401);
      const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const { data } = await db.from("bookings").select("*").eq("guest_email", signedIn).gte("date", since)
        .in("status", ["held", "completed", "cancelled", "no_show"]).order("date", { ascending: true }).limit(30);
      const c = await getContact(db, signedIn);
      return json({ bookings: (data ?? []).map(view), card: c?.card_label ?? null,
        credit_cents: c?.deposit_credit_cents && c.deposit_credit_until >= new Date().toISOString().slice(0, 10) ? c.deposit_credit_cents : 0 });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
});

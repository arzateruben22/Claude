// Lumevina — gift certificates, shared by the gift-cards function and the
// payment webhook (when the shop takes real payments, stripe-webhook calls
// issueGift for each paid "gift-any-<amount>" line, after Stripe confirms,
// never before).

// deno-lint-ignore-file no-explicit-any

// LUM-XXXX-XXXX, without the look-alikes O/0/1/I (same alphabet as js/giftcards.js)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const chunk = (n: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
};
export const newCode = () => `LUM-${chunk(4)}-${chunk(4)}`;

export type NewGift = {
  amountCents: number;
  recipientName?: string;
  recipientEmail?: string;
  buyerEmail?: string;
  message?: string;
  deliverToBuyer?: boolean;
  sendDate?: string | null;
  source?: "sale" | "studio" | "membership";
  paymentIntent?: string;
  /* a treatment certificate (a gifted membership facial): covers that one service */
  kind?: "value" | "service";
  serviceId?: string;
  label?: string;
};

const clip = (v: unknown, n: number) => (v == null || v === "" ? null : String(v).slice(0, n));

/** Store a new certificate (a dollar value, or one treatment) and return its row (with its code). */
export async function issueGift(db: any, g: NewGift) {
  for (let tries = 0; tries < 5; tries++) {
    const row = {
      code: newCode(),
      kind: g.kind === "service" ? "service" : "value",
      label: g.kind === "service" ? clip(g.label, 120) ?? "One treatment" : "Any treatment",
      service_id: g.kind === "service" ? clip(g.serviceId, 80) : null,
      amount_cents: g.amountCents,
      balance_cents: g.amountCents,
      recipient_name: clip(g.recipientName, 120),
      recipient_email: clip(g.recipientEmail, 200)?.toLowerCase() ?? null,
      buyer_email: clip(g.buyerEmail, 200)?.toLowerCase() ?? null,
      message: clip(g.message, 500),
      deliver_to_buyer: !!g.deliverToBuyer,
      send_date: g.sendDate ?? null,
      source: g.source ?? "sale",
      stripe_payment_intent: g.paymentIntent ?? null,
    };
    const { data, error } = await db.from("gift_cards").insert(row).select().single();
    if (!error) return data;
    if (error.code !== "23505") throw error;   // 23505: that code exists already; draw another
  }
  throw new Error("couldn't find a free gift code");
}

/** What anyone holding the code may see. */
export function publicCard(c: any) {
  return {
    code: c.code,
    kind: c.kind,
    label: c.label,
    amount: c.amount_cents / 100,
    balance: c.balance_cents / 100,
    status: c.status,
  };
}

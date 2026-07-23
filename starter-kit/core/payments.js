/* Payments — card validation, brand detection, a saved-card vault, and the
 * single Stripe integration point. No UI, no styling.
 *
 * DEMO: process() simulates a charge; the vault stores only brand + last4.
 * LIVE: replace process() with a Stripe PaymentIntent confirm, and back the
 * vault with a Stripe SetupIntent (off-session) so you can charge saved cards
 * for rebookings and no-show fees.
 */

export function luhnValid(digits) {
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function cardValid(value) {
  const d = String(value).replace(/\D/g, "");
  return d.length >= 13 && d.length <= 16 && luhnValid(d);
}

export function expiryValid(value) {
  const m = String(value).match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return false;
  const year = 2000 + Number(m[2]);
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export const cvcValid = (v) => /^\d{3,4}$/.test(String(v));

export function cardBrand(value) {
  const d = String(value).replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6(011|5)/.test(d)) return "Discover";
  return "Card";
}

export const money = (n) => "$" + Number(n).toFixed(2);

export function createPayments({ store, key = "cards" } = {}) {
  const load = () => (store ? store.get(key, {}) : {});
  const norm = (e) => (e || "").trim().toLowerCase();

  /* Replace this body with a real Stripe confirm when you go live. */
  async function process(payment) {
    await new Promise((r) => setTimeout(r, 400));
    return { id: "PAY-" + Date.now().toString(36).toUpperCase() };
  }

  return {
    luhnValid, cardValid, expiryValid, cvcValid, cardBrand, money, process,

    /* Save a card on file (demo: brand + last4 only, keyed by email). */
    saveCard(email, cardValue, expiry) {
      const e = norm(email); if (!e || !store) return null;
      const digits = String(cardValue).replace(/\D/g, "");
      const rec = { brand: cardBrand(cardValue), last4: digits.slice(-4),
        expiry: expiry || "", token: "pm_demo_" + Date.now().toString(36), savedAt: new Date().toISOString() };
      const all = load(); all[e] = rec; store.set(key, all);
      return rec;
    },
    getCard(email) { return store ? (load()[norm(email)] || null) : null; },
    forgetCard(email) { const all = load(); delete all[norm(email)]; if (store) store.set(key, all); }
  };
}

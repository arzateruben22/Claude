/* Gift certificates — issue, look up, quote, and redeem with rollover balances.
 * A certificate holds a value; a "service gift" is just a value labelled with
 * that service's name. Redemption decrements the balance so partials carry over.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I

export function createGiftCards({ store, key = "giftcards", codePrefix = "GC" } = {}) {
  const load = () => (store ? store.get(key, []) : []);
  const save = (list) => { if (store) store.set(key, list); };
  const norm = (c) => (c || "").trim().toUpperCase();

  function chunk(n) { let o = ""; for (let i = 0; i < n; i++) o += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; return o; }
  function newCode() { return codePrefix + "-" + chunk(4) + "-" + chunk(4); }

  return {
    /* Issue a certificate; returns the stored record incl. its code. */
    create(d = {}) {
      const list = load();
      let code = newCode();
      while (list.some((g) => g.code === code)) code = newCode();
      const amount = Math.max(0, Number(d.amount) || 0);
      const card = {
        code, amount, balance: amount,
        label: d.label || "Any service", serviceId: d.serviceId || null,
        recipientName: d.recipientName || "", recipientEmail: d.recipientEmail || "",
        message: d.message || "", deliverToBuyer: !!d.deliverToBuyer,
        sendDate: d.sendDate || null, boughtBy: d.boughtBy || "",
        status: "active", purchasedAt: new Date().toISOString()
      };
      list.push(card); save(list);
      return card;
    },

    lookup(code) { return load().find((g) => g.code === norm(code)) || null; },

    /* How much of `amount` a code can cover right now (0 if invalid/empty). */
    quote(code, amount) {
      const g = this.lookup(code);
      if (!g || g.status === "void" || g.balance <= 0) return 0;
      return Math.min(g.balance, Math.max(0, Number(amount) || 0));
    },

    /* Commit a redemption: decrement balance, flip to redeemed when empty. */
    redeem(code, amount) {
      const list = load();
      const g = list.find((x) => x.code === norm(code));
      if (!g) return { ok: false, reason: "not_found" };
      if (g.status === "void") return { ok: false, reason: "void" };
      if (g.balance <= 0) return { ok: false, reason: "empty" };
      const applied = Math.min(g.balance, Math.max(0, Number(amount) || 0));
      g.balance = Math.round((g.balance - applied) * 100) / 100;
      g.status = g.balance <= 0 ? "redeemed" : "active";
      g.lastUsedAt = new Date().toISOString();
      save(list);
      return { ok: true, applied, balance: g.balance, card: g };
    },

    all() { return load(); },

    /* Outstanding liability = money collected but not yet redeemed. */
    liability() { return load().reduce((a, g) => a + Number(g.balance || 0), 0); }
  };
}

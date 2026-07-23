/* Rewards — a loyalty engine (points, referrals, birthday, streak, welcome).
 * Headless: it owns the rules and the ledger, you own the UI.
 *
 * Points earn on money spent; a "block" of points redeems for a dollar value.
 * All amounts/rules are config so you can tune them per business.
 */

const DEFAULTS = {
  earnPerDollar: 1,     // points per $1 spent
  blockPoints: 100,     // points in one redeemable block
  blockValue: 10,       // $ a block is worth
  welcomeBonus: 50,     // first-ever sign-up / booking
  referralBonus: 150,   // when a referred friend books
  birthdayBonus: 50,    // once per birthday month
  streakBonus: 25,      // consecutive-visit reward
  streakDays: 35        // max gap (days) that keeps a streak alive
};

export function createRewards({ store, key = "rewards", config = {} } = {}) {
  const cfg = { ...DEFAULTS, ...config };

  function load() {
    let s = store ? store.get(key, null) : null;
    if (!s) s = { points: 0, history: [], lastVisit: null, refCode: null, welcomed: false, birthdayYear: null };
    if (!s.refCode) s.refCode = "REF-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    return s;
  }
  function save(s) { if (store) store.set(key, s); }

  function log(s, points, note) {
    s.history.unshift({ points, note, at: new Date().toISOString() });
    s.history = s.history.slice(0, 100);
  }

  return {
    config: cfg,
    points() { return load().points; },
    refCode() { return load().refCode; },
    history() { return load().history; },
    blockPoints: cfg.blockPoints,
    blockValue: cfg.blockValue,
    referralBonus: cfg.referralBonus,

    /* Preview the points a spend would earn, including any active bonuses. */
    quote(amount, ctx = {}) {
      const s = load();
      let points = Math.round(amount * cfg.earnPerDollar);
      const notes = [];
      if (ctx.dayKey && s.lastVisit) {
        const gap = (new Date(ctx.dayKey) - new Date(s.lastVisit)) / 86400000;
        if (gap > 0 && gap <= cfg.streakDays) { points += cfg.streakBonus; notes.push("streak +" + cfg.streakBonus); }
      }
      const bMonth = ctx.birthdayMonth, nowMonth = new Date().getMonth() + 1;
      if (bMonth && bMonth === nowMonth && s.birthdayYear !== new Date().getFullYear()) {
        points += cfg.birthdayBonus; notes.push("birthday +" + cfg.birthdayBonus);
      }
      return { points, notes };
    },

    /* Commit an earn (call after a paid transaction). */
    award(amount, ctx = {}, note = "Purchase") {
      const s = load();
      const q = this.quote(amount, ctx);
      s.points += q.points;
      if (ctx.dayKey) s.lastVisit = ctx.dayKey;
      if (q.notes.some((n) => n.startsWith("birthday"))) s.birthdayYear = new Date().getFullYear();
      log(s, q.points, note + (q.notes.length ? " (" + q.notes.join(", ") + ")" : ""));
      save(s);
      return q;
    },

    spend(points, note = "Redeemed") {
      const s = load();
      if (points > s.points) return false;
      s.points -= points; log(s, -points, note); save(s); return true;
    },

    /* How many whole blocks can cover up to `cap` dollars. */
    redeemableBlocks(cap) {
      const s = load();
      const byPoints = Math.floor(s.points / cfg.blockPoints);
      const byValue = cap != null ? Math.floor(cap / cfg.blockValue) : Infinity;
      return Math.max(0, Math.min(byPoints, byValue));
    },

    claimWelcome() {
      const s = load();
      if (s.welcomed) return 0;
      s.welcomed = true; s.points += cfg.welcomeBonus; log(s, cfg.welcomeBonus, "Welcome bonus"); save(s);
      return cfg.welcomeBonus;
    },

    creditReferral() {
      const s = load();
      s.points += cfg.referralBonus; log(s, cfg.referralBonus, "Referral"); save(s);
      return cfg.referralBonus;
    }
  };
}

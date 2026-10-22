/* Lumevina Skin Intelligence — sign-in for the client portal and the studio
 *
 * Supabase Auth's emailed link, with the same browser keys as js/account.js
 * (lumevina_auth, lumevina_account), so signing in on the main site signs
 * the client in here too, and the reverse. Staff use separate keys
 * (lumevina_staff_auth) so a client's session and a staff session never mix
 * on a shared device, and add multifactor (an authenticator app code):
 * Skin Intelligence's staff function refuses any staff token without it.
 *
 * In demo mode (no Supabase in js/site-config.js) there is no real sign-in:
 * the pages run on the synthetic demo record.
 */

const CFG = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};
export const LIVE = /^https:\/\//.test(CFG.supabase || "") && !!CFG.key;
const AUTH = LIVE ? CFG.supabase.replace(/\/$/, "") + "/auth/v1" : "";

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

async function authCall(path, body, token, method) {
  const headers = { apikey: CFG.key, "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(AUTH + path, { method: method || (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { j.status = r.status; throw j; }
  return j;
}

const tokensFrom = (j) => ({ access: j.access_token, refresh: j.refresh_token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 });

/** The claims inside an access token (for showing aal; the server verifies). */
export function claims(token) {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; }
}

/**
 * kind 'client' shares js/account.js's keys; kind 'staff' keeps its own.
 */
export function createSession(kind = "client") {
  const AUTH_KEY = kind === "staff" ? "lumevina_staff_auth" : "lumevina_auth";
  const WHO_KEY = kind === "staff" ? "lumevina_staff_account" : "lumevina_account";
  let auth = store.get(AUTH_KEY);
  let who = store.get(WHO_KEY);
  let timer = null;
  const listeners = new Set();
  const changed = () => listeners.forEach((f) => f());

  const keep = (a) => { auth = a; store.set(AUTH_KEY, a); schedule(); };
  const schedule = () => { clearTimeout(timer); if (auth?.refresh) timer = setTimeout(refresh, Math.max(5000, auth.expiresAt - Date.now() - 120000)); };

  async function refresh() {
    if (!LIVE || !auth?.refresh) return null;
    try { keep(tokensFrom(await authCall("/token?grant_type=refresh_token", { refresh_token: auth.refresh }))); return auth; }
    catch (e) { if (e instanceof TypeError) { timer = setTimeout(refresh, 60000); return null; } end(); return null; }
  }
  function end() { auth = null; who = null; store.set(AUTH_KEY, null); store.set(WHO_KEY, null); clearTimeout(timer); changed(); }

  /** The emailed link lands with #access_token=…; take it, then clean the address bar. */
  async function arrive() {
    if (!LIVE || !/access_token=|error_description=/.test(location.hash)) return { arrived: false };
    const q = Object.fromEntries(location.hash.slice(1).split("&").map((kv) => kv.split("=").map((x) => decodeURIComponent(x.replace(/\+/g, " ")))));
    history.replaceState(null, "", location.pathname + location.search);
    if (!q.access_token) return { arrived: false, error: /expired/i.test(q.error_description || "") ? "That sign-in link has expired. Send yourself a new one." : "That sign-in link didn't work. Send yourself a new one." };
    keep(tokensFrom(q));
    try {
      const u = await authCall("/user", null, auth.access);
      who = { name: u.user_metadata?.name || String(u.email).split("@")[0], email: u.email, since: Date.parse(u.created_at) || Date.now() };
      store.set(WHO_KEY, who);
      changed();
      return { arrived: true };
    } catch { end(); return { arrived: false, error: "That sign-in link didn't work. Send yourself a new one." }; }
  }

  async function sendLink(email, name = "") {
    if (!LIVE) throw { message: "demo" };
    const back = location.origin + location.pathname;
    await authCall("/otp?redirect_to=" + encodeURIComponent(back), { email: String(email).trim().toLowerCase(), create_user: kind !== "staff", data: name ? { name } : undefined });
  }

  async function signOut({ everywhere = false } = {}) {
    if (LIVE && auth?.access) { try { await authCall(`/logout${everywhere ? "?scope=global" : ""}`, {}, auth.access); } catch { /* signed out locally anyway */ } }
    end();
  }

  /* ── multifactor (staff) ── */
  async function factors() { const u = await authCall("/user", null, await token()); return (u.factors || []).filter((f) => f.factor_type === "totp"); }
  async function enrollTotp(label = "Lumevina Studio") { return authCall("/factors", { factor_type: "totp", friendly_name: label }, await token()); }
  async function verifyTotp(factorId, code) {
    const ch = await authCall(`/factors/${factorId}/challenge`, {}, await token());
    const j = await authCall(`/factors/${factorId}/verify`, { challenge_id: ch.id, code: String(code).replace(/\s/g, "") }, await token());
    keep(tokensFrom(j));
    changed();
    return true;
  }
  const aal = () => (auth?.access ? claims(auth.access).aal || "aal1" : null);

  async function token() {
    if (!auth) return null;
    if (auth.expiresAt - Date.now() < 60000) await refresh();
    return auth?.access ?? null;
  }

  schedule();
  return {
    kind, live: LIVE,
    signedIn: () => !!auth?.access, who: () => who, aal, token, arrive, sendLink, signOut, refresh,
    factors, enrollTotp, verifyTotp,
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
  };
}

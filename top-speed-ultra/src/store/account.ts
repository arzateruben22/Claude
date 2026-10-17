// Your store account: a magic-link sign-in by email, the 13+ age answer, and sign-out. Playing never needs an
// account; it is only for buying and for getting your items back on another device.
//
// TEST MODE (Lumevina's demo pattern): "Send my sign-in link" signs straight in, with a test account made from the
// email on this device. Nothing is sent anywhere.
// LIVE: Supabase Auth. requestLink() asks Supabase to email a one-tap link; the link comes back to this page with
// the session in the address bar's #fragment, which consumeRedirect() reads and clears. Tokens are refreshed before
// they expire. The endpoints are Supabase Auth's REST API, called with fetch (no SDK); verify them at launch.
//
// The age question is neutral ("What month and year were you born?", no default, no hint of the cutoff) and asked
// before anything is collected. Only the answer's result is kept: 13 or over, or not. Never the date.
import { CONFIG, sbHeaders } from './config';
import { load, save, drop, emit, sessionSave } from './bus';

export interface Session {
  userId: string;
  email: string;
  test: boolean;
  since: number;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;              // ms
}

const SESSION_KEY = 'ocu.store.session';
const AGE_KEY = 'ocu.store.age';
let session: Session | null = load<Session | null>(SESSION_KEY, null);
if (session && session.test !== !CONFIG.live) session = null;     // a test session never carries into a live build, or back
let lastError = '';

export const current = () => session;
export const signedIn = () => !!session;
export const authError = () => lastError;
export const clearAuthError = () => { lastError = ''; };
function setSession(s: Session | null) {
  session = s;
  if (s) save(SESSION_KEY, s); else drop(SESSION_KEY);
  emit();
}

// ------------------------------------------------------------------------------------------- age (COPPA)
export type AgeState = 'unknown' | 'ok' | 'under13';
export function ageState(): AgeState {
  const a = load<{ ok13: boolean } | null>(AGE_KEY, null);
  return !a ? 'unknown' : a.ok13 ? 'ok' : 'under13';
}
// month 1-12. Conservative: in your birthday month you count as not yet 13, so nobody passes early.
export function answerAge(year: number, month: number, now = new Date()): AgeState {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 1900 || year > now.getFullYear()) return 'unknown';
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  const ok13 = months > 13 * 12;
  save(AGE_KEY, { ok13, at: Date.now() });
  emit();
  return ok13 ? 'ok' : 'under13';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validEmail = (e: string) => EMAIL.test(e.trim()) && e.trim().length <= 254;

// a stable test account id from the email, so signing in again on this device brings your test items back
function testId(email: string) {
  let h = 0x811c9dc5;
  for (const c of email.trim().toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'test-' + h.toString(16).padStart(8, '0');
}

// ------------------------------------------------------------------------------------------- sign in
// Test mode: signed in when this resolves ({ signedIn: true }). Live: the link is on its way ({ sent: true }).
export async function requestLink(email: string): Promise<{ signedIn?: true; sent?: true; error?: string }> {
  const e = email.trim().toLowerCase();
  if (!validEmail(e)) return { error: 'Please type a valid email address.' };
  if (!CONFIG.live) {
    await new Promise((r) => setTimeout(r, 600));
    setSession({ userId: testId(e), email: e, test: true, since: Date.now() });
    return { signedIn: true };
  }
  if (!CONFIG.canRedirect) return { error: 'Signing in works on the game\'s website, not from a copy opened from disk.' };
  const back = `${location.origin}${location.pathname}?store=signin`;
  try {
    const r = await fetch(`${CONFIG.supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(back)}`, {
      method: 'POST', headers: sbHeaders(null), body: JSON.stringify({ email: e, create_user: true }),
    });
    if (r.status === 429) return { error: 'Too many sign-in emails just now. Try again in a few minutes.' };
    if (!r.ok) return { error: `The sign-in email could not be sent (${r.status}). Try again in a moment.` };
    return { sent: true };
  } catch {
    return { error: 'No connection. Check your signal and try again.' };
  }
}

interface TokenReply { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user?: { id: string; email?: string } }
function fromTokens(t: TokenReply, email: string, userId: string): Session {
  const expiresAt = t.expires_at ? t.expires_at * 1000 : Date.now() + (t.expires_in ?? 3600) * 1000;
  return { userId, email, test: false, since: Date.now(), accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt };
}

// the page loaded from a sign-in link: read the session from the #fragment, check it with Supabase, clear the address
async function consumeRedirect(): Promise<void> {
  if (!CONFIG.live || typeof location !== 'object') return;
  const hash = location.hash.startsWith('#') ? new URLSearchParams(location.hash.slice(1)) : null;
  const q = new URLSearchParams(location.search);
  if (!hash || (!hash.get('access_token') && !hash.get('error'))) return;
  // before the address is cleared below: App reads this on its first render to open the Store again
  sessionSave('ocu.store.reopen', true);
  const clean = () => {
    q.delete('store');
    const qs = q.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch { /* sandboxed */ }
  };
  if (hash.get('error')) {
    lastError = hash.get('error_code') === 'otp_expired' ? 'That sign-in link has expired or was used already. Send a new one.' : `Sign-in did not finish: ${hash.get('error_description') ?? hash.get('error')}`;
    clean(); emit();
    return;
  }
  const t: TokenReply = {
    access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token') ?? '',
    expires_in: Number(hash.get('expires_in')) || undefined, expires_at: Number(hash.get('expires_at')) || undefined,
  };
  clean();
  try {
    const r = await fetch(`${CONFIG.supabaseUrl}/auth/v1/user`, { headers: sbHeaders(t.access_token, false) });
    if (!r.ok) throw new Error(String(r.status));
    const u = await r.json() as { id: string; email?: string };
    setSession(fromTokens(t, u.email ?? '', u.id));
  } catch {
    lastError = 'Sign-in could not be checked. Send a new link and try again.';
    emit();
  }
}
export const ready: Promise<void> = consumeRedirect();

// a fresh access token for a server call, refreshed when it is within a minute of expiring; null when signed out
export async function accessToken(): Promise<string | null> {
  const s = session;
  if (!s || s.test || !s.accessToken) return null;
  if ((s.expiresAt ?? 0) - 60000 > Date.now()) return s.accessToken;
  if (!s.refreshToken) { setSession(null); return null; }
  try {
    const r = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: sbHeaders(null), body: JSON.stringify({ refresh_token: s.refreshToken }),
    });
    if (r.status === 400 || r.status === 401) { setSession(null); return null; }   // revoked or reused: sign in again
    if (!r.ok) return null;
    const t = await r.json() as TokenReply;
    setSession(fromTokens(t, t.user?.email ?? s.email, t.user?.id ?? s.userId));
    return session!.accessToken!;
  } catch {
    return null;                                                                   // offline: try again later
  }
}

// record "13 or over" on your profile row, which the checkout function checks (live only)
export async function ensureProfile(): Promise<boolean> {
  if (!CONFIG.live) return true;
  const s = session, token = await accessToken();
  if (!s || !token || ageState() !== 'ok') return false;
  try {
    const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST', headers: { ...sbHeaders(token), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: s.userId, is_13_plus: true }),
    });
    return r.ok;
  } catch { return false; }
}

export async function signOut() {
  const s = session;
  setSession(null);
  if (s && !s.test && s.accessToken) {
    try { await fetch(`${CONFIG.supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: sbHeaders(s.accessToken, false) }); } catch { /* signed out here anyway */ }
  }
}

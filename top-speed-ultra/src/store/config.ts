/// <reference types="vite/client" />
// The store's one switch, read at build time. TEST MODE unless all three are set and VITE_PAYMENTS_LIVE is exactly
// "true":
//
//   VITE_SUPABASE_URL        https://<project>.supabase.co (the project's API URL)
//   VITE_SUPABASE_ANON_KEY   the project's anon (or publishable) key: public by design, row-level security guards
//                            the data. Never put the service-role or a secret key in a VITE_ variable: Vite bakes
//                            every VITE_ value into the page.
//   VITE_PAYMENTS_LIVE       "true" turns live mode on
//
// In TEST MODE nothing leaves the browser: no request to Supabase or Stripe, the card form takes Stripe's test cards
// only, and what you "buy" is kept in this browser's storage. Live mode is the owner's decision (server/README.md).

export interface StoreConfig {
  live: boolean;
  supabaseUrl: string;
  anonKey: string;
  // why the store is in test mode, for the owner (shown small in the store); empty when live
  why: string;
  // a live build opened from disk (file://) can't come back from Stripe's page or a sign-in link
  canRedirect: boolean;
}

function read(): StoreConfig {
  let env: Record<string, unknown> = {};
  try { env = import.meta.env as unknown as Record<string, unknown>; } catch { /* no env: test mode */ }
  const url = String(env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const flag = String(env.VITE_PAYMENTS_LIVE ?? '').trim();
  let why = '';
  if (flag !== 'true') why = 'VITE_PAYMENTS_LIVE is not "true"';
  else if (!url) why = 'VITE_SUPABASE_URL is not set';
  else if (!anonKey) why = 'VITE_SUPABASE_ANON_KEY is not set';
  else {
    try { if (new URL(url).protocol !== 'https:') why = 'VITE_SUPABASE_URL must start with https://'; } catch { why = 'VITE_SUPABASE_URL is not a URL'; }
  }
  const live = !why;
  const proto = typeof location === 'object' ? location.protocol : '';
  return { live, supabaseUrl: live ? url : '', anonKey: live ? anonKey : '', why, canRedirect: proto === 'https:' || proto === 'http:' };
}

export const CONFIG: StoreConfig = read();

// The headers every Supabase call carries. The anon key always goes in `apikey`. A signed-in player's access token
// goes in Authorization; with no player, only a legacy anon key (a JWT) goes there too, since Supabase's newer
// publishable keys (sb_publishable_...) are not JWTs and belong in `apikey` alone (verify at launch).
export function sbHeaders(token?: string | null, json = true): Record<string, string> {
  const h: Record<string, string> = { apikey: CONFIG.anonKey };
  if (token) h.Authorization = `Bearer ${token}`;
  else if (CONFIG.anonKey.startsWith('eyJ')) h.Authorization = `Bearer ${CONFIG.anonKey}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

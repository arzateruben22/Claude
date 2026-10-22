// Lumevina — Skin Intelligence for the signed-in client. The work is in handler.ts.
//
//   supabase functions deploy skin --no-verify-jwt
//
// --no-verify-jwt like the other functions: the handler verifies the token
// itself (and refuses the anon key), so CORS preflights reach it.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (set by
// Supabase), SITE_URL (allowed origin), AUDIT_SALT (hashing addresses in the
// audit log), OWNER_EMAIL (her alerts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { handle } from "./handler.ts";
import { notifyOwner } from "../_shared/notify.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
Deno.serve((req) => handle(req, { db, env: (k) => Deno.env.get(k), notify: (d, a) => notifyOwner(d, a as any) }));

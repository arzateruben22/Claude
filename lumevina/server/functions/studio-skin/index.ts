// Lumevina — Skin Intelligence for staff. The work is in handler.ts.
//
//   supabase functions deploy studio-skin --no-verify-jwt
//
// The handler verifies the staff token itself, requires multifactor (aal2)
// and an active staff row, and never accepts the STUDIO_KEY.
// Secrets: as functions/skin (SITE_URL, AUDIT_SALT, OWNER_EMAIL).

import { createClient } from "npm:@supabase/supabase-js@2";
import { handle } from "./handler.ts";
import { notifyOwner } from "../_shared/notify.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
Deno.serve((req) => handle(req, { db, env: (k) => Deno.env.get(k), notify: (d, a) => notifyOwner(d, a as any) }));

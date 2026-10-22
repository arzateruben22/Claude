// Lumevina — the pre-visit form, saved on the server. The work is in handler.ts.
//
//   supabase functions deploy intake --no-verify-jwt
//
// Signed-in clients update their own form; a first form saves without
// sign-in, an existing one only with it.

import { createClient } from "npm:@supabase/supabase-js@2";
import { handle } from "./handler.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) => handle(req, { db, env: (k) => Deno.env.get(k) }));

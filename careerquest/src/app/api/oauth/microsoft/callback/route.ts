import { handleOAuthCallback } from "@/lib/integrations/oauth/routes";

/** Provider redirect target: validates state + session binding, exchanges the code, stores encrypted tokens. */
export async function GET(req: Request) {
  return handleOAuthCallback(req, "microsoft");
}

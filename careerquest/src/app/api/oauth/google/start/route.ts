import { handleOAuthStart } from "@/lib/integrations/oauth/routes";

/** Consent dialog form POST → authorization code + PKCE (S256) redirect. See src/lib/integrations/oauth/providers.ts for scopes. */
export async function POST(req: Request) {
  return handleOAuthStart(req, "google");
}

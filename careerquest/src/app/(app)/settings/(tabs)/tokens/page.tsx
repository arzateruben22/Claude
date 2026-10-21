import { requireUser } from "@/lib/auth/current-user";
import { listTokens } from "@/lib/account/service";
import { TokensPanel } from "@/components/settings/tokens-panel";

export const metadata = { title: "Developer tokens" };

export default async function SettingsTokensPage() {
  const user = await requireUser("/settings/tokens");
  const tokens = await listTokens(user.id);
  return (
    <TokensPanel
      tokens={tokens.map((t) => ({
        id: t.id,
        name: t.name,
        scopes: t.scopes,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
      }))}
    />
  );
}

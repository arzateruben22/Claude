import "server-only";
/**
 * Data for /integrations: every registry provider with its computed status, the user's connections
 * (client-safe views, never tokens) and the last sync runs.
 */
import { prisma } from "@/lib/db";
import { listConnectionViews, type ConnectionView } from "./connections";
import type { ServerIntegrationEnv } from "./env";
import {
  PROVIDERS,
  computeStatus,
  oauthConfigured,
  pickPrimaryConnection,
  type DisplayStatus,
  type IntegrationKey,
  type ProviderEntry,
} from "./registry";
import { listRecentSyncRuns, type SyncRunView } from "./sync";

export type ProviderOverview = {
  entry: ProviderEntry;
  status: DisplayStatus;
  reason: string;
  /** Connections for this provider (mailbox providers only), primary first. */
  connections: ConnectionView[];
  /** True when the Connect button can start an OAuth flow on this server. */
  canConnect: boolean;
};

export type IntegrationsOverview = {
  providers: ProviderOverview[];
  recentRuns: SyncRunView[];
  extension: { activeTokens: number; lastUsedAt: string | null };
};

export async function getIntegrationsOverview(userId: string, env: ServerIntegrationEnv, now = new Date()): Promise<IntegrationsOverview> {
  const [connections, recentRuns, tokens] = await Promise.all([
    listConnectionViews(userId),
    listRecentSyncRuns(userId, 10),
    prisma.apiToken.findMany({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { lastUsedAt: true },
    }),
  ]);
  const lastUsed = tokens.reduce<Date | null>((acc, t) => (t.lastUsedAt && (!acc || t.lastUsedAt > acc) ? t.lastUsedAt : acc), null);
  const extensionTokenUsage = tokens.length ? { lastUsedAt: lastUsed } : null;

  const providers = PROVIDERS.map((entry): ProviderOverview => {
    const own = connections.filter((c) => (c.provider as IntegrationKey) === entry.key && c.status !== "DISCONNECTED");
    const primary = pickPrimaryConnection(own);
    const ordered = primary ? [primary, ...own.filter((c) => c.id !== primary.id)] : own;
    const { status, reason } = computeStatus(entry.key, {
      env,
      connection: primary ? { status: primary.status, accountEmail: primary.accountEmail, lastError: primary.lastError } : null,
      extensionTokenUsage,
      now,
    });
    const canConnect = (entry.key === "GMAIL" || entry.key === "OUTLOOK") && oauthConfigured(entry.key, env);
    return { entry, status, reason, connections: ordered, canConnect };
  });

  return {
    providers,
    recentRuns,
    extension: { activeTokens: tokens.length, lastUsedAt: lastUsed?.toISOString() ?? null },
  };
}

import "server-only";
/**
 * IntegrationConnection persistence. Tokens are only ever stored encrypted (encryptSecret) and only
 * ever decrypted inside this module, right before a provider call. Every query is scoped by userId.
 */
import type { IntegrationConnection } from "@/generated/prisma/client";
import type { IntegrationProvider } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { IntegrationAuthError, type FetchLike, type TokenSource } from "./adapters/types";
import { GOOGLE_REVOKE_URL, getOAuthConfig, OAUTH_KEY_FOR } from "./oauth/providers";
import { refreshAccessToken, revokeToken, type RevokeOutcome } from "./oauth/tokens";
import { DEFAULT_HISTORY_DAYS, isHistoryDays, type IntegrationEnv, type OAuthKey } from "./registry";

/** Refresh this long before the stored expiry. */
const EXPIRY_SKEW_MS = 60_000;

export type ConnectionSettings = { historyDays: number };

export function readConnectionSettings(value: unknown): ConnectionSettings {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return { historyDays: isHistoryDays(v.historyDays) ? v.historyDays : DEFAULT_HISTORY_DAYS };
}

export function isOAuthProvider(p: IntegrationProvider): p is OAuthKey {
  return p === "GMAIL" || p === "OUTLOOK";
}

export type SaveConnectionInput = {
  provider: OAuthKey;
  accountEmail: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scopes: string[];
  historyDays: number;
  now?: Date;
};

/**
 * Create or update the (userId, provider, accountEmail) connection as CONNECTED with freshly encrypted
 * tokens. A reconnect keeps the previous refresh token when the provider did not issue a new one, and
 * restarts the history window when the range changed or the connection had been disconnected.
 */
export async function saveOAuthConnection(userId: string, input: SaveConnectionInput): Promise<IntegrationConnection> {
  const now = input.now ?? new Date();
  const accountEmail = input.accountEmail.trim().toLowerCase();
  const historyDays = isHistoryDays(input.historyDays) ? input.historyDays : DEFAULT_HISTORY_DAYS;
  const tokenExpiresAt = new Date(now.getTime() + Math.max(60, input.expiresIn) * 1000);
  const existing = await prisma.integrationConnection.findFirst({
    where: { userId, provider: input.provider, accountEmail },
  });
  const accessTokenEnc = encryptSecret(input.accessToken);
  if (!existing) {
    return prisma.integrationConnection.create({
      data: {
        userId,
        provider: input.provider,
        accountEmail,
        status: "CONNECTED",
        accessTokenEnc,
        refreshTokenEnc: input.refreshToken ? encryptSecret(input.refreshToken) : null,
        tokenExpiresAt,
        scopes: input.scopes,
        syncEnabled: true,
        settings: { historyDays },
        lastError: null,
      },
    });
  }
  const previous = readConnectionSettings(existing.settings);
  const restartWindow = existing.status === "DISCONNECTED" || previous.historyDays !== historyDays;
  return prisma.integrationConnection.update({
    where: { id: existing.id },
    data: {
      status: "CONNECTED",
      accessTokenEnc,
      refreshTokenEnc: input.refreshToken ? encryptSecret(input.refreshToken) : existing.refreshTokenEnc,
      tokenExpiresAt,
      scopes: input.scopes,
      settings: { ...(existing.settings as object), historyDays },
      lastError: null,
      ...(restartWindow ? { syncCursor: null } : {}),
    },
  });
}

/**
 * Access-token source for one connection. `get()` returns the stored token unless it is about to
 * expire; `refresh()` uses the refresh token and stores the result. Tokens are never written back to a
 * connection that was disconnected meanwhile.
 */
export function connectionTokenSource(
  connection: Pick<IntegrationConnection, "id" | "userId" | "provider" | "accessTokenEnc" | "refreshTokenEnc" | "tokenExpiresAt">,
  deps: { env: IntegrationEnv; fetch: FetchLike; now?: () => Date },
): TokenSource {
  const now = deps.now ?? (() => new Date());
  if (!isOAuthProvider(connection.provider)) throw new Error("Not an OAuth connection.");
  const cfg = getOAuthConfig(OAUTH_KEY_FOR[connection.provider], deps.env);
  let accessToken = connection.accessTokenEnc ? safeDecrypt(connection.accessTokenEnc) : null;
  let refreshToken = connection.refreshTokenEnc ? safeDecrypt(connection.refreshTokenEnc) : null;
  let expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;

  const source: TokenSource = {
    async get() {
      if (accessToken && expiresAt - EXPIRY_SKEW_MS > now().getTime()) return accessToken;
      return source.refresh();
    },
    async refresh() {
      if (!cfg) throw new Error("The OAuth client is not configured on this server.");
      if (!refreshToken) throw new IntegrationAuthError("No refresh token is stored; reconnect to resume syncing.");
      const tokens = await refreshAccessToken(cfg, refreshToken, deps.fetch);
      accessToken = tokens.accessToken;
      if (tokens.refreshToken) refreshToken = tokens.refreshToken;
      expiresAt = now().getTime() + Math.max(60, tokens.expiresIn) * 1000;
      await prisma.integrationConnection.updateMany({
        where: { id: connection.id, userId: connection.userId, status: "CONNECTED" },
        data: {
          accessTokenEnc: encryptSecret(tokens.accessToken),
          ...(tokens.refreshToken ? { refreshTokenEnc: encryptSecret(tokens.refreshToken) } : {}),
          tokenExpiresAt: new Date(expiresAt),
        },
      });
      return tokens.accessToken;
    },
  };
  return source;
}

function safeDecrypt(payload: string): string | null {
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

export type DisconnectResult = {
  revoke: RevokeOutcome;
  deletedEmails: number;
};

/**
 * Disconnect: revoke at the provider when it supports it (Google), wipe the encrypted tokens and the
 * cursor, mark DISCONNECTED, optionally delete the email records this connection imported. Imported
 * applications are kept (they may hold the user's own edits).
 */
export async function disconnectConnection(
  userId: string,
  connectionId: string,
  opts: { deleteEmails: boolean; fetch: FetchLike },
): Promise<DisconnectResult | null> {
  const conn = await prisma.integrationConnection.findFirst({ where: { id: connectionId, userId } });
  if (!conn) return null;

  let revoke: RevokeOutcome = "not_supported";
  if (conn.provider === "GMAIL") {
    // Revoking the refresh token also invalidates the access tokens issued from it.
    const token = (conn.refreshTokenEnc && safeDecrypt(conn.refreshTokenEnc)) || (conn.accessTokenEnc && safeDecrypt(conn.accessTokenEnc));
    revoke = token ? await revokeToken(GOOGLE_REVOKE_URL, token, opts.fetch) : "already_invalid";
  }

  await prisma.integrationConnection.updateMany({
    where: { id: conn.id, userId },
    data: {
      status: "DISCONNECTED",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      syncCursor: null,
      lastError: null,
    },
  });

  let deletedEmails = 0;
  if (opts.deleteEmails) {
    const res = await prisma.emailMessage.deleteMany({ where: { userId, connectionId: conn.id } });
    deletedEmails = res.count;
  }

  await audit("integration.disconnected", {
    userId,
    entityType: "IntegrationConnection",
    entityId: conn.id,
    metadata: { provider: conn.provider, revoke, deletedEmails },
  });
  return { revoke, deletedEmails };
}

export type ConnectionView = {
  id: string;
  provider: IntegrationProvider;
  accountEmail: string | null;
  status: IntegrationConnection["status"];
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  historyDays: number;
  scopes: string[];
  createdAt: string;
};

/** Client-safe view of a user's connections (never includes tokens or cursors). */
export async function listConnectionViews(userId: string): Promise<ConnectionView[]> {
  const rows = await prisma.integrationConnection.findMany({
    where: { userId },
    orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      provider: true,
      accountEmail: true,
      status: true,
      syncEnabled: true,
      lastSyncAt: true,
      lastError: true,
      settings: true,
      scopes: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    accountEmail: r.accountEmail,
    status: r.status,
    syncEnabled: r.syncEnabled,
    lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
    lastError: r.lastError,
    historyDays: readConnectionSettings(r.settings).historyDays,
    scopes: r.scopes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function setSyncEnabled(userId: string, connectionId: string, enabled: boolean): Promise<boolean> {
  const res = await prisma.integrationConnection.updateMany({ where: { id: connectionId, userId }, data: { syncEnabled: enabled } });
  return res.count > 0;
}

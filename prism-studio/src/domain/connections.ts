// Connections: a platform's OAuth grant for one destination. Tokens are sealed at rest (lib/crypto) and only
// ever unsealed server-side for a call. A connection is the only thing that makes a destination "api"; a saved
// handle or URL never is. Disconnecting returns the destination to manual publishing.
import { and, eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { connections, destinations } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";
import { seal, unseal } from "../lib/crypto";
import { connectorFor } from "../integrations";
import { ConnectorError, type AccountInfo, type Fetch, type Platform, type PlatformConnector, type TokenSet } from "../integrations/types";

export type ConnectionRow = typeof connections.$inferSelect;

export function requireConnector(platform: Platform): PlatformConnector {
  const c = connectorFor(platform);
  if (!c) throw new DomainError("unsupported", `no connector for ${platform}`);
  return c;
}

/** After the OAuth callback: store the grant and let the destination carry the platform's own account facts. */
export async function saveConnection(d: DB, v: { destinationId: string; platform: Platform; tokens: TokenSet; account: AccountInfo; capabilities?: Record<string, unknown> }) {
  return d.transaction(async (tx) => {
    const [dest] = await tx.select().from(destinations).where(eq(destinations.id, v.destinationId)).for("update");
    if (!dest) throw new DomainError("not_found", "destination not found");
    if (dest.platform !== v.platform) throw new DomainError("wrong_platform", `that destination is ${dest.platform}, not ${v.platform}`);
    // the same platform account must not be connected to two destinations (two channels can't share one YouTube channel)
    const [dup] = await tx.select({ id: connections.id, destinationId: connections.destinationId }).from(connections)
      .where(and(eq(connections.verifiedAccountId, v.account.accountId), eq(connections.kind, `${v.platform}_oauth`)));
    if (dup && dup.destinationId !== v.destinationId) throw new DomainError("duplicate_account", `${v.account.handle} is already connected to another destination`);
    await tx.delete(connections).where(eq(connections.destinationId, v.destinationId));
    const [row] = await tx.insert(connections).values({
      destinationId: v.destinationId, kind: `${v.platform}_oauth`, scopes: v.tokens.scopes, verifiedAccountId: v.account.accountId,
      tokenCipher: seal(JSON.stringify(v.tokens)), expiresAt: new Date(v.tokens.expiresAt), status: "connected", capabilities: v.capabilities ?? {},
    }).returning();
    await tx.update(destinations).set({
      handle: v.account.handle, displayName: v.account.displayName, platformAccountId: v.account.accountId, profileUrl: v.account.profileUrl,
      avatarUrl: v.account.avatarUrl ?? "", provenance: "integration_verified", publishMethod: "api", lastConfirmedAt: new Date(), updatedAt: new Date(),
    }).where(eq(destinations.id, v.destinationId));
    await audit(tx, "owner", "connection.create", "connection", row.id, { destinationId: v.destinationId, platform: v.platform, account: v.account.handle, scopes: v.tokens.scopes });
    return row;
  });
}

export async function connectionFor(c: Conn, destinationId: string): Promise<ConnectionRow | null> {
  const [row] = await c.select().from(connections).where(eq(connections.destinationId, destinationId));
  return row ?? null;
}

/** Whether a failed refresh means the grant itself is gone (refused, revoked, invalid_grant), not a passing problem. */
export function refreshRefused(e: unknown): boolean {
  return e instanceof ConnectorError && !e.retryable && (e.code === "auth" || e.code === "rejected");
}

/** Unsealed tokens, refreshed when within five minutes of expiry. Marks the connection expired only when the platform
 *  refused the refresh; network trouble, rate limits and anything else are thrown as they are (the connection stays
 *  connected, and the queue retries with backoff). */
export async function freshTokens(d: DB, destinationId: string, f?: Fetch): Promise<{ conn: ConnectionRow; tokens: TokenSet; connector: PlatformConnector }> {
  const conn = await connectionFor(d, destinationId);
  if (!conn || !conn.tokenCipher || conn.status === "revoked") throw new DomainError("not_connected", "this destination is not connected");
  const [dest] = await d.select().from(destinations).where(eq(destinations.id, destinationId));
  const connector = requireConnector(dest.platform);
  let tokens = JSON.parse(unseal(conn.tokenCipher)) as TokenSet;
  if (tokens.expiresAt - Date.now() < 5 * 60_000) {
    try {
      tokens = await connector.refresh(tokens, undefined, f);
      await d.update(connections).set({ tokenCipher: seal(JSON.stringify(tokens)), expiresAt: new Date(tokens.expiresAt), status: "connected", updatedAt: new Date() }).where(eq(connections.id, conn.id));
    } catch (e) {
      if (!refreshRefused(e)) throw e;
      await d.update(connections).set({ status: "expired", updatedAt: new Date() }).where(eq(connections.id, conn.id));
      await audit(d, "system", "connection.expired", "connection", conn.id, { error: (e as Error).message });
      throw new DomainError("expired", `the ${dest.platform} connection expired: reconnect it in Accounts`);
    }
  }
  return { conn, tokens, connector };
}

export async function markConnectionError(d: DB, destinationId: string, status: "expired" | "error", error: string) {
  const conn = await connectionFor(d, destinationId);
  if (!conn) return;
  await d.update(connections).set({ status, updatedAt: new Date() }).where(eq(connections.id, conn.id));
  await audit(d, "system", `connection.${status}`, "connection", conn.id, { error: error.slice(0, 300) });
}

/** Back to manual. The handle and links stay (they came from the platform), marked as confirmed by the owner. */
export async function disconnect(d: DB, destinationId: string) {
  const conn = await connectionFor(d, destinationId);
  await d.delete(connections).where(eq(connections.destinationId, destinationId));
  await d.update(destinations).set({ publishMethod: "manual", provenance: "owner_confirmed", updatedAt: new Date() }).where(eq(destinations.id, destinationId));
  await audit(d, "owner", "connection.delete", "connection", conn?.id ?? "", { destinationId });
}

/** For the Accounts screen: every destination's connection state, with no secrets. */
export async function connectionSummary(c: Conn) {
  const rows = await c.select({ destinationId: connections.destinationId, status: connections.status, expiresAt: connections.expiresAt, verifiedAccountId: connections.verifiedAccountId, scopes: connections.scopes, capabilities: connections.capabilities, updatedAt: connections.updatedAt }).from(connections);
  return new Map(rows.map((r) => [r.destinationId, r]));
}

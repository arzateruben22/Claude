import "server-only";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

export const API_TOKEN_PREFIX = "cqt_";

export type ApiPrincipal = {
  userId: string;
  tokenId: string;
  scopes: string[];
};

/** Create a bearer token for the extension/mobile. The plaintext is shown once and never stored. */
export async function createApiToken(userId: string, name: string, scopes?: string[]) {
  const plain = `${API_TOKEN_PREFIX}${randomToken(32)}`;
  const token = await prisma.apiToken.create({
    data: { userId, name, tokenHash: sha256(plain), ...(scopes ? { scopes } : {}) },
  });
  return { token, plaintext: plain };
}

export async function revokeApiToken(userId: string, tokenId: string) {
  await prisma.apiToken.updateMany({ where: { id: tokenId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Resolve `Authorization: Bearer cqt_...` to a principal, or null. */
export async function authenticateBearer(authorizationHeader: string | null): Promise<ApiPrincipal | null> {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value?.startsWith(API_TOKEN_PREFIX)) return null;
  const token = await prisma.apiToken.findUnique({ where: { tokenHash: sha256(value) } });
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt.getTime() < Date.now())) return null;
  prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { userId: token.userId, tokenId: token.id, scopes: token.scopes };
}

export function hasScope(principal: ApiPrincipal, scope: string): boolean {
  return principal.scopes.includes(scope) || principal.scopes.includes("*");
}

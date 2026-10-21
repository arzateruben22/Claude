import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";

export type SessionView = {
  id: string;
  /** First 8 characters of the session id, enough to tell rows apart without exposing the hash. */
  idPrefix: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  current: boolean;
};

export async function listSessions(userId: string, currentId: string | null): Promise<SessionView[]> {
  const rows = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true },
  });
  return rows.map((r) => ({ ...r, idPrefix: r.id.slice(0, 8), current: r.id === currentId }));
}

/** Delete every session of the user except `keepId`. Returns how many were removed. */
export async function revokeOtherSessions(userId: string, keepId: string | null): Promise<number> {
  const res = await prisma.session.deleteMany({
    where: { userId, ...(keepId ? { id: { not: keepId } } : {}) },
  });
  return res.count;
}

export type ChangePasswordResult = { ok: true; revokedSessions: number } | { ok: false; reason: "wrong_password" | "not_found" };

/** Verify the current password, store the new hash and sign out every other session. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  keepSessionId: string | null,
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, deletedAt: true } });
  if (!user || user.deletedAt) return { ok: false, reason: "not_found" };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return { ok: false, reason: "wrong_password" };
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  const revokedSessions = await revokeOtherSessions(userId, keepSessionId);
  return { ok: true, revokedSessions };
}

export type DeleteAccountResult = { ok: true } | { ok: false; reason: "wrong_password" | "not_found" };

/**
 * Permanently delete the user row; every user-owned table cascades. An audit entry is written
 * first — its userId becomes null when the row disappears (AuditLog.user is onDelete: SetNull).
 */
export async function deleteAccount(userId: string, password: string, ipAddress?: string | null): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
  if (!user) return { ok: false, reason: "not_found" };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, reason: "wrong_password" };
  const [applications, xpLedger] = await Promise.all([
    prisma.application.count({ where: { userId } }),
    prisma.xpLedger.count({ where: { userId } }),
  ]);
  await audit("account.delete", {
    userId,
    entityType: "User",
    entityId: userId,
    ipAddress: ipAddress ?? null,
    metadata: { email: user.email, applications, xpLedger },
  });
  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}

export type ApiTokenView = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export async function listTokens(userId: string): Promise<ApiTokenView[]> {
  return prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
  });
}

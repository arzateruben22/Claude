import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

export const SESSION_COOKIE = "cq_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days, sliding
const REFRESH_AFTER_MS = 1000 * 60 * 60 * 12; // bump lastSeen/expiry at most twice a day

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

async function requestMeta() {
  try {
    const h = await headers();
    return {
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ipAddress: (h.get("x-forwarded-for") ?? h.get("x-real-ip"))?.split(",")[0]?.trim().slice(0, 64) ?? null,
    };
  } catch {
    return { userAgent: null, ipAddress: null };
  }
}

/** Create a DB-backed session and set the cookie. The raw token never touches the database. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const meta = await requestMeta();
  await prisma.session.create({ data: { id, userId, expiresAt, ...meta } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: sha256(token) } }).catch(() => undefined);
  }
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Resolve the current user from the session cookie. Returns null when signed out or expired. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, role: true, deletedAt: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || session.user.deletedAt) {
    return null;
  }
  // Sliding expiry: refresh occasionally rather than on every request.
  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session
      .update({ where: { id }, data: { lastSeenAt: new Date(), expiresAt } })
      .catch(() => undefined);
    try {
      jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
    } catch {
      // Server Components cannot set cookies; the next Server Action / Route Handler will.
    }
  }
  const { user } = session;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

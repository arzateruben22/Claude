// Shared domain helpers: hashing, audit, settings, errors.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB, Tx } from "../db/client";
import { auditLog, studioSettings } from "../db/schema";

export type Conn = DB | Tx;

export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

export async function audit(c: Conn, actor: "owner" | "worker" | "system", action: string, entity: string, entityId = "", detail: Record<string, unknown> = {}) {
  await c.insert(auditLog).values({ actor, action, entity, entityId, detail });
}

export async function settings(c: Conn) {
  const [s] = await c.select().from(studioSettings).where(eq(studioSettings.id, 1));
  if (s) return s;
  const [created] = await c.insert(studioSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await c.select().from(studioSettings).where(eq(studioSettings.id, 1)))[0];
}

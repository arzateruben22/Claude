import "server-only";
import { prisma } from "@/lib/db";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export async function audit(
  action: string,
  opts: { userId?: string | null; entityType?: string; entityId?: string; metadata?: Record<string, JsonValue>; ipAddress?: string | null } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: opts.userId ?? null,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        metadata: opts.metadata ?? {},
        ipAddress: opts.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

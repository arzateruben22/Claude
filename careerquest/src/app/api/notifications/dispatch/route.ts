import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { generateDueNotifications } from "@/lib/notifications/service";
import { deliverPush } from "@/lib/notifications/push";

/**
 * Scheduler entry point: `POST /api/notifications/dispatch` with `Authorization: Bearer $CRON_SECRET`.
 * Generates due reminders for every active user and delivers web push where enabled.
 * Run it every 15–60 minutes from cron, a platform scheduler, or `scripts/dispatch-notifications.sh`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } });
  let created = 0;
  let pushed = 0;
  const errors: string[] = [];
  for (const u of users) {
    try {
      created += await generateDueNotifications(u.id, { force: true });
      pushed += await deliverPush(u.id);
    } catch (err) {
      errors.push(`${u.id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
  return NextResponse.json({ users: users.length, created, pushed, errors: errors.slice(0, 20) });
}

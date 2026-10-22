import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { parsePrefs } from "./prefs";

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  return { enabled: Boolean(publicKey && privateKey && subject), publicKey, privateKey, subject };
}

let configured = false;
function ensureConfigured() {
  const cfg = pushConfig();
  if (!cfg.enabled) return false;
  if (!configured) {
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    configured = true;
  }
  return true;
}

export type PushSender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;

/**
 * Send not-yet-pushed notifications from the last 24 h to the user's subscribed devices when the
 * user enabled push. Gone subscriptions (404/410) are removed. Returns the number of deliveries.
 */
export async function deliverPush(userId: string, send?: PushSender): Promise<number> {
  const sender: PushSender | null = send ?? (ensureConfigured() ? (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 3600 }) : null);
  if (!sender) return 0;
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { notificationPrefs: true } });
  if (!parsePrefs(profile?.notificationPrefs).push) return 0;
  const [subs, pending] = await Promise.all([
    prisma.pushSubscription.findMany({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId, pushedAt: null, readAt: null, createdAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);
  if (subs.length === 0 || pending.length === 0) return 0;
  let delivered = 0;
  for (const n of pending) {
    const payload = JSON.stringify({ title: n.title, body: n.body ?? "", link: n.link ?? "/notifications", tag: n.dedupeKey ?? n.id });
    for (const s of subs) {
      const keys = s.keys as { p256dh?: string; auth?: string };
      if (!keys?.p256dh || !keys?.auth) continue;
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, payload);
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
      }
    }
    await prisma.notification.update({ where: { id: n.id }, data: { pushedAt: new Date() } });
  }
  return delivered;
}

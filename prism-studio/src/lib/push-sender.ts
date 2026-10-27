// The one place Prism talks to a browser's push service (web-push: RFC 8030 delivery, RFC 8291 payload encryption,
// RFC 8292 VAPID). The domain (src/domain/push.ts) takes the sender as a parameter, so tests inject a fake and never
// reach the network. Nothing here logs: the endpoint is a capability URL and the VAPID private key is a secret.
import webpush from "web-push";
import type { PushSender } from "../domain/push";

export const webPushSender: PushSender = async (target, payload, o) => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || "";
  const r = await webpush.sendNotification(target, payload, {
    vapidDetails: o.vapid, TTL: o.ttl, urgency: o.urgency, timeout: o.timeoutMs, ...(o.topic ? { topic: o.topic } : {}),
    ...(proxy ? { proxy } : {}),
  });
  return { statusCode: r.statusCode };
};

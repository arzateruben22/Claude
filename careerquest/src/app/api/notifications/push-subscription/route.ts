import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine((u) => u.startsWith("https://"), "Push endpoints must use https"),
  keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(128) }),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!rateLimit(`push-sub:${user.id}`, 20, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  // An endpoint belongs to one browser profile; re-bind it to the current user if it changed hands.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, keys, userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null },
    update: { userId: user.id, keys },
  });
  await audit("notifications.push_subscribed", { userId: user.id });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  else await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
  await audit("notifications.push_unsubscribed", { userId: user.id });
  return NextResponse.json({ ok: true });
}

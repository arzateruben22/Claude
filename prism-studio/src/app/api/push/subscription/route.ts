// The service worker's "pushsubscriptionchange": the browser replaced this device's subscription, so the worker's
// next send would miss it. Owner-only (the proxy checks the session cookie, and so does this route); the browser sends
// the new subscription and the endpoint it replaces. Answers with no body: nothing about other devices leaves.
import { z } from "zod";
import { db } from "@/db/client";
import { DomainError } from "@/domain/core";
import { renewSubscription } from "@/domain/push";
import { isOwner } from "@/lib/owner";

export const runtime = "nodejs";

const Body = z.object({
  subscription: z.object({ endpoint: z.string().max(2048), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  replaces: z.string().max(2048).nullish(),
});

export async function POST(req: Request) {
  if (!(await isOwner())) return new Response("sign in", { status: 401 });
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return new Response("send JSON", { status: 415 });
  let v: z.infer<typeof Body>;
  try { v = Body.parse(await req.json()); } catch { return new Response("not a subscription", { status: 400 }); }
  try {
    await renewSubscription(db(), v);
  } catch (e) {
    if (e instanceof DomainError) return new Response(e.message, { status: 400 });
    throw e;
  }
  return new Response(null, { status: 204 });
}

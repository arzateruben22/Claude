import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { productionSyncDeps } from "@/lib/integrations/defaults";
import { readIntegrationEnv } from "@/lib/integrations/env";
import { isSameOriginRequest } from "@/lib/integrations/http-guards";
import { syncAllUsers, syncUserConnections } from "@/lib/integrations/sync";

/** Minimum CRON_SECRET length; shorter secrets disable the scheduler path entirely. */
const MIN_CRON_SECRET = 16;

/**
 * POST /api/integrations/sync
 * - `Authorization: Bearer <CRON_SECRET>`: syncs every user's CONNECTED, sync-enabled mailbox
 *   connections sequentially (one user's failure never stops the others).
 * - Otherwise the signed-in user's own CONNECTED mailbox connections are synced.
 */
export async function POST(req: Request) {
  const env = readIntegrationEnv();
  const authorization = req.headers.get("authorization");

  if (authorization && /^bearer\s+/i.test(authorization)) {
    const presented = authorization.replace(/^bearer\s+/i, "").trim();
    const secret = env.CRON_SECRET ?? "";
    if (secret.length < MIN_CRON_SECRET || !safeEqual(presented, secret)) {
      return NextResponse.json({ error: "Invalid scheduler credentials" }, { status: 401 });
    }
    const startedAt = Date.now();
    const report = await syncAllUsers(productionSyncDeps(env));
    await audit("integrations.scheduled_sync", {
      metadata: { users: report.users, connections: report.connections, ms: Date.now() - startedAt },
    });
    return NextResponse.json(report);
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isSameOriginRequest(req, env)) return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  const limit = rateLimit(`integrations-sync:${user.id}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many sync requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const results = await syncUserConnections(user.id, productionSyncDeps(env));
  return NextResponse.json({ results });
}

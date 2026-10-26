// Liveness for the container healthcheck and uptime monitors: the app answers and the database responds.
// Public (the proxy opens /api/health) and says nothing private.
import { pool } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool().query("select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { generateDueNotifications, getNotificationSummary } from "@/lib/notifications/service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    await generateDueNotifications(user.id);
  } catch (err) {
    console.error("notification generation failed", err);
  }
  const summary = await getNotificationSummary(user.id);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

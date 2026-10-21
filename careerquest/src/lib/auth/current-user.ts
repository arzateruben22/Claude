import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/** For Server Components and Server Actions: redirects to /login when signed out. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const qs = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${qs}`);
  }
  return user;
}

export { getSessionUser };
export type { SessionUser };

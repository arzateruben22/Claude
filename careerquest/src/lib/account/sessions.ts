import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { sha256 } from "@/lib/crypto";

/** Id (sha256 of the cookie token) of the session making this request, or null when signed out. */
export async function currentSessionId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    return token ? sha256(token) : null;
  } catch {
    return null;
  }
}

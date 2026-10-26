// Defence in depth behind the proxy: server actions and route handlers check the owner's session themselves.
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "./session";

export async function isOwner(): Promise<boolean> {
  return verifySession((await cookies()).get(COOKIE)?.value);
}

export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) throw new Error("sign in required");
}

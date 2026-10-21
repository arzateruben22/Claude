import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "cq_session";
const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/offline", "/privacy"]);

/**
 * Lightweight gate: redirects signed-out visitors away from app pages and signed-in visitors
 * away from the auth pages. It only checks cookie presence (no DB); real validation happens in
 * the (app) layout via getSessionUser().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" || pathname === "/register") {
    if (hasSession) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // App pages only; API routes, static assets, PWA files and the extension handshake are excluded.
    "/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icons/|images/|robots\\.txt|share).*)",
  ],
};

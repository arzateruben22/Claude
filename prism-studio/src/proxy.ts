// Next 16 proxy (formerly middleware): every page and API route is owner-only, except sign-in and static assets.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "./lib/session";

const OPEN = [/^\/login$/, /^\/setup$/, /^\/api\/health$/, /^\/icon\.png$/, /^\/api\/auth\//, /^\/api\/public-media\//, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/icons\//, /^\/fonts\//, /^\/wallpaper\/[\w-]+\.jpg$/, /^\/offline$/, /^\/favicon/];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN.some((r) => r.test(pathname))) return NextResponse.next();
  if (await verifySession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

// /api/media-push checks its own token and must stream large uploads: a request the proxy sees is buffered in memory
// and cut at 10 MB (Next's proxyClientMaxBodySize), so it is left out here.
export const config = { matcher: ["/((?!_next/static|_next/image|api/media-push$).*)"] };

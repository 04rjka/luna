import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const authRoutes = ["/login", "/signup"];
const protectedRoutes = ["/bots", "/settings"]; // "/" (dashboard) is handled below

const API = process.env.FASTAPI_URL ?? "http://localhost:8000";
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

const matches = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(route + "/");

async function embedResponse(pathname: string) {
  const key = pathname.split("/")[2] ?? "";
  let ancestors = "'self'"; // 'self' lets your own dashboard preview work
  if (KEY_RE.test(key)) {
    try {
      const r = await fetch(`${API}/public/bots/${key}/config`);
      if (r.ok) {
        const origins: string[] = (await r.json()).allowed_origins ?? [];
        if (origins.length) ancestors += " " + origins.join(" ");
      }
    } catch {
      /* backend down: keep the strict default */
    }
  }
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", `frame-ancestors ${ancestors}`);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public widget page: no auth, only the embed rules
  if (pathname.startsWith("/embed/")) {
    return embedResponse(pathname);
  }

  // Better Auth session cookie. Presence check only, so this is not a security check.
  const hasSession = !!getSessionCookie(request);

  const isAuthRoute = authRoutes.some((r) => matches(pathname, r));
  const isProtectedRoute =
    pathname === "/" || protectedRoutes.some((r) => matches(pathname, r));

  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|widget\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
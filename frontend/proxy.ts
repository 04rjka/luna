import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authRoutes = ["/login", "/signup"];
const protectedRoutes = ["/documents", "/settings", "/chats", "/upload"];

const API = process.env.FASTAPI_URL ?? "http://localhost:8000";
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

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

  const token = request.cookies.get("access_token")?.value;

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  const isProtectedRoute =
    pathname === "/" ||
    protectedRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedRoute && !token) {
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
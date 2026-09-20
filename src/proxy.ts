import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/money";

async function isAuthed(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? "bs-fincorp-insecure-dev-secret"
    );
    const { payload } = await jwtVerify(token, secret);
    return Boolean(payload.sub);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await isAuthed(request);

  // Landing page → signed-in users go to the dashboard.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(authed ? "/dashboard" : "/login", request.url));
  }

  // Login page → already signed-in users are sent to the dashboard.
  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  // Everything else is protected.
  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|webp)$).*)",
  ],
};
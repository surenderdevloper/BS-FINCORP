import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/money";

const PUBLIC_PATHS = ["/forgot-password", "/reset-password"];

async function isAuthed(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  // Refuse to authenticate with a known fallback key on a production
  // deployment — treat a missing AUTH_SECRET as signed-out so the app fails
  // closed instead of validating forged session cookies.
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") return false;
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

  // Login page → let the page validate the session against the DB. Redirecting
  // here based on a signature-valid JWT would loop for stale sessions whose
  // tokenVersion no longer matches (e.g. after a password reset in this browser).
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // Password recovery pages are public (usable even while signed in).
  if (PUBLIC_PATHS.includes(pathname)) {
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
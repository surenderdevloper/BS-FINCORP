import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import {
  normalizeRole,
  sessionCookieOptions,
  SESSION_COOKIE,
  signSessionToken,
} from "@/lib/auth";
import { clientIp, startSession } from "@/lib/sessions";
import { clientKey, persistentRateLimit } from "@/lib/rate-limit";
import { multiTenantEnabled, runUnscoped } from "@/lib/tenant";
import { User } from "@/models/User";

const DEMO_LOGIN_LIMIT = 30;
const DEMO_LOGIN_WINDOW_MS = 60 * 1000;

function enabled(): boolean {
  const value = (process.env.PUBLIC_DEMO_MODE ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function unavailable(status = 503) {
  return NextResponse.json(
    { error: "The demo is temporarily unavailable." },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

export const dynamic = "force-dynamic";

/** Public demo login. Enable only on a separate deployment with its own demo database. */
export async function GET(request: Request) {
  if (!enabled()) return unavailable(404);

  const email = (process.env.PUBLIC_DEMO_USER_EMAIL ?? "").trim().toLowerCase();
  const expectedDatabaseName = (process.env.PUBLIC_DEMO_DATABASE_NAME ?? "").trim();
  if (
    !email ||
    !expectedDatabaseName ||
    !expectedDatabaseName.toLowerCase().includes("demo") ||
    multiTenantEnabled()
  ) {
    return unavailable();
  }

  try {
    const connection = await dbConnect();
    // Fail closed if the demo deployment was accidentally pointed at another DB.
    if (connection.name !== expectedDatabaseName) {
      console.error("Public demo login refused: configured database name did not match.");
      return unavailable();
    }

    const limit = await persistentRateLimit(
      `public-demo-login:${clientKey(request)}`,
      DEMO_LOGIN_LIMIT,
      DEMO_LOGIN_WINDOW_MS
    );
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many demo sign-ins. Please try again in a minute." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "Retry-After": String(limit.retryAfterSeconds),
            "X-Robots-Tag": "noindex, nofollow",
          },
        }
      );
    }

    const user = await runUnscoped(() =>
      User.findOne({ email }).select("_id name email role tokenVersion tenantId").lean()
    );
    if (!user || normalizeRole(user.role) !== "admin") return unavailable();

    const userId = user._id.toString();
    const userAgent = request.headers.get("user-agent") ?? "";
    const ip = clientIp(request);
    const sid = await startSession({
      userId,
      tenantId: user.tenantId ?? null,
      userAgent,
      ip,
    });
    const token = await signSessionToken(
      {
        id: userId,
        name: user.name,
        email: user.email,
        role: "admin",
        tokenVersion: user.tokenVersion ?? 0,
        tenantId: user.tenantId ?? null,
      },
      sid
    );

    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    console.error("Public demo login failed", error);
    return unavailable();
  }
}

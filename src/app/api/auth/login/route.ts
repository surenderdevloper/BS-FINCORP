import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { signSessionToken, sessionCookieOptions, SESSION_COOKIE, normalizeRole } from "@/lib/auth";
import { clientIp, parseDevice, startSession } from "@/lib/sessions";
import { runUnscoped } from "@/lib/tenant";
import { clientKey, rateLimit, rateLimitReset } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const limit = rateLimit(`login:${clientKey(req)}:${email}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    await dbConnect();
    // Login is global: accounts are matched by email across all tenants.
    const user = await runUnscoped(() => User.findOne({ email }));

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    rateLimitReset(`login:${clientKey(req)}:${email}`);

    // Register this device so the superadmin panel can show where the account is
    // signed in (and sign a specific device out later). The session id goes into
    // the cookie, so without one no valid session can be issued.
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = clientIp(req);
    const sid = await startSession({
      userId: user._id.toString(),
      tenantId: user.tenantId ?? null,
      userAgent,
      ip,
    });
    try {
      await runUnscoped(() =>
        User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date(), lastLoginDevice: parseDevice(userAgent), lastLoginIp: ip } }
        )
      );
    } catch {
      // Best-effort "last seen" for the superadmin panel; never blocks login.
    }

    const token = await signSessionToken(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: normalizeRole(user.role),
        tokenVersion: user.tokenVersion ?? 0,
        tenantId: user.tenantId ?? null,
      },
      sid
    );

    const res = NextResponse.json({ name: user.name, email: user.email });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("login error", err);
    const missingSecret = err instanceof Error && err.message.includes("AUTH_SECRET");
    return NextResponse.json(
      {
        error: missingSecret
          ? "Server configuration error: AUTH_SECRET is not set for this environment. Add it as a production environment variable and redeploy."
          : "Server error. Check that MongoDB is reachable (MONGODB_URI).",
      },
      { status: 500 }
    );
  }
}
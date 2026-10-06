import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { signSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findOne({ email });

if (!user) {
  return NextResponse.json(
    { error: "Invalid email or password." },
    { status: 401 }
  );
}

const ok = await bcrypt.compare(password, user.passwordHash);

if (!ok) {
  return NextResponse.json(
    { error: "Invalid email or password." },
    { status: 401 }
  );
}

    const token = await signSessionToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    });

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
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { SESSION_COOKIE, readSession, signSessionToken, sessionCookieOptions } from "@/lib/auth";

export async function PUT(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Please enter your current password.", fieldErrors: { currentPassword: "Current password is required." } },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters.", fieldErrors: { newPassword: "Minimum 8 characters." } },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await User.findById(session.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect.", fieldErrors: { currentPassword: "Incorrect current password." } },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = passwordHash;
  // Bumping the token version invalidates every existing session. We then
  // re-issue a cookie for the current device so the person changing the
  // password is not logged out, while all other sessions are revoked.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  const token = await signSessionToken({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role === "developer" ? "developer" : "admin",
    tokenVersion: user.tokenVersion,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({ ok: true });
}
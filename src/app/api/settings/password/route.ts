import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { SESSION_COOKIE, signSessionToken, sessionCookieOptions, normalizeRole } from "@/lib/auth";
import { revokeUserSessions } from "@/lib/sessions";
import { runUnscoped } from "@/lib/tenant";
import { withTenant } from "@/lib/tenant-route";

export async function PUT(req: Request) {
  return withTenant(async (session) => {

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

  // Accounts are global; the id is enough to find the signed-in user.
  const user = await runUnscoped(() => User.findById(session.id));
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
  // The tokenVersion bump kills every other cookie on its next request; marking
  // their device rows revoked too keeps the superadmin device list truthful.
  try {
    await revokeUserSessions(String(user._id), session.sid ?? null);
  } catch {
    // Best-effort: the tokenVersion bump already ended those sessions.
  }

  const token = await signSessionToken(
    {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      tokenVersion: user.tokenVersion,
      tenantId: user.tenantId ?? null,
    },
    session.sid ?? ""
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({ ok: true });
  });
}
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import {
  readSession,
  isSuperadmin,
  signSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { runUnscoped } from "@/lib/tenant";
import { revokeUserSessions } from "@/lib/sessions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Change the signed-in superadmin's own password.
 *
 * Verifies the current password, sets the new one and bumps tokenVersion so any
 * *other* live session is signed out — then re-issues a fresh cookie so the
 * caller's own session keeps working.
 */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session || !isSuperadmin(session)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { currentPassword?: string; newPassword?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!currentPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Enter your current password and a new one of at least 8 characters." },
      { status: 400 }
    );
  }

  await dbConnect();
  const user = await runUnscoped(() => User.findById(session.id));
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });

  const nextVersion = (user.tokenVersion ?? 0) + 1;
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = nextVersion;
  await user.save();

  await recordAudit({
    actor: session,
    action: "self.password.change",
    targetType: "user",
    targetId: session.id,
    details: "Changed own superadmin password",
  });

  // Revoke every other device row; the tokenVersion bump above already ends
  // their cookies, this just makes the device list accurate.
  try {
    await revokeUserSessions(session.id, session.sid ?? null);
  } catch {
    // Best-effort.
  }

  const token = await signSessionToken(
    {
      id: session.id,
      name: session.name,
      email: session.email,
      role: "superadmin",
      tokenVersion: nextVersion,
      tenantId: null,
    },
    session.sid ?? ""
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

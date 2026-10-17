import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { withSuperadmin } from "@/lib/tenant-route";
import { recordAudit } from "@/lib/audit";
import { normalizeRole, signSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { runUnscoped } from "@/lib/tenant";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function POST(_req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { userId } = await ctx.params;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
    }
    if (userId === session.id) {
      return NextResponse.json({ error: "Cannot impersonate your own account." }, { status: 400 });
    }

    await dbConnect();
    const user = await runUnscoped(() => User.findById(userId).lean());
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const role = normalizeRole(user.role);
    if (role === "superadmin") {
      return NextResponse.json({ error: "Cannot impersonate a superadmin account." }, { status: 400 });
    }

    await recordAudit({
      actor: session,
      action: "user.impersonate",
      targetType: "user",
      targetId: user.email,
      details: `Impersonating ${role} account`,
    });

    const token = await signSessionToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role,
      tokenVersion: user.tokenVersion ?? 0,
      tenantId: user.tenantId ?? null,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  });
}

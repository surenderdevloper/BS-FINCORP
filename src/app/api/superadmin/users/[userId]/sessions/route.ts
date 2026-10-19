import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { withSuperadmin } from "@/lib/tenant-route";
import { listUserSessions, revokeSession, revokeUserSessions } from "@/lib/sessions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET  — list the signed-in devices for an account ("where is it logged in").
 * DELETE — sign a device out: `?sid=` one device, or `?all=1` for every device.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  return withSuperadmin(async () => {
    const { userId } = await ctx.params;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
    }
    await dbConnect();
    const sessions = await listUserSessions(userId);
    return NextResponse.json({ sessions });
  });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { userId } = await ctx.params;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
    }

    const url = new URL(req.url);
    const sid = url.searchParams.get("sid");
    const all = url.searchParams.get("all") === "1";
    if (!sid && !all) {
      return NextResponse.json({ error: "Provide ?sid= or ?all=1." }, { status: 400 });
    }

    await dbConnect();
    let revoked = 0;
    if (all) {
      revoked = await revokeUserSessions(userId);
    } else {
      revoked = (await revokeSession(userId, sid as string)) ? 1 : 0;
    }
    if (!revoked) {
      return NextResponse.json({ error: "No matching active session." }, { status: 404 });
    }

    await recordAudit({
      actor: session,
      action: all ? "session.revoke_all" : "session.revoke",
      targetType: "user",
      targetId: userId,
      details: all
        ? `Signed out all ${revoked} device(s)`
        : `Signed out device ${String(sid).slice(0, 8)}…`,
    });

    return NextResponse.json({ ok: true, revoked });
  });
}

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { withSuperadmin } from "@/lib/tenant-route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetId = (searchParams.get("targetId") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(searchParams.get("limit") ?? 100) || 100, 300);

  return withSuperadmin(async () => {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    if (targetId) filter.targetId = targetId;
    if (q) {
      filter.$or = [
        { action: { $regex: q, $options: "i" } },
        { actorEmail: { $regex: q, $options: "i" } },
        { targetId: { $regex: q, $options: "i" } },
        { details: { $regex: q, $options: "i" } },
      ];
    }

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return NextResponse.json({
      logs: logs.map((l) => ({
        id: String(l._id),
        action: l.action,
        actorEmail: l.actorEmail,
        actorRole: l.actorRole,
        targetType: l.targetType,
        targetId: l.targetId,
        details: l.details,
        createdAt: l.createdAt?.toISOString(),
      })),
    });
  });
}

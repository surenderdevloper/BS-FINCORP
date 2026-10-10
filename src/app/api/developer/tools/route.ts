import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireDeveloper } from "@/lib/auth";
import { invalidateCompanySettingCache, getCompanySetting } from "@/models/CompanySetting";
import { invalidatePenaltyRuleCache } from "@/models/PenaltyRule";
import { invalidateAppConfigCache } from "@/models/AppConfig";

function dbStateLabel(state: number): string {
  return (
    { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }[state] ?? "unknown"
  );
}

export async function POST(req: Request) {
  const session = await requireDeveloper();
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "invalidate-cache") {
    invalidateCompanySettingCache();
    invalidatePenaltyRuleCache();
    invalidateAppConfigCache();
    return NextResponse.json({
      ok: true,
      message: "Server caches cleared (company, penalty rule, developer config).",
    });
  }

  if (body.action === "check-db") {
    const started = Date.now();
    try {
      await dbConnect();
      await getCompanySetting();
      return NextResponse.json({
        ok: true,
        state: dbStateLabel(mongoose.connection.readyState),
        ms: Date.now() - started,
        message: `Database reachable in ${Date.now() - started} ms.`,
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        state: dbStateLabel(mongoose.connection.readyState),
        message: err instanceof Error ? err.message : "Database check failed.",
      });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

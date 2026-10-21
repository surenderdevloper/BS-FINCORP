import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Tenant } from "@/models/Tenant";
import { uploadBackupToR2 } from "@/lib/backup-r2";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const tenants = await Tenant.find({}).distinct("slug");
    const testKey = `bs-fincorp/test/${Date.now()}.txt`;
    await uploadBackupToR2(testKey, "test");
    return NextResponse.json({ ok: true, tenants, testKey }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}

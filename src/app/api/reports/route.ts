import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { withTenant } from "@/lib/tenant-route";
import { buildReport, type ReportType } from "@/lib/reports";

export async function GET(req: Request) {
  return withTenant(async () => {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type") ?? "loans-active";
    const type: ReportType =
      typeParam === "collections" || typeParam === "loans-closed" ? typeParam : "loans-active";

    await dbConnect();
    const report = await buildReport({
      type,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return NextResponse.json(report);
  });
}

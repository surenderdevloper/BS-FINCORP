import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { CompanySetting } from "@/models/CompanySetting";
import { PenaltyRule, invalidatePenaltyRuleCache } from "@/models/PenaltyRule";
import { getCompanySetting } from "@/models/CompanySetting";
import { readSession } from "@/lib/auth";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const company = await getCompanySetting();
  const penalty = await PenaltyRule.findOne({ singleton: "penalty" });

  return NextResponse.json({
    company: {
      companyName: company.companyName,
      address: company.address,
      gst: company.gst,
      phone: company.phone,
      email: company.email,
      logo: company.logo ?? "",
      receiptPrefix: company.receiptPrefix,
      nextReceiptNo: company.nextReceiptNo,
      loanPrefix: company.loanPrefix,
      nextLoanNo: company.nextLoanNo,
    },
    penalty: {
      enabled: penalty?.enabled ?? true,
      graceDays: penalty?.graceDays ?? 3,
      penaltyType: penalty?.penaltyType ?? "fixed",
      penaltyPerDay: penalty?.penaltyPerDay ?? 10,
      maxPenaltyAmount: penalty?.maxPenaltyAmount ?? null,
    },
  });
}

export async function PUT(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { section?: "company" | "penalty"; company?: Record<string, unknown>; penalty?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();

  if (body.section === "penalty" && body.penalty) {
    const p = body.penalty;
    const updated = await PenaltyRule.findOneAndUpdate(
      { singleton: "penalty" },
      {
        $set: {
          enabled: p.enabled ?? true,
          graceDays: Math.max(0, Number(p.graceDays) || 0),
          penaltyType: p.penaltyType === "percentage" ? "percentage" : "fixed",
          penaltyPerDay: Math.max(0, Number(p.penaltyPerDay) || 0),
          maxPenaltyAmount:
            p.maxPenaltyAmount === null || p.maxPenaltyAmount === "" ? undefined : Math.max(0, Number(p.maxPenaltyAmount) || 0),
        },
        $setOnInsert: { singleton: "penalty" },
      },
      { upsert: true, returnDocument: "after" }
    );
    invalidatePenaltyRuleCache();
    return NextResponse.json({
      penalty: {
        enabled: updated.enabled,
        graceDays: updated.graceDays,
        penaltyType: updated.penaltyType,
        penaltyPerDay: updated.penaltyPerDay,
        maxPenaltyAmount: updated.maxPenaltyAmount ?? null,
      },
    });
  }

  if (body.section === "company" && body.company) {
    const c = body.company;
    const updated = await CompanySetting.findOneAndUpdate(
      { singleton: "company" },
      {
        $set: {
          companyName: String(c.companyName ?? "BS FINCORP").trim(),
          address: String(c.address ?? "").trim(),
          gst: String(c.gst ?? "").trim(),
          phone: String(c.phone ?? "").trim(),
          email: String(c.email ?? "").trim(),
          logo: typeof c.logo === "string" ? String(c.logo).slice(0, 5_000_000) : "",
        },
        $setOnInsert: { singleton: "company" },
      },
      { upsert: true, returnDocument: "after" }
    );
    return NextResponse.json({
      company: {
        companyName: updated.companyName,
        address: updated.address,
        gst: updated.gst,
        phone: updated.phone,
        email: updated.email,
        logo: updated.logo ?? "",
      },
    });
  }

  return NextResponse.json({ error: "Unknown settings section." }, { status: 400 });
}
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { CompanySetting, invalidateCompanySettingCache } from "@/models/CompanySetting";
import { PenaltyRule, invalidatePenaltyRuleCache } from "@/models/PenaltyRule";
import { AppConfig, invalidateAppConfigCache } from "@/models/AppConfig";
import { getSettingsSnapshot } from "@/lib/settings";
import { withTenant } from "@/lib/tenant-route";

export async function GET() {
  return withTenant(async () => {
    await dbConnect();
    return NextResponse.json(await getSettingsSnapshot());
  });
}

export async function PUT(req: Request) {
  return withTenant(async () => {
    let body: {
      section?: "company" | "penalty" | "messages";
      company?: Record<string, unknown>;
      penalty?: Record<string, unknown>;
      waTemplates?: Record<string, unknown>;
      smsTemplates?: Record<string, unknown>;
    };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();

  if (body.section === "messages") {
    const wa = (body.waTemplates ?? {}) as Record<string, unknown>;
    const sms = (body.smsTemplates ?? {}) as Record<string, unknown>;
    const set: Record<string, string> = {};
    for (const key of ["upcoming", "duetoday", "overdue", "payment", "followupFriendly", "followupStatus", "followupContact", "statement", "chat"]) {
      if (key in wa) {
        set[`waTemplates.${key}`] = String(wa[key] ?? "").slice(0, 3000).trim();
      }
    }
    for (const key of ["upcoming", "overdue"]) {
      if (key in sms) {
        set[`smsTemplates.${key}`] = String(sms[key] ?? "").slice(0, 1000).trim();
      }
    }
    const updated = await AppConfig.findOneAndUpdate(
      { singleton: "appconfig" },
      { $set: set, $setOnInsert: { singleton: "appconfig" } },
      { upsert: true, returnDocument: "after" }
    );
    invalidateAppConfigCache();
    return NextResponse.json({
      messages: {
        waTemplates: updated.waTemplates,
        smsTemplates: updated.smsTemplates,
      },
    });
  }

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
          companyName: String(c.companyName ?? "Gigabyte Finance Manager").trim(),
          address: String(c.address ?? "").trim(),
          gst: String(c.gst ?? "").trim(),
          phone: String(c.phone ?? "").trim(),
          email: String(c.email ?? "").trim(),
          logo: typeof c.logo === "string" ? String(c.logo).slice(0, 5_000_000) : "",
          ...(c.currency !== undefined ? { currency: String(c.currency).trim().toUpperCase() || "INR" } : {}),
          ...(c.currencySymbol !== undefined ? { currencySymbol: String(c.currencySymbol).trim() || "₹" } : {}),
          ...(c.countryCode !== undefined ? { countryCode: String(c.countryCode).trim().toUpperCase() || "IN" } : {}),
          ...(c.phoneDialCode !== undefined ? { phoneDialCode: String(c.phoneDialCode).replace(/\D/g, "") || "91" } : {}),
        },
        $setOnInsert: { singleton: "company" },
      },
      { upsert: true, returnDocument: "after" }
    );
    invalidateCompanySettingCache();
    return NextResponse.json({
      company: {
        companyName: updated.companyName,
        address: updated.address,
        gst: updated.gst,
        phone: updated.phone,
        email: updated.email,
        logo: updated.logo ?? "",
        currency: updated.currency ?? "INR",
        currencySymbol: updated.currencySymbol ?? "₹",
        countryCode: updated.countryCode ?? "IN",
        phoneDialCode: updated.phoneDialCode ?? "91",
      },
    });
  }

  return NextResponse.json({ error: "Unknown settings section." }, { status: 400 });
  });
}
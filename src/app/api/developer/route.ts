import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { hasDeveloperAccess } from "@/lib/developer-access";
import { isValidHex, DEFAULT_PRIMARY } from "@/lib/brand";
import { CompanySetting, getCompanySetting, invalidateCompanySettingCache } from "@/models/CompanySetting";
import {
  AppConfig,
  getAppConfig,
  invalidateAppConfigCache,
  DEFAULT_LOAN_TYPES,
  type LoanTypeConfig,
} from "@/models/AppConfig";
import {
  buildEmiReminderMessage,
  buildPaymentConfirmationMessage,
  buildCollectionFollowUpMessage,
  buildStatementMessage,
  buildCustomChatMessage,
} from "@/lib/whatsapp";
import { buildSmsMessage } from "@/lib/sms";

const MAX_STR = 400;
const MAX_TEMPLATE = 2000;

function str(value: unknown, max = MAX_STR): string {
  return String(value ?? "").trim().slice(0, max);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function color(value: unknown, fallback: string): string {
  const v = String(value ?? "").trim();
  return isValidHex(v) ? v : fallback;
}

function dbStateLabel(state: number): string {
  return (
    {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    }[state] ?? "unknown"
  );
}

function envStatus() {
  const names = ["MONGODB_URI", "AUTH_SECRET", "SEED_ADMIN_EMAIL", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  return names.map((name) => ({ name, set: Boolean(process.env[name]) }));
}

export async function GET() {
  if (!(await hasDeveloperAccess())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await dbConnect();
  const [company, config] = await Promise.all([getCompanySetting(), getAppConfig()]);

  const today = new Date();
  const brand = company.companyName || "Gigabyte Finance Manager";
  const officePhone = company.phone || "";
  const sampleLoan = "BF-0001";
  const sampleAmount = 4917;

  const defaults = {
    waTemplates: {
      upcoming: buildEmiReminderMessage("upcoming", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, dueDate: today.toISOString(), brandingName: brand }),
      duetoday: buildEmiReminderMessage("duetoday", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, dueDate: today.toISOString(), brandingName: brand }),
      overdue: buildEmiReminderMessage("overdue", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, dueDate: today.toISOString(), brandingName: brand }),
      payment: buildPaymentConfirmationMessage({ customerName: "Ramesh Kumar", amount: sampleAmount, paidAt: today.toISOString(), receiptNo: "RCPT-0001", loanNo: sampleLoan, brandingName: brand }),
      followupFriendly: buildCollectionFollowUpMessage("friendly", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, officePhone, brandingName: brand }),
      followupStatus: buildCollectionFollowUpMessage("status", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, officePhone, brandingName: brand }),
      followupContact: buildCollectionFollowUpMessage("contact_office", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, officePhone, brandingName: brand }),
      statement: buildStatementMessage({ customerName: "Ramesh Kumar", loanCount: 2, totalPaid: 20000, outstanding: 15000, brandingName: brand }),
      chat: buildCustomChatMessage("Ramesh Kumar", brand),
    },
    smsTemplates: {
      upcoming: buildSmsMessage("upcoming", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, dueDate: today.toISOString(), brandingName: brand }),
      overdue: buildSmsMessage("overdue", { customerName: "Ramesh Kumar", loanNo: sampleLoan, amount: sampleAmount, dueDate: today.toISOString(), brandingName: brand }),
    },
  };

  return NextResponse.json({
    company: {
      companyName: company.companyName,
      address: company.address,
      gst: company.gst,
      phone: company.phone,
      email: company.email,
      logo: company.logo ?? "",
      printLogo: config.printLogo ?? "",
      tagline: config.tagline ?? "",
      website: config.website ?? "",
      receiptPrefix: company.receiptPrefix,
      loanPrefix: company.loanPrefix,
    },
    documents: config.documents,
    loanTypes: (config.loanTypes?.length ? config.loanTypes : DEFAULT_LOAN_TYPES).map((t) => ({
      name: t.name,
      defaultInterestType: t.defaultInterestType,
      defaultRate: t.defaultRate,
      defaultTenureMonths: t.defaultTenureMonths,
      defaultEmiDay: t.defaultEmiDay,
      active: t.active,
    })),
    waTemplates: config.waTemplates,
    smsTemplates: config.smsTemplates,
    theme: config.theme,
    maintenance: config.maintenance,
    features: config.features,
    audit: (config.audit ?? []).slice(-30).reverse(),
    defaults,
    meta: {
      dbState: dbStateLabel(mongoose.connection.readyState),
      node: process.version,
      next: "16.3.5",
      env: envStatus(),
      now: new Date().toISOString(),
    },
  });
}

export async function PUT(req: Request) {
  if (!(await hasDeveloperAccess())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { section?: string; data?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();
  const section = body.section ?? "";
  const data = body.data ?? {};

  switch (section) {
    case "company": {
      const updated = await CompanySetting.findOneAndUpdate(
        { singleton: "company" },
        {
          $set: {
            companyName: str(data.companyName, 120) || "Gigabyte Finance Manager",
            address: str(data.address, 300),
            gst: str(data.gst, 60),
            phone: str(data.phone, 40),
            email: str(data.email, 120),
            logo: typeof data.logo === "string" ? data.logo.slice(0, 5_000_000) : "",
          },
          $setOnInsert: { singleton: "company" },
        },
        { upsert: true, returnDocument: "after" }
      );
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        {
          $set: {
            tagline: str(data.tagline, 80),
            website: str(data.website, 160),
            printLogo: typeof data.printLogo === "string" ? data.printLogo.slice(0, 5_000_000) : "",
          },
          $setOnInsert: { singleton: "appconfig" },
        },
        { upsert: true, returnDocument: "after" }
      );
      invalidateCompanySettingCache();
      invalidateAppConfigCache();
      return NextResponse.json({
        company: {
          companyName: updated.companyName,
          address: updated.address,
          gst: updated.gst,
          phone: updated.phone,
          email: updated.email,
          logo: updated.logo ?? "",
          printLogo: cfg.printLogo ?? "",
          tagline: cfg.tagline ?? "",
          website: cfg.website ?? "",
          receiptPrefix: updated.receiptPrefix,
          loanPrefix: updated.loanPrefix,
        },
      });
    }

    case "documents": {
      const d = (data.documents ?? data) as Record<string, unknown>;
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        {
          $set: {
            "documents.receiptTitle": str(d.receiptTitle, 80) || "Payment Receipt",
            "documents.receiptHeaderNote": str(d.receiptHeaderNote, 300),
            "documents.receiptFooterNote": str(d.receiptFooterNote, 300),
            "documents.signOffReceived": str(d.signOffReceived, 60) || "Received By",
            "documents.signOffCustomer": str(d.signOffCustomer, 60) || "Customer Sign",
            "documents.showGstOnReceipt": bool(d.showGstOnReceipt, true),
            "documents.showLogoOnPrint": bool(d.showLogoOnPrint, true),
            "documents.letterheadColor": color(d.letterheadColor, "#1e40af"),
            "documents.accentColor": color(d.accentColor, "#1e40af"),
            "documents.textColor": color(d.textColor, "#18181b"),
          },
          $setOnInsert: { singleton: "appconfig" },
        },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ documents: cfg.documents });
    }

    case "loanTypes": {
      const incoming = Array.isArray(data.loanTypes) ? data.loanTypes : [];
      const loanTypes: LoanTypeConfig[] = incoming
        .map((raw) => {
          const t = (raw ?? {}) as Record<string, unknown>;
          return {
            name: str(t.name, 60),
            defaultInterestType: t.defaultInterestType === "reducing" ? "reducing" : "flat",
            defaultRate: Math.max(0, num(t.defaultRate, 0)),
            defaultTenureMonths: Math.max(1, Math.round(num(t.defaultTenureMonths, 12))),
            defaultEmiDay: Math.min(28, Math.max(1, Math.round(num(t.defaultEmiDay, 5)))),
            active: bool(t.active, true),
          } as LoanTypeConfig;
        })
        .filter((t) => t.name.length > 0);

      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        { $set: { loanTypes }, $setOnInsert: { singleton: "appconfig" } },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ loanTypes: cfg.loanTypes });
    }

    case "waTemplates": {
      const t = (data.waTemplates ?? data) as Record<string, unknown>;
      const set: Record<string, string> = {};
      for (const key of ["upcoming", "duetoday", "overdue", "payment", "followupFriendly", "followupStatus", "followupContact", "statement", "chat"]) {
        set[`waTemplates.${key}`] = str(t[key], MAX_TEMPLATE);
      }
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        { $set: set, $setOnInsert: { singleton: "appconfig" } },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ waTemplates: cfg.waTemplates });
    }

    case "smsTemplates": {
      const t = (data.smsTemplates ?? data) as Record<string, unknown>;
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        {
          $set: {
            "smsTemplates.upcoming": str(t.upcoming, MAX_TEMPLATE),
            "smsTemplates.overdue": str(t.overdue, MAX_TEMPLATE),
          },
          $setOnInsert: { singleton: "appconfig" },
        },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ smsTemplates: cfg.smsTemplates });
    }

    case "theme": {
      const t = (data.theme ?? data) as Record<string, unknown>;
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        {
          $set: { "theme.primary": color(t.primary, DEFAULT_PRIMARY) },
          $setOnInsert: { singleton: "appconfig" },
        },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ theme: cfg.theme });
    }

    case "maintenance": {
      const m = (data.maintenance ?? data) as Record<string, unknown>;
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        {
          $set: {
            "maintenance.enabled": bool(m.enabled, false),
            "maintenance.message": str(m.message, 300) || "This system is temporarily under maintenance. Please try again shortly.",
          },
          $setOnInsert: { singleton: "appconfig" },
        },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ maintenance: cfg.maintenance });
    }

    case "features": {
      const f = (data.features ?? data) as Record<string, unknown>;
      const cfg = await AppConfig.findOneAndUpdate(
        { singleton: "appconfig" },
        {
          $set: {
            "features.whatsapp": bool(f.whatsapp, true),
            "features.sms": bool(f.sms, true),
          },
          $setOnInsert: { singleton: "appconfig" },
        },
        { upsert: true, returnDocument: "after" }
      );
      invalidateAppConfigCache();
      return NextResponse.json({ features: cfg.features });
    }

    default:
      return NextResponse.json({ error: "Unknown developer section." }, { status: 400 });
  }
}

/** Append an audit-log entry (called by the client after a successful save). */
export async function POST(req: Request) {
  if (!(await hasDeveloperAccess())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: { summary?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const summary = str(body.summary, 200);
  if (!summary) return NextResponse.json({ error: "Nothing to log." }, { status: 400 });

  const session = await readSession();
  const by = session?.email ?? "developer";

  await dbConnect();
  const cfg = await AppConfig.findOneAndUpdate(
    { singleton: "appconfig" },
    {
      $push: { audit: { $each: [{ at: new Date(), by, summary }], $slice: -50 } },
      $setOnInsert: { singleton: "appconfig" },
    },
    { upsert: true, returnDocument: "after" }
  );
  invalidateAppConfigCache();
  return NextResponse.json({ audit: cfg.audit.slice(-30).reverse() });
}

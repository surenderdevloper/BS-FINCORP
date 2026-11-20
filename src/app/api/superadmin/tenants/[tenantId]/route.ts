import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Tenant } from "@/models/Tenant";
import { CompanySetting, invalidateCompanySettingCache } from "@/models/CompanySetting";
import { withSuperadmin } from "@/lib/tenant-route";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tenantId: string }> };

const PLAN_STATUSES = ["active", "suspended"] as const;

export async function PATCH(req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { tenantId } = await ctx.params;

    let body: {
      planStatus?: string;
      planName?: string;
      businessName?: string;
      adminEmail?: string;
      expiresAt?: string | null;
      archived?: boolean;
      notes?: string;
      currency?: string;
      currencySymbol?: string;
      countryCode?: string;
      phoneDialCode?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const set: Record<string, unknown> = {};
    const fieldErrors: Record<string, string> = {};

    if (body.currency !== undefined) set.currency = String(body.currency).trim().toUpperCase() || "INR";
    if (body.currencySymbol !== undefined) set.currencySymbol = String(body.currencySymbol).trim();
    if (body.countryCode !== undefined) set.countryCode = String(body.countryCode).trim().toUpperCase();
    if (body.phoneDialCode !== undefined) set.phoneDialCode = String(body.phoneDialCode).replace(/\D/g, "") || "91";

    if (body.planStatus !== undefined) {
      if (PLAN_STATUSES.includes(body.planStatus as (typeof PLAN_STATUSES)[number])) {
        set.planStatus = body.planStatus;
      } else {
        fieldErrors.planStatus = "Must be active or suspended.";
      }
    }
    if (body.planName !== undefined) set.planName = String(body.planName).trim().slice(0, 100);
    if (body.businessName !== undefined) {
      const name = String(body.businessName).trim();
      if (name) set.businessName = name.slice(0, 160);
      else fieldErrors.businessName = "Business name is required.";
    }
    if (body.adminEmail !== undefined) {
      set.adminEmail = String(body.adminEmail).trim().toLowerCase().slice(0, 200);
    }
    if (body.notes !== undefined) set.notes = String(body.notes ?? "").trim().slice(0, 500);
    if (body.archived !== undefined) {
      if (typeof body.archived === "boolean") set.archived = body.archived;
      else fieldErrors.archived = "Expected true or false.";
    }
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null || body.expiresAt === "") {
        set.expiresAt = null;
      } else {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime())) fieldErrors.expiresAt = "Invalid date.";
        else set.expiresAt = parsed;
      }
    }

    if (Object.keys(fieldErrors).length) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }
    if (!Object.keys(set).length) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await dbConnect();
    const tenant = await Tenant.findOneAndUpdate(
      { tenantId },
      { $set: set },
      { new: true, runValidators: true }
    );
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    // Sync regional & currency settings to the tenant's CompanySetting record
    const companyUpdates: Record<string, string> = {};
    if (set.businessName) companyUpdates.companyName = String(set.businessName);
    if (set.currency) companyUpdates.currency = String(set.currency);
    if (set.currencySymbol) companyUpdates.currencySymbol = String(set.currencySymbol);
    if (set.countryCode) companyUpdates.countryCode = String(set.countryCode);
    if (set.phoneDialCode) companyUpdates.phoneDialCode = String(set.phoneDialCode);

    if (Object.keys(companyUpdates).length) {
      await CompanySetting.findOneAndUpdate(
        { tenantId, singleton: "company" },
        { $set: companyUpdates }
      );
      invalidateCompanySettingCache();
    }

    await recordAudit({
      actor: session,
      action: "tenant.update",
      targetType: "tenant",
      targetId: tenantId,
      details: `Updated ${Object.keys(set).join(", ")}`,
    });

    return NextResponse.json({
      tenant: {
        tenantId: tenant.tenantId,
        businessName: tenant.businessName,
        adminEmail: tenant.adminEmail ?? "",
        planName: tenant.planName ?? "",
        planStatus: tenant.planStatus,
        expiresAt: tenant.expiresAt ? new Date(tenant.expiresAt).toISOString() : null,
        archived: tenant.archived === true,
        notes: tenant.notes ?? "",
      },
    });
  });
}

/**
 * Soft-delete a tenant: marks it archived and suspends it. Records, users and
 * loans are left untouched so nothing is lost and the tenant can be restored
 * with a PATCH `{ archived: false }`.
 */
export async function DELETE(req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { tenantId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const restore = searchParams.get("restore") === "1";

    await dbConnect();
    const tenant = await Tenant.findOneAndUpdate(
      { tenantId },
      { $set: { archived: !restore, ...(restore ? {} : { planStatus: "suspended" }) } },
      { new: true }
    );
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    await recordAudit({
      actor: session,
      action: restore ? "tenant.restore" : "tenant.archive",
      targetType: "tenant",
      targetId: tenantId,
      details: restore ? "Restored tenant" : `Archived "${tenant.businessName}"`,
    });

    return NextResponse.json({ tenant: { tenantId, archived: tenant.archived === true } });
  });
}

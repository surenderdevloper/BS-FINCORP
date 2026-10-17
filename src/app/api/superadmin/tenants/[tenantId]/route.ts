import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Tenant } from "@/models/Tenant";
import { withSuperadmin } from "@/lib/tenant-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tenantId: string }> };

const PLAN_STATUSES = ["active", "suspended"] as const;

export async function PATCH(req: Request, ctx: RouteContext) {
  return withSuperadmin(async () => {
    const { tenantId } = await ctx.params;

    let body: {
      planStatus?: string;
      planName?: string;
      businessName?: string;
      adminEmail?: string;
      expiresAt?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const set: Record<string, unknown> = {};
    const fieldErrors: Record<string, string> = {};

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

    return NextResponse.json({
      tenant: {
        tenantId: tenant.tenantId,
        businessName: tenant.businessName,
        adminEmail: tenant.adminEmail ?? "",
        planName: tenant.planName ?? "",
        planStatus: tenant.planStatus,
        expiresAt: tenant.expiresAt ? new Date(tenant.expiresAt).toISOString() : null,
      },
    });
  });
}

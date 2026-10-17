import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Tenant } from "@/models/Tenant";
import { withSuperadmin } from "@/lib/tenant-route";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function normalizeTenantId(value: unknown): string | null {
  const slug = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9_-]{2,64}$/.test(slug) ? slug : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const includeArchived = searchParams.get("archived") === "1";

  return withSuperadmin(async () => {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: "No database connection." }, { status: 500 });

    const filter: Record<string, unknown> = {};
    if (!includeArchived) filter.archived = { $ne: true };
    if (q) {
      filter.$or = [
        { tenantId: { $regex: q, $options: "i" } },
        { businessName: { $regex: q, $options: "i" } },
        { adminEmail: { $regex: q, $options: "i" } },
      ];
    }

    const tenants = await Tenant.find(filter).sort({ createdAt: 1 }).lean();
    const now = Date.now();
    const rows = await Promise.all(
      tenants.map(async (t) => {
        const [customers, loans, users] = await Promise.all([
          db.collection("customers").countDocuments({ tenantId: t.tenantId }),
          db.collection("loans").countDocuments({ tenantId: t.tenantId }),
          db.collection("users").countDocuments({ tenantId: t.tenantId }),
        ]);
        const expires = t.expiresAt ? new Date(t.expiresAt).getTime() : null;
        const expired = expires !== null && expires < now;
        const daysLeft =
          expires === null ? null : Math.ceil((expires - now) / (24 * 60 * 60 * 1000));
        return {
          tenantId: t.tenantId,
          businessName: t.businessName,
          adminEmail: t.adminEmail ?? "",
          planName: t.planName ?? "",
          planStatus: t.planStatus ?? "active",
          expiresAt: t.expiresAt ? new Date(t.expiresAt).toISOString() : null,
          archived: t.archived === true,
          notes: t.notes ?? "",
          expired,
          daysLeft,
          createdAt: t.createdAt?.toISOString(),
          counts: { customers, loans, users },
        };
      })
    );
    return NextResponse.json({ tenants: rows });
  });
}

export async function POST(req: Request) {
  return withSuperadmin(async (session) => {
    let body: {
      tenantId?: string;
      businessName?: string;
      adminEmail?: string;
      planName?: string;
      expiresAt?: string | null;
      notes?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const tenantId = normalizeTenantId(body.tenantId);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Invalid tenant id.", fieldErrors: { tenantId: "2-64 chars: a-z, 0-9, _ or -." } },
        { status: 400 }
      );
    }
    const businessName = (body.businessName ?? "").trim();
    if (!businessName) {
      return NextResponse.json(
        { error: "Business name is required.", fieldErrors: { businessName: "Business name is required." } },
        { status: 400 }
      );
    }

    await dbConnect();
    const existing = await Tenant.findOne({ tenantId });
    if (existing) {
      return NextResponse.json(
        { error: "A tenant with that id already exists.", fieldErrors: { tenantId: "Already in use." } },
        { status: 409 }
      );
    }

    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid expiry date.", fieldErrors: { expiresAt: "Invalid date." } }, { status: 400 });
      }
      expiresAt = parsed;
    }

    const tenant = await Tenant.create({
      tenantId,
      businessName,
      adminEmail: (body.adminEmail ?? "").trim().toLowerCase(),
      planName: (body.planName ?? "").trim(),
      planStatus: "active",
      expiresAt,
      notes: String(body.notes ?? "").trim().slice(0, 500),
    });

    await recordAudit({
      actor: session,
      action: "tenant.create",
      targetType: "tenant",
      targetId: tenantId,
      details: `Created "${businessName}"`,
    });

    return NextResponse.json(
      { tenant: { tenantId: tenant.tenantId, businessName: tenant.businessName, planStatus: tenant.planStatus } },
      { status: 201 }
    );
  });
}

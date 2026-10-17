import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Tenant } from "@/models/Tenant";
import { withSuperadmin } from "@/lib/tenant-route";

export const dynamic = "force-dynamic";

function normalizeTenantId(value: unknown): string | null {
  const slug = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9_-]{2,64}$/.test(slug) ? slug : null;
}

export async function GET() {
  return withSuperadmin(async () => {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: "No database connection." }, { status: 500 });

    const tenants = await Tenant.find({}).sort({ createdAt: 1 }).lean();
    const rows = await Promise.all(
      tenants.map(async (t) => {
        const [customers, loans, users] = await Promise.all([
          db.collection("customers").countDocuments({ tenantId: t.tenantId }),
          db.collection("loans").countDocuments({ tenantId: t.tenantId }),
          db.collection("users").countDocuments({ tenantId: t.tenantId }),
        ]);
        return {
          tenantId: t.tenantId,
          businessName: t.businessName,
          adminEmail: t.adminEmail ?? "",
          planName: t.planName ?? "",
          planStatus: t.planStatus ?? "active",
          expiresAt: t.expiresAt ? new Date(t.expiresAt).toISOString() : null,
          createdAt: t.createdAt?.toISOString(),
          counts: { customers, loans, users },
        };
      })
    );
    return NextResponse.json({ tenants: rows });
  });
}

export async function POST(req: Request) {
  return withSuperadmin(async () => {
    let body: {
      tenantId?: string;
      businessName?: string;
      adminEmail?: string;
      planName?: string;
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

    const tenant = await Tenant.create({
      tenantId,
      businessName,
      adminEmail: (body.adminEmail ?? "").trim().toLowerCase(),
      planName: (body.planName ?? "").trim(),
      planStatus: "active",
    });

    return NextResponse.json(
      { tenant: { tenantId: tenant.tenantId, businessName: tenant.businessName, planStatus: tenant.planStatus } },
      { status: 201 }
    );
  });
}

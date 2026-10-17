import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { normalizeRole } from "@/lib/auth";
import { withSuperadmin } from "@/lib/tenant-route";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSuperadmin(async () => {
    await dbConnect();
    const users = await User.find({})
      .select("name email role tenantId createdAt lastLoginAt")
      .sort({ createdAt: 1 })
      .lean();
    return NextResponse.json({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: normalizeRole(u.role),
        tenantId: u.tenantId ?? null,
        createdAt: u.createdAt?.toISOString(),
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
      })),
    });
  });
}

export async function POST(req: Request) {
  return withSuperadmin(async (session) => {
    let body: {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      tenantId?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const role = normalizeRole(body.role);
    const fieldErrors: Record<string, string> = {};

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "Valid email required.";
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();

    // Only tenant admins are attached to a tenant; developers/superadmins stay global.
    let tenantId: string | null = null;
    if (role === "admin") {
      const slug = String(body.tenantId ?? "").trim().toLowerCase();
      if (!slug) fieldErrors.tenantId = "A tenant is required for an admin.";
      else tenantId = slug;
    }

    if (Object.keys(fieldErrors).length) {
      return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors }, { status: 400 });
    }

    await dbConnect();

    if (tenantId) {
      const tenant = await Tenant.findOne({ tenantId });
      if (!tenant) {
        return NextResponse.json(
          { error: "Unknown tenant.", fieldErrors: { tenantId: "No such tenant." } },
          { status: 400 }
        );
      }
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists.", fieldErrors: { email: "Already in use." } },
        { status: 409 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters.", fieldErrors: { password: "Minimum 8 characters." } },
        { status: 400 }
      );
    }

    const user = await User.create({
      name: name || email,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      tenantId,
    });

    await recordAudit({
      actor: session,
      action: "user.create",
      targetType: "user",
      targetId: email,
      details: `Created ${role}${tenantId ? ` for ${tenantId}` : ""}`,
    });

    return NextResponse.json(
      { user: { id: String(user._id), email: user.email, role: normalizeRole(user.role), tenantId: user.tenantId ?? null } },
      { status: 201 }
    );
  });
}

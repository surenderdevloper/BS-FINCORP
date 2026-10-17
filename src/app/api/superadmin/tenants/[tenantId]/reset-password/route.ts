import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { withSuperadmin } from "@/lib/tenant-route";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tenantId: string }> };

function generatePassword(): string {
  // Avoid ambiguous characters; 16 chars keeps it well above the 8-char floor.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = crypto.randomBytes(32);
  let out = "";
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Reset one or every administrator password for a tenant.
 *
 * Body: `{ password?: string, email?: string }`
 *   - `password` omitted/short → a strong password is generated and returned.
 *   - `email` given → only that account (must belong to the tenant).
 *   - `email` omitted → every account with role `admin` in that tenant.
 *
 * tokenVersion is bumped so any live session for those accounts is signed out
 * immediately.
 */
export async function POST(req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { tenantId } = await ctx.params;

    let body: { password?: string; email?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const provided = String(body.password ?? "");
    const generated = provided.length < 8;
    const password = generated ? generatePassword() : provided;
    const email = String(body.email ?? "").trim().toLowerCase();

    const query: Record<string, unknown> = { tenantId, role: "admin" };
    if (email) query.email = email;

    await dbConnect();
    const targets = await User.find(query).select("_id email tenantId role").lean();
    if (!targets.length) {
      return NextResponse.json(
        { error: email ? "No such admin account in this tenant." : "This tenant has no admin account." },
        { status: 404 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await User.updateMany(
      { _id: { $in: targets.map((u) => u._id) } },
      { $set: { passwordHash }, $inc: { tokenVersion: 1 } }
    );

    await recordAudit({
      actor: session,
      action: "user.password.reset",
      targetType: "tenant",
      targetId: tenantId,
      details: `Reset ${result.modifiedCount} admin password(s)${email ? ` (${email})` : ""}`,
    });

    return NextResponse.json({
      ok: true,
      updated: result.modifiedCount,
      accounts: targets.map((u) => u.email),
      password: generated ? password : null,
      generated,
    });
  });
}

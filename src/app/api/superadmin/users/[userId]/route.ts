import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { CustomerDocument } from "@/models/CustomerDocument";
import { CompanySetting } from "@/models/CompanySetting";
import { normalizeRole } from "@/lib/auth";
import { withSuperadmin } from "@/lib/tenant-route";
import { runUnscoped } from "@/lib/tenant";
import { revokeUserSessions } from "@/lib/sessions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

async function countSuperadmins(): Promise<number> {
  return User.countDocuments({ role: "superadmin" });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { userId } = await ctx.params;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
    }

    let body: { role?: string; tenantId?: string | null; name?: string; password?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const set: Record<string, unknown> = {};
    const inc: Record<string, number> = {};
    const unset: Record<string, 1> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name) set.name = name.slice(0, 120);
    }

    let roleChanged = false;
    if (body.role !== undefined) {
      const role = normalizeRole(body.role);
      // Never allow demoting the final superadmin — that would lock the panel.
      if (user.role === "superadmin" && role !== "superadmin" && (await countSuperadmins()) <= 1) {
        return NextResponse.json({ error: "Cannot remove the last superadmin." }, { status: 400 });
      }
      if (role !== user.role) {
        set.role = role;
        roleChanged = true;
      }
    }

    if (body.tenantId !== undefined) {
      const nextRole = (set.role as string | undefined) ?? user.role;
      if (nextRole === "admin") {
        const slug = String(body.tenantId ?? "").trim().toLowerCase();
        if (!slug) return NextResponse.json({ error: "Tenant is required for an admin." }, { status: 400 });
        const tenant = await Tenant.findOne({ tenantId: slug });
        if (!tenant) return NextResponse.json({ error: "Unknown tenant." }, { status: 400 });
        if (slug !== user.tenantId) set.tenantId = slug;
      } else {
        if (user.tenantId) unset.tenantId = 1;
      }
    }

    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      set.passwordHash = await bcrypt.hash(password, 10);
    }

    // Any identity change invalidates live sessions for this account.
    if (roleChanged || "passwordHash" in set || "tenantId" in set || "tenantId" in unset) inc.tokenVersion = 1;

    if (!Object.keys(set).length && !Object.keys(inc).length && !Object.keys(unset).length) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await User.updateOne(
      { _id: userId },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(inc).length ? { $inc: inc } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      }
    );

    await recordAudit({
      actor: session,
      action: "user.update",
      targetType: "user",
      targetId: user.email,
      details: `Updated ${Object.keys(set).filter((k) => k !== "passwordHash").join(", ") || "password"}`,
    });

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  return withSuperadmin(async (session) => {
    const { userId } = await ctx.params;
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
    }
    if (userId === session.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    // Three destructive scopes, chosen explicitly by the caller:
    //   account (default) — remove just this login, tenant data is untouched
    //   data              — wipe this account's tenant business data, keep logins
    //   both              — wipe the data and remove this login
    const scope = new URL(req.url).searchParams.get("scope") ?? "account";
    if (scope !== "account" && scope !== "data" && scope !== "both") {
      return NextResponse.json({ error: "Unknown delete scope." }, { status: 400 });
    }

    await dbConnect();
    const user = await runUnscoped(() => User.findById(userId).select("email role tenantId").lean());
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const removesAccount = scope === "account" || scope === "both";
    const removesData = scope === "data" || scope === "both";

    if (scope === "data" || scope === "both") {
      if (!user.tenantId) {
        return NextResponse.json(
          { error: "This account has no tenant, so there is no data to delete." },
          { status: 400 }
        );
      }
      if (!removesAccount && user.role === "superadmin" && (await countSuperadmins()) <= 1) {
        return NextResponse.json({ error: "Cannot delete the last superadmin." }, { status: 400 });
      }
    }

    if (removesAccount) {
      if (user.role === "superadmin" && (await countSuperadmins()) <= 1) {
        return NextResponse.json({ error: "Cannot delete the last superadmin." }, { status: 400 });
      }
    }

    const deleted: Record<string, number> = {};
    if (removesData) {
      const tenantId = user.tenantId as string;
      // Unscoped + explicit tenant filter: this is a platform-level wipe, and the
      // target tenant is derived from the account, never from the request body.
      const res = await runUnscoped(() =>
        Promise.all([
          Customer.deleteMany({ tenantId }),
          Loan.deleteMany({ tenantId }),
          Emi.deleteMany({ tenantId }),
          Payment.deleteMany({ tenantId }),
          CustomerDocument.deleteMany({ tenantId }),
        ])
      );
      deleted.customers = res[0].deletedCount;
      deleted.loans = res[1].deletedCount;
      deleted.emis = res[2].deletedCount;
      deleted.payments = res[3].deletedCount;
      deleted.customerDocuments = res[4].deletedCount;
      // Restart numbering for the fresh tenant; users, settings and rules stay.
      await runUnscoped(() =>
        CompanySetting.updateOne({ tenantId }, { $set: { nextLoanNo: 1, nextReceiptNo: 1 } })
      );
    }

    if (removesAccount) {
      await runUnscoped(() => User.deleteOne({ _id: userId }));
      try {
        await revokeUserSessions(userId);
      } catch {
        // Account row is gone; orphan sessions expire on their own.
      }
    }

    await recordAudit({
      actor: session,
      action: removesData && removesAccount ? "user.delete" : removesData ? "tenant.data.delete" : "user.delete",
      targetType: removesData && !removesAccount ? "tenant" : "user",
      targetId: removesData && !removesAccount ? String(user.tenantId ?? "") : user.email,
      details:
        scope === "both"
          ? `Deleted ${user.role} account and all tenant data`
          : scope === "data"
            ? `Wiped tenant data (${Object.entries(deleted).map(([k, v]) => `${k}:${v}`).join(", ")})`
            : `Deleted ${user.role} account`,
    });

    return NextResponse.json({ ok: true, scope, deleted });
  });
}

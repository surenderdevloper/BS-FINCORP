import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { withSuperadmin } from "@/lib/tenant-route";
import { recordAudit } from "@/lib/audit";
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";
import { CompanySetting } from "@/models/CompanySetting";
import { PenaltyRule } from "@/models/PenaltyRule";
import { CustomerDocument } from "@/models/CustomerDocument";
import { invalidateCustomersListCache } from "@/lib/customers";
import { invalidatePenaltyRuleCache } from "@/models/PenaltyRule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KNOWN_COLLECTIONS = [
  "customers",
  "loans",
  "emis",
  "payments",
  "users",
  "companySettings",
  "penaltyRules",
  "customerDocuments",
] as const;

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type BackupDoc = Record<string, unknown>;

type BackupFile = {
  app?: string;
  tenantId?: string;
  exportedAt?: string;
  counts?: Record<string, number>;
  total?: number;
  collections?: Record<string, unknown>;
};

async function purgeTenant(tenantId: string) {
  await Promise.all([
    Customer.deleteMany({ tenantId }),
    Loan.deleteMany({ tenantId }),
    Emi.deleteMany({ tenantId }),
    Payment.deleteMany({ tenantId }),
    User.deleteMany({ tenantId }),
    CustomerDocument.deleteMany({ tenantId }),
    CompanySetting.deleteMany({ tenantId }),
    PenaltyRule.deleteMany({ tenantId }),
  ]);
}

async function insertBatch(name: string, docs: BackupDoc[], tenantId: string) {
  if (!Array.isArray(docs) || docs.length === 0) return { inserted: 0 };
  try {
    switch (name) {
      case "customers": {
        const r = await Customer.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "loans": {
        const r = await Loan.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "emis": {
        const r = await Emi.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "payments": {
        const r = await Payment.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "users": {
        const r = await User.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "companySettings": {
        const r = await CompanySetting.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "penaltyRules": {
        const r = await PenaltyRule.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      case "customerDocuments": {
        const r = await CustomerDocument.insertMany(docs.map((d) => ({ ...d, tenantId })), { ordered: false });
        return { inserted: r.length };
      }
      default:
        return { inserted: 0 };
    }
  } catch (err) {
    const inserted = (err as { result?: { insertedCount?: number } })?.result?.insertedCount ?? 0;
    return { inserted };
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
  return withSuperadmin(async (session) => {
    try {
      const { tenantId } = await ctx.params;
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const purge = formData.get("purge") !== "false";
      const force = formData.get("force") === "true";

      if (!file) {
        return NextResponse.json({ error: "Backup file required" }, { status: 400 });
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "Backup file too large (max 100 MB)" }, { status: 400 });
      }

      const text = await file.text();
      let backup: BackupFile;
      try {
        backup = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
      }

      const collections = backup?.collections;
      if (!collections || typeof collections !== "object" || Array.isArray(collections)) {
        return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
      }

      // The backup carries the tenant it was taken from. Restoring it into a
      // different tenant rewrites every record's tenantId, so it needs an
      // explicit confirmation instead of happening silently.
      const sourceTenantId =
        typeof backup.tenantId === "string" && backup.tenantId.trim() ? backup.tenantId.trim() : null;

      if (sourceTenantId && sourceTenantId !== tenantId && !force) {
        return NextResponse.json(
          {
            error: `This backup belongs to tenant "${sourceTenantId}". Restoring it into "${tenantId}" rewrites every record's tenantId. Confirm to continue.`,
            code: "TENANT_MISMATCH",
            sourceTenantId,
          },
          { status: 400 },
        );
      }

      // Validate every collection before purging anything, so a malformed file
      // can never wipe a tenant and then fail halfway through the import.
      const invalid = KNOWN_COLLECTIONS.filter(
        (key) => collections[key] !== undefined && !Array.isArray(collections[key]),
      );
      if (invalid.length) {
        return NextResponse.json(
          { error: `Invalid collections in backup: ${invalid.join(", ")}` },
          { status: 400 },
        );
      }

      await dbConnect();

      if (purge) {
        await purgeTenant(tenantId);
      }

      const results: Record<string, { requested: number; inserted: number }> = {};

      for (const key of KNOWN_COLLECTIONS) {
        const docs = collections[key];
        if (!Array.isArray(docs)) {
          results[key] = { requested: 0, inserted: 0 };
          continue;
        }
        const res = await insertBatch(key, docs, tenantId);
        results[key] = { requested: docs.length, inserted: res.inserted };
      }

      await recordAudit({
        actor: session,
        action: "tenant.restore_backup",
        targetType: "tenant",
        targetId: tenantId,
        details: `Restored backup ${file.name} (purge=${purge}, source=${sourceTenantId ?? "unknown"}, crossTenant=${sourceTenantId ? sourceTenantId !== tenantId : false})`,
      });

      // The restore replaced business data wholesale — drop the in-memory
      // caches so the pre-restore view is not served for another TTL window.
      invalidateCustomersListCache();
      invalidatePenaltyRuleCache();

      return NextResponse.json(
        { ok: true, tenantId, sourceTenantId, crossTenant: sourceTenantId ? sourceTenantId !== tenantId : false, results },
        { status: 200 },
      );
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Restore failed" }, { status: 500 });
    }
  });
}

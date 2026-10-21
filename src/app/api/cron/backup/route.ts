import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";
import { CompanySetting } from "@/models/CompanySetting";
import { PenaltyRule } from "@/models/PenaltyRule";
import { CustomerDocument } from "@/models/CustomerDocument";
import { Tenant } from "@/models/Tenant";
import { uploadBackupToR2 } from "@/lib/backup-r2";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function exportForTenant(tenantId: string) {
  const [customers, loans, emis, payments, users, companySettings, penaltyRules, customerDocuments] =
    await Promise.all([
      Customer.find({ tenantId }).lean(),
      Loan.find({ tenantId }).lean(),
      Emi.find({ tenantId }).lean(),
      Payment.find({ tenantId }).lean(),
      User.find({ tenantId }).lean(),
      CompanySetting.find({ tenantId }).lean(),
      PenaltyRule.find({ tenantId }).lean(),
      CustomerDocument.find({ tenantId }).lean(),
    ]);

  const collections = {
    customers: JSON.parse(JSON.stringify(customers)),
    loans: JSON.parse(JSON.stringify(loans)),
    emis: JSON.parse(JSON.stringify(emis)),
    payments: JSON.parse(JSON.stringify(payments)),
    users: JSON.parse(JSON.stringify(users)),
    companySettings: JSON.parse(JSON.stringify(companySettings)),
    penaltyRules: JSON.parse(JSON.stringify(penaltyRules)),
    customerDocuments: JSON.parse(JSON.stringify(customerDocuments)),
  };

  const total = customers.length + loans.length + emis.length + payments.length + users.length + companySettings.length + penaltyRules.length + customerDocuments.length ;

  return {
    app: "BS-FINCORP",
    tenantId,
    exportedAt: new Date().toISOString(),
    counts: {
      customers: customers.length,
      loans: loans.length,
      emis: emis.length,
      payments: payments.length,
      users: users.length,
      companySettings: companySettings.length,
      penaltyRules: penaltyRules.length,
      customerDocuments: customerDocuments.length,
    },
    total,
    collections,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    const vercelCron = req.headers.get("x-vercel-cron");

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !vercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const tenants = await Tenant.find({}).distinct("tenantId");
    const activeTenants = (tenants as string[]).filter((t) => t && typeof t === "string");

    const date = new Date().toISOString().slice(0, 10);
    const results = [];

    for (const tenantId of activeTenants) {
      try {
        const backup = await exportForTenant(tenantId);
        const key = `bs-fincorp/${tenantId}/${date}.json`;
        await uploadBackupToR2(key, JSON.stringify(backup, null, 2));
        results.push({ tenantId, key, total: backup.total, status: "ok" });
      } catch (err) {
        results.push({ tenantId, status: "error", error: err instanceof Error ? err.message : "failed" });
      }
    }

    return NextResponse.json({ ok: true, date, results }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Backup failed" }, { status: 500 });
  }
}

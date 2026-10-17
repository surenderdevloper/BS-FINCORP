import "dotenv/config";
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Backfill existing single-tenant data into the multi-tenant model.
 *
 * The application is currently single-tenant: business records have no
 * `tenantId` and accounts have a null `tenantId`. This script assigns all of
 * them to one tenant (the company that already exists), creates the Tenant
 * registry entry, and installs the tenant-aware indexes.
 *
 * Safety properties:
 *   - Dry-run by default. Nothing is written unless `--apply` is passed.
 *   - Always writes a full JSON backup before an `--apply` run.
 *   - Idempotent: it only touches records that have no tenant yet, so running
 *     it twice is harmless.
 *   - Never deletes business data.
 *
 * Usage:
 *   npm run migrate-tenant -- --tenant-id default_client --business-name "GFM"            # dry run
 *   npm run migrate-tenant -- --tenant-id default_client --business-name "GFM" --apply    # apply
 */

interface Options {
  tenantId: string;
  businessName: string;
  adminEmail: string;
  apply: boolean;
  skipBackup: boolean;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1) return process.argv[idx + 1];
  return undefined;
}

function parseOptions(): Options {
  const tenantId = (arg("tenant-id") ?? "default_client").trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,64}$/.test(tenantId)) {
    throw new Error("--tenant-id must be 2-64 chars of a-z, 0-9, _ or -.");
  }
  return {
    tenantId,
    businessName: (arg("business-name") ?? "Gigabyte Finance Manager").trim(),
    adminEmail: (arg("admin-email") ?? process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase(),
    apply: process.argv.includes("--apply"),
    skipBackup: process.argv.includes("--skip-backup"),
  };
}

// Collections that carry a `tenantId`. Kept in sync with the models that apply
// the tenant plugin (see src/models/*.ts).
const TENANT_OWNED = [
  "customers",
  "loans",
  "emis",
  "payments",
  "customerdocuments",
  "companysettings",
  "penaltyrules",
  "appconfigs",
];

// Models whose indexes change shape in multi-tenant mode, imported dynamically
// (after MULTI_TENANT is enabled) so their compound indexes are registered.
async function scopedModels(): Promise<Array<[string, mongoose.Model<unknown>]>> {
  const [{ Customer }, { Loan }, { Payment }, { CompanySetting }, { PenaltyRule }, { AppConfig }] =
    await Promise.all([
      import("../src/models/Customer"),
      import("../src/models/Loan"),
      import("../src/models/Payment"),
      import("../src/models/CompanySetting"),
      import("../src/models/PenaltyRule"),
      import("../src/models/AppConfig"),
    ]);
  return [
    ["Customer", Customer as unknown as mongoose.Model<unknown>],
    ["Loan", Loan as unknown as mongoose.Model<unknown>],
    ["Payment", Payment as unknown as mongoose.Model<unknown>],
    ["CompanySetting", CompanySetting as unknown as mongoose.Model<unknown>],
    ["PenaltyRule", PenaltyRule as unknown as mongoose.Model<unknown>],
    ["AppConfig", AppConfig as unknown as mongoose.Model<unknown>],
  ];
}

async function backup() {
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection.");
  const collections = await db.listCollections().toArray();
  const dump: Record<string, unknown[]> = {};
  for (const { name } of collections) {
    dump[name] = await db.collection(name).find({}).toArray();
  }
  const path = join(dir, `pre-tenant-migration-${stamp}.json`);
  writeFileSync(path, JSON.stringify(dump, null, 2), "utf8");
  const total = Object.values(dump).reduce((n, rows) => n + rows.length, 0);
  console.log(`Backup written: ${path} (${collections.length} collections, ${total} records).`);
  return path;
}

async function main() {
  const options = parseOptions();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env first.");

  // Enable multi-tenancy BEFORE importing models so their conditional compound
  // indexes are registered.
  process.env.MULTI_TENANT = "on";

  console.log(options.apply ? "=== APPLYING MIGRATION ===" : "=== DRY RUN (no writes) ===");
  console.log(`Target tenant : ${options.tenantId}`);
  console.log(`Business name : ${options.businessName}`);
  console.log(`Admin email   : ${options.adminEmail || "(none)"}`);
  console.log("");

  await mongoose.connect(uri);

  if (options.apply) {
    if (options.skipBackup) {
      console.log("Skipping backup (--skip-backup).");
    } else {
      await backup();
    }
  }

  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection.");

  const missingFilter = {
    $or: [
      { tenantId: { $exists: false } },
      { tenantId: null },
      { tenantId: "" },
    ],
  };

  const counts: Record<string, number> = {};
  for (const name of TENANT_OWNED) {
    counts[name] = await db.collection(name).countDocuments(missingFilter);
  }
  const userCount = await db.collection("users").countDocuments({
    ...missingFilter,
    role: "admin",
  });

  console.log("Records without a tenant (to be backfilled):");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(20)} ${count}`);
  }
  console.log(`  ${"users (admin only)".padEnd(20)} ${userCount}`);
  console.log("");

  if (!options.apply) {
    console.log("Dry run complete. Re-run with --apply to write these changes.");
    await mongoose.disconnect();
    return;
  }

  // 1. Register the tenant.
  const { Tenant } = await import("../src/models/Tenant");
  await Tenant.updateOne(
    { tenantId: options.tenantId },
    {
      $set: { businessName: options.businessName, adminEmail: options.adminEmail },
      $setOnInsert: { planStatus: "active", planName: "Default" },
    },
    { upsert: true }
  );
  console.log(`Tenant "${options.tenantId}" ensured.`);

  // 2. Backfill tenant-owned collections.
  for (const name of TENANT_OWNED) {
    const result = await db
      .collection(name)
      .updateMany(missingFilter, { $set: { tenantId: options.tenantId } });
    console.log(`  ${name.padEnd(20)} updated ${result.modifiedCount}`);
  }

  // 3. Only admin accounts belong to this tenant. Developers/superadmins stay
  //    global (tenantId null) so they can operate across every tenant.
  const userResult = await db
    .collection("users")
    .updateMany({ ...missingFilter, role: "admin" }, { $set: { tenantId: options.tenantId } });
  console.log(`  ${"users (admin only)".padEnd(20)} updated ${userResult.modifiedCount}`);

  // 4. Install tenant-aware indexes (drops the old single-tenant unique ones).
  const models = await scopedModels();
  for (const [modelName, model] of models) {
    await model.syncIndexes();
    console.log(`  indexes synced: ${modelName}`);
  }

  await mongoose.disconnect();
  console.log("\nMigration complete. Verify the app, then set MULTI_TENANT=on.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

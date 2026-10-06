import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs";

import { User } from "../src/models/User";
import { Customer } from "../src/models/Customer";
import { Loan } from "../src/models/Loan";
import { Emi } from "../src/models/Emi";
import { Payment } from "../src/models/Payment";
import { CompanySetting } from "../src/models/CompanySetting";
import { PenaltyRule } from "../src/models/PenaltyRule";
import { CustomerDocument } from "../src/models/CustomerDocument";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bs_fincorp";

// Restore inserts each backup collection through its Mongoose model so casting
// applies (string -> ObjectId on *_id fields), matching what the app queries.
// This is a dev-time tool: it is intentionally not exposed in the app UI so only
// someone with repo access can import data.
type InsertResult = { ok: true; inserted: number } | { ok: false; inserted: number };

async function insertBatch(name: string, docs: unknown[]): Promise<InsertResult> {
  try {
    switch (name) {
      case "customers": {
        const r = await Customer.insertMany(docs as Parameters<typeof Customer.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "loans": {
        const r = await Loan.insertMany(docs as Parameters<typeof Loan.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "emis": {
        const r = await Emi.insertMany(docs as Parameters<typeof Emi.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "payments": {
        const r = await Payment.insertMany(docs as Parameters<typeof Payment.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "users": {
        const r = await User.insertMany(docs as Parameters<typeof User.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "companySettings": {
        const r = await CompanySetting.insertMany(docs as Parameters<typeof CompanySetting.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "penaltyRules": {
        const r = await PenaltyRule.insertMany(docs as Parameters<typeof PenaltyRule.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      case "customerDocuments": {
        const r = await CustomerDocument.insertMany(docs as Parameters<typeof CustomerDocument.insertMany>[0], { ordered: false });
        return { ok: true, inserted: r.length };
      }
      default:
        return { ok: false, inserted: 0 };
    }
  } catch (err) {
    const inserted = (err as { result?: { insertedCount?: number } }).result?.insertedCount ?? 0;
    return { ok: false, inserted };
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/restore.ts <path-to-backup.json>");
    process.exit(1);
  }

  let backup: { collections?: Record<string, unknown[]> };
  try {
    backup = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("Could not read the backup file:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const collections = backup.collections;
  if (!collections || typeof collections !== "object") {
    console.error("This file does not look like a BS FINCORP backup (missing `collections`).");
    process.exit(1);
  }

  const knownCollections = ["customers", "loans", "emis", "payments", "users", "companySettings", "penaltyRules", "customerDocuments"];
  const unknown = Object.keys(collections).filter((k) => !knownCollections.includes(k));
  if (unknown.length) {
    console.warn(`WARNING: ignoring unknown collections: ${unknown.join(", ")}`);
  }

  await mongoose.connect(uri);
  console.log("Connected to", uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Could not access the database.");

  const existing = await db.listCollections().toArray();
  if (existing.length > 0) {
    console.warn("WARNING: the target database is not empty. Restoring into a non-empty");
    console.warn("database can create duplicate / conflicting records. Recommended: run this");
    console.warn("against an empty database and verify counts afterwards.");
  }

  for (const [name, docs] of Object.entries(collections)) {
    if (!knownCollections.includes(name)) continue;
    if (!Array.isArray(docs) || docs.length === 0) {
      console.log(`skipped "${name}" (empty)`);
      continue;
    }
    const result = await insertBatch(name, docs);
    const label = result.ok ? "restored" : "partially restored";
    const skipped = docs.length - result.inserted;
    console.log(`${label} ${result.inserted}/${docs.length} docs into "${name}"${skipped > 0 ? ` (${skipped} skipped as duplicates/invalid)` : ""}`);
  }

  await mongoose.disconnect();
  console.log("\nRestore finished. Compare the printed counts with the `counts` object in the");
  console.log("backup file, then deploy with MONGODB_URI pointing at this database.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
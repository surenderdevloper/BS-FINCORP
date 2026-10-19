import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

/**
 * Rename a tenant id across the whole database.
 *
 * Usage:
 *   npx tsx scripts/rename-tenant.ts <oldId> <newId>            # dry run
 *   npx tsx scripts/rename-tenant.ts <oldId> <newId> --apply    # apply
 *
 * Safe by construction: every update is `{ tenantId: oldId } -> $set { tenantId: newId }`,
 * so documents without that exact tenant id are untouched, and a document that
 * already carries the new id is never matched. A JSON copy of every affected
 * document is written to backups/ before --apply runs.
 */
const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bs_fincorp";

async function main() {
  const [oldId, newId] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");

  if (!oldId || !newId || oldId === newId) {
    console.error("Usage: npx tsx scripts/rename-tenant.ts <oldId> <newId> [--apply]");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle.");

  const taken = await db.collection("tenants").findOne({ tenantId: newId });
  if (taken) {
    console.error(`Aborted: tenant "${newId}" already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const oldExists = await db.collection("tenants").findOne({ tenantId: oldId });
  if (!oldExists) {
    console.warn(`WARNING: no tenant document with id "${oldId}" (data may still be renamed).`);
  }

  const names = (await db.listCollections().toArray()).map((c) => c.name);
  const plan: Array<{ collection: string; count: number }> = [];
  const backup: Record<string, unknown[]> = {};

  for (const name of names) {
    const docs = await db.collection(name).find({ tenantId: oldId }).toArray();
    if (docs.length) {
      plan.push({ collection: name, count: docs.length });
      backup[name] = JSON.parse(JSON.stringify(docs));
    }
  }

  if (!plan.length) {
    console.log(`Nothing to rename: no documents with tenantId "${oldId}".`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Tenant rename "${oldId}" -> "${newId}"${apply ? "" : " (dry run)"}:`);
  for (const p of plan) console.log(`  ${p.collection}: ${p.count}`);
  const total = plan.reduce((s, p) => s + p.count, 0);
  console.log(`  total: ${total}`);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to rename.");
    await mongoose.disconnect();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join("backups", `rename-${oldId}-to-${newId}-${stamp}.json`);
  fs.mkdirSync("backups", { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ backupOf: oldId, renamedAt: new Date().toISOString(), collections: backup }, null, 2));
  console.log(`\nBackup written: ${file}`);

  for (const p of plan) {
    const res = await db.collection(p.collection).updateMany({ tenantId: oldId }, { $set: { tenantId: newId } });
    console.log(`  renamed ${res.modifiedCount}/${p.count} in "${p.collection}"`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

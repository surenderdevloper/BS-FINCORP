import "dotenv/config";
import mongoose from "mongoose";

import { Customer } from "../src/models/Customer";
import { Loan } from "../src/models/Loan";
import { Emi } from "../src/models/Emi";
import { Payment } from "../src/models/Payment";
import { CustomerDocument } from "../src/models/CustomerDocument";
import { CompanySetting } from "../src/models/CompanySetting";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bs_fincorp";

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error("Usage: npx tsx scripts/reset-tenant-demo.ts <tenantId>");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to", uri);

  const res = await Promise.all([
    Customer.deleteMany({ tenantId }),
    Loan.deleteMany({ tenantId }),
    Emi.deleteMany({ tenantId }),
    Payment.deleteMany({ tenantId }),
    CustomerDocument.deleteMany({ tenantId }),
  ]);

  console.log("Deleted:", {
    customers: res[0].deletedCount,
    loans: res[1].deletedCount,
    emis: res[2].deletedCount,
    payments: res[3].deletedCount,
    customerDocuments: res[4].deletedCount,
  });

  await CompanySetting.updateOne(
    { tenantId, singleton: "company" },
    { $set: { nextLoanNo: 1, nextReceiptNo: 1 } },
    { upsert: false }
  );
  console.log("Reset counters: nextLoanNo=1, nextReceiptNo=1");

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

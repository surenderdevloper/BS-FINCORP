import "dotenv/config";
import mongoose from "mongoose";

import { Tenant } from "../src/models/Tenant";
import { User } from "../src/models/User";
import { Customer } from "../src/models/Customer";
import { CompanySetting } from "../src/models/CompanySetting";
import { DeviceSession } from "../src/models/DeviceSession";

const TENANT = "tmp_smoke_tenant";
const EMAIL = "tmp_smoke_user@example.com";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  if (process.argv[2] === "--verify") {
    const [customer, user, tenant, setting] = await Promise.all([
      Customer.countDocuments({ tenantId: TENANT }),
      User.findOne({ email: EMAIL }).lean(),
      Tenant.findOne({ tenantId: TENANT }).lean(),
      CompanySetting.findOne({ tenantId: TENANT }).lean(),
    ]);
    console.log(
      JSON.stringify({
        customers: customer,
        userExists: !!user,
        tenantExists: !!tenant,
        nextLoanNo: setting?.nextLoanNo,
        nextReceiptNo: setting?.nextReceiptNo,
      })
    );
    await mongoose.disconnect();
    return;
  }

  if (process.argv[2] === "--reseed") {
    await Customer.deleteMany({ tenantId: TENANT });
    await Customer.create({ name: "Smoke Customer", mobile: "9876501234", tenantId: TENANT });
    await CompanySetting.updateOne(
      { tenantId: TENANT },
      { $set: { nextLoanNo: 7, nextReceiptNo: 9 } }
    );
    console.log("reseeded");
    await mongoose.disconnect();
    return;
  }

  if (process.argv[2] === "--teardown") {
    const res = await Promise.all([
      Tenant.deleteOne({ tenantId: TENANT }),
      User.deleteOne({ email: EMAIL }),
      Customer.deleteMany({ tenantId: TENANT }),
      CompanySetting.deleteOne({ tenantId: TENANT }),
      DeviceSession.deleteMany({ userId: { $exists: true }, device: "SmokeProbe" }),
    ]);
    console.log("torn down:", res.map((r) => r.deletedCount));
    await mongoose.disconnect();
    return;
  }

  await Tenant.updateOne(
    { tenantId: TENANT },
    { $set: { tenantId: TENANT, businessName: "Smoke Test", planStatus: "active" } },
    { upsert: true }
  );
  const user = await User.findOneAndUpdate(
    { email: EMAIL },
    {
      $set: {
        name: "Smoke User",
        email: EMAIL,
        passwordHash: "$2a$10$invalidhashinvalidhashinvalidhashinvalidhashinvalidha",
        role: "admin",
        tenantId: TENANT,
        tokenVersion: 0,
      },
    },
    { upsert: true, new: true }
  );
  const existing = await Customer.countDocuments({ tenantId: TENANT });
  if (existing === 0) {
    await Customer.create({ name: "Smoke Customer", mobile: "9876501234", tenantId: TENANT });
  }
  await CompanySetting.updateOne(
    { tenantId: TENANT },
    { $set: { tenantId: TENANT, singleton: "company", nextLoanNo: 7, nextReceiptNo: 9 } },
    { upsert: true }
  );

  const cs = await CompanySetting.findOne({ tenantId: TENANT }).lean();
  console.log(JSON.stringify({ userId: String(user._id), tenant: TENANT, nextLoanNo: cs?.nextLoanNo, nextReceiptNo: cs?.nextReceiptNo }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bs_fincorp";

async function main() {
  await mongoose.connect(uri);
  const email = (process.env.SEED_ADMIN_EMAIL ?? "bsfincorp79@gmail.com").toLowerCase();
  const tenantId = "default_client";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "bsfincorp123";

  await User.deleteMany({ tenantId, role: "admin" });
  const hash = await bcrypt.hash(password, 10);
  await User.create({
    name: "BS Fincorp Admin",
    email,
    passwordHash: hash,
    role: "admin",
    tenantId,
    tokenVersion: 0,
  });
  console.log("Created:", { email, tenantId, password });
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { User } from "../src/models/User";

/**
 * Promote / create a user account with a specific role.
 *
 * Safe to run against production: it never drops or reseeds the database. It
 * only updates the matching user (role and optionally password) or creates a
 * new user when none exists.
 *
 * Usage:
 *   npm run set-role -- --email owner@example.com --role developer
 *   npm run set-role -- --email owner@example.com --role developer --name "Owner" --password "secret123"
 */

type Role = "admin" | "developer" | "superadmin";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env first.");

  const email = (arg("email") ?? "").trim().toLowerCase();
  const role = (arg("role") ?? "").trim() as Role;
  const name = (arg("name") ?? "").trim();
  const password = arg("password") ?? "";

  if (!email) throw new Error("Provide --email <address>.");
  if (role !== "admin" && role !== "developer" && role !== "superadmin") {
    throw new Error("Provide --role <admin|developer|superadmin>.");
  }

  await mongoose.connect(uri);
  console.log("Connected to database.");

  const existing = await User.findOne({ email });

  if (existing) {
    existing.role = role;
    if (name) existing.name = name;
    if (password) existing.passwordHash = await bcrypt.hash(password, 10);
    await existing.save();
    console.log(`Updated ${email} → role "${role}"${password ? " (password changed)" : ""}.`);
  } else {
    if (!password) {
      throw new Error(
        `No user found for ${email}. To create one, also pass --password <value> (and optionally --name).`
      );
    }
    await User.create({
      name: name || "Developer",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    });
    console.log(`Created ${email} with role "${role}".`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

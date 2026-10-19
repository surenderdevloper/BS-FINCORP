import mongoose, { type InferSchemaType } from "mongoose";
import { tenantPlugin } from "@/lib/tenant-plugin";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "developer", "superadmin"], default: "admin" },
    tokenVersion: { type: Number, default: 0 },
    tenantId: { type: String, trim: true },
    lastLoginAt: { type: Date, default: null },
    /** Human readable device of the most recent login, e.g. "Chrome · Windows". */
    lastLoginDevice: { type: String, default: "" },
    lastLoginIp: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.plugin(tenantPlugin);

export type UserType = InferSchemaType<typeof userSchema>;

export const User =
  (mongoose.models.User as mongoose.Model<UserType>) ??
  mongoose.model<UserType>("User", userSchema);
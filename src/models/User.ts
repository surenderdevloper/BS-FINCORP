import mongoose, { type InferSchemaType } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin"], default: "admin" },
  },
  { timestamps: true }
);

export type UserType = InferSchemaType<typeof userSchema>;

export const User =
  (mongoose.models.User as mongoose.Model<UserType>) ??
  mongoose.model<UserType>("User", userSchema);
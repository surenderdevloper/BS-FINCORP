import mongoose, { type InferSchemaType } from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type PasswordResetType = InferSchemaType<typeof passwordResetSchema>;

export const PasswordReset =
  (mongoose.models.PasswordReset as mongoose.Model<PasswordResetType>) ??
  mongoose.model<PasswordResetType>("PasswordReset", passwordResetSchema);
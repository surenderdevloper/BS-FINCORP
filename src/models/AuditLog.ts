import mongoose, { type InferSchemaType } from "mongoose";

/**
 * Who did what, when — platform-level superadmin actions.
 *
 * Deliberately NOT tenant-scoped: audit entries describe the whole deployment
 * (tenant creation, plan changes, account resets) and must survive any single
 * tenant's lifecycle. The tenant plugin is intentionally not registered here.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: String, default: "" },
    actorEmail: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "" },
    details: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export type AuditLogType = InferSchemaType<typeof auditLogSchema>;

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<AuditLogType>) ??
  mongoose.model<AuditLogType>("AuditLog", auditLogSchema);

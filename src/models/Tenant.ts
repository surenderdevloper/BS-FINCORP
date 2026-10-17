import mongoose, { type InferSchemaType } from "mongoose";

/**
 * A tenant is one finance company using the shared application.
 *
 * Multi-tenancy is opt-in via the MULTI_TENANT environment flag. While the flag
 * is off, this collection is unused and the application behaves exactly as the
 * original single-tenant build. Business-owned collections carry a `tenantId`
 * that points at `tenantId` below.
 */
const tenantSchema = new mongoose.Schema(
  {
    // Stable, immutable slug used as the foreign key on business records.
    tenantId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    businessName: { type: String, required: true, trim: true },
    // Primary administrator for the tenant (display only; auth lives on User).
    adminEmail: { type: String, default: "", lowercase: true, trim: true },
    planName: { type: String, default: "", trim: true },
    planStatus: { type: String, enum: ["active", "suspended"], default: "active" },
    expiresAt: { type: Date, default: null },
    // Soft delete: archived tenants stay listed (with their data) but are
    // excluded from the default panel list and treated as suspended.
    archived: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export type TenantType = InferSchemaType<typeof tenantSchema>;

export const Tenant =
  (mongoose.models.Tenant as mongoose.Model<TenantType>) ??
  mongoose.model<TenantType>("Tenant", tenantSchema);

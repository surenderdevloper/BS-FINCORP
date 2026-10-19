import mongoose, { type InferSchemaType } from "mongoose";

/**
 * A signed-in device session, tracked so a superadmin can see where an account
 * is logged in and sign a specific device out.
 *
 * Deliberately NOT tenant-scoped (like AuditLog): sessions are resolved from the
 * verified cookie *before* a tenant is bound to the request, and revoking them
 * is a platform-level operation. Lookups are by the globally unique `sid` or by
 * `userId`, both of which are already unique across tenants.
 */
const deviceSessionSchema = new mongoose.Schema({
  /** Session id embedded in the JWT (`sid` claim). */
  sid: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  tenantId: { type: String, default: "" },
  /** Human readable device, e.g. "Chrome · Windows". */
  device: { type: String, default: "" },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
});

deviceSessionSchema.index({ userId: 1, revokedAt: 1 });

export type DeviceSessionType = InferSchemaType<typeof deviceSessionSchema>;

export const DeviceSession =
  (mongoose.models.DeviceSession as mongoose.Model<DeviceSessionType>) ??
  mongoose.model<DeviceSessionType>("DeviceSession", deviceSessionSchema);

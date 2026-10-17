import mongoose, { type InferSchemaType } from "mongoose";
import { multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: "" },
    mobile: {
      type: String,
      required: true,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },
    altMobile: { type: String, trim: true, default: "" },
    aadhaar: {
      type: String,
      trim: true,
      match: /^\d{12}$/,
    },
    pan: { type: String, uppercase: true, trim: true, sparse: true, match: /^[A-Z]{5}\d{4}[A-Z]$/ },
    dob: { type: Date },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    tenantId: { type: String, trim: true },
  },
  { timestamps: true }
);

customerSchema.plugin(tenantPlugin);

customerSchema.index({ name: "text", mobile: "text", aadhaar: "text" });
customerSchema.index({ createdAt: -1 });

// In multi-tenant mode a phone/aadhaar only has to be unique within its tenant;
// in single-tenant mode uniqueness stays global (unchanged from before).
if (multiTenantEnabled()) {
  customerSchema.index({ tenantId: 1, mobile: 1 }, { unique: true });
  customerSchema.index({ tenantId: 1, aadhaar: 1 }, { unique: true, sparse: true });
} else {
  customerSchema.index({ mobile: 1 }, { unique: true });
  customerSchema.index({ aadhaar: 1 }, { unique: true, sparse: true });
}

export type CustomerType = InferSchemaType<typeof customerSchema>;

export const Customer =
  (mongoose.models.Customer as mongoose.Model<CustomerType>) ??
  mongoose.model<CustomerType>("Customer", customerSchema);

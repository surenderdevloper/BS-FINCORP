import mongoose, { type InferSchemaType } from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: "" },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },
    altMobile: { type: String, trim: true, default: "" },
    aadhaar: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
      match: /^\d{12}$/,
    },
    pan: { type: String, uppercase: true, trim: true, sparse: true, match: /^[A-Z]{5}\d{4}[A-Z]$/ },
    dob: { type: Date },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", mobile: "text", aadhaar: "text" });

export type CustomerType = InferSchemaType<typeof customerSchema>;

export const Customer =
  (mongoose.models.Customer as mongoose.Model<CustomerType>) ??
  mongoose.model<CustomerType>("Customer", customerSchema);
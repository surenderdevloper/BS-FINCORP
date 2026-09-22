import mongoose, { type InferSchemaType } from "mongoose";

const customerDocumentSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    documentType: {
      type: String,
      enum: ["aadhaar", "pan", "loan_agreement", "address_proof", "rc_vehicle", "other"],
      required: true,
    },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    // Base64 data URL of the uploaded file. Same embedded-storage architecture
    // already used for CompanySetting.logo — persisted in MongoDB, never the
    // serverless filesystem.
    data: { type: String, required: true },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

customerDocumentSchema.index({ customerId: 1, createdAt: -1 });

export type CustomerDocumentType = InferSchemaType<typeof customerDocumentSchema>;

export const CustomerDocument =
  (mongoose.models.CustomerDocument as mongoose.Model<CustomerDocumentType>) ??
  mongoose.model<CustomerDocumentType>("CustomerDocument", customerDocumentSchema);
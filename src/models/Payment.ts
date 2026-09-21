import mongoose, { type InferSchemaType } from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, unique: true },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true },
    loanNo: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    emiIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Emi" }],
    amount: { type: Number, required: true },
    principal: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    mode: { type: String, enum: ["cash", "online"], required: true },
    receivedBy: { type: String, default: "" },
    notes: { type: String, default: "" },
    type: { type: String, enum: ["EMI", "NOC_REPRINT"], default: "EMI" },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ loanId: 1 });

export type PaymentType = InferSchemaType<typeof paymentSchema>;

export const Payment =
  (mongoose.models.Payment as mongoose.Model<PaymentType>) ??
  mongoose.model<PaymentType>("Payment", paymentSchema);
import mongoose, { type InferSchemaType } from "mongoose";
import { multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

const paymentSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true },
    loanNo: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    emiIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Emi" }],
    // Actual cash received from the customer. This drives the dashboard
    // collection totals.
    amount: { type: Number, required: true },
    principal: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    // Concession / write-off granted on this payment.
    discount: { type: Number, default: 0 },
    // Credit balance consumed from a previous overpayment.
    advanceUsed: { type: Number, default: 0 },
    // Overpayment received on this payment, stored as new credit balance.
    advanceAdded: { type: Number, default: 0 },
    mode: { type: String, enum: ["cash", "online"], required: true },
    receivedBy: { type: String, default: "" },
    notes: { type: String, default: "" },
    type: { type: String, enum: ["EMI", "NOC_REPRINT"], default: "EMI" },
    tenantId: { type: String, trim: true },
  },
  { timestamps: true }
);

paymentSchema.plugin(tenantPlugin);

paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ loanId: 1 });

if (multiTenantEnabled()) {
  paymentSchema.index({ tenantId: 1, receiptNo: 1 }, { unique: true });
} else {
  paymentSchema.index({ receiptNo: 1 }, { unique: true });
}

export type PaymentType = InferSchemaType<typeof paymentSchema>;

export const Payment =
  (mongoose.models.Payment as mongoose.Model<PaymentType>) ??
  mongoose.model<PaymentType>("Payment", paymentSchema);
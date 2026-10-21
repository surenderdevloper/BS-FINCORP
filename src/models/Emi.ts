import mongoose, { type InferSchemaType } from "mongoose";
import { multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

const emiSchema = new mongoose.Schema(
  {
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true },
    loanNo: { type: String, required: true },
    emiNo: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    principal: { type: Number, required: true },
    interest: { type: Number, required: true },
    // Amount actually collected towards this EMI. `amount - paidAmount` is the
    // remaining due. Existing paid EMIs may have 0 here for backwards
    // compatibility; treat `status === "paid"` as fully settled regardless.
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "partial", "paid"], default: "pending" },
    paidOn: { type: Date },
    penalty: { type: Number, default: 0 },
    // Balance that was left unpaid on this EMI and moved to the next
    // instalment of the same loan (carry-forward). The EMI itself is settled.
    // `amount` above is always the *decided* instalment — carried money never
    // inflates it; it is tracked separately through `carriedIn` on the target.
    carriedForward: { type: Number, default: 0 },
    // Balance of earlier instalments that was moved into this EMI. The EMI's
    // own `amount` stays as decided at loan creation; the payable for this
    // month is `amount + carriedIn.amount`.
    carriedIn: {
      amount: { type: Number, default: 0 },
      principal: { type: Number, default: 0 },
      interest: { type: Number, default: 0 },
      penalty: { type: Number, default: 0 },
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    tenantId: { type: String, trim: true },
  },
  { timestamps: true }
);

emiSchema.plugin(tenantPlugin);

emiSchema.index({ loanId: 1, dueDate: 1 });
emiSchema.index({ status: 1, dueDate: 1 });
emiSchema.index({ loanId: 1, emiNo: 1 });
emiSchema.index({ loanNo: 1 });

// Tenant-prefixed variants of the hot lookups: in multi-tenant mode every
// query carries tenantId, so an index that does not lead with it cannot be
// used as a range scan (dashboard overdue counts, per-loan EMI pages).
if (multiTenantEnabled()) {
  emiSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
  emiSchema.index({ tenantId: 1, loanId: 1, dueDate: 1 });
}

export type EmiType = InferSchemaType<typeof emiSchema>;

export const Emi =
  (mongoose.models.Emi as mongoose.Model<EmiType>) ??
  mongoose.model<EmiType>("Emi", emiSchema);
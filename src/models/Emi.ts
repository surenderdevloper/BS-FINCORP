import mongoose, { type InferSchemaType } from "mongoose";

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
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  },
  { timestamps: true }
);

emiSchema.index({ loanId: 1, dueDate: 1 });
emiSchema.index({ status: 1, dueDate: 1 });
emiSchema.index({ loanId: 1, emiNo: 1 });
emiSchema.index({ loanNo: 1 });

export type EmiType = InferSchemaType<typeof emiSchema>;

export const Emi =
  (mongoose.models.Emi as mongoose.Model<EmiType>) ??
  mongoose.model<EmiType>("Emi", emiSchema);
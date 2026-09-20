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
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidOn: { type: Date },
    penalty: { type: Number, default: 0 },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  },
  { timestamps: true }
);

emiSchema.index({ loanId: 1, dueDate: 1 });
emiSchema.index({ status: 1, dueDate: 1 });

export type EmiType = InferSchemaType<typeof emiSchema>;

export const Emi =
  (mongoose.models.Emi as mongoose.Model<EmiType>) ??
  mongoose.model<EmiType>("Emi", emiSchema);
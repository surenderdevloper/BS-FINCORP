import mongoose, { type InferSchemaType } from "mongoose";
import { multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

const loanSchema = new mongoose.Schema(
  {
    loanNo: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicle: {
      name: { type: String, required: true },
      model: { type: String, default: "" },
      engineNo: { type: String, default: "" },
      chassisNo: { type: String, default: "" },
      regNo: { type: String, default: "" },
      loanType: { type: String, default: "2 Wheeler" },
      dealerName: { type: String, default: "" },
    },
    financial: {
      vehiclePrice: { type: Number, required: true },
      downPayment: { type: Number, required: true },
      loanAmount: { type: Number, required: true },
      interestRate: { type: Number, required: true },
      interestType: { type: String, enum: ["flat", "reducing"], default: "flat" },
      tenureMonths: { type: Number, required: true },
      emiDay: { type: Number, required: true, min: 1, max: 31 },
      startDate: { type: Date, required: true },
      firstDueDate: { type: Date },
    },
    paymentPlan: {
      monthlyEmi: { type: Number, required: true },
      totalPayable: { type: Number, required: true },
      totalInterest: { type: Number, required: true },
    },
    guarantor: {
      name: { type: String, default: "" },
      mobile: { type: String, default: "" },
      relation: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    // Credit balance from overpayments. Applied automatically to the next EMI
    // collected on this loan. Reset to 0 when the loan is closed.
    advance: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    closedAt: { type: Date },
    tenantId: { type: String, trim: true },
  },
  { timestamps: true }
);

loanSchema.plugin(tenantPlugin);

loanSchema.index({ customerId: 1 });
loanSchema.index({ status: 1, createdAt: -1 });
loanSchema.index({ "financial.startDate": 1 });
loanSchema.index({ closedAt: 1 });
// Reports and dashboard lists sort the whole collection by creation time —
// without this MongoDB falls back to an in-memory blocking sort.
loanSchema.index({ createdAt: -1 });

if (multiTenantEnabled()) {
  loanSchema.index({ tenantId: 1, loanNo: 1 }, { unique: true });
  loanSchema.index({ tenantId: 1, createdAt: -1 });
  // Dashboard active-loan queries and the loan reports filter tenant+status
  // and sort by createdAt — one index serves both predicates and the sort.
  loanSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
} else {
  loanSchema.index({ loanNo: 1 }, { unique: true });
}

export type LoanType = InferSchemaType<typeof loanSchema>;
export type LoanDocument = mongoose.HydratedDocument<LoanType>;

export const Loan =
  (mongoose.models.Loan as mongoose.Model<LoanType>) ??
  mongoose.model<LoanType>("Loan", loanSchema);
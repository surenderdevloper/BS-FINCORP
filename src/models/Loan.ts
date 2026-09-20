import mongoose, { type InferSchemaType } from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    loanNo: { type: String, required: true, unique: true },
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
    status: { type: String, enum: ["active", "closed"], default: "active" },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

export type LoanType = InferSchemaType<typeof loanSchema>;
export type LoanDocument = mongoose.HydratedDocument<LoanType>;

export const Loan =
  (mongoose.models.Loan as mongoose.Model<LoanType>) ??
  mongoose.model<LoanType>("Loan", loanSchema);
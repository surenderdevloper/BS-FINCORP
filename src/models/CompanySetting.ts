import mongoose, { type InferSchemaType } from "mongoose";

const companySettingSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "company", unique: true, required: true },
    companyName: { type: String, required: true, default: "BS FINCORP" },
    address: { type: String, default: "" },
    gst: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    receiptPrefix: { type: String, default: "RCPT" },
    nextReceiptNo: { type: Number, default: 1 },
    loanPrefix: { type: String, default: "BF" },
    nextLoanNo: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export type CompanySettingType = InferSchemaType<typeof companySettingSchema>;

export const CompanySetting =
  (mongoose.models.CompanySetting as mongoose.Model<CompanySettingType>) ??
  mongoose.model<CompanySettingType>("CompanySetting", companySettingSchema);

export async function getCompanySetting() {
  return CompanySetting.findOneAndUpdate(
    { singleton: "company" },
    { $setOnInsert: { singleton: "company" } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" }
  );
}

export async function nextLoanNumber(): Promise<{ loanNo: string }> {
  const setting = await getCompanySetting();
  const seq = setting.nextLoanNo;
  setting.nextLoanNo = (setting.nextLoanNo ?? 0) + 1;
  await setting.save();
  return {
    loanNo: `${setting.loanPrefix}-${String(seq).padStart(4, "0")}`,
  };
}

export async function nextReceiptNumber(): Promise<string> {
  const setting = await getCompanySetting();
  const seq = setting.nextReceiptNo;
  setting.nextReceiptNo = (setting.nextReceiptNo ?? 0) + 1;
  await setting.save();
  return `${setting.receiptPrefix}-${String(seq).padStart(4, "0")}`;
}
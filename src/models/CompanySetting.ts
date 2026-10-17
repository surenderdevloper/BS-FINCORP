import mongoose, { type InferSchemaType } from "mongoose";
import { currentTenantId, multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

const companySettingSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "company", required: true },
    companyName: { type: String, required: true, default: "Gigabyte Finance Manager" },
    address: { type: String, default: "" },
    gst: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    logo: { type: String, default: "" },
    receiptPrefix: { type: String, default: "RCPT" },
    nextReceiptNo: { type: Number, default: 1 },
    loanPrefix: { type: String, default: "GFM" },
    nextLoanNo: { type: Number, default: 1 },
    tenantId: { type: String, trim: true },
  },
  { timestamps: true }
);

companySettingSchema.plugin(tenantPlugin);

if (multiTenantEnabled()) {
  companySettingSchema.index({ tenantId: 1, singleton: 1 }, { unique: true });
} else {
  companySettingSchema.index({ singleton: 1 }, { unique: true });
}

export type CompanySettingType = InferSchemaType<typeof companySettingSchema>;

export const CompanySetting =
  (mongoose.models.CompanySetting as mongoose.Model<CompanySettingType>) ??
  mongoose.model<CompanySettingType>("CompanySetting", companySettingSchema);

let cache: Invalidatable<CompanySettingType> | null = null;
const CACHE_TTL_MS = 10_000;

type Invalidatable<T> = { value: T; at: number; key: string };

const cacheKey = () => currentTenantId() ?? "global";

/**
 * Read-only company settings lookup. Never writes to MongoDB by itself.
 *
 * - Short in-memory cache (10s) so repeated reads (sidebar, receipts, branding)
 *   do not hit the database every time.
 * - If no document exists, a schema-defaulted document is returned so callers
 *   can safely read default values. The default is only persisted when someone
 *   actually saves it (e.g. when allocating a receipt/loan number).
 */
export async function getCompanySetting(): Promise<InstanceType<typeof CompanySetting>> {
  const key = cacheKey();
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    const doc: InstanceType<typeof CompanySetting> = new CompanySetting(
      cache.value as CompanySettingType
    ) as InstanceType<typeof CompanySetting>;
    doc.isNew = false;
    return doc;
  }

  const doc = (await CompanySetting.findOne({ singleton: "company" }).exec()) as unknown as
    | InstanceType<typeof CompanySetting>
    | null;

  if (doc) {
    cache = { value: doc.toObject() as CompanySettingType, at: Date.now(), key };
    return doc;
  }

  const fresh = new CompanySetting({} as CompanySettingType) as InstanceType<typeof CompanySetting>;
  cache = { value: fresh.toObject() as CompanySettingType, at: Date.now(), key };
  return fresh;
}

export function invalidateCompanySettingCache(): void {
  cache = null;
}

export async function nextLoanNumber(): Promise<{ loanNo: string }> {
  const setting = (await CompanySetting.findOneAndUpdate(
    { singleton: "company" },
    { $inc: { nextLoanNo: 1 } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" }
  )) as unknown as InstanceType<typeof CompanySetting>;
  const seq = setting.nextLoanNo;
  invalidateCompanySettingCache();
  return {
    loanNo: `${setting.loanPrefix}-${String(seq - 1).padStart(4, "0")}`,
  };
}

export async function nextReceiptNumber(): Promise<string> {
  const setting = (await CompanySetting.findOneAndUpdate(
    { singleton: "company" },
    { $inc: { nextReceiptNo: 1 } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" }
  )) as unknown as InstanceType<typeof CompanySetting>;
  const seq = setting.nextReceiptNo;
  invalidateCompanySettingCache();
  return `${setting.receiptPrefix}-${String(seq - 1).padStart(4, "0")}`;
}
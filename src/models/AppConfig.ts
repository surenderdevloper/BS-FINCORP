import mongoose, { type InferSchemaType } from "mongoose";
import { currentTenantId, multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

/**
 * Developer Console configuration — owner-only settings that go beyond the
 * day-to-day Company Settings. Kept in its own singleton document so the
 * regular admin settings endpoint can never read or modify it.
 */

const loanTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    defaultInterestType: { type: String, enum: ["flat", "reducing"], default: "flat" },
    defaultRate: { type: Number, default: 0, min: 0 },
    defaultTenureMonths: { type: Number, default: 12, min: 1 },
    defaultEmiDay: { type: Number, default: 5, min: 1, max: 28 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    receiptTitle: { type: String, default: "Payment Receipt", trim: true },
    receiptHeaderNote: { type: String, default: "", trim: true },
    receiptFooterNote: { type: String, default: "This is a computer-generated receipt.", trim: true },
    signOffReceived: { type: String, default: "Received By", trim: true },
    signOffCustomer: { type: String, default: "Customer Sign", trim: true },
    showGstOnReceipt: { type: Boolean, default: true },
    showLogoOnPrint: { type: Boolean, default: true },
    letterheadColor: { type: String, default: "#1e40af" },
    accentColor: { type: String, default: "#1e40af" },
    textColor: { type: String, default: "#18181b" },
  },
  { _id: false }
);

const waTemplatesSchema = new mongoose.Schema(
  {
    upcoming: { type: String, default: "" },
    duetoday: { type: String, default: "" },
    overdue: { type: String, default: "" },
    payment: { type: String, default: "" },
    followupFriendly: { type: String, default: "" },
    followupStatus: { type: String, default: "" },
    followupContact: { type: String, default: "" },
    statement: { type: String, default: "" },
    chat: { type: String, default: "" },
  },
  { _id: false }
);

const smsTemplatesSchema = new mongoose.Schema(
  {
    upcoming: { type: String, default: "" },
    overdue: { type: String, default: "" },
  },
  { _id: false }
);

const auditEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: String, default: "" },
    summary: { type: String, default: "" },
  },
  { _id: false }
);

const appConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "appconfig", required: true },
    tagline: { type: String, default: "Loan Management", trim: true },
    website: { type: String, default: "", trim: true },
    printLogo: { type: String, default: "" },
    documents: { type: documentSchema, default: () => ({}) },
    loanTypes: { type: [loanTypeSchema], default: [] },
    waTemplates: { type: waTemplatesSchema, default: () => ({}) },
    smsTemplates: { type: smsTemplatesSchema, default: () => ({}) },
    theme: {
      primary: { type: String, default: "#059669" },
    },
    maintenance: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: "This system is temporarily under maintenance. Please try again shortly.", trim: true },
    },
    features: {
      whatsapp: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
    },
    audit: { type: [auditEntrySchema], default: [] },
    tenantId: { type: String, trim: true },
  },
  { timestamps: true, minimize: false }
);

appConfigSchema.plugin(tenantPlugin);

if (multiTenantEnabled()) {
  appConfigSchema.index({ tenantId: 1, singleton: 1 }, { unique: true });
} else {
  appConfigSchema.index({ singleton: 1 }, { unique: true });
}

export type AppConfigType = InferSchemaType<typeof appConfigSchema>;
export type LoanTypeConfig = {
  name: string;
  defaultInterestType: "flat" | "reducing";
  defaultRate: number;
  defaultTenureMonths: number;
  defaultEmiDay: number;
  active: boolean;
};

export const AppConfig =
  (mongoose.models.AppConfig as mongoose.Model<AppConfigType>) ??
  mongoose.model<AppConfigType>("AppConfig", appConfigSchema);

/** Loan types used when the developer has not configured any yet. */
export const DEFAULT_LOAN_TYPES: LoanTypeConfig[] = [
  { name: "2 Wheeler", defaultInterestType: "flat", defaultRate: 0, defaultTenureMonths: 12, defaultEmiDay: 5, active: true },
  { name: "3 Wheeler", defaultInterestType: "flat", defaultRate: 0, defaultTenureMonths: 12, defaultEmiDay: 5, active: true },
  { name: "4 Wheeler", defaultInterestType: "flat", defaultRate: 0, defaultTenureMonths: 12, defaultEmiDay: 5, active: true },
  { name: "Other", defaultInterestType: "flat", defaultRate: 0, defaultTenureMonths: 12, defaultEmiDay: 5, active: true },
];

let cache: { value: AppConfigType; at: number; key: string } | null = null;
const CACHE_TTL_MS = 10_000;

const cacheKey = () => currentTenantId() ?? "global";

/**
 * Read the developer configuration (cached for 10s). If no document exists a
 * schema-defaulted instance is returned so every caller reads safe defaults.
 * The document is only persisted when the developer actually saves it.
 */
export async function getAppConfig(): Promise<InstanceType<typeof AppConfig>> {
  const key = cacheKey();
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    const doc = new AppConfig(cache.value as AppConfigType) as InstanceType<typeof AppConfig>;
    doc.isNew = false;
    return doc;
  }

  const existing = (await AppConfig.findOne({ singleton: "appconfig" }).exec()) as unknown as
    | InstanceType<typeof AppConfig>
    | null;

  if (existing) {
    cache = { value: existing.toObject() as AppConfigType, at: Date.now(), key };
    return existing;
  }

  const fresh = new AppConfig({} as AppConfigType) as InstanceType<typeof AppConfig>;
  cache = { value: fresh.toObject() as AppConfigType, at: Date.now(), key };
  return fresh;
}

export function invalidateAppConfigCache(): void {
  cache = null;
}

/** Active loan-type names for dropdowns, falling back to sensible defaults. */
export function activeLoanTypeNames(config: AppConfigType): string[] {
  const configured = (config.loanTypes ?? []).filter((t) => t.active && t.name?.trim());
  if (configured.length > 0) return configured.map((t) => t.name.trim());
  return DEFAULT_LOAN_TYPES.map((t) => t.name);
}

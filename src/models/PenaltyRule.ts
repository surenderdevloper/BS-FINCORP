import mongoose, { type InferSchemaType } from "mongoose";
import { currentTenantId, multiTenantEnabled } from "@/lib/tenant";
import { tenantPlugin } from "@/lib/tenant-plugin";

const penaltyRuleSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "penalty", required: true },
    enabled: { type: Boolean, default: true },
    graceDays: { type: Number, default: 3 },
    penaltyType: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
    penaltyPerDay: { type: Number, default: 10 },
    maxPenaltyAmount: { type: Number }, // optional cap per EMI, e.g. 1000
    tenantId: { type: String, trim: true },
  },
  { timestamps: true }
);

penaltyRuleSchema.plugin(tenantPlugin);

if (multiTenantEnabled()) {
  penaltyRuleSchema.index({ tenantId: 1, singleton: 1 }, { unique: true });
} else {
  penaltyRuleSchema.index({ singleton: 1 }, { unique: true });
}

export type PenaltyRuleType = InferSchemaType<typeof penaltyRuleSchema>;

export const PenaltyRule =
  (mongoose.models.PenaltyRule as mongoose.Model<PenaltyRuleType>) ??
  mongoose.model<PenaltyRuleType>("PenaltyRule", penaltyRuleSchema);

let cache: Invalidatable<PenaltyRuleType> | null = null;
const CACHE_TTL_MS = 10_000;

type Invalidatable<T> = { value: T; at: number; key: string };

const cacheKey = () => currentTenantId() ?? "global";

export async function getPenaltyRule(): Promise<InstanceType<typeof PenaltyRule>> {
  const key = cacheKey();
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    const doc: InstanceType<typeof PenaltyRule> = new PenaltyRule(cache.value as PenaltyRuleType) as InstanceType<typeof PenaltyRule>;
    doc.isNew = false;
    return doc;
  }
  const existing = (await PenaltyRule.findOne({ singleton: "penalty" }).exec()) as unknown as InstanceType<typeof PenaltyRule> | null;
  if (existing) {
    cache = { value: existing.toObject() as PenaltyRuleType, at: Date.now(), key };
    return existing;
  }
  const fresh = new PenaltyRule({} as PenaltyRuleType) as InstanceType<typeof PenaltyRule>;
  cache = { value: fresh.toObject() as PenaltyRuleType, at: Date.now(), key };
  return fresh;
}

export function invalidatePenaltyRuleCache(): void {
  cache = null;
}

export async function getPenaltyRuleObj(): Promise<PenaltyRuleType> {
  const doc = await getPenaltyRule();
  return doc.toObject() as PenaltyRuleType;
}

/**
 * Days late after the grace period + computed penalty for an overdue EMI.
 * fixed      → ₹penaltyPerDay × lateDays
 * percentage → emiAmount × (penaltyPerDay / 100) × lateDays  (per-day %)
 */
export async function computePenaltyForEmi(
  dueDate: string,
  emiAmount: number,
  today: Date,
  rule?: PenaltyRuleType
): Promise<{ daysLate: number; penalty: number }> {
  const effectiveRule = rule ?? (await getPenaltyRuleObj());
  const msPerDay = 24 * 60 * 60 * 1000;
  const startToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const startDue = Date.UTC(new Date(dueDate).getUTCFullYear(), new Date(dueDate).getUTCMonth(), new Date(dueDate).getUTCDate());
  const rawLate = Math.floor((startToday - startDue) / msPerDay);
  const daysLate = Math.max(0, rawLate - (effectiveRule.graceDays ?? 0));

  if (!effectiveRule.enabled || daysLate <= 0) return { daysLate: 0, penalty: 0 };

  let penalty =
    effectiveRule.penaltyType === "fixed"
      ? (effectiveRule.penaltyPerDay ?? 0) * daysLate
      : emiAmount * ((effectiveRule.penaltyPerDay ?? 0) / 100) * daysLate;

  if (effectiveRule.maxPenaltyAmount) penalty = Math.min(penalty, effectiveRule.maxPenaltyAmount);
  return { daysLate, penalty: Math.round(penalty) };
}
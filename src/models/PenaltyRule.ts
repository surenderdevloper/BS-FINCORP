import mongoose, { type InferSchemaType } from "mongoose";

const penaltyRuleSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "penalty", unique: true, required: true },
    enabled: { type: Boolean, default: true },
    graceDays: { type: Number, default: 3 },
    penaltyType: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
    penaltyPerDay: { type: Number, default: 10 },
    maxPenaltyAmount: { type: Number }, // optional cap per EMI, e.g. 1000
  },
  { timestamps: true }
);

export type PenaltyRuleType = InferSchemaType<typeof penaltyRuleSchema>;

export const PenaltyRule =
  (mongoose.models.PenaltyRule as mongoose.Model<PenaltyRuleType>) ??
  mongoose.model<PenaltyRuleType>("PenaltyRule", penaltyRuleSchema);

let cache: Invalidatable<PenaltyRuleType> | null = null;
const CACHE_TTL_MS = 10_000;

type Invalidatable<T> = { value: T; at: number };

export async function getPenaltyRule(): Promise<InstanceType<typeof PenaltyRule>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    const doc: InstanceType<typeof PenaltyRule> = new PenaltyRule(cache.value as PenaltyRuleType) as InstanceType<typeof PenaltyRule>;
    doc.isNew = false;
    return doc;
  }
  const doc = (await PenaltyRule.findOneAndUpdate(
    { singleton: "penalty" },
    { $setOnInsert: { singleton: "penalty" } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" }
  )) as unknown as InstanceType<typeof PenaltyRule>;
  cache = { value: doc.toObject() as PenaltyRuleType, at: Date.now() };
  return doc;
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
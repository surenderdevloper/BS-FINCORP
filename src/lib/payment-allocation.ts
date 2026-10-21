/**
 * Pure allocation engine for EMI collections.
 *
 * Given a pool of money (cash received + existing advance + discount), it pays
 * down the selected EMIs oldest-first. Each EMI is settled against its
 * principal+interest first, then any penalty. An EMI becomes `partial` when
 * only part of it is covered, and `paid` when fully covered. Left-over cash
 * (overpayment) is returned as a new advance balance on the loan.
 *
 * Keeping this pure makes the same logic reusable for single/multi EMI
 * collection and for the "close loan" settlement.
 */

export interface AllocEmi {
  _id: string;
  /** Decided instalment amount (principal + interest). */
  amount: number;
  principal: number;
  interest: number;
  /** Effective amount already collected (0 for legacy paid EMIs). */
  paidAmount: number;
  status: "pending" | "partial" | "paid";
  /** Penalty already charged and still due on this EMI. */
  penalty: number;
  /** Balance of earlier EMIs carried into this one (carry-forward). */
  carriedInAmount?: number;
  carriedInPrincipal?: number;
  carriedInInterest?: number;
}

export interface AllocEmiResult {
  _id: string;
  paidAmount: number;
  status: "pending" | "partial" | "paid";
  /** Remaining penalty still due after this payment. */
  penalty: number;
  /** Amount applied toward principal+interest on this payment. */
  appliedBase: number;
  /** Penalty collected on this payment. */
  appliedPenalty: number;
}

export interface AllocationInput {
  emis: AllocEmi[];
  /** Cash physically received (drives collection totals). */
  cash: number;
  /** Concession / write-off granted. */
  discount: number;
  /** Existing loan credit balance. */
  advance: number;
  /** Newly chargeable penalty per EMI (0 when already charged / not overdue). */
  penaltyFor: (emi: AllocEmi) => number;
}

export interface AllocationResult {
  emis: AllocEmiResult[];
  principal: number;
  interest: number;
  penalty: number;
  discount: number;
  advanceUsed: number;
  advanceAdded: number;
  /** Net credit balance left on the loan after this payment. */
  newAdvance: number;
  /** Cash actually attributed to this payment (equals input cash, clamped >= 0). */
  amount: number;
}

/**
 * Payable this month: the decided instalment plus any balance carried into it
 * from earlier instalments.
 */
export const totalDueFor = (emi: AllocEmi): number =>
  emi.amount + Math.max(0, emi.carriedInAmount ?? 0);

const remainingFor = (emi: AllocEmi): number =>
  emi.status === "paid" ? 0 : Math.max(0, totalDueFor(emi) - emi.paidAmount);

export function allocatePayment(input: AllocationInput): AllocationResult {
  const cash = Math.max(0, Math.round(input.cash));
  const discountInput = Math.max(0, Math.round(input.discount));
  const advanceInput = Math.max(0, Math.round(input.advance));

  // Effective need per EMI (remaining principal+interest plus any penalty due).
  const needs = input.emis.map((emi) => {
    const remaining = remainingFor(emi);
    const already = Math.max(0, Math.round(emi.penalty));
    const newlyCharged = remaining > 0 && already === 0 ? Math.max(0, Math.round(input.penaltyFor(emi))) : 0;
    const penalty = Math.max(already, newlyCharged);
    return { emi, remaining, penalty, need: remaining + penalty };
  });

  const totalNeed = needs.reduce((n, r) => n + r.need, 0);

  const discount = Math.min(discountInput, totalNeed);
  const afterDiscount = totalNeed - discount;
  const advanceUsed = Math.min(advanceInput, afterDiscount);
  const afterAdvance = afterDiscount - advanceUsed;
  const cashUsed = Math.min(cash, afterAdvance);
  const advanceAdded = Math.max(0, cash - cashUsed);
  const newAdvance = advanceInput - advanceUsed + advanceAdded;

  // Pool of value applied to the EMIs, in guaranteed-payable order.
  let pool = discount + advanceUsed + cashUsed;

  let principal = 0;
  let interest = 0;
  let penalty = 0;
  const emis: AllocEmiResult[] = [];

  for (const row of needs) {
    const { emi, remaining, penalty: penaltyDue } = row;
    const baseApply = Math.min(remaining, pool);
    pool -= baseApply;
    const penaltyApply = Math.min(penaltyDue, pool);
    pool -= penaltyApply;

    const totalDue = totalDueFor(emi);
    const paidAmount = emi.status === "paid" ? totalDue : emi.paidAmount + baseApply;
    const status: AllocEmiResult["status"] =
      paidAmount >= totalDue ? "paid" : paidAmount > 0 ? "partial" : "pending";

    // Split the collected money across principal/interest using the full
    // payable mix (decided schedule + anything carried in from earlier EMIs).
    const basePrincipal = emi.principal + (emi.carriedInPrincipal ?? 0);
    const baseInterest = emi.interest + (emi.carriedInInterest ?? 0);
    const base = basePrincipal + baseInterest;
    const principalPortion = base > 0 ? Math.round(baseApply * (basePrincipal / base)) : 0;
    principal += principalPortion;
    interest += baseApply - principalPortion;
    penalty += penaltyApply;

    emis.push({
      _id: emi._id,
      paidAmount,
      status,
      penalty: Math.max(0, penaltyDue - penaltyApply),
      appliedBase: baseApply,
      appliedPenalty: penaltyApply,
    });
  }

  return {
    emis,
    principal,
    interest,
    penalty,
    discount,
    advanceUsed,
    advanceAdded,
    newAdvance,
    amount: cash,
  };
}

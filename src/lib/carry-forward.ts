/**
 * Carry-forward of an unpaid EMI balance into the next instalment.
 *
 * When a customer pays less than what is due this month, the operator can
 * settle that month anyway: the unpaid part is moved to the next instalment of
 * the same loan instead of being left hanging on the old EMI.
 *
 * The move keeps the books balanced:
 * - the settled (source) EMI keeps its *decided* amount, principal and
 *   interest — nothing is rewritten, only marked paid. The money that left it
 *   is recorded on `carriedForward` so the row still explains itself;
 * - the receiving (target) EMI also keeps its decided amount; the carried
 *   balance is added to its separate `carriedIn` bucket, so the payable for
 *   that month becomes `amount + carriedIn.amount`;
 * - any penalty still due on the source EMI travels with the balance, because
 *   it was already charged.
 *
 * Because both EMIs keep their schedule, the customer's total obligation never
 * changes — the balance only moves.
 */

export interface CarryEmi {
  _id: string;
  emiNo: number;
  /** Decided instalment amount (principal + interest). */
  amount: number;
  principal: number;
  interest: number;
  /** Amount already collected towards this EMI. */
  paidAmount: number;
  status: "pending" | "partial" | "paid";
  /** Penalty already charged and still due on this EMI. */
  penalty: number;
  /** Balance already carried into this EMI from earlier instalments. */
  carriedInAmount?: number;
  carriedInPrincipal?: number;
  carriedInInterest?: number;
  carriedInPenalty?: number;
}

export interface CarryForwardPlan {
  fromEmiId: string;
  fromEmiNo: number;
  toEmiId: string;
  toEmiNo: number;
  /** Instalment amount (principal + interest) moved to the next EMI. */
  baseCarried: number;
  /** Penalty moved along with the balance. */
  penaltyCarried: number;
  /** Total balance moved. */
  totalCarried: number;
  principalMoved: number;
  interestMoved: number;
  /**
   * The source EMI keeps its decided amount/principal/interest untouched; the
   * caller only has to mark it settled and record the move.
   */
  source: {
    status: "paid";
    penalty: 0;
    carriedForward: number;
  };
  /** New carry-in bucket for the receiving EMI (its own amount is unchanged). */
  target: {
    carriedInAmount: number;
    carriedInPrincipal: number;
    carriedInInterest: number;
    carriedInPenalty: number;
  };
}

const round = (n: number) => Math.round(n);

const carriedInOf = (emi: CarryEmi) => Math.max(0, emi.carriedInAmount ?? 0);
const carriedInPrincipalOf = (emi: CarryEmi) => Math.max(0, emi.carriedInPrincipal ?? 0);
const carriedInInterestOf = (emi: CarryEmi) => Math.max(0, emi.carriedInInterest ?? 0);
const carriedInPenaltyOf = (emi: CarryEmi) => Math.max(0, emi.carriedInPenalty ?? 0);

/** Full payable for this month: the decided EMI plus anything carried in. */
export function emiTotalDue(emi: CarryEmi): number {
  return emi.amount + carriedInOf(emi);
}

/**
 * Plans the carry-forward for a payment allocation.
 *
 * `touched` are the EMIs the payment was applied to (allocation runs oldest
 * first, so at most one of them can end up short). `allEmis` are every EMI of
 * the loan, used to find the instalment that receives the balance.
 *
 * Returns `null` when there is nothing to carry: the instalment was fully
 * covered, or the loan has no later unpaid EMI to move the balance into.
 */
export function planCarryForward(
  touched: CarryEmi[],
  allEmis: CarryEmi[]
): CarryForwardPlan | null {
  const source = touched
    .filter((emi) => emi.status !== "paid")
    .map((emi) => ({ emi, remaining: Math.max(0, emiTotalDue(emi) - emi.paidAmount) }))
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.emi.emiNo - a.emi.emiNo)[0];

  if (!source) return null;

  const target = allEmis
    .filter((emi) => emi.emiNo > source.emi.emiNo && emi.status !== "paid")
    .sort((a, b) => a.emiNo - b.emiNo)[0];

  if (!target) return null;

  const baseCarried = round(source.remaining);
  if (baseCarried <= 0) return null;

  // Split the moved balance in the same principal/interest mix as the source
  // EMI's full payable (its own schedule plus anything already carried in).
  const sourceBase = emiTotalDue(source.emi);
  const sourcePrincipal = source.emi.amount > 0 ? source.emi.principal + carriedInPrincipalOf(source.emi) : 0;
  const principalMoved = sourceBase > 0 ? round((baseCarried * sourcePrincipal) / sourceBase) : 0;
  const interestMoved = baseCarried - principalMoved;
  const penaltyCarried = round(Math.max(0, source.emi.penalty));

  return {
    fromEmiId: source.emi._id,
    fromEmiNo: source.emi.emiNo,
    toEmiId: target._id,
    toEmiNo: target.emiNo,
    baseCarried,
    penaltyCarried,
    totalCarried: baseCarried + penaltyCarried,
    principalMoved,
    interestMoved,
    source: {
      status: "paid",
      penalty: 0,
      carriedForward: baseCarried,
    },
    target: {
      carriedInAmount: carriedInOf(target) + baseCarried,
      carriedInPrincipal: carriedInPrincipalOf(target) + principalMoved,
      carriedInInterest: carriedInInterestOf(target) + interestMoved,
      carriedInPenalty: carriedInPenaltyOf(target) + penaltyCarried,
    },
  };
}

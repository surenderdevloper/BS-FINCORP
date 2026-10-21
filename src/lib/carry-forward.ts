/**
 * Carry-forward of an unpaid EMI balance into the next instalment.
 *
 * When a customer pays less than the EMI that is due, the operator can settle
 * that month anyway: the unpaid part is moved to the next instalment of the
 * same loan instead of being left hanging on the old EMI.
 *
 * The move keeps the books balanced:
 * - the source EMI is reduced to what was actually collected and marked paid,
 *   so the month no longer shows as overdue/partial;
 * - the same amount (principal + interest share) is added to the target EMI,
 *   so the customer's total obligation does not change;
 * - any penalty still due on the source EMI travels with the balance, because
 *   it was already charged.
 */

export interface CarryEmi {
  _id: string;
  emiNo: number;
  amount: number;
  principal: number;
  interest: number;
  paidAmount: number;
  status: "pending" | "partial" | "paid";
  /** Penalty already charged and still due on this EMI. */
  penalty: number;
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
  /** New values for the settled (source) EMI. */
  source: {
    amount: number;
    principal: number;
    interest: number;
    penalty: number;
    status: "paid";
  };
  /** New values for the receiving (target) EMI. */
  target: {
    amount: number;
    principal: number;
    interest: number;
    penalty: number;
  };
}

const round = (n: number) => Math.round(n);

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
    .map((emi) => ({ emi, remaining: Math.max(0, emi.amount - emi.paidAmount) }))
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.emi.emiNo - a.emi.emiNo)[0];

  if (!source) return null;

  const target = allEmis
    .filter((emi) => emi.emiNo > source.emi.emiNo && emi.status !== "paid")
    .sort((a, b) => a.emiNo - b.emiNo)[0];

  if (!target) return null;

  const baseCarried = round(source.remaining);
  if (baseCarried <= 0) return null;

  const principalMoved =
    source.emi.amount > 0 ? round((baseCarried * source.emi.principal) / source.emi.amount) : 0;
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
      amount: source.emi.paidAmount,
      principal: source.emi.principal - principalMoved,
      interest: source.emi.interest - interestMoved,
      penalty: 0,
      status: "paid",
    },
    target: {
      amount: target.amount + baseCarried,
      principal: target.principal + principalMoved,
      interest: target.interest + interestMoved,
      penalty: target.penalty + penaltyCarried,
    },
  };
}

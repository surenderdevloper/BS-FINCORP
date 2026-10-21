import { inr } from "@/lib/money";

/**
 * Renders one EMI's money the way the books actually work:
 *
 *   ₹2,817              <- the decided instalment (never rewritten)
 *   + ₹1,034 carried in <- balance moved in from earlier EMIs (if any)
 *   = ₹3,851            <- what must actually be collected this month
 *
 * Keeping the decided amount visible on top is what makes a carry-forward
 * readable at a glance instead of looking like the EMI itself got bigger.
 */
export function EmiAmount({
  amount,
  carriedIn = 0,
  totalDue,
  status,
  remaining = 0,
}: {
  amount: number;
  carriedIn?: number;
  totalDue?: number;
  status?: "pending" | "partial" | "paid";
  remaining?: number;
}) {
  const total = totalDue ?? amount + carriedIn;
  return (
    <div className="text-right leading-tight">
      <span className="block font-medium text-zinc-900">{inr(amount)}</span>
      {carriedIn > 0 && (
        <>
          <span className="block text-[10px] text-sky-700">+ {inr(carriedIn)} carried in</span>
          <span className="block text-[10px] font-semibold text-zinc-800">= {inr(total)}</span>
        </>
      )}
      {status === "partial" && (
        <span className="block text-[10px] text-amber-600">{inr(remaining)} pending</span>
      )}
    </div>
  );
}

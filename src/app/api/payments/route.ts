import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { nextReceiptNumber } from "@/models/CompanySetting";
import { computePenaltyForEmi, getPenaltyRuleObj } from "@/models/PenaltyRule";
import { withTenant } from "@/lib/tenant-route";
import { parseCalendarDate } from "@/lib/dates";
import { invalidateCustomersListCache } from "@/lib/customers";
import { allocatePayment, type AllocEmi } from "@/lib/payment-allocation";

interface Payload {
  loanNo: string;
  emiIds: string[];
  mode: "cash" | "online";
  receivedBy?: string;
  notes?: string;
  discount?: number;
  /** Actual cash received. When omitted, the full remaining due (after discount
   *  and any advance credit) is assumed. */
  amount?: number;
  /** Calendar date (YYYY-MM-DD) on which this payment is being made. Used as the authoritative penalty date. */
  paymentDate?: string;
}

export async function POST(req: Request) {
  return withTenant(async (session) => {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const loanNo = body.loanNo?.trim();
  if (!loanNo) return NextResponse.json({ error: "Loan number is required." }, { status: 400 });
  if (!body.emiIds || !Array.isArray(body.emiIds) || body.emiIds.length === 0) {
    return NextResponse.json({ error: "Select at least one EMI to collect." }, { status: 400 });
  }

  await dbConnect();

  const loan = await Loan.findOne({ loanNo });
  if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  if (loan.status !== "active") {
    return NextResponse.json({ error: "This loan is already closed. No payments can be collected on it." }, { status: 409 });
  }

  const customer = await Customer.findById(loan.customerId).lean();
  const today = new Date();

  // Authoritative penalty date: the validated calendar date the operator selected.
  // Falls back to the server's current UTC calendar date when the client omits it.
  const paymentDate = body.paymentDate ? parseCalendarDate(body.paymentDate) : null;
  if (body.paymentDate != null && !paymentDate) {
    return NextResponse.json({ error: "Invalid paymentDate. Use YYYY-MM-DD." }, { status: 400 });
  }
  const penaltyDate = paymentDate ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const emis = await Emi.find({
    _id: { $in: body.emiIds },
    loanId: loan._id,
    status: { $ne: "paid" },
  })
    .sort({ emiNo: 1 })
    .lean();

  if (!emis.length) {
    return NextResponse.json({ error: "None of the selected EMIs are outstanding on this loan." }, { status: 409 });
  }

  const rule = await getPenaltyRuleObj();
  const penaltyCache = new Map<string, number>();

  const allocEmis: AllocEmi[] = emis.map((emi) => ({
    _id: emi._id.toString(),
    amount: emi.amount,
    principal: emi.principal,
    interest: emi.interest,
    paidAmount: Math.max(0, emi.paidAmount ?? 0),
    status: emi.status,
    penalty: Math.max(0, emi.penalty ?? 0),
  }));

  const discountInput = typeof body.discount === "number" && Number.isFinite(body.discount) ? Math.max(0, Math.round(body.discount)) : 0;

  // Compute + cache penalties up-front (async) so the pure allocator stays sync.
  for (const e of allocEmis) {
    if (e.status === "paid" || e.amount - e.paidAmount <= 0) continue;
    if (e.penalty > 0) continue;
    const emi = emis.find((x) => x._id.toString() === e._id);
    if (!emi) continue;
    if (new Date(emi.dueDate) < penaltyDate) {
      const { penalty } = await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, penaltyDate, rule);
      penaltyCache.set(e._id, penalty);
    }
  }

  // When the client omits the exact cash received, assume the customer paid the
  // full remaining due after discount and any existing advance credit.
  const totalNeed = allocEmis.reduce(
    (n, e) => n + Math.max(0, e.amount - e.paidAmount) + Math.max(e.penalty, penaltyCache.get(e._id) ?? 0),
    0
  );
  const advance = Math.max(0, loan.advance ?? 0);
  const cash =
    typeof body.amount === "number" && Number.isFinite(body.amount)
      ? Math.max(0, Math.round(body.amount))
      : Math.max(0, totalNeed - discountInput - advance);

  const finalAlloc = allocatePayment({
    emis: allocEmis,
    cash,
    discount: discountInput,
    advance,
    penaltyFor: (e) => penaltyCache.get(e._id) ?? 0,
  });

  const touched = finalAlloc.emis.some((e) => e.appliedBase > 0 || e.appliedPenalty > 0);
  if (!touched) {
    return NextResponse.json(
      { error: "Nothing to collect. Enter an amount received or a discount." },
      { status: 400 }
    );
  }

  // Allocate receipt number (atomic increment — a genuine write only here).
  const receiptNo = await nextReceiptNumber();

  const payment = await Payment.create({
    receiptNo,
    loanId: loan._id,
    loanNo: loan.loanNo,
    customerId: loan.customerId,
    customerName: customer?.name ?? "",
    emiIds: finalAlloc.emis.filter((e) => e.appliedBase > 0 || e.appliedPenalty > 0).map((e) => e._id),
    amount: finalAlloc.amount,
    principal: finalAlloc.principal,
    interest: finalAlloc.interest,
    penalty: finalAlloc.penalty,
    discount: finalAlloc.discount,
    advanceUsed: finalAlloc.advanceUsed,
    advanceAdded: finalAlloc.advanceAdded,
    mode: body.mode === "online" ? "online" : "cash",
    receivedBy: body.receivedBy?.trim() ?? session.name,
    notes: body.notes?.trim() ?? "",
  });

  await Promise.all(
    finalAlloc.emis
      .filter((e) => e.appliedBase > 0 || e.appliedPenalty > 0 || e.status === "paid")
      .map((e) =>
        Emi.updateOne(
          { _id: e._id },
          {
            $set: {
              paidAmount: e.paidAmount,
              status: e.status,
              penalty: e.penalty,
              ...(e.status === "paid" ? { paidOn: today } : {}),
              paymentId: payment._id,
            },
          }
        )
      )
  );

  loan.advance = finalAlloc.newAdvance;
  await loan.save();

  invalidateCustomersListCache();

  const emiTotal = finalAlloc.principal + finalAlloc.interest;

  return NextResponse.json(
    {
      payment: {
        receiptNo,
        loanNo: loan.loanNo,
        customerName: customer?.name ?? "",
        amount: finalAlloc.amount,
        emiTotal,
        penalty: finalAlloc.penalty,
        discount: finalAlloc.discount,
        advanceUsed: finalAlloc.advanceUsed,
        advanceAdded: finalAlloc.advanceAdded,
        paidCount: finalAlloc.emis.filter((e) => e.appliedBase > 0 || e.appliedPenalty > 0).length,
        mode: payment.mode,
        paidAt: payment.createdAt?.toISOString(),
      },
    },
    { status: 201 }
  );
  });
}

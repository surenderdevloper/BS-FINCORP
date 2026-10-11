import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { nextReceiptNumber } from "@/models/CompanySetting";
import { computePenaltyForEmi, getPenaltyRuleObj } from "@/models/PenaltyRule";
import { readSession } from "@/lib/auth";
import { startOfToday } from "@/lib/dates";
import { invalidateCustomersListCache } from "@/lib/customers";
import { allocatePayment, type AllocEmi } from "@/lib/payment-allocation";

type RouteContext = { params: Promise<{ id: string }> };

interface Payload {
  mode?: "cash" | "online";
  receivedBy?: string;
  notes?: string;
  /** Concession granted on settlement. */
  discount?: number;
  /** Actual cash received. Defaults to the full outstanding after discount + advance. */
  amount?: number;
}

export async function POST(req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: Payload = {};
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();

  const loan = await Loan.findById(id);
  if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  if (loan.status !== "active") {
    return NextResponse.json({ error: "This loan is already closed." }, { status: 409 });
  }

  const customer = await Customer.findById(loan.customerId).lean();
  const today = new Date();
  const todayStart = startOfToday(today);

  const pendingEmis = await Emi.find({ loanId: loan._id, status: { $ne: "paid" } })
    .sort({ emiNo: 1 })
    .lean();
  if (!pendingEmis.length) {
    return NextResponse.json({ error: "This loan has no outstanding EMIs to close." }, { status: 409 });
  }

  const rule = await getPenaltyRuleObj();

  const allocEmis: AllocEmi[] = pendingEmis.map((emi) => ({
    _id: emi._id.toString(),
    amount: emi.amount,
    principal: emi.principal,
    interest: emi.interest,
    paidAmount: Math.max(0, emi.paidAmount ?? 0),
    status: emi.status,
    penalty: Math.max(0, emi.penalty ?? 0),
  }));

  const penaltyCache = new Map<string, number>();
  for (let i = 0; i < allocEmis.length; i++) {
    const e = allocEmis[i];
    const emi = pendingEmis[i];
    if (e.status === "paid" || e.amount - e.paidAmount <= 0) continue;
    if (e.penalty > 0) continue;
    if (new Date(emi.dueDate) < todayStart) {
      const { penalty } = await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, today, rule);
      penaltyCache.set(e._id, penalty);
    }
  }

  const totalNeed = allocEmis.reduce(
    (n, e) => n + Math.max(0, e.amount - e.paidAmount) + Math.max(e.penalty, penaltyCache.get(e._id) ?? 0),
    0
  );
  const discountInput = typeof body.discount === "number" && Number.isFinite(body.discount) ? Math.max(0, Math.round(body.discount)) : 0;
  const advance = Math.max(0, loan.advance ?? 0);
  const cash =
    typeof body.amount === "number" && Number.isFinite(body.amount)
      ? Math.max(0, Math.round(body.amount))
      : Math.max(0, totalNeed - discountInput - advance);

  const allocation = allocatePayment({
    emis: allocEmis,
    cash,
    discount: discountInput,
    advance,
    penaltyFor: (e) => penaltyCache.get(e._id) ?? 0,
  });

  const fullySettled = allocation.emis.every((e) => e.status === "paid");
  if (!fullySettled) {
    return NextResponse.json(
      { error: "The settlement does not cover the full outstanding balance. Increase the amount or discount." },
      { status: 400 }
    );
  }

  const receiptNo = await nextReceiptNumber();

  const payment = await Payment.create({
    receiptNo,
    loanId: loan._id,
    loanNo: loan.loanNo,
    customerId: loan.customerId,
    customerName: customer?.name ?? "",
    emiIds: allocation.emis.map((e) => e._id),
    amount: allocation.amount,
    principal: allocation.principal,
    interest: allocation.interest,
    penalty: allocation.penalty,
    discount: allocation.discount,
    advanceUsed: allocation.advanceUsed,
    advanceAdded: allocation.advanceAdded,
    mode: body.mode === "online" ? "online" : "cash",
    receivedBy: body.receivedBy?.trim() ?? session.name,
    notes: (body.notes?.trim() ?? "") || "Loan closed",
  });

  await Promise.all(
    allocation.emis.map((e) =>
      Emi.updateOne(
        { _id: e._id },
        { $set: { paidAmount: e.paidAmount, status: e.status, penalty: e.penalty, paidOn: today, paymentId: payment._id } }
      )
    )
  );

  loan.advance = allocation.newAdvance;
  loan.status = "closed";
  loan.closedAt = today;
  await loan.save();

  invalidateCustomersListCache();

  return NextResponse.json({
    loanNo: loan.loanNo,
    closedAt: loan.closedAt.toISOString(),
    settledAmount: allocation.amount,
    penalty: allocation.penalty,
    discount: allocation.discount,
    advanceUsed: allocation.advanceUsed,
    receiptNo,
  });
}

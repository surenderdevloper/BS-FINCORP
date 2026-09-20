import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { getCompanySetting } from "@/models/CompanySetting";
import { computePenaltyForEmi, getPenaltyRuleObj } from "@/models/PenaltyRule";
import { readSession } from "@/lib/auth";
import { startOfToday } from "@/lib/dates";

type RouteContext = { params: Promise<{ id: string }> };

interface Payload {
  mode?: "cash" | "online";
  receivedBy?: string;
  notes?: string;
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

  const pendingEmis = await Emi.find({ loanId: loan._id, status: "pending" }).lean();
  if (!pendingEmis.length) {
    return NextResponse.json({ error: "This loan has no outstanding EMIs to close." }, { status: 409 });
  }

  const rule = await getPenaltyRuleObj();
  const todayStart = startOfToday(today);

  let principal = 0;
  let interest = 0;
  let penalty = 0;
  for (const emi of pendingEmis) {
    principal += emi.principal;
    interest += emi.interest;
    if (new Date(emi.dueDate) < todayStart) {
      penalty += (await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, today, rule)).penalty;
    }
  }
  const emiTotal = principal + interest;
  const amount = emiTotal + penalty;

  const setting = await getCompanySetting();
  const seq = setting.nextReceiptNo;
  setting.nextReceiptNo = (setting.nextReceiptNo ?? 0) + 1;
  await setting.save();
  const receiptNo = `${setting.receiptPrefix}-${String(seq).padStart(4, "0")}`;

  const payment = await Payment.create({
    receiptNo,
    loanId: loan._id,
    loanNo: loan.loanNo,
    customerId: loan.customerId,
    customerName: customer?.name ?? "",
    emiIds: pendingEmis.map((e) => e._id),
    amount,
    principal,
    interest,
    penalty,
    mode: body.mode === "online" ? "online" : "cash",
    receivedBy: body.receivedBy?.trim() ?? session.name,
    notes: (body.notes?.trim() ?? "") || "Loan closed",
  });

  await Emi.updateMany(
    { _id: { $in: pendingEmis.map((e) => e._id) } },
    { $set: { status: "paid", paidOn: today, paymentId: payment._id } }
  );

  loan.status = "closed";
  loan.closedAt = today;
  await loan.save();

  return NextResponse.json({
    loanNo: loan.loanNo,
    closedAt: loan.closedAt.toISOString(),
    settledAmount: amount,
    penalty,
    receiptNo,
  });
}
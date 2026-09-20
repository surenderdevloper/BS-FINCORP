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

interface Payload {
  loanNo: string;
  emiIds: string[];
  mode: "cash" | "online";
  receivedBy?: string;
  notes?: string;
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const loan = await Loan.findOne({ loanNo }).lean();
  if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  if (loan.status !== "active") {
    return NextResponse.json({ error: "This loan is already closed. No payments can be collected on it." }, { status: 409 });
  }

  const customer = await Customer.findById(loan.customerId).lean();
  const today = new Date();

  const emis = await Emi.find({
    _id: { $in: body.emiIds },
    loanId: loan._id,
    status: "pending",
  }).lean();

  if (!emis.length) {
    return NextResponse.json({ error: "None of the selected EMIs are outstanding on this loan." }, { status: 409 });
  }

  let principal = 0;
  let interest = 0;
  let emiTotal = 0;
  let penalty = 0;
  const rule = await getPenaltyRuleObj();
  const todayStart = startOfToday(today);

  const emiRows: Array<{ emi: (typeof emis)[number]; penalty: number }> = [];
  for (const emi of emis) {
    let emiPenalty = 0;
    if (new Date(emi.dueDate) < todayStart) {
      emiPenalty = (await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, today, rule)).penalty;
    }
    principal += emi.principal;
    interest += emi.interest;
    emiTotal += emi.amount;
    penalty += emiPenalty;
    emiRows.push({ emi, penalty: emiPenalty });
  }

  const amount = emiTotal + penalty;

  // Allocate receipt number.
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
    emiIds: emiRows.map((r) => r.emi._id),
    amount,
    principal,
    interest,
    penalty,
    mode: body.mode === "online" ? "online" : "cash",
    receivedBy: body.receivedBy?.trim() ?? session.name,
    notes: body.notes?.trim() ?? "",
  });

  await Promise.all(
    emiRows.map((r) =>
      Emi.updateOne(
        { _id: r.emi._id },
        { $set: { status: "paid", paidOn: today, penalty: r.penalty, paymentId: payment._id } }
      )
    )
  );

  return NextResponse.json(
    {
      payment: {
        receiptNo,
        loanNo: loan.loanNo,
        customerName: customer?.name ?? "",
        amount,
        penalty,
        paidCount: emiRows.length,
        mode: payment.mode,
        paidAt: payment.createdAt?.toISOString(),
      },
    },
    { status: 201 }
  );
}
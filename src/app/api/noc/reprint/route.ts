import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Loan } from "@/models/Loan";
import { Customer } from "@/models/Customer";
import { Payment } from "@/models/Payment";
import { nextReceiptNumber } from "@/models/CompanySetting";
import { readSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { loanNo?: string; charge?: number; mode?: string; notes?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const loanNo = body.loanNo?.trim();
  if (!loanNo) return NextResponse.json({ error: "Loan number is required." }, { status: 400 });

  const charge = Math.round(Number(body.charge) || 0);
  if (charge <= 0) {
    return NextResponse.json({ error: "Reprint charge must be greater than zero." }, { status: 400 });
  }
  const mode = body.mode === "online" ? "online" : "cash";
  const notes = body.notes?.trim() ?? "";

  await dbConnect();

  const loan = await Loan.findOne({ loanNo }).lean();
  if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  if (loan.status !== "closed") {
    return NextResponse.json({ error: "Reprint charge can only be recorded for closed loans." }, { status: 409 });
  }

  const customer = await Customer.findById(loan.customerId).lean();
  const receiptNo = await nextReceiptNumber();

  const payment = await Payment.create({
    receiptNo,
    loanId: loan._id,
    loanNo: loan.loanNo,
    customerId: loan.customerId,
    customerName: customer?.name ?? "",
    emiIds: [],
    amount: charge,
    principal: 0,
    interest: 0,
    penalty: 0,
    mode,
    receivedBy: session.name,
    notes: notes || "NOC Reprint",
    type: "NOC_REPRINT",
  });

  return NextResponse.json(
    {
      receipt: {
        receiptNo,
        loanNo: loan.loanNo,
        customerName: customer?.name ?? "",
        amount: charge,
        mode: payment.mode,
        paidAt: payment.createdAt?.toISOString(),
      },
    },
    { status: 201 }
  );
}
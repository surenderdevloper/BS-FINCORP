import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Loan } from "@/models/Loan";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { readSession } from "@/lib/auth";

type ReportRow = Record<string, string | number>;

interface RawLoanLean {
  _id: Types.ObjectId;
  loanNo: string;
  status: string;
  customerId: Types.ObjectId;
  financial: { loanAmount: number; startDate: Date; tenureMonths: number };
  vehicle: { name: string };
  paymentPlan: { monthlyEmi: number };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "loans-active";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const start = new Date(from ? `${from}T00:00:00Z` : "1970-01-01T00:00:00Z");
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();

  await dbConnect();

  if (type === "collections") {
    const payments = await Payment.find({ createdAt: { $gte: start, $lte: end } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    let totalAmount = 0;
    let totalPenalty = 0;
    const rows: ReportRow[] = payments.map((p) => {
      totalAmount += p.amount;
      totalPenalty += p.penalty ?? 0;
      return {
        "Receipt No": p.receiptNo,
        "Date": p.createdAt!.toISOString().slice(0, 10),
        "Loan No": p.loanNo,
        "Customer": p.customerName,
        "Amount": p.amount,
        "Principal": p.principal ?? 0,
        "Interest": p.interest ?? 0,
        "Penalty": p.penalty ?? 0,
        "Mode": p.mode === "online" ? "Online" : "Cash",
      };
    });
    return NextResponse.json({
      title: type,
      columns: ["Receipt No", "Date", "Loan No", "Customer", "Amount", "Principal", "Interest", "Penalty", "Mode"],
      rows,
      summary: { count: payments.length, totalAmount, totalPenalty },
    });
  }

  // Loan reports: status is enforced by `type`, financial.startDate / closedAt by range.
  const isClosed = type === "loans-closed";
  const dateField = isClosed ? "closedAt" : "financial.startDate";
  const loans = (await Loan.find({
    status: isClosed ? "closed" : "active",
    [dateField]: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as RawLoanLean[];

  const customerIds = [...new Set(loans.map((l) => l.customerId.toString()))];
  const customers = await Customer.find({ _id: { $in: customerIds } }).select("name mobile").lean().exec();
  const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));

  let totalAmount = 0;
  const rows: ReportRow[] = loans.map((l) => {
    totalAmount += l.financial.loanAmount;
    const c = customerMap.get(l.customerId.toString());
    return {
      "Loan No": l.loanNo,
      "Customer": c?.name ?? "",
      "Mobile": c?.mobile ?? "",
      "Vehicle": l.vehicle.name,
      "Loan Date": l.financial.startDate.toISOString().slice(0, 10),
      "Loan Amount": l.financial.loanAmount,
      "Monthly EMI": l.paymentPlan.monthlyEmi,
      "Tenure (months)": l.financial.tenureMonths,
      "Status": l.status,
    };
  });

  return NextResponse.json({
    title: type,
    columns: ["Loan No", "Customer", "Mobile", "Vehicle", "Loan Date", "Loan Amount", "Monthly EMI", "Tenure (months)", "Status"],
    rows,
    summary: { count: loans.length, totalAmount },
  });
}
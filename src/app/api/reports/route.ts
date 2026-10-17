import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Loan } from "@/models/Loan";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { withTenant } from "@/lib/tenant-route";
import { endOfISTDay, isoDateIST, startOfISTDay } from "@/lib/dates";

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
  return withTenant(async () => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "loans-active";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // From/To are plain calendar dates picked by the user; the range must be
  // interpreted as IST days (00:00:00–23:59:59 IST) so a payment made just
  // after midnight IST still counts on the correct business day.
  const start = from ? startOfISTDay(from) : new Date("1970-01-01T00:00:00Z");
  const end = to ? endOfISTDay(to) : new Date();

  await dbConnect();

  if (type === "collections") {
    const payments = await Payment.find({ type: { $ne: "NOC_REPRINT" }, createdAt: { $gte: start, $lte: end } })
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
        "Date": p.createdAt ? isoDateIST(p.createdAt) : "",
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

  // Active loans are a current snapshot, so the From/To range does not apply —
  // every active loan is listed. Closed loans are filtered by the closing date.
  const isClosed = type === "loans-closed";
  const query: Record<string, unknown> = { status: isClosed ? "closed" : "active" };
  if (isClosed) query.closedAt = { $gte: start, $lte: end };
  const loans = (await Loan.find(query)
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
      "Loan Date": isoDateIST(l.financial.startDate),
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
  });
}
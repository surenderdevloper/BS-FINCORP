import type { Types } from "mongoose";
import { Loan } from "@/models/Loan";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { endOfISTDay, isoDateIST, startOfISTDay } from "@/lib/dates";

export type ReportType = "loans-active" | "loans-closed" | "collections";

export interface ReportData {
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
  summary: { count: number; totalAmount: number; totalPenalty?: number };
}

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

/**
 * Build a report payload for the active tenant. The tenant scope must already
 * be bound (runForSession / withTenant) — every query here is tenant-scoped by
 * the model plugin.
 */
export async function buildReport(input: {
  type: ReportType;
  from?: string | null;
  to?: string | null;
}): Promise<ReportData> {
  const { type, from, to } = input;

  // From/To are plain calendar dates picked by the user; the range must be
  // interpreted as IST days (00:00:00–23:59:59 IST) so a payment made just
  // after midnight IST still counts on the correct business day.
  const start = from ? startOfISTDay(from) : new Date("1970-01-01T00:00:00Z");
  const end = to ? endOfISTDay(to) : new Date();

  if (type === "collections") {
    const payments = await Payment.find({ type: { $ne: "NOC_REPRINT" }, createdAt: { $gte: start, $lte: end } })
      .select("receiptNo createdAt loanNo customerName amount principal interest penalty mode")
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
    return {
      title: type,
      columns: ["Receipt No", "Date", "Loan No", "Customer", "Amount", "Principal", "Interest", "Penalty", "Mode"],
      rows,
      summary: { count: payments.length, totalAmount, totalPenalty },
    };
  }

  // Active and closed loan reports are both current snapshots — the From/To
  // range only applies to the Collections report, so every matching loan is
  // listed regardless of date.
  const isClosed = type === "loans-closed";
  const query: Record<string, unknown> = { status: isClosed ? "closed" : "active" };
  const loans = (await Loan.find(query)
    .select(
      "loanNo status customerId financial.loanAmount financial.startDate financial.tenureMonths vehicle.name paymentPlan.monthlyEmi"
    )
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

  return {
    title: type,
    columns: ["Loan No", "Customer", "Mobile", "Vehicle", "Loan Date", "Loan Amount", "Monthly EMI", "Tenure (months)", "Status"],
    rows,
    summary: { count: loans.length, totalAmount },
  };
}

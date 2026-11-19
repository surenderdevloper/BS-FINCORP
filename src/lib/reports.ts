import type { Types } from "mongoose";
import { Loan } from "@/models/Loan";
import { Payment } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { Emi } from "@/models/Emi";
import { computePenaltyForEmi, getPenaltyRuleObj } from "@/models/PenaltyRule";
import { endOfISTDay, isoDateIST, startOfISTDay } from "@/lib/dates";
import { formatEmiNumbers } from "@/lib/emi-names";

export type ReportType = "loans-active" | "loans-closed" | "collections" | "penalties";

export interface ReportData {
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
  summary: {
    count: number;
    totalAmount: number;
    totalPenalty?: number;
    pendingPenalty?: number;
    collectedPenalty?: number;
  };
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
      .select("receiptNo createdAt loanNo customerName amount principal interest penalty mode emiNumbers")
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
        "EMI No": p.emiNumbers && p.emiNumbers.length > 0 ? formatEmiNumbers(p.emiNumbers) : "—",
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
      columns: ["Receipt No", "EMI No", "Date", "Loan No", "Customer", "Amount", "Principal", "Interest", "Penalty", "Mode"],
      rows,
      summary: { count: payments.length, totalAmount, totalPenalty },
    };
  }

  if (type === "penalties") {
    // 1. Fetch loans to resolve customer, vehicle, and loan details
    const allLoans = (await Loan.find({})
      .select("loanNo status customerId vehicle.name paymentPlan.monthlyEmi")
      .lean()
      .exec()) as unknown as Array<{
        _id: Types.ObjectId;
        loanNo: string;
        status: string;
        customerId: Types.ObjectId;
        vehicle: { name: string };
        paymentPlan: { monthlyEmi: number };
      }>;

    const loanMapById = new Map(allLoans.map((l) => [l._id.toString(), l]));
    const loanMapByNo = new Map(allLoans.map((l) => [l.loanNo, l]));

    // Customer details lookup
    const customerIds = [...new Set(allLoans.map((l) => l.customerId?.toString()).filter(Boolean))];
    const customers = await Customer.find({ _id: { $in: customerIds } })
      .select("name mobile")
      .lean()
      .exec();
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));

    const now = new Date();
    const penaltyRule = await getPenaltyRuleObj();

    // 2. Overdue EMIs with unpaid penalties
    const activeLoanIds = allLoans.filter((l) => l.status !== "closed").map((l) => l._id);
    const overdueEmis = await Emi.find({
      loanId: { $in: activeLoanIds },
      status: { $ne: "paid" },
      dueDate: { $lt: now },
    })
      .select("loanId loanNo emiNo dueDate amount paidAmount penalty carriedIn")
      .sort({ dueDate: -1 })
      .lean()
      .exec();

    // 3. Payments where penalty was collected
    const paymentQuery: Record<string, unknown> = {
      type: { $ne: "NOC_REPRINT" },
      penalty: { $gt: 0 },
    };
    if (from || to) {
      paymentQuery.createdAt = { $gte: start, $lte: end };
    }
    const penaltyPayments = await Payment.find(paymentQuery)
      .select("receiptNo createdAt loanNo customerName amount penalty emiNumbers")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const rows: ReportRow[] = [];
    let totalPenalty = 0;
    let pendingPenalty = 0;
    let collectedPenalty = 0;
    let totalAmount = 0;

    // Process Overdue / Due Penalties
    for (const emi of overdueEmis) {
      const loan = loanMapById.get(emi.loanId.toString());
      if (!loan) continue;
      const customer = customerMap.get(loan.customerId?.toString() ?? "");
      const effectiveAmount = Math.max(0, emi.amount + (emi.carriedIn?.amount ?? 0) - (emi.paidAmount ?? 0));

      const late = await computePenaltyForEmi(
        emi.dueDate.toISOString(),
        effectiveAmount,
        now,
        penaltyRule
      );
      const charge = (emi.penalty ?? 0) > 0 ? (emi.penalty ?? 0) : late.penalty;

      if (charge > 0 || late.daysLate > (penaltyRule?.graceDays ?? 3)) {
        totalPenalty += charge;
        pendingPenalty += charge;
        totalAmount += effectiveAmount;
        rows.push({
          "Status": "Pending (Due)",
          "Loan No": loan.loanNo,
          "Customer": customer?.name ?? "—",
          "Mobile": customer?.mobile ?? "—",
          "Vehicle": loan.vehicle?.name ?? "—",
          "EMI No": formatEmiNumbers([emi.emiNo]),
          "Date": isoDateIST(emi.dueDate),
          "Days Late": late.daysLate,
          "Amount": effectiveAmount,
          "Penalty": charge,
          "Reference": "Overdue EMI",
        });
      }
    }

    // Process Collected Penalties
    for (const p of penaltyPayments) {
      const loan = loanMapByNo.get(p.loanNo);
      const customer = loan ? customerMap.get(loan.customerId?.toString() ?? "") : null;
      const charge = p.penalty ?? 0;
      totalPenalty += charge;
      collectedPenalty += charge;
      totalAmount += p.amount;
      rows.push({
        "Status": "Collected (Paid)",
        "Loan No": p.loanNo,
        "Customer": p.customerName || customer?.name || "—",
        "Mobile": customer?.mobile ?? "—",
        "Vehicle": loan?.vehicle?.name ?? "—",
        "EMI No": p.emiNumbers && p.emiNumbers.length > 0 ? formatEmiNumbers(p.emiNumbers) : "—",
        "Date": p.createdAt ? isoDateIST(p.createdAt) : "",
        "Days Late": "—",
        "Amount": p.amount,
        "Penalty": charge,
        "Reference": p.receiptNo,
      });
    }

    return {
      title: type,
      columns: [
        "Status",
        "Loan No",
        "Customer",
        "Mobile",
        "Vehicle",
        "EMI No",
        "Date",
        "Days Late",
        "Amount",
        "Penalty",
        "Reference",
      ],
      rows,
      summary: {
        count: rows.length,
        totalAmount,
        totalPenalty,
        pendingPenalty,
        collectedPenalty,
      },
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

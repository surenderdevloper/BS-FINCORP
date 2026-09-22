import type { Types } from "mongoose";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Customer } from "@/models/Customer";
import { computePenaltyForEmi } from "@/models/PenaltyRule";
import { startOfToday } from "@/lib/dates";

export interface EmiRow {
  _id: string;
  loanId: string;
  loanNo: string;
  emiNo: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  status: "pending" | "paid";
  paidOn?: string;
  penalty: number;
}

export interface LoanDetail {
  _id: string;
  loanNo: string;
  status: string;
  startDate: string;
  firstDueDate?: string | null;
  closedAt?: string | null;
  createdAt?: string;
  customer: {
    _id: string;
    name: string;
    fatherName?: string;
    mobile: string;
    altMobile?: string;
    aadhaar?: string;
    pan?: string;
    dob?: string;
    address?: string;
    city?: string;
    state?: string;
  };
  vehicle: {
    name: string;
    model?: string;
    engineNo?: string;
    chassisNo?: string;
    regNo?: string;
    loanType?: string;
    dealerName?: string;
  };
  financial: {
    vehiclePrice: number;
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    interestType: string;
    tenureMonths: number;
    emiDay: number;
  };
  paymentPlan: {
    monthlyEmi: number;
    totalPayable: number;
    totalInterest: number;
  };
  guarantor?: {
    name?: string;
    mobile?: string;
    relation?: string;
    address?: string;
  };
  emis: EmiRow[];
  totals: {
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    paidAmount: number;
    pendingAmount: number;
    totalPenalty: number;
    outstandingAmount: number;
  };
}

export interface LoanSummary {
  _id: string;
  loanNo: string;
  status: string;
  startDate?: string;
  closedAt?: string | null;
  createdAt?: string;
  customer: { _id: string; name: string; mobile: string; aadhaar: string };
  vehicle: string;
  loanAmount: number;
  monthlyEmi: number;
  totalPayable: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  outstandingAmount: number;
  overduePenalty: number;
}

export interface RawEmi {
  _id: Types.ObjectId;
  loanId: Types.ObjectId;
  loanNo: string;
  emiNo: number;
  dueDate: Date;
  amount: number;
  principal: number;
  interest: number;
  status: "pending" | "paid";
  paidOn?: Date;
}

interface RawLoan {
  _id: Types.ObjectId;
  loanNo: string;
  status: string;
  customerId: Types.ObjectId;
  closedAt?: Date | null;
  createdAt?: Date;
  financial: {
    vehiclePrice: number;
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    interestType: string;
    tenureMonths: number;
    emiDay: number;
    startDate: Date;
    firstDueDate?: Date;
  };
  vehicle: {
    name: string;
    model?: string;
    engineNo?: string;
    chassisNo?: string;
    regNo?: string;
    loanType?: string;
    dealerName?: string;
  };
  paymentPlan: { monthlyEmi: number; totalPayable: number; totalInterest: number };
  guarantor?: { name?: string; mobile?: string; relation?: string; address?: string };
}

export async function buildEmiRows(rawEmis: RawEmi[], today = new Date()): Promise<{ emis: EmiRow[]; totals: LoanDetail["totals"] }> {
  const todayStart = startOfToday(today);
  const emis: EmiRow[] = [];
  const totals: LoanDetail["totals"] = {
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    totalPenalty: 0,
    outstandingAmount: 0,
  };

  for (const emi of rawEmis) {
    let penalty = 0;
    if (emi.status === "pending" && emi.dueDate < todayStart) {
      penalty = (await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, today)).penalty;
    }
    emis.push({
      _id: emi._id.toString(),
      loanId: emi.loanId.toString(),
      loanNo: emi.loanNo,
      emiNo: emi.emiNo,
      dueDate: emi.dueDate.toISOString(),
      amount: emi.amount,
      principal: emi.principal,
      interest: emi.interest,
      status: emi.status,
      paidOn: emi.paidOn?.toISOString(),
      penalty,
    });
    if (emi.status === "paid") {
      totals.paidCount++;
      totals.paidAmount += emi.amount;
    } else {
      totals.pendingCount++;
      totals.pendingAmount += emi.amount;
      if (emi.dueDate < todayStart) totals.overdueCount++;
      totals.totalPenalty += penalty;
    }
  }
  totals.outstandingAmount = totals.pendingAmount + totals.totalPenalty;
  return { emis, totals };
}

export async function getLoanEmis(loanId: string | Types.ObjectId, today = new Date()): Promise<{ emis: EmiRow[]; totals: LoanDetail["totals"] }> {
  const rawEmis = (await Emi.find({ loanId }).sort({ emiNo: 1 }).lean().exec()) as unknown as RawEmi[];
  return buildEmiRows(rawEmis, today);
}

export async function getLoanDetail(loanNo: string, today = new Date()): Promise<LoanDetail | null> {
  const loan = (await Loan.findOne({ loanNo }).lean().exec()) as unknown as RawLoan | null;
  if (!loan) return null;

  const customerRaw = await Customer.findById(loan.customerId).lean().exec();
  const customer = customerRaw as unknown as {
    _id: Types.ObjectId;
    name: string;
    fatherName?: string;
    mobile: string;
    aadhaar?: string;
    pan?: string;
    dob?: Date;
    address?: string;
    altMobile?: string;
    city?: string;
    state?: string;
  } | null;

  const { emis, totals } = await getLoanEmis(loan._id, today);

  return {
    _id: loan._id.toString(),
    loanNo: loan.loanNo,
    status: loan.status,
    startDate: loan.financial.startDate.toISOString(),
    firstDueDate: loan.financial.firstDueDate?.toISOString() ?? null,
    closedAt: loan.closedAt?.toISOString() ?? null,
    createdAt: loan.createdAt?.toISOString(),
    customer: {
      _id: loan.customerId.toString(),
      name: customer?.name ?? "",
      fatherName: customer?.fatherName ?? "",
      mobile: customer?.mobile ?? "",
      altMobile: customer?.altMobile ?? "",
      aadhaar: customer?.aadhaar ?? "",
      pan: customer?.pan ?? "",
      dob: customer?.dob?.toISOString() ?? "",
      address: customer?.address ?? "",
      city: customer?.city ?? "",
      state: customer?.state ?? "",
    },
    vehicle: {
      name: loan.vehicle.name,
      model: loan.vehicle.model ?? "",
      engineNo: loan.vehicle.engineNo ?? "",
      chassisNo: loan.vehicle.chassisNo ?? "",
      regNo: loan.vehicle.regNo ?? "",
      loanType: loan.vehicle.loanType ?? "",
      dealerName: loan.vehicle.dealerName ?? "",
    },
    financial: {
      vehiclePrice: loan.financial.vehiclePrice,
      downPayment: loan.financial.downPayment,
      loanAmount: loan.financial.loanAmount,
      interestRate: loan.financial.interestRate,
      interestType: loan.financial.interestType,
      tenureMonths: loan.financial.tenureMonths,
      emiDay: loan.financial.emiDay,
    },
    paymentPlan: {
      monthlyEmi: loan.paymentPlan.monthlyEmi,
      totalPayable: loan.paymentPlan.totalPayable,
      totalInterest: loan.paymentPlan.totalInterest,
    },
    guarantor: loan.guarantor
      ? {
          name: loan.guarantor.name ?? "",
          mobile: loan.guarantor.mobile ?? "",
          relation: loan.guarantor.relation ?? "",
          address: loan.guarantor.address ?? "",
        }
      : undefined,
    emis,
    totals,
  };
}

/**
 * Lists loans with live EMI statistics. Searching matches the loan number,
 * customer name, mobile or Aadhaar.
 */
export async function listLoans(input: {
  search?: string;
  status?: "active" | "closed";
  limit?: number;
  today?: Date;
}): Promise<LoanSummary[]> {
  const { search, status, limit = 20, today = new Date() } = input;

  let filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const q = search?.trim();
  if (q) {
    const matched = await Customer.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
        { aadhaar: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id")
      .limit(25)
      .lean();
    filter = {
      ...filter,
      $or: [{ loanNo: { $regex: q, $options: "i" } }, { customerId: { $in: matched.map((c) => c._id) } }],
    };
  }

  const loans = (await Loan.find(filter).sort({ createdAt: -1 }).limit(limit).lean().exec()) as unknown as RawLoan[];
  if (!loans.length) return [];

  const rawCustomers = await Customer.find({ _id: { $in: loans.map((l) => l.customerId) } })
    .select("name mobile aadhaar")
    .lean()
    .exec();
  const customerMap = new Map(
    rawCustomers.map((c) => [c._id.toString(), c as unknown as { name: string; mobile: string; aadhaar?: string }])
  );

  const loanIds = loans.map((l) => l._id);
  const rawEmis = (await Emi.find({ loanId: { $in: loanIds } }).lean().exec()) as unknown as RawEmi[];
  const emisByLoan = new Map<string, RawEmi[]>();
  for (const emi of rawEmis) {
    const key = emi.loanId.toString();
    const rows = emisByLoan.get(key);
    if (rows) rows.push(emi);
    else emisByLoan.set(key, [emi]);
  }

  const summaries: LoanSummary[] = [];
  for (const loan of loans) {
    const customer = customerMap.get(loan.customerId.toString());
    const { emis } = await buildEmiRows(emisByLoan.get(loan._id.toString()) ?? [], today);
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let outstandingAmount = 0;
    let overduePenalty = 0;
    const todayStart = startOfToday(today);
    for (const row of emis) {
      if (row.status === "paid") {
        paidCount++;
        continue;
      }
      pendingCount++;
      if (new Date(row.dueDate) < todayStart) {
        overdueCount++;
        overduePenalty += row.penalty;
      } else {
        outstandingAmount += row.amount;
      }
    }
    summaries.push({
      _id: loan._id.toString(),
      loanNo: loan.loanNo,
      status: loan.status,
      startDate: loan.financial.startDate.toISOString(),
      closedAt: loan.closedAt?.toISOString() ?? null,
      createdAt: loan.createdAt?.toISOString(),
      customer: {
        _id: loan.customerId.toString(),
        name: customer?.name ?? "",
        mobile: customer?.mobile ?? "",
        aadhaar: customer?.aadhaar ?? "",
      },
      vehicle: loan.vehicle.name,
      loanAmount: loan.financial.loanAmount,
      monthlyEmi: loan.paymentPlan.monthlyEmi,
      totalPayable: loan.paymentPlan.totalPayable,
      paidCount,
      pendingCount,
      overdueCount,
      outstandingAmount,
      overduePenalty,
    });
  }
  return summaries;
}
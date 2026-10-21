import type { Types } from "mongoose";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Customer } from "@/models/Customer";
import { computePenaltyForEmi, getPenaltyRuleObj, type PenaltyRuleType } from "@/models/PenaltyRule";
import { startOfToday } from "@/lib/dates";

export interface EmiRow {
  _id: string;
  loanId: string;
  loanNo: string;
  emiNo: number;
  dueDate: string;
  /** Decided instalment amount (principal + interest), never rewritten. */
  amount: number;
  principal: number;
  interest: number;
  /** Balance of earlier EMIs carried into this one (carry-forward). */
  carriedIn: number;
  /** `amount + carriedIn` — what must actually be collected this month. */
  totalDue: number;
  /** Amount collected towards this EMI. */
  paidAmount: number;
  /** `totalDue - paidAmount`, clamped at 0. */
  remaining: number;
  status: "pending" | "partial" | "paid";
  paidOn?: string;
  penalty: number;
  /** Balance moved from this EMI to the next instalment (carry-forward). */
  carriedForward: number;
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
  /** Credit balance from overpayments, applied to future EMIs. */
  advance: number;
  emis: EmiRow[];
  totals: {
    paidCount: number;
    partialCount: number;
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
  paidAmount?: number;
  status: "pending" | "partial" | "paid";
  paidOn?: Date;
  penalty?: number;
  carriedForward?: number;
  carriedIn?: { amount?: number; principal?: number; interest?: number; penalty?: number };
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
  advance?: number;
}

export async function buildEmiRows(rawEmis: RawEmi[], today = new Date()): Promise<{ emis: EmiRow[]; totals: LoanDetail["totals"] }> {
  const todayStart = startOfToday(today);
  const emis: EmiRow[] = [];
  // Loaded at most once per call — only when an overdue EMI actually needs a
  // live penalty computed (stored penalties short-circuit above it).
  let rule: PenaltyRuleType | undefined;
  const totals: LoanDetail["totals"] = {
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    totalPenalty: 0,
    outstandingAmount: 0,
  };

  for (const emi of rawEmis) {
    const carriedIn = Math.max(0, emi.carriedIn?.amount ?? 0);
    const totalDue = emi.amount + carriedIn;
    const storedPaid = Math.max(0, emi.paidAmount ?? 0);
    // Legacy paid EMIs may carry no paidAmount at all — the stored state is
    // still authoritative, so a settled EMI with a carry-forward keeps the
    // money it actually collected while a legacy paid one reads as fully paid.
    const paidAmount = emi.status === "paid" ? (storedPaid > 0 ? storedPaid : totalDue) : storedPaid;
    const remaining = emi.status === "paid" ? 0 : Math.max(0, totalDue - storedPaid);

    // Penalty is frozen once charged (stored); otherwise computed live for
    // overdue outstanding EMIs.
    let penalty = 0;
    if (emi.status !== "paid" && remaining > 0) {
      if ((emi.penalty ?? 0) > 0) {
        penalty = emi.penalty ?? 0;
      } else if (emi.dueDate < todayStart) {
        if (!rule) rule = await getPenaltyRuleObj();
        penalty = (await computePenaltyForEmi(emi.dueDate.toISOString(), totalDue, today, rule)).penalty;
      }
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
      carriedIn,
      totalDue,
      paidAmount,
      remaining,
      status: emi.status,
      paidOn: emi.paidOn?.toISOString(),
      penalty,
      carriedForward: Math.max(0, emi.carriedForward ?? 0),
    });

    if (emi.status === "paid") {
      totals.paidCount++;
      totals.paidAmount += paidAmount;
    } else {
      if (emi.status === "partial") totals.partialCount++;
      totals.pendingCount++;
      totals.paidAmount += paidAmount;
      totals.pendingAmount += remaining;
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
    advance: Math.max(0, loan.advance ?? 0),
    emis,
    totals,
  };
}

/**
 * Lists loans with live EMI statistics. Searching matches the loan number,
 * customer name, mobile or Aadhaar.
 *
 * Pass `stats: false` for dropdown pickers: the stats fields come back as 0
 * and the EMI scan for the matched loans (plus the per-EMI penalty maths) is
 * skipped entirely — pickers only render identity fields.
 */
export async function listLoans(input: {
  search?: string;
  status?: "active" | "closed";
  limit?: number;
  today?: Date;
  stats?: boolean;
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
  // Picker mode: nobody reads the stats — skip pulling every EMI of up to
  // `limit` loans (the biggest cost in this function by far).
  const rawEmis: RawEmi[] =
    input.stats === false
      ? []
      : ((await Emi.find({ loanId: { $in: loanIds } }).lean().exec()) as unknown as RawEmi[]);
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
      outstandingAmount += row.remaining;
      if (new Date(row.dueDate) < todayStart) {
        overdueCount++;
        overduePenalty += row.penalty;
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
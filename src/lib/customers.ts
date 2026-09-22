import type { Types } from "mongoose";
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { startOfToday } from "@/lib/dates";
import { buildEmiRows, type EmiRow, type LoanDetail, type RawEmi } from "@/lib/loans";

interface RawLoanLean {
  _id: Types.ObjectId;
  loanNo: string;
  status: string;
  customerId: Types.ObjectId;
  vehicle: { name: string };
  financial: { loanAmount: number; startDate: Date };
  paymentPlan: { monthlyEmi: number; totalPayable: number };
}
interface RawEmiLean {
  loanId: Types.ObjectId;
  emiNo: number;
  status: string;
  amount: number;
  dueDate: Date;
}

export interface CustomerLoanStat {
  loanNo: string;
  status: string;
  startDate?: string;
  vehicle: string;
  loanAmount: number;
  monthlyEmi: number;
  totalPayable: number;
  totalPaid: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  outstandingAmount: number;
}

export interface CustomerWithLoans {
  _id: string;
  name: string;
  fatherName?: string;
  mobile: string;
  aadhaar?: string;
  pan?: string;
  dob?: string;
  address?: string;
  createdAt?: string;
  loans: CustomerLoanStat[];
}

interface Calcs {
  totalPaid: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  pendingAmount: number;
}

export function calcLoanFromEmis(emis: { status: string; amount: number; dueDate: Date }[], today: Date): Calcs {
  const start = startOfToday(today);
  const calcs: Calcs = { totalPaid: 0, paidCount: 0, pendingCount: 0, overdueCount: 0, pendingAmount: 0 };
  for (const emi of emis) {
    if (emi.status === "paid") {
      calcs.paidCount++;
      calcs.totalPaid += emi.amount;
    } else {
      calcs.pendingCount++;
      calcs.pendingAmount += emi.amount;
      if (new Date(emi.dueDate) < start) calcs.overdueCount++;
    }
  }
  return calcs;
}

// In-memory cache for the expensive full customer list (no search). The full
// list can reach the 2,000 customer cap and pulls in every loan and EMI, so it
// is cached for a short TTL to make the Customers tab re-visits cheap while
// never caching mutations (callers invalidate on create/update). Searches and
// detail lookups bypass the cache entirely.
const CUSTOMERS_LIST_CACHE_TTL_MS = 60_000;

let customersListCache: { key: string; value: CustomerWithLoans[]; at: number } | null = null;
let customersListInFlight: Promise<CustomerWithLoans[]> | null = null;

export function invalidateCustomersListCache(): void {
  customersListCache = null;
}

export async function listCustomers(input: { search?: string; limit?: number; today?: Date }): Promise<CustomerWithLoans[]> {
  const { search, today = new Date() } = input;
  const limit = input.limit ?? 200;

  const q = search?.trim();
  const cacheKey = JSON.stringify({ limit });

  // Only the unsorted full list (no search / no query) is cacheable.
  const cacheable = !q;
  if (cacheable && customersListCache && customersListCache.key === cacheKey && Date.now() - customersListCache.at < CUSTOMERS_LIST_CACHE_TTL_MS) {
    return customersListCache.value;
  }

  const load = async (): Promise<CustomerWithLoans[]> => {
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { mobile: { $regex: q, $options: "i" } },
            { aadhaar: { $regex: q, $options: "i" } },
            { pan: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const rawCustomers = await Customer.find(filter).sort({ createdAt: -1 }).limit(limit).lean().exec();
    const customers = rawCustomers as unknown as Array<{
      _id: Types.ObjectId;
      name: string;
      fatherName?: string;
      mobile: string;
      aadhaar?: string;
      pan?: string;
      dob?: Date;
      address?: string;
      createdAt?: Date;
    }>;
    if (!customers.length) return [];

    const rawLoans = await Loan.find({ customerId: { $in: customers.map((c) => c._id) } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const loans = rawLoans as unknown as RawLoanLean[];
    const loansByCustomer = new Map<string, RawLoanLean[]>();
    for (const loan of loans) {
      const key = loan.customerId.toString();
      if (!loansByCustomer.has(key)) loansByCustomer.set(key, []);
      loansByCustomer.get(key)!.push(loan);
    }

    const loanIds = loans.map((l) => l._id);
    const rawEmis = await Emi.find({ loanId: { $in: loanIds } }).lean().exec();
    const emis = rawEmis as unknown as RawEmiLean[];
    const emisByLoan = new Map<string, RawEmiLean[]>();
    for (const emi of emis) {
      const key = emi.loanId.toString();
      if (!emisByLoan.has(key)) emisByLoan.set(key, []);
      emisByLoan.get(key)!.push(emi);
    }

    return customers.map((c) => {
      const loansForCustomer = loansByCustomer.get(c._id.toString()) ?? [];
      const rows = loansForCustomer.map((loan): CustomerLoanStat => {
        const emiRows = emisByLoan.get(loan._id.toString()) ?? [];
        const calcs = calcLoanFromEmis(emiRows, today);
        return {
          loanNo: loan.loanNo,
          status: loan.status,
          startDate: loan.financial.startDate.toISOString(),
          vehicle: loan.vehicle.name,
          loanAmount: loan.financial.loanAmount,
          monthlyEmi: loan.paymentPlan.monthlyEmi,
          totalPayable: loan.paymentPlan.totalPayable,
          totalPaid: calcs.totalPaid,
          paidCount: calcs.paidCount,
          pendingCount: calcs.pendingCount,
          overdueCount: calcs.overdueCount,
          outstandingAmount: calcs.pendingAmount,
        };
      });

      return {
        _id: c._id.toString(),
        name: c.name,
        fatherName: c.fatherName,
        mobile: c.mobile,
        aadhaar: c.aadhaar,
        pan: c.pan,
        dob: c.dob ? c.dob.toISOString() : undefined,
        address: c.address,
        createdAt: c.createdAt?.toISOString(),
        loans: rows,
      };
    });
  };

  if (!cacheable) return load();

  // Coalesce simultaneous cache misses so the full list is only computed once.
  if (customersListInFlight) return customersListInFlight;
  customersListInFlight = load()
    .then((value) => {
      customersListCache = { key: cacheKey, value, at: Date.now() };
      customersListInFlight = null;
      return value;
    })
    .catch((err) => {
      customersListInFlight = null;
      throw err;
    });
  return customersListInFlight;
}

export interface CustomerPaymentRow {
  _id: string;
  receiptNo: string;
  loanNo: string;
  amount: number;
  principal: number;
  interest: number;
  penalty: number;
  mode: string;
  notes: string;
  paidAt: string;
}

export interface CustomerLoanDetail {
  _id: string;
  loanNo: string;
  status: string;
  startDate: string;
  closedAt?: string | null;
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
  paymentPlan: { monthlyEmi: number; totalPayable: number; totalInterest: number };
  emis: EmiRow[];
  payments: CustomerPaymentRow[];
  nocReprints: CustomerPaymentRow[];
  totals: LoanDetail["totals"];
}

export interface CustomerDetail {
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
  createdAt?: string;
  loans: CustomerLoanDetail[];
  totals: {
    loanCount: number;
    activeCount: number;
    closedCount: number;
    totalDisbursed: number;
    totalPaid: number;
    pendingAmount: number;
    totalPenalty: number;
    overdueCount: number;
    outstanding: number;
  };
}

interface RawPaymentLean {
  _id: Types.ObjectId;
  loanId: Types.ObjectId;
  receiptNo: string;
  loanNo: string;
  amount: number;
  principal: number;
  interest: number;
  penalty: number;
  mode: string;
  notes: string;
  type?: string;
  createdAt: Date;
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const customer = await Customer.findById(id).lean();
  if (!customer) return null;

  const rawLoans = await Loan.find({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  const loans = rawLoans as unknown as Array<{
    _id: Types.ObjectId;
    loanNo: string;
    status: string;
    closedAt?: Date;
    vehicle: { name: string; model?: string; engineNo?: string; chassisNo?: string; regNo?: string; loanType?: string; dealerName?: string };
    financial: {
      vehiclePrice: number;
      downPayment: number;
      loanAmount: number;
      interestRate: number;
      interestType: string;
      tenureMonths: number;
      emiDay: number;
      startDate: Date;
    };
    paymentPlan: { monthlyEmi: number; totalPayable: number; totalInterest: number };
  }>;

  const loanDetails: CustomerLoanDetail[] = [];
  const totals: CustomerDetail["totals"] = {
    loanCount: loans.length,
    activeCount: 0,
    closedCount: 0,
    totalDisbursed: 0,
    totalPaid: 0,
    pendingAmount: 0,
    totalPenalty: 0,
    overdueCount: 0,
    outstanding: 0,
  };

  const loanIds = loans.map((l) => l._id);

  const rawEmisAll = (await Emi.find({ loanId: { $in: loanIds } })
    .sort({ loanId: 1, emiNo: 1 })
    .lean()
    .exec()) as unknown as RawEmi[];
  const emisByLoan = new Map<string, RawEmi[]>();
  for (const emi of rawEmisAll) {
    const key = emi.loanId.toString();
    const rows = emisByLoan.get(key);
    if (rows) rows.push(emi);
    else emisByLoan.set(key, [emi]);
  }

  const rawPaymentsAll = (await Payment.find({ loanId: { $in: loanIds } })
    .select("receiptNo loanNo amount principal interest penalty loanId mode notes type createdAt")
    .sort({ loanId: 1, createdAt: -1 })
    .lean()
    .exec()) as unknown as RawPaymentLean[];
  const paymentsByLoan = new Map<string, RawPaymentLean[]>();
  for (const payment of rawPaymentsAll) {
    const key = payment.loanId.toString();
    const rows = paymentsByLoan.get(key);
    if (rows) rows.push(payment);
    else paymentsByLoan.set(key, [payment]);
  }

  for (const loan of loans) {
    const { emis, totals: loanTotals } = await buildEmiRows(emisByLoan.get(loan._id.toString()) ?? []);
    const rawPayments = paymentsByLoan.get(loan._id.toString()) ?? [];
    const toRow = (p: RawPaymentLean): CustomerPaymentRow => ({
      _id: p._id.toString(),
      receiptNo: p.receiptNo,
      loanNo: p.loanNo,
      amount: p.amount,
      principal: p.principal,
      interest: p.interest,
      penalty: p.penalty,
      mode: p.mode,
      notes: p.notes,
      paidAt: p.createdAt.toISOString(),
    });
    const payments = rawPayments.filter((p) => p.type !== "NOC_REPRINT").map(toRow);
    const nocReprints = rawPayments.filter((p) => p.type === "NOC_REPRINT").map(toRow);

    loanDetails.push({
      _id: loan._id.toString(),
      loanNo: loan.loanNo,
      status: loan.status,
      startDate: loan.financial.startDate.toISOString(),
      closedAt: loan.closedAt?.toISOString() ?? null,
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
      emis,
      payments,
      nocReprints,
      totals: loanTotals,
    });

    totals.totalDisbursed += loan.financial.loanAmount;
    if (loan.status === "closed") totals.closedCount++;
    else totals.activeCount++;
  }

  totals.totalPaid = loanDetails.reduce((n, l) => n + l.totals.paidAmount, 0);
  totals.pendingAmount = loanDetails.reduce((n, l) => n + l.totals.pendingAmount, 0);
  totals.totalPenalty = loanDetails.reduce((n, l) => n + l.totals.totalPenalty, 0);
  totals.overdueCount = loanDetails.reduce((n, l) => n + l.totals.overdueCount, 0);
  totals.outstanding = totals.pendingAmount + totals.totalPenalty;

  return {
    _id: customer._id.toString(),
    name: customer.name,
    fatherName: customer.fatherName ?? undefined,
    mobile: customer.mobile,
    aadhaar: customer.aadhaar ?? undefined,
    pan: customer.pan ?? undefined,
    dob: customer.dob ? customer.dob.toISOString() : undefined,
    address: customer.address ?? undefined,
    createdAt: customer.createdAt?.toISOString(),
    loans: loanDetails,
    totals,
  };
}
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { computePenaltyForEmi, getPenaltyRuleObj } from "@/models/PenaltyRule";
import { isoDateIST, startOfISTDay } from "@/lib/dates";
import { currentTenantId } from "@/lib/tenant";
import type { DashboardData, OverdueRow, ReminderRow, TodayCollectionRow } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// The dashboard runs many aggregation queries, so its output is cached for a
// very short window. Switching back to the Dashboard tab then renders almost
// instantly, and any staleness is at most this TTL (mutations reflect after a
// few seconds). Mirrors the listCustomers server-cache pattern.
const DASHBOARD_CACHE_TTL_MS = 10_000;

let dashboardCache: { value: DashboardData; at: number; day: string; tenant: string } | null = null;
const dashboardInFlight = new Map<string, Promise<DashboardData>>();

// "Today" is the IST business day: IST midnight → next IST midnight. India has
// no DST, so a day is always exactly 24h. Without this, a payment made just
// after midnight IST would fall on the previous (UTC) day and be missed.
function startOfToday(today: Date): Date {
  return startOfISTDay(isoDateIST(today));
}

const tomorrow = (today: Date) => new Date(startOfToday(today).getTime() + DAY_MS);

type LeanCustomer = { name: string; mobile: string };

function populateCustomerName(c: LeanCustomer | null | undefined, fallback: string): string {
  return c ? c.name : fallback;
}

async function computeDashboardData(today: Date): Promise<DashboardData> {
  const startToday = startOfToday(today);
  const endToday = tomorrow(today);

  const [totalCustomers, activeLoans, closedLoans] = await Promise.all([
    Customer.countDocuments(),
    Loan.countDocuments({ status: "active" }),
    Loan.countDocuments({ status: "closed" }),
  ]);

  const [
    disbursedAgg,
    collectedAgg,
    todayAgg,
    overdueEmis,
    pendingEmis,
    partialEmis,
    activeLoanDocs,
    todayPayments,
    penaltyRule,
  ] = await Promise.all([
    Loan.aggregate<{ total: number }>([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$financial.loanAmount" } } },
    ]),
    Payment.aggregate<{ total: number }>([
      { $match: { type: { $ne: "NOC_REPRINT" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Payment.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: startToday, $lt: endToday }, type: { $ne: "NOC_REPRINT" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    // Overdue = fully-pending EMIs whose due date has passed. Partly-paid EMIs
    // are tracked separately (see partialEmis) and never counted as overdue.
    Emi.countDocuments({ status: "pending", dueDate: { $lt: startToday } }),
    // Pending = every unpaid-in-full EMI (includes overdue), matching the
    // legacy AVTech software's "EMIs Pending" column.
    Emi.countDocuments({ status: "pending" }),
    // Partly-paid EMIs form their own bucket so they don't inflate Pending/Overdue.
    Emi.countDocuments({ status: "partial" }),
    Loan.find({ status: "active" }).select("_id advance").lean().exec(),
    Payment.find({
      createdAt: { $gte: startToday, $lt: endToday },
      type: { $ne: "NOC_REPRINT" },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    getPenaltyRuleObj(),
  ]);

  const totalDisbursed = disbursedAgg[0]?.total ?? 0;
  const totalCollection = collectedAgg[0]?.total ?? 0;
  const todayCollection = todayAgg[0]?.total ?? 0;

  const activeLoanIds = activeLoanDocs.map((loan) => loan._id);
  // Prepaid credit already collected (extra over scheduled EMIs) reduces the
  // amount still owed, so the outstanding figure is net of it.
  const advanceCredit = activeLoanDocs.reduce(
    (sum, loan) => sum + ((loan as { advance?: number }).advance ?? 0),
    0
  );
  const reminderCutoff = new Date(startToday.getTime() + 7 * DAY_MS);

  const [pendingAmountAgg, upcomingEmis, overdueEmisRows, reminderEmisRows] = await Promise.all([
    Emi.aggregate<{ total: number }>([
      {
        $match: {
          status: { $ne: "paid" },
          dueDate: { $gte: startToday },
          loanId: { $in: activeLoanIds },
        },
      },
      {
        $group: {
          _id: null,
          // Total outstanding (principal + interest) of the remaining balance.
          // Partial EMIs only contribute their unpaid share.
          total: {
            $sum: {
              $cond: [
                { $gt: ["$amount", 0] },
                { $subtract: ["$amount", { $ifNull: ["$paidAmount", 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Emi.countDocuments({
      status: { $ne: "paid" },
      dueDate: { $gte: startToday, $lt: reminderCutoff },
      loanId: { $in: activeLoanIds },
    }),
    Emi.find({ status: { $ne: "paid" }, dueDate: { $lt: startToday }, loanId: { $in: activeLoanIds } })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean(),
    Emi.find({
      status: { $ne: "paid" },
      dueDate: { $gte: startToday, $lt: reminderCutoff },
      loanId: { $in: activeLoanIds },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean(),
  ]);
  // Outstanding = remaining principal + interest of upcoming EMIs, less any
  // advance credit the customer has already paid.
  const pendingAmount = Math.max(0, (pendingAmountAgg[0]?.total ?? 0) - advanceCredit);

  const rowLoanIds = [
    ...new Set([...overdueEmisRows, ...reminderEmisRows].map((emi) => emi.loanId.toString())),
  ];
  const rowLoans = await Loan.find({ _id: { $in: rowLoanIds } })
    .select("loanNo vehicle.name status customerId")
    .lean();
  const loanMap = new Map(rowLoans.map((loan) => [loan._id.toString(), loan]));

  const customers = await Customer.find({
    _id: { $in: [...new Set(rowLoans.map((loan) => loan.customerId.toString()))] },
  })
    .select("name mobile")
    .lean();
  const customerMap = new Map<string, LeanCustomer>();
  customers.forEach((c) => customerMap.set(c._id.toString(), { name: c.name, mobile: c.mobile }));

  const overdueRows: OverdueRow[] = [];
  const reminders: ReminderRow[] = [];
  for (const emi of overdueEmisRows) {
    const loan = loanMap.get(emi.loanId.toString());
    if (!loan) continue;
    const customer = customerMap.get(loan.customerId.toString());
    const late = await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, today, penaltyRule);
    overdueRows.push({
      emiId: emi._id.toString(),
      customerId: loan.customerId.toString(),
      customerName: populateCustomerName(customer, ""),
      mobile: customer?.mobile ?? "",
      loanNo: loan.loanNo,
      vehicle: loan.vehicle?.name ?? "",
      dueDate: emi.dueDate.toISOString(),
      amount: Math.max(0, emi.amount - (emi.paidAmount ?? 0)),
      daysLate: late.daysLate,
      penalty: (emi.penalty ?? 0) > 0 ? (emi.penalty ?? 0) : late.penalty,
    });
  }

  for (const emi of reminderEmisRows) {
    const loan = loanMap.get(emi.loanId.toString());
    if (!loan) continue;
    const customer = customerMap.get(loan.customerId.toString());
    const due = new Date(emi.dueDate);
    reminders.push({
      emiId: emi._id.toString(),
      emiNo: emi.emiNo,
      customerId: loan.customerId.toString(),
      customerName: populateCustomerName(customer, ""),
      mobile: customer?.mobile ?? "",
      loanNo: loan.loanNo,
      vehicle: loan.vehicle?.name ?? "",
      dueDate: due.toISOString(),
      amount: Math.max(0, emi.amount - (emi.paidAmount ?? 0)),
      daysLeft: Math.max(0, Math.ceil((due.getTime() - startToday.getTime()) / DAY_MS)),
    });
  }

  const todayRows: TodayCollectionRow[] = todayPayments.map((p) => ({
    paymentId: p._id.toString(),
    receiptNo: p.receiptNo,
    customerId: p.customerId ? p.customerId.toString() : "",
    customerName: p.customerName,
    loanNo: p.loanNo,
    amount: p.amount,
    settled: (p.principal ?? 0) + (p.interest ?? 0) + (p.penalty ?? 0),
    advanceUsed: p.advanceUsed ?? 0,
    penalty: p.penalty,
    mode: p.mode,
    paidAt: p.createdAt.toISOString(),
  }));

  return {
    totalCustomers,
    activeLoans,
    closedLoans,
    pendingEmis,
    overdueEmis,
    partialEmis,
    todayCollection,
    totalDisbursed,
    pendingAmount,
    totalCollection,
    upcomingEmis,
    overdueRows: overdueRows.sort((a, b) => b.daysLate - a.daysLate).slice(0, 10),
    todayRows,
    reminders: reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10),
  };
}

export async function getDashboardData(today = new Date()): Promise<DashboardData> {
  const tenant = currentTenantId() ?? "global";
  const day = `${today.toDateString()}::${tenant}`;
  if (dashboardCache && dashboardCache.day === day && Date.now() - dashboardCache.at < DASHBOARD_CACHE_TTL_MS) {
    return dashboardCache.value;
  }
  // Coalesce simultaneous renders so the aggregations only run once per tenant.
  const existing = dashboardInFlight.get(day);
  if (existing) return existing;
  const pending = computeDashboardData(today)
    .then((value) => {
      dashboardCache = { value, at: Date.now(), day, tenant };
      dashboardInFlight.delete(day);
      return value;
    })
    .catch((err) => {
      dashboardInFlight.delete(day);
      throw err;
    });
  dashboardInFlight.set(day, pending);
  return pending;
}
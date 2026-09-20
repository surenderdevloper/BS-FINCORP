import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { computePenaltyForEmi } from "@/models/PenaltyRule";
import type { DashboardData, OverdueRow, ReminderRow, TodayCollectionRow } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(today: Date): Date {
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
}

const tomorrow = (today: Date) => {
  const t = startOfToday(today);
  t.setUTCDate(t.getUTCDate() + 1);
  return t;
};

type LeanCustomer = { name: string; mobile: string };

function populateCustomerName(c: LeanCustomer | null | undefined, fallback: string): string {
  return c ? c.name : fallback;
}

export async function getDashboardData(today = new Date()): Promise<DashboardData> {
  const startToday = startOfToday(today);
  const endToday = tomorrow(today);

  const [totalCustomers, activeLoans, closedLoans] = await Promise.all([
    Customer.countDocuments(),
    Loan.countDocuments({ status: "active" }),
    Loan.countDocuments({ status: "closed" }),
  ]);

  const [disbursedAgg, collectedAgg, todayAgg, unpaidEmis] = await Promise.all([
    Loan.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: "$financial.loanAmount" } } },
    ]),
    Payment.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Payment.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: startToday, $lt: endToday } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Emi.find({ status: "pending" }).lean(),
  ]);

  const totalDisbursed = disbursedAgg[0]?.total ?? 0;
  const totalCollection = collectedAgg[0]?.total ?? 0;
  const todayCollection = todayAgg[0]?.total ?? 0;

  const unpaidByLoan = new Map<string, typeof unpaidEmis>();
  const loanIds = new Set<string>();
  for (const emi of unpaidEmis) {
    const key = emi.loanId.toString();
    loanIds.add(key);
    if (!unpaidByLoan.has(key)) unpaidByLoan.set(key, []);
    unpaidByLoan.get(key)!.push(emi);
  }

  // Only track outstanding for active loans on the dashboard.
  const loans = await Loan.find({ _id: { $in: [...loanIds] } })
    .select("loanNo vehicle.name status customerId")
    .lean();

  const customers = await Customer.find({
    _id: { $in: [...new Set(loans.map((l) => l.customerId.toString()))] },
  })
    .select("name mobile")
    .lean();
  const customerMap = new Map<string, LeanCustomer>();
  customers.forEach((c) => customerMap.set(c._id.toString(), { name: c.name, mobile: c.mobile }));

  let pendingEmis = 0;
  let overdueEmis = 0;
  let pendingAmount = 0;
  let upcomingEmis = 0;
  const overdueRows: OverdueRow[] = [];
  const reminders: ReminderRow[] = [];
  const reminderCutoff = new Date(startToday.getTime() + 7 * DAY_MS);

  for (const loan of loans) {
    const isActive = loan.status === "active";
    const emis = unpaidByLoan.get(loan._id.toString()) ?? [];
    const customer = customerMap.get(loan.customerId.toString());

    for (const emi of emis) {
      const late = await computePenaltyForEmi(emi.dueDate.toISOString(), emi.amount, today);
      if (new Date(emi.dueDate) < startToday) {
        overdueEmis++;
        if (isActive) {
          overdueRows.push({
            emiId: emi._id.toString(),
            customerId: loan.customerId.toString(),
            customerName: populateCustomerName(customer, ""),
            mobile: customer?.mobile ?? "",
            loanNo: loan.loanNo,
            vehicle: loan.vehicle?.name ?? "",
            dueDate: emi.dueDate.toISOString(),
            amount: emi.amount,
            daysLate: late.daysLate,
            penalty: late.penalty,
          });
        }
      } else {
        pendingEmis++;
        if (!isActive) continue;
        pendingAmount += emi.principal;
        const due = new Date(emi.dueDate);
        if (due < reminderCutoff) {
          upcomingEmis++;
          reminders.push({
            emiId: emi._id.toString(),
            emiNo: emi.emiNo,
            customerId: loan.customerId.toString(),
            customerName: populateCustomerName(customer, ""),
            mobile: customer?.mobile ?? "",
            loanNo: loan.loanNo,
            vehicle: loan.vehicle?.name ?? "",
            dueDate: due.toISOString(),
            amount: emi.amount,
            daysLeft: Math.max(0, Math.ceil((due.getTime() - startToday.getTime()) / DAY_MS)),
          });
        }
      }
    }
  }

  // Today's collections.
  const todayPayments = await Payment.find({
    createdAt: { $gte: startToday, $lt: endToday },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const todayRows: TodayCollectionRow[] = todayPayments.map((p) => ({
    paymentId: p._id.toString(),
    receiptNo: p.receiptNo,
    customerName: p.customerName,
    loanNo: p.loanNo,
    amount: p.amount,
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
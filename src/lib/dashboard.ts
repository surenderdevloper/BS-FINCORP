import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { computePenaltyForEmi, getPenaltyRuleObj } from "@/models/PenaltyRule";
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

  const [
    disbursedAgg,
    collectedAgg,
    todayAgg,
    overdueEmis,
    pendingEmis,
    activeLoanDocs,
    todayPayments,
    penaltyRule,
  ] = await Promise.all([
    Loan.aggregate<{ total: number }>([
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
    Emi.countDocuments({ status: "pending", dueDate: { $lt: startToday } }),
    Emi.countDocuments({ status: "pending", dueDate: { $gte: startToday } }),
    Loan.find({ status: "active" }).select("_id").lean().exec(),
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
  const reminderCutoff = new Date(startToday.getTime() + 7 * DAY_MS);

  const [pendingAmountAgg, upcomingEmis, overdueEmisRows, reminderEmisRows] = await Promise.all([
    Emi.aggregate<{ total: number }>([
      {
        $match: {
          status: "pending",
          dueDate: { $gte: startToday },
          loanId: { $in: activeLoanIds },
        },
      },
      { $group: { _id: null, total: { $sum: "$principal" } } },
    ]),
    Emi.countDocuments({
      status: "pending",
      dueDate: { $gte: startToday, $lt: reminderCutoff },
      loanId: { $in: activeLoanIds },
    }),
    Emi.find({ status: "pending", dueDate: { $lt: startToday }, loanId: { $in: activeLoanIds } })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean(),
    Emi.find({
      status: "pending",
      dueDate: { $gte: startToday, $lt: reminderCutoff },
      loanId: { $in: activeLoanIds },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean(),
  ]);
  const pendingAmount = pendingAmountAgg[0]?.total ?? 0;

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
      amount: emi.amount,
      daysLate: late.daysLate,
      penalty: late.penalty,
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
      amount: emi.amount,
      daysLeft: Math.max(0, Math.ceil((due.getTime() - startToday.getTime()) / DAY_MS)),
    });
  }

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
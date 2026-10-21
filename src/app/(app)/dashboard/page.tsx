import type { Metadata } from "next";
import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { runForSession } from "@/lib/tenant";
import { getDashboardData } from "@/lib/dashboard";
import { inr, formatDate, APP_TIME_ZONE } from "@/lib/money";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SmsComposer } from "@/components/sms-composer";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { buildCollectionFollowUpMessage, buildEmiReminderMessage } from "@/lib/whatsapp";
import { getMessageSettings } from "@/lib/message-config";
import type { OverdueRow } from "@/types";
import { RemindersCard } from "./reminders-card";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data;
  let error: string | null = null;
  const session = await readSession();
  try {
    await dbConnect();
    data = await runForSession(session?.tenantId, () => getDashboardData());
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load dashboard data.";
  }

  const msgs = await runForSession(session?.tenantId, () => getMessageSettings());
  const brandingName = msgs.brand;
  const officePhone = msgs.officePhone;

  function overdueTemplates(row: OverdueRow) {
    const base = { customerName: row.customerName, loanNo: row.loanNo, amount: row.amount, brandingName };
    return [
      {
        key: "overdue",
        label: "Overdue reminder",
        message: buildEmiReminderMessage("overdue", { ...base, dueDate: row.dueDate }, msgs.wa.overdue),
      },
      {
        key: "friendly",
        label: "Friendly follow-up",
        message: buildCollectionFollowUpMessage("friendly", base, msgs.wa.followupFriendly),
      },
      {
        key: "status",
        label: "Ask payment date",
        message: buildCollectionFollowUpMessage("status", base, msgs.wa.followupStatus),
      },
      {
        key: "office",
        label: "Contact office",
        message: buildCollectionFollowUpMessage("contact_office", { ...base, officePhone }, msgs.wa.followupContact),
      },
    ];
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center">
        <Icon name="alert" size={28} className="text-red-500" />
        <h2 className="mt-3 text-base font-semibold text-red-800">Dashboard unavailable</h2>
        <p className="mt-1 max-w-md text-sm text-red-700">{error}</p>
        <p className="mt-4 max-w-lg text-xs text-red-600">
          Copy <code className="rounded bg-red-100 px-1">.env.example</code> to{" "}
          <code className="rounded bg-red-100 px-1">.env</code>, set{" "}
          <code className="rounded bg-red-100 px-1">MONGODB_URI</code> to your MongoDB (Atlas or local)
          connection string, then run <code className="rounded bg-red-100 px-1">npm run seed</code>.
        </p>
      </div>
    );
  }
  if (!data) return null;

  const metrics = [
    { label: "Total Customers", value: String(data.totalCustomers), tone: "emerald" as const, icon: <Icon name="users" />, href: "/customers" },
    { label: "Active Loans", value: String(data.activeLoans), tone: "sky" as const, icon: <Icon name="dashboard" />, href: "/loans" },
    { label: "Closed Loans", value: String(data.closedLoans), tone: "zinc" as const, icon: <Icon name="close" />, href: "/reports?tab=loans-closed" },
    { label: "Pending EMIs", value: String(data.pendingEmis), tone: "amber" as const, icon: <Icon name="calendar" />, href: "/emi-pay" },
    { label: "Overdue EMIs", value: String(data.overdueEmis), tone: "red" as const, icon: <Icon name="alert" />, href: "/emi-pay" },
    { label: "Today Collection", value: inr(data.todayCollection), tone: "emerald" as const, icon: <Icon name="cash" />, href: "/reports?tab=collections" },
    { label: "Total Disbursed", value: inr(data.totalDisbursed), tone: "sky" as const, icon: <Icon name="plus" />, href: "/loans" },
    { label: "Pending Amount", value: inr(data.pendingAmount), tone: "amber" as const, icon: <Icon name="cash" />, href: "/emi-pay" },
    { label: "Total Collection", value: inr(data.totalCollection), tone: "emerald" as const, icon: <Icon name="cash" />, href: "/reports?tab=collections" },
    { label: "Closed Loan Amount", value: inr(data.closedLoanAmount), tone: "zinc" as const, icon: <Icon name="close" />, href: "/reports?tab=loans-closed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Business overview for {formatDate(new Date())}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Link
            href="/loans/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Icon name="plus" size={16} /> New Loan
          </Link>
          <Link
            href="/emi-pay"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Icon name="cash" size={16} /> Collect EMI
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {metrics.map((m) => (
          <StatCard key={m.label} label={m.label} value={m.value} icon={m.icon} tone={m.tone} href={m.href} />
        ))}
      </div>

      <RemindersCard
        reminders={data.reminders}
        count={data.upcomingEmis}
        brandingName={brandingName}
        waUpcoming={msgs.wa.upcoming}
        waDuetoday={msgs.wa.duetoday}
        smsUpcoming={msgs.sms.upcoming}
      />

      <div className="grid gap-6">
        <Card className="min-w-0">
          <CardHeader
            title="Overdue EMIs"
            subtitle="Unpaid installments past their due date"
            action={
              data.overdueEmis > 0 ? (
                <Badge tone="red">{data.overdueEmis} overdue</Badge>
              ) : (
                <Badge tone="green">All clear</Badge>
              )
            }
          />
          <div>
            {data.overdueRows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                No overdue EMIs. Everything is on track.
              </p>
            ) : (
              <div className="relative min-w-0">
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pl-4 pr-4 pb-4 pt-2 sm:pl-5">
                  {data.overdueRows.map((row) => (
                    <article
                      key={row.emiId}
                      className="ml-1 flex w-[78%] shrink-0 snap-start flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:w-72"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">
                            {row.customerName || "—"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-400">{row.loanNo}</p>
                        </div>
                        <Badge tone="red">{row.daysLate}d late</Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="min-w-0 truncate">{row.vehicle || "—"}</span>
                        <span className="shrink-0">Due {formatDate(row.dueDate)}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                        <span className="text-base font-bold text-zinc-900">{inr(row.amount)}</span>
                        <span className="text-xs text-zinc-500">{row.mobile || "—"}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-xs font-medium text-red-600">+{inr(row.penalty)} penalty</span>
                        <span className="flex flex-wrap items-center justify-end gap-1.5">
                          <SmsComposer
                            type="overdue"
                            customerName={row.customerName}
                            mobile={row.mobile}
                            loanNo={row.loanNo}
                            amount={row.amount}
                            dueDate={row.dueDate}
                            template={msgs.sms.overdue}
                            brandingName={brandingName}
                          />
                          <WhatsAppShare
                            recipientName={row.customerName}
                            mobile={row.mobile}
                            title="WhatsApp Reminder"
                            subtitle={`${row.loanNo} · overdue EMI`}
                            templates={overdueTemplates(row)}
                          />
                          <Link
                            href={`/emi-pay?loan=${row.loanNo}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                          >
                            <Icon name="cash" size={14} /> Collect
                          </Link>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
                {data.overdueRows.length > 1 && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title="Today's Collections"
            subtitle="Payments received today"
            action={<Badge tone="green">{inr(data.todayCollection)}</Badge>}
          />
          <div>
            {data.todayRows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                No collections recorded today yet.
              </p>
            ) : (
              <div>
                <ul className="max-h-[280px] divide-y divide-zinc-50 overflow-y-auto lg:hidden">
                  {data.todayRows.map((row) => (
                    <li key={row.paymentId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-900">
                          {row.customerName}
                          <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                          <span className="font-mono">{row.receiptNo}</span>
                          <Badge tone={row.mode === "online" ? "blue" : "zinc"}>
                            {row.mode === "online" ? "Online" : "Cash"}
                          </Badge>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-right">
                        <span className="text-right">
                          <span className="block text-sm font-semibold text-zinc-900">{inr(row.settled)}</span>
                          {row.advanceUsed > 0 && <Badge tone="amber">Advance</Badge>}
                        </span>
                        <Link
                          href={`/customers/${row.customerId}/receipt/${row.paymentId}?print=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Print receipt"
                          aria-label={`Print receipt ${row.receiptNo}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                        >
                          <Icon name="print" size={16} />
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="hidden lg:block">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                        <th className="whitespace-nowrap px-3 py-2.5 font-medium sm:px-5">Receipt</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-medium">Customer</th>
                        <th className="whitespace-nowrap px-3 py-2.5 font-medium">Mode</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Amount</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Time</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium sm:px-5">Print</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="max-h-[280px] overflow-y-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <tbody className="divide-y divide-zinc-50">
                        {data.todayRows.map((row) => (
                        <tr key={row.paymentId} className="hover:bg-zinc-50/60">
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-500 sm:px-5">{row.receiptNo}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-900">
                            {row.customerName}
                            <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <Badge tone={row.mode === "online" ? "blue" : "zinc"}>
                              {row.mode === "online" ? "Online" : "Cash"}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-zinc-900">
                            <span className="inline-flex items-center justify-end gap-1.5">
                              {inr(row.settled)}
                              {row.advanceUsed > 0 && <Badge tone="amber">Advance</Badge>}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-zinc-500">
                            {new Intl.DateTimeFormat("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: APP_TIME_ZONE,
                            }).format(new Date(row.paidAt))}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right sm:px-5">
                            <Link
                              href={`/customers/${row.customerId}/receipt/${row.paymentId}?print=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Print receipt"
                              aria-label={`Print receipt ${row.receiptNo}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                            >
                              <Icon name="print" size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
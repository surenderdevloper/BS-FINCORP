import type { Metadata } from "next";
import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard";
import { inr, formatDate } from "@/lib/money";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AutoRefresh } from "./auto-refresh";
import { RemindersCard } from "./reminders-card";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data;
  let error: string | null = null;
  try {
    await dbConnect();
    data = await getDashboardData();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load dashboard data.";
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
    { label: "Total Customers", value: String(data.totalCustomers), tone: "emerald" as const, icon: <Icon name="users" /> },
    { label: "Active Loans", value: String(data.activeLoans), tone: "sky" as const, icon: <Icon name="dashboard" /> },
    { label: "Closed Loans", value: String(data.closedLoans), tone: "zinc" as const, icon: <Icon name="close" /> },
    { label: "Pending EMIs", value: String(data.pendingEmis), tone: "amber" as const, icon: <Icon name="calendar" /> },
    { label: "Overdue EMIs", value: String(data.overdueEmis), tone: "red" as const, icon: <Icon name="alert" /> },
    { label: "Today Collection", value: inr(data.todayCollection), tone: "emerald" as const, icon: <Icon name="cash" /> },
    { label: "Total Disbursed", value: inr(data.totalDisbursed), tone: "sky" as const, icon: <Icon name="plus" /> },
    { label: "Pending Amount", value: inr(data.pendingAmount), tone: "amber" as const, icon: <Icon name="cash" /> },
    { label: "Total Collection", value: inr(data.totalCollection), tone: "emerald" as const, icon: <Icon name="cash" /> },
    { label: "Upcoming EMIs (7d)", value: String(data.upcomingEmis), tone: "sky" as const, icon: <Icon name="calendar" /> },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh />
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
          <StatCard key={m.label} label={m.label} value={m.value} icon={m.icon} tone={m.tone} />
        ))}
      </div>

      <RemindersCard reminders={data.reminders} count={data.upcomingEmis} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
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
              <div>
                <ul className="divide-y divide-zinc-50 md:hidden">
                  {data.overdueRows.map((row) => (
                    <li key={row.emiId} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                          {row.customerName || "—"}
                          <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                        </span>
                        <Badge tone="red">{row.daysLate}d late</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="min-w-0 truncate">
                          {row.vehicle || "—"} · {formatDate(row.dueDate)}
                        </span>
                        <span className="shrink-0 font-semibold text-zinc-900">{inr(row.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">{row.mobile || "—"}</span>
                        <span className="font-medium text-red-600">+{inr(row.penalty)} penalty</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="-mx-4 hidden overflow-x-auto px-4 sm:mx-0 sm:px-0 md:block">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                        <th className="px-3 py-2.5 font-medium sm:px-5">Customer</th>
                        <th className="px-3 py-2.5 font-medium">Mobile</th>
                        <th className="px-3 py-2.5 font-medium">Vehicle</th>
                        <th className="px-3 py-2.5 font-medium">Due Date</th>
                        <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                        <th className="px-3 py-2.5 text-right font-medium">Days Late</th>
                        <th className="px-3 py-2.5 text-right font-medium sm:px-5">Penalty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {data.overdueRows.map((row) => (
                        <tr key={row.emiId} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-3 font-medium text-zinc-900 sm:px-5">
                            {row.customerName || "—"}
                            <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                          </td>
                          <td className="px-3 py-3 text-zinc-600">{row.mobile || "—"}</td>
                          <td className="px-3 py-3 text-zinc-600">{row.vehicle || "—"}</td>
                          <td className="px-3 py-3 text-zinc-600">{formatDate(row.dueDate)}</td>
                          <td className="px-3 py-3 text-right font-medium text-zinc-900">{inr(row.amount)}</td>
                          <td className="px-3 py-3 text-right">
                            <Badge tone="red">{row.daysLate} days</Badge>
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-red-600 sm:px-5">{inr(row.penalty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
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
                <ul className="divide-y divide-zinc-50 md:hidden">
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
                      <span className="shrink-0 text-sm font-semibold text-zinc-900">{inr(row.amount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="-mx-4 hidden overflow-x-auto px-4 sm:mx-0 sm:px-0 md:block">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                        <th className="px-3 py-2.5 font-medium sm:px-5">Receipt</th>
                        <th className="px-3 py-2.5 font-medium">Customer</th>
                        <th className="px-3 py-2.5 font-medium">Mode</th>
                        <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                        <th className="px-3 py-2.5 text-right font-medium sm:px-5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {data.todayRows.map((row) => (
                        <tr key={row.paymentId} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-3 font-mono text-xs text-zinc-500 sm:px-5">{row.receiptNo}</td>
                          <td className="px-3 py-3 font-medium text-zinc-900">
                            {row.customerName}
                            <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={row.mode === "online" ? "blue" : "zinc"}>
                              {row.mode === "online" ? "Online" : "Cash"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-zinc-900">{inr(row.amount)}</td>
                          <td className="px-3 py-3 text-right text-zinc-500 sm:px-5">
                            {new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
                              new Date(row.paidAt)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
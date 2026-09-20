"use client";

import { useEffect } from "react";
import type { CustomerDetail } from "@/lib/customers";
import { Button, Card, CardHeader, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { inr, formatDate, formatDateTime } from "@/lib/money";

function StatusBadge({ status }: { status: string }) {
  const tone = status === "closed" ? "green" : status === "active" ? "blue" : "amber";
  return <Badge tone={tone}>{status}</Badge>;
}

function SummaryGrid({ customer }: { customer: CustomerDetail }) {
  const items: Array<{ label: string; value: string; tone: "emerald" | "red" | "amber" | "sky" | "zinc" }> = [
    { label: "Total Loans", value: String(customer.totals.loanCount), tone: "sky" },
    { label: "Disbursed", value: inr(customer.totals.totalDisbursed), tone: "zinc" },
    { label: "Total Paid", value: inr(customer.totals.totalPaid), tone: "emerald" },
    { label: "Pending", value: inr(customer.totals.pendingAmount), tone: "amber" },
    { label: "Penalty", value: inr(customer.totals.totalPenalty), tone: "red" },
    { label: "Outstanding", value: inr(customer.totals.outstanding), tone: "red" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <Card key={it.label} className="p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:text-xs sm:normal-case sm:tracking-normal">
            {it.label}
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900">{it.value}</p>
        </Card>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function LoanSection({ loan }: { loan: CustomerDetail["loans"][number] }) {
  const t = loan.totals;
  return (
    <Card>
      <CardHeader
        title={`Loan ${loan.loanNo}`}
        subtitle={`${loan.vehicle.name ?? ""}${loan.vehicle.regNo ? ` • ${loan.vehicle.regNo}` : ""}`}
        action={<StatusBadge status={loan.status} />}
      />
      <div className="px-4 py-3 sm:px-5 sm:py-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <DetailRow label="Loan Amount" value={inr(loan.financial.loanAmount)} />
          <DetailRow label="Monthly EMI" value={inr(loan.paymentPlan.monthlyEmi)} />
          <DetailRow label="Total Payable" value={inr(loan.paymentPlan.totalPayable)} />
          <DetailRow label="Interest" value={inr(loan.paymentPlan.totalInterest)} />
          <DetailRow label="Rate" value={`${loan.financial.interestRate}% (${loan.financial.interestType})`} />
          <DetailRow label="Tenure" value={`${loan.financial.tenureMonths} months`} />
          <DetailRow label="Start Date" value={formatDate(loan.startDate)} />
          {loan.closedAt && <DetailRow label="Closed On" value={formatDate(loan.closedAt)} />}
          <DetailRow label="Chassis No" value={loan.vehicle.chassisNo} />
          <DetailRow label="Engine No" value={loan.vehicle.engineNo} />
          <DetailRow label="Dealer Name" value={loan.vehicle.dealerName} />
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-zinc-50 p-2.5">
            <p className="text-[11px] text-zinc-500">Paid</p>
            <p className="text-sm font-bold text-emerald-700">
              {t.paidCount}/{loan.emis.length} • {inr(t.paidAmount)}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-2.5">
            <p className="text-[11px] text-zinc-500">Pending</p>
            <p className="text-sm font-bold text-amber-700">{t.pendingCount} • {inr(t.pendingAmount)}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-2.5">
            <p className="text-[11px] text-zinc-500">Overdue</p>
            <p className="text-sm font-bold text-red-700">{t.overdueCount}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-2.5">
            <p className="text-[11px] text-zinc-500">Penalty Due</p>
            <p className="text-sm font-bold text-red-700">{inr(t.totalPenalty)}</p>
          </div>
        </div>

        {loan.emis.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs font-semibold text-zinc-700">EMI Schedule</p>
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">EMI</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3 text-right">Principal</th>
                  <th className="py-2 pr-3 text-right">Interest</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3 text-right">Penalty</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {loan.emis.map((e) => (
                  <tr key={e._id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-zinc-900">#{e.emiNo}</td>
                    <td className="py-2 pr-3 text-zinc-600">{formatDate(e.dueDate)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(e.principal)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(e.interest)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-zinc-900">{inr(e.amount)}</td>
                    <td className="py-2 pr-3 text-right text-red-600">{e.penalty ? inr(e.penalty) : "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={e.status === "paid" ? "green" : "red"}>{e.status}</Badge>
                    </td>
                    <td className="py-2 text-zinc-600">{e.paidOn ? formatDate(e.paidOn) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loan.payments.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs font-semibold text-zinc-700">Payment History</p>
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Receipt</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Principal</th>
                  <th className="py-2 pr-3 text-right">Interest</th>
                  <th className="py-2 pr-3 text-right">Penalty</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loan.payments.map((p) => (
                  <tr key={p._id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{p.receiptNo}</td>
                    <td className="py-2 pr-3 text-zinc-600">{formatDateTime(p.paidAt)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(p.principal)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(p.interest)}</td>
                    <td className="py-2 pr-3 text-right text-red-600">{inr(p.penalty)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-zinc-900">{inr(p.amount)}</td>
                    <td className="py-2 pr-3 text-zinc-600">{p.mode}</td>
                    <td className="py-2 text-zinc-600">{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loan.emis.length === 0 && loan.payments.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">No EMIs or payments yet.</p>
        )}
      </div>
    </Card>
  );
}

export function CustomerStatement({
  customer,
  autoPrint = false,
}: {
  customer: CustomerDetail;
  autoPrint?: boolean;
}) {
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  useEffect(() => {
    const t = document.title;
    document.title = `${customer.name} — Customer Detail`;
    return () => {
      document.title = t;
    };
  }, [customer.name]);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Customer Statement</h1>
          <p className="text-sm text-zinc-500">{customer.name}</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()} className="px-4 py-2 text-sm">
          <Icon name="print" size={16} /> Print Statement
        </Button>
      </div>

      <Card className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <DetailRow label="Customer" value={customer.name} />
          <DetailRow label="Father" value={customer.fatherName} />
          <DetailRow label="Mobile" value={customer.mobile} />
          <DetailRow label="Alt Mobile" value={customer.altMobile} />
          <DetailRow label="Aadhaar" value={customer.aadhaar} />
          <DetailRow label="PAN" value={customer.pan} />
          <DetailRow label="DOB" value={customer.dob ? formatDate(customer.dob) : undefined} />
          <DetailRow label="Address" value={customer.address} />
          <DetailRow label="City" value={customer.city} />
          <DetailRow label="State" value={customer.state} />
          <DetailRow label="Customer Since" value={customer.createdAt ? formatDate(customer.createdAt) : undefined} />
        </dl>
      </Card>

      <SummaryGrid customer={customer} />

      {customer.loans.length === 0 ? (
        <Card>
          <CardHeader title="Loans" subtitle="No loans registered for this customer." />
        </Card>
      ) : (
        customer.loans.map((loan) => <LoanSection key={loan._id} loan={loan} />)
      )}
    </div>
  );
}
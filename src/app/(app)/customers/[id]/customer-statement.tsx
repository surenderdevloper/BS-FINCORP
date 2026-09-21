"use client";

import { useEffect, useState } from "react";
import type { CustomerDetail } from "@/lib/customers";
import { Button, Card, CardHeader, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { inr, formatDate, formatDateTime } from "@/lib/money";

interface Company {
  companyName: string;
  address?: string;
  gst?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
      {status}
    </span>
  );
}

function SummaryGrid({ customer }: { customer: CustomerDetail }) {
  const items: Array<{ label: string; value: string }> = [
    { label: "Total Loans", value: String(customer.totals.loanCount) },
    { label: "Disbursed", value: inr(customer.totals.totalDisbursed) },
    { label: "Total Paid", value: inr(customer.totals.totalPaid) },
    { label: "Pending", value: inr(customer.totals.pendingAmount) },
    { label: "Penalty", value: inr(customer.totals.totalPenalty) },
    { label: "Outstanding", value: inr(customer.totals.outstanding) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="print-total rounded-xl p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/85 sm:text-xs sm:normal-case sm:tracking-normal">
            {it.label}
          </p>
          <p className="mt-1 text-lg font-bold text-white">{it.value}</p>
        </div>
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
    <Card className="print-doc">
      <div className="print-banner flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-bold text-white">Loan {loan.loanNo}</p>
          <p className="mt-0.5 text-xs text-white/85">
            {loan.vehicle.name ?? ""}
            {loan.vehicle.regNo ? ` • ${loan.vehicle.regNo}` : ""}
          </p>
        </div>
        <StatusBadge status={loan.status} />
      </div>
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
          <div className="print-total rounded-lg p-2.5">
            <p className="text-[11px] text-white/80">Paid</p>
            <p className="text-sm font-bold text-white">
              {t.paidCount}/{loan.emis.length} • {inr(t.paidAmount)}
            </p>
          </div>
          <div className="print-total rounded-lg p-2.5">
            <p className="text-[11px] text-white/80">Pending</p>
            <p className="text-sm font-bold text-white">{t.pendingCount} • {inr(t.pendingAmount)}</p>
          </div>
          <div className="print-total rounded-lg p-2.5">
            <p className="text-[11px] text-white/80">Overdue</p>
            <p className="text-sm font-bold text-white">{t.overdueCount}</p>
          </div>
          <div className="print-total rounded-lg p-2.5">
            <p className="text-[11px] text-white/80">Penalty Due</p>
            <p className="text-sm font-bold text-white">{inr(t.totalPenalty)}</p>
          </div>
        </div>

        {loan.emis.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <div className="mb-2 print-break-avoid print-section-heading">EMI Schedule</div>
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-600">
                  <th className="py-2 pr-3 font-semibold">EMI</th>
                  <th className="py-2 pr-3 font-semibold">Due</th>
                  <th className="py-2 pr-3 text-right font-semibold">Principal</th>
                  <th className="py-2 pr-3 text-right font-semibold">Interest</th>
                  <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-3 text-right font-semibold">Penalty</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Paid On</th>
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
                    <td className="py-2 pr-3 text-right text-zinc-600">{e.penalty ? inr(e.penalty) : "—"}</td>
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
            <div className="mb-2 print-break-avoid print-section-heading">Payment History</div>
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-600">
                  <th className="py-2 pr-3 font-semibold">Receipt</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 text-right font-semibold">Principal</th>
                  <th className="py-2 pr-3 text-right font-semibold">Interest</th>
                  <th className="py-2 pr-3 text-right font-semibold">Penalty</th>
                  <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-3 font-semibold">Mode</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loan.payments.map((p) => (
                  <tr key={p._id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{p.receiptNo}</td>
                    <td className="py-2 pr-3 text-zinc-600">{formatDateTime(p.paidAt)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(p.principal)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(p.interest)}</td>
                    <td className="py-2 pr-3 text-right text-zinc-600">{inr(p.penalty)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-zinc-900">{inr(p.amount)}</td>
                    <td className="py-2 pr-3 text-zinc-600">{p.mode}</td>
                    <td className="py-2 text-zinc-600">{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loan.nocReprints.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <div className="mb-2 print-break-avoid print-section-heading">NOC Reprint Charges</div>
            <table className="w-full min-w-[480px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-600">
                  <th className="py-2 pr-3 font-semibold">Receipt</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-3 font-semibold">Mode</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loan.nocReprints.map((p) => (
                  <tr key={p._id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{p.receiptNo}</td>
                    <td className="py-2 pr-3 text-zinc-600">{formatDateTime(p.paidAt)}</td>
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

  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { company: Company };
          setCompany(data.company);
        }
      } catch {
        /* optional */
      }
    })();
  }, []);

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

      <Card className="print-doc overflow-hidden p-0">
        <div className="print-letterhead px-6 pb-5 pt-6 text-center">
          <p className="print-letterhead-name">{company?.companyName ?? "BS FINCORP"}</p>
          {company?.address && <p className="print-letterhead-detail mt-1 text-xs">{company.address}</p>}
          <div className="print-letterhead-detail mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs">
            {company?.phone && <span>Ph: {company.phone}</span>}
            {company?.email && <span>{company.email}</span>}
            {company?.gst && <span>GST: {company.gst}</span>}
          </div>
        </div>
        <div className="border-t border-zinc-200 px-4 py-3 text-center sm:px-5">
          <p className="print-title text-base">Customer Statement</p>
          <p className="mt-0.5 text-xs text-zinc-500">{customer.name}</p>
        </div>
      </Card>

      <Card className="print-doc">
        <div className="print-break-avoid print-section-heading">Customer Details</div>
        <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
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
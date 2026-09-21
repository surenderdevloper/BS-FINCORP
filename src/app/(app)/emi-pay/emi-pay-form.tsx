"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";
import { Icon } from "@/components/icons";
import { formatDate, inr } from "@/lib/money";
import type { EmiRow, LoanDetail } from "@/lib/loans";

interface LoanSummaryResult {
  _id: string;
  loanNo: string;
  customer: { name: string };
}

interface Company {
  companyName: string;
  address?: string;
  phone?: string;
  logo?: string;
}

interface ReceiptResult {
  receiptNo: string;
  loanNo: string;
  customerName: string;
  amount: number;
  emiTotal: number;
  penalty: number;
  discount: number;
  paidCount: number;
  mode: string;
  paidAt: string;
}

const defaultDue = (emis: EmiRow[]) => {
  const overdue = emis.filter((e) => e.status === "pending" && e.penalty > 0);
  if (overdue.length) return overdue.map((e) => e._id);
  const earliest = emis.find((e) => e.status === "pending");
  return earliest ? [earliest._id] : [];
};

const localDateStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function EmiPayForm({ preselectedLoan }: { preselectedLoan?: string }) {
  const [search, setSearch] = useState(preselectedLoan ?? "");
  const [results, setResults] = useState<LoanSummaryResult[]>([]);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => localDateStr());
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDetail = useCallback(async (loanNo: string, payDate?: string) => {
    setLoadingDetail(true);
    try {
      const qs = payDate ? `?paymentDate=${encodeURIComponent(payDate)}` : "";
      const res = await fetch(`/api/loans/${loanNo}${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { loan: LoanDetail };
      setLoan(data.loan);
      setSelected(defaultDue(data.loan.emis));
      setDiscount("");
    } catch {
      /* handled by caller */
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    document.title = "EMI Pay";
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { company: Company };
          setCompany(data.company);
        }
      } catch {
        /* settings optional for payment flow */
      }
    })();
  }, []);

  useEffect(() => {
    if (!preselectedLoan) return;
    const t = setTimeout(() => void loadDetail(preselectedLoan, paymentDate), 0);
    return () => clearTimeout(t);
  }, [preselectedLoan, loadDetail, paymentDate]);

  const onSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!v.trim()) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/loans?search=${encodeURIComponent(v)}&status=active&limit=10`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { loans: LoanSummaryResult[] };
        setResults(data.loans.filter((l) => l.customer.name));
      } catch {
        setError("Search failed.");
      }
    }, 350);
  };

  const selectLoan = useCallback(
    async (loanNo: string) => {
      setError(null);
      setReceipt(null);
      await loadDetail(loanNo, paymentDate);
    },
    [loadDetail, paymentDate]
  );

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const selectedRows = (loan?.emis ?? []).filter((e) => selected.includes(e._id));
  const emiTotal = selectedRows.reduce((n, e) => n + e.amount, 0);
  const penaltyTotal = selectedRows.reduce((n, e) => n + e.penalty, 0);
  const discountValue = discount.trim() === "" ? 0 : Math.max(0, Number(discount) || 0);
  const payable = Math.max(0, emiTotal + penaltyTotal - discountValue);

  const onCollect = async () => {
    if (!loan || !selected.length) return;
    setCollecting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanNo: loan.loanNo, emiIds: selected, mode, notes, discount: discountValue, paymentDate }),
      });
      const data = (await res.json()) as { error?: string; payment?: ReceiptResult };
      if (!res.ok) {
        setError(data.error ?? "Could not record payment.");
        return;
      }
      if (data.payment) setReceipt(data.payment);
      void loadDetail(loan.loanNo, paymentDate);
    } catch {
      setError("Network error while saving payment.");
    } finally {
      setCollecting(false);
    }
  };

  const reset = () => {
    setReceipt(null);
    setLoan(null);
    setSelected([]);
    setSearch("");
    setResults([]);
    setNotes("");
    setDiscount("");
    setPaymentDate(localDateStr());
  };

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="no-print">
        <h1 className="text-xl font-bold text-zinc-900">EMI Pay</h1>
        <p className="text-sm text-zinc-500">Find a loan and collect its due EMIs with a printable receipt.</p>
      </div>

      <Card className="no-print">
        <CardHeader title="Find active loan" subtitle="Search by loan number or customer name" />
        <div className="p-4 sm:p-5">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
              <Icon name="search" size={16} />
            </span>
            <Input
              className="pl-9"
              placeholder="e.g. BF-0006 or customer name…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
              {results.map((l) => (
                <li key={l._id}>
                  <button
                    onClick={() => {
                      setSearch(l.loanNo);
                      setResults([]);
                      void selectLoan(l.loanNo);
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-50"
                  >
                    <span className="font-medium text-zinc-900">{l.customer.name}</span>
                    <span className="font-mono text-xs text-zinc-500">{l.loanNo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {loadingDetail && <p className="text-sm text-zinc-500">Loading loan schedule…</p>}

      {error && (
        <div className="no-print flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      {loan && !receipt && (
        <div className="no-print space-y-5">
          <Card>
            <CardHeader
              title={`${loan.customer.name} · ${loan.loanNo}`}
              subtitle={`${loan.vehicle.name} · ${formatDate(loan.startDate)} · EMI ${inr(loan.paymentPlan.monthlyEmi)}/mo`}
              action={
                <Badge tone={loan.totals.overdueCount > 0 ? "red" : "green"}>
                  {loan.totals.overdueCount > 0 ? `${loan.totals.overdueCount} overdue` : "On track"}
                </Badge>
              }
            />
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                    <th className="w-10 px-3 py-2.5 sm:px-5" />
                    <th className="px-3 py-2.5 font-medium">EMI</th>
                    <th className="px-3 py-2.5 font-medium">Due Date</th>
                    <th className="px-3 py-2.5 text-right font-medium">Principal</th>
                    <th className="px-3 py-2.5 text-right font-medium">Interest</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-2.5 text-right font-medium">Penalty</th>
                    <th className="px-3 py-2.5 sm:px-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {loan.emis.map((e) => {
                    const isOverdue = e.status === "pending" && e.penalty > 0;
                    const checked = selected.includes(e._id);
                    return (
                      <tr key={e._id} className={e.status === "paid" ? "opacity-50" : "hover:bg-zinc-50/60"}>
                        <td className="px-3 py-2.5 sm:px-5">
                          {e.status === "pending" && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(e._id)}
                              className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
                            />
                          )}
                        </td>
                        <td
                          className={`px-3 py-2.5 font-mono text-xs ${isOverdue ? "font-bold text-red-600" : "text-zinc-500"}`}
                        >
                          {String(e.emiNo).padStart(2, "0")}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600">{formatDate(e.dueDate)}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-600">{inr(e.principal)}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-600">{inr(e.interest)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-zinc-900">{inr(e.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-red-600">{e.penalty > 0 ? inr(e.penalty) : "—"}</td>
                        <td className="px-3 py-2.5 text-right sm:px-5">
                          {e.status === "paid" ? (
                            <Badge tone="green">Paid</Badge>
                          ) : isOverdue ? (
                            <Badge tone="red">Overdue</Badge>
                          ) : (
                            <Badge tone="zinc">Due</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Collect payment" subtitle={`${selected.length} EMI${selected.length === 1 ? "" : "s"} selected`} />
            <div className="space-y-4 p-4 sm:p-5">
              {selected.length > 0 && (
                <div className="rounded-lg bg-zinc-50 p-4 text-sm">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-zinc-500">EMI Amount</p>
                      <p className="font-semibold text-zinc-900">{inr(emiTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Due Date</p>
                      <p className="font-semibold text-zinc-900">
                        {selectedRows.map((e) => formatDate(e.dueDate)).join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Penalty</p>
                      <p className="font-semibold text-red-600">{inr(penaltyTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Discount</p>
                      <p className="font-semibold text-zinc-900">-{inr(discountValue)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-200 pt-3">
                    <span className="text-xs text-zinc-500">
                      {inr(emiTotal)} + {inr(penaltyTotal)} − {inr(discountValue)}
                    </span>
                    <span className="text-right">
                      <span className="block text-xs text-zinc-500">Payable Now</span>
                      <span className="text-lg font-bold text-emerald-700">{inr(payable)}</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Payment Mode">
                  <Select value={mode} onChange={(e) => setMode(e.target.value as "cash" | "online")}>
                    <option value="cash">Cash</option>
                    <option value="online">Online (UPI / Bank)</option>
                  </Select>
                </Field>
                <Field label="Payment Date" required hint="Penalty is calculated from this date.">
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPaymentDate(v);
                      if (loan) void loadDetail(loan.loanNo, v);
                    }}
                  />
                </Field>
                <Field label="Discount (₹)" hint="Optional. Negative values are ignored.">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </Field>
                <Field label="Notes (optional)">
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remarks…" />
                </Field>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="primary"
                  onClick={onCollect}
                  disabled={collecting || !selected.length || loan.totals.pendingCount === 0}
                >
                  <Icon name="cash" size={16} />
                  {collecting ? "Recording…" : `Collect ${inr(payable)}`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {receipt && (
        <div>
          <div className="no-print mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Payment recorded</h2>
              <p className="text-sm text-zinc-500">Receipt {receipt.receiptNo} generated. Print a copy below.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.print()}>
                <Icon name="print" size={16} /> Print Receipt
              </Button>
              <Button variant="secondary" onClick={reset}>
                New Payment
              </Button>
            </div>
          </div>

          <Card className="print-doc mx-auto max-w-md overflow-hidden p-0 sm:p-0">
            <div className="print-letterhead px-6 pb-5 pt-6 text-center">
              <p className="print-letterhead-name">{company?.companyName ?? "BS FINCORP"}</p>
              {company?.address && <p className="print-letterhead-detail mt-1 text-xs">{company.address}</p>}
              {company?.phone && <p className="print-letterhead-detail mt-0.5 text-xs">Ph: {company.phone}</p>}
            </div>
            <div className="p-6 sm:p-8">
              <div className="text-center">
                <p className="print-title text-base">Payment Receipt</p>
                <p className="mt-1 font-mono text-sm text-zinc-700">{receipt.receiptNo}</p>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Date</dt>
                  <dd className="font-medium text-zinc-900">{formatDate(receipt.paidAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Customer</dt>
                  <dd className="font-medium text-zinc-900">{receipt.customerName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Loan No</dt>
                  <dd className="font-mono text-zinc-900">{receipt.loanNo}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">EMIs</dt>
                  <dd className="text-zinc-900">{receipt.paidCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Mode</dt>
                  <dd className="capitalize text-zinc-900">{receipt.mode}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">EMI Total</dt>
                  <dd className="text-zinc-900">{inr(receipt.emiTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Penalty</dt>
                  <dd className="text-zinc-800">{inr(receipt.penalty)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Discount</dt>
                  <dd className="text-zinc-800">{receipt.discount > 0 ? `-${inr(receipt.discount)}` : "—"}</dd>
                </div>
              </dl>
              <div className="print-total mt-4 flex items-center justify-between rounded-lg px-4 py-3">
                <span className="text-sm font-semibold">Amount Received</span>
                <span className="text-xl font-bold">{inr(receipt.amount)}</span>
              </div>
              <div className="mt-8 flex items-end justify-between text-xs text-zinc-500">
                <span>Received By: _______________</span>
                <span>Customer Sign: _______________</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!loan && !receipt && (
        <div className="no-print rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">Search an active loan above to start collecting EMIs.</p>
        </div>
      )}
    </div>
  );
}
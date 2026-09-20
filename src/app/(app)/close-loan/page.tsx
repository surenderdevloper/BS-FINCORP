"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";
import { Icon } from "@/components/icons";
import { formatDate, inr } from "@/lib/money";
import type { LoanDetail } from "@/lib/loans";

interface LoanSummaryResult {
  _id: string;
  loanNo: string;
  customer: { name: string };
}

export default function CloseLoanPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LoanSummaryResult[]>([]);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ loanNo: string; closedAt: string; settledAmount: number; penalty: number; receiptNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = "Close Loan";
  }, []);

  const onSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
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
        /* ignore */
      }
    }, 350);
  };

  const selectLoan = async (loanNo: string) => {
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/loans/${loanNo}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Could not load loan details.");
        return;
      }
      const data = (await res.json()) as { loan: LoanDetail };
      setLoan(data.loan);
    } catch {
      setError("Could not load loan details.");
    }
  };

  const onClose = async () => {
    if (!loan || loan.totals.pendingCount === 0) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loan._id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, notes }),
      });
      const data = (await res.json()) as {
        error?: string;
        loanNo?: string;
        closedAt?: string;
        settledAmount?: number;
        penalty?: number;
        receiptNo?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not close the loan.");
        return;
      }
      setResult(data as { loanNo: string; closedAt: string; settledAmount: number; penalty: number; receiptNo: string });
      setLoan(null);
      setSearch("");
      setResults([]);
    } catch {
      setError("Network error while closing the loan.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Close Loan</h1>
        <p className="text-sm text-zinc-500">Settle the outstanding balance to close an active loan.</p>
      </div>

      <Card>
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

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      {loan && loan.totals.pendingCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert" size={16} /> This loan has no outstanding EMIs — nothing to settle.
        </div>
      )}

      {loan && (
        <Card>
          <CardHeader
            title={`${loan.customer.name} · ${loan.loanNo}`}
            subtitle={`${loan.vehicle.name} · ${formatDate(loan.startDate)} · ${inr(loan.paymentPlan.monthlyEmi)}/mo`}
            action={<Badge tone="amber">{loan.totals.pendingCount} EMI pending</Badge>}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 p-4 sm:p-5">
            <div className="rounded-lg bg-zinc-50 p-3.5">
              <p className="text-xs text-zinc-500">EMIs Paid</p>
              <p className="mt-1 text-lg font-bold text-zinc-900">{loan.totals.paidCount}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3.5">
              <p className="text-xs text-zinc-500">EMIs Pending</p>
              <p className="mt-1 text-lg font-bold text-zinc-900">{loan.totals.pendingCount}</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3.5">
              <p className="text-xs text-zinc-500">Pending Principal + Interest</p>
              <p className="mt-1 text-lg font-bold text-zinc-900">{inr(loan.totals.pendingAmount)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3.5">
              <p className="text-xs text-zinc-500">Late-Fee Penalty</p>
              <p className="mt-1 text-lg font-bold text-red-600">{inr(loan.totals.totalPenalty)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-emerald-600 px-5 py-4">
            <span className="text-sm font-semibold text-white">Total to settle</span>
            <span className="text-2xl font-bold text-white">{inr(loan.totals.outstandingAmount)}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="Payment Mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value as "cash" | "online")}>
                <option value="cash">Cash</option>
                <option value="online">Online (UPI / Bank)</option>
              </Select>
            </Field>
            <Field label="Notes (optional)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. full settlement…" />
            </Field>
          </div>

          <div className="flex justify-end border-t border-zinc-100 px-4 py-4 sm:px-5">
            <Button
              variant="danger"
              onClick={onClose}
              disabled={confirming || loan.totals.pendingCount === 0}
            >
              <Icon name="close" size={16} />
              {confirming ? "Closing…" : "Close Loan & Settle"}
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card className="border-emerald-200">
          <CardHeader title="Loan closed successfully" action={<Badge tone="green">Closed</Badge>} />
          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-2 rounded-lg bg-emerald-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-emerald-700/70">Loan No</p>
                <p className="font-mono font-semibold text-emerald-900">{result.loanNo}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700/70">Closed On</p>
                <p className="font-semibold text-emerald-900">{formatDate(result.closedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700/70">Receipt</p>
                <p className="font-mono font-semibold text-emerald-900">{result.receiptNo}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600">
                Settled <span className="font-bold text-zinc-900">{inr(result.settledAmount)}</span>
                {result.penalty > 0 && <span className="ml-1 text-xs text-red-600">(incl. {inr(result.penalty)} penalty)</span>}
              </p>
              <Link
                href={`/noc?loan=${result.loanNo}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Icon name="noc" size={16} /> Generate NOC
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
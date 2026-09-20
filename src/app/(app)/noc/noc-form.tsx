"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { Input } from "@/components/form";
import { Icon } from "@/components/icons";
import { formatDate, inr } from "@/lib/money";
import type { LoanDetail } from "@/lib/loans";

interface Company {
  companyName: string;
  address?: string;
  gst?: string;
  phone?: string;
  email?: string;
}

interface LoanSummaryResult {
  _id: string;
  loanNo: string;
  customer: { name: string };
}

export function NocForm({ preselectedLoan }: { preselectedLoan?: string }) {
  const [search, setSearch] = useState(preselectedLoan ?? "");
  const [results, setResults] = useState<LoanSummaryResult[]>([]);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadLoan = useCallback(async (loanNo: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loanNo}`, { cache: "no-store" });
      if (!res.ok) {
        setError(loanNo ? "Loan not found or still active." : "");
        setLoan(null);
        return;
      }
      const data = (await res.json()) as { loan: LoanDetail };
      setLoan(data.loan);
      if (data.loan.status !== "closed") {
        setError("NOC can only be generated for closed loans.");
      }
    } catch {
      setError("Could not load loan.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!preselectedLoan) return;
    const t = setTimeout(() => void loadLoan(preselectedLoan), 0);
    return () => clearTimeout(t);
  }, [preselectedLoan, loadLoan]);

  const onSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!v.trim()) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/loans?search=${encodeURIComponent(v)}&status=closed&limit=10`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { loans: LoanSummaryResult[] };
        setResults(data.loans.filter((l) => l.customer.name));
      } catch {
        /* ignore */
      }
    }, 350);
  };

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="no-print">
        <h1 className="text-xl font-bold text-zinc-900">NOC Reprint</h1>
        <p className="text-sm text-zinc-500">
          Generate and print a No Objection Certificate for closed loans.
        </p>
      </div>

      <Card className="no-print">
        <div className="p-4 sm:p-5">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
              <Icon name="search" size={16} />
            </span>
            <Input
              className="pl-9"
              placeholder="Search closed loans by number or customer…"
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
                      void loadLoan(l.loanNo);
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

      {loading && <p className="no-print text-sm text-zinc-500">Loading…</p>}
      {error && (
        <div className="no-print flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      {loan && loan.status === "closed" && (
        <>
          <div className="no-print flex justify-end">
            <Button onClick={() => window.print()}>
              <Icon name="print" size={16} /> Print NOC
            </Button>
          </div>

          <Card className="mx-auto max-w-3xl p-6 sm:p-10">
            <div className="border-b border-zinc-300 pb-5 text-center">
              <p className="text-xl font-bold tracking-wide text-zinc-900">
                {company?.companyName ?? "BS FINCORP"}
              </p>
              {company?.address && <p className="mt-1 text-xs text-zinc-600">{company.address}</p>}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs text-zinc-600">
                {company?.phone && <span>Ph: {company.phone}</span>}
                {company?.email && <span>{company.email}</span>}
                {company?.gst && <span>GST: {company.gst}</span>}
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-zinc-800">
                No Objection Certificate
              </p>
              <p className="mt-1 font-mono text-xs text-zinc-500">Ref: NOC / {loan.loanNo}</p>
            </div>

            <div className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-800">
              <p>
                <span className="font-semibold">{company?.companyName ?? "BS FINCORP"}</span> hereby
                declares that the loan availed by the borrower under the following details has been
                <span className="font-semibold"> fully settled and repaid</span> in accordance with
                the agreed repayment schedule. The company raises <span className="font-semibold">no objection</span>{" "}
                to the transfer / sale / hypothecation release of the financed asset.
              </p>

              <div className="mt-6 rounded-lg border border-zinc-200 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Borrower & Loan Details
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Customer</dt>
                    <dd className="font-semibold text-zinc-900">{loan.customer.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Father Name</dt>
                    <dd className="font-semibold text-zinc-900">{loan.customer.fatherName || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block sm:col-span-2">
                    <dt className="text-zinc-500">Address</dt>
                    <dd className="max-w-[60%] text-right font-semibold text-zinc-900 sm:max-w-none sm:text-left">
                      {loan.customer.address || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Mobile</dt>
                    <dd className="font-mono font-semibold text-zinc-900">{loan.customer.mobile}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Aadhaar</dt>
                    <dd className="font-mono font-semibold text-zinc-900">{loan.customer.aadhaar || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Loan No</dt>
                    <dd className="font-mono font-semibold text-zinc-900">{loan.loanNo}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Vehicle</dt>
                    <dd className="font-semibold text-zinc-900">{loan.vehicle.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Registration No</dt>
                    <dd className="font-mono font-semibold text-zinc-900">{loan.vehicle.regNo || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Chassis No</dt>
                    <dd className="font-mono font-semibold text-zinc-900">{loan.vehicle.chassisNo || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Engine No</dt>
                    <dd className="font-mono font-semibold text-zinc-900">{loan.vehicle.engineNo || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Loan Amount</dt>
                    <dd className="font-semibold text-zinc-900">{inr(loan.financial.loanAmount)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-zinc-500">Loan Started</dt>
                    <dd className="font-semibold text-zinc-900">{formatDate(loan.startDate)}</dd>
                  </div>
                </dl>
              </div>

              <p>
                The loan was closed on{" "}
                <span className="font-semibold">{loan.closedAt ? formatDate(loan.closedAt) : formatDate(new Date())}</span>.
                Any balance overpayment, if applicable, is to be settled by the company as per policy.
              </p>
            </div>

            <div className="mt-12 flex items-end justify-between text-sm text-zinc-800">
              <div>
                <p>Date: _______________</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">Authorised Signatory</p>
                <p className="mt-8 inline-block border-t border-zinc-400 px-6 pt-1 text-xs text-zinc-500">
                  {company?.companyName ?? "BS FINCORP"}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
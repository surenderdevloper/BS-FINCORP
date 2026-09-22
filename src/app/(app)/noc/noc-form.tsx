"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";
import { Icon } from "@/components/icons";
import { formatDate, inr } from "@/lib/money";
import type { LoanDetail } from "@/lib/loans";

interface Company {
  companyName: string;
  address?: string;
  gst?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

interface LoanSummaryResult {
  _id: string;
  loanNo: string;
  customer: { name: string };
}

interface ReprintReceipt {
  receiptNo: string;
  loanNo: string;
  customerName: string;
  amount: number;
  mode: string;
  paidAt: string;
}

export function NocForm({ preselectedLoan }: { preselectedLoan?: string }) {
  const [search, setSearch] = useState(preselectedLoan ?? "");
  const [results, setResults] = useState<LoanSummaryResult[]>([]);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprintReceipt, setReprintReceipt] = useState<ReprintReceipt | null>(null);
  const [charge, setCharge] = useState(0);
  const [chargeMode, setChargeMode] = useState<"cash" | "online">("cash");
  const [chargeNotes, setChargeNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
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
      setReprintReceipt(null);
      setCharge(0);
      setChargeMode("cash");
      setChargeNotes("");
      setChargeError(null);
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

  const resetCharge = () => {
    setReprintReceipt(null);
    setCharge(0);
    setChargeMode("cash");
    setChargeNotes("");
    setChargeError(null);
  };

  const generateReceipt = async () => {
    if (!loan || charge <= 0) return;
    setGenerating(true);
    setChargeError(null);
    try {
      const res = await fetch("/api/noc/reprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanNo: loan.loanNo, charge, mode: chargeMode, notes: chargeNotes }),
      });
      const data = (await res.json()) as { error?: string; receipt?: ReprintReceipt };
      if (!res.ok) {
        setChargeError(data.error ?? "Could not record reprint charge.");
        return;
      }
      if (data.receipt) setReprintReceipt(data.receipt);
    } catch {
      setChargeError("Network error while recording reprint charge.");
    } finally {
      setGenerating(false);
    }
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
          <Card className="no-print">
            <CardHeader title="NOC Reprint Charge" subtitle="Record the reprint fee before issuing the NOC copy" />
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Reprint Charge (Rs.)">
                  <Input
                    type="number"
                    min={0}
                    value={charge === 0 ? "" : charge}
                    onChange={(e) => setCharge(Math.max(0, Number(e.target.value)))}
                    placeholder="Enter reprint charge"
                  />
                </Field>
                <Field label="Payment Mode">
                  <Select value={chargeMode} onChange={(e) => setChargeMode(e.target.value as "cash" | "online")}>
                    <option value="cash">Cash</option>
                    <option value="online">Online (UPI / Bank)</option>
                  </Select>
                </Field>
              </div>
              <Field label="Remarks (optional)">
                <Input value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} placeholder="Any remarks…" />
              </Field>
              {chargeError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <Icon name="alert" size={16} /> {chargeError}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm">
                  <p className="text-xs text-zinc-500">Total Charge</p>
                  <p className="text-lg font-bold text-zinc-900">{inr(charge)}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void generateReceipt()} disabled={generating || charge <= 0}>
                    <Icon name="cash" size={16} />
                    {generating ? "Recording…" : "Generate Receipt + NOC"}
                  </Button>
                  <Button variant="secondary" onClick={resetCharge}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="no-print flex justify-end">
            <Button onClick={() => window.print()}>
              <Icon name="print" size={16} /> {reprintReceipt ? "Print Receipt" : "Print NOC"}
            </Button>
          </div>

          <Card className={`print-doc mx-auto max-w-3xl overflow-hidden p-0 sm:p-0 ${reprintReceipt ? "print:hidden" : ""}`}>
            <div className="print-letterhead px-6 pb-5 pt-6 text-center sm:px-10">
              <p className="print-letterhead-name">{company?.companyName ?? "BS FINCORP"}</p>
              {company?.address && <p className="print-letterhead-detail mt-1 text-xs">{company.address}</p>}
              <div className="print-letterhead-detail mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs">
                {company?.phone && <span>Ph: {company.phone}</span>}
                {company?.email && <span>{company.email}</span>}
                {company?.gst && <span>GST: {company.gst}</span>}
              </div>
            </div>

            <div className="p-6 sm:p-10">
              <div className="text-center">
                <p className="print-title text-sm uppercase tracking-widest">No Objection Certificate</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">Ref: NOC / {loan.loanNo}</p>
              </div>

              <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-800">
              <p>
                <span className="font-semibold">{company?.companyName ?? "BS FINCORP"}</span> hereby
                declares that the loan availed by the borrower under the following details has been
                <span className="font-semibold"> fully settled and repaid</span> in accordance with
                the agreed repayment schedule. The company raises <span className="font-semibold">no objection</span>{" "}
                to the transfer / sale / hypothecation release of the financed asset.
              </p>

              <div className="print-break-avoid mt-6 overflow-hidden rounded-lg border border-zinc-200">
                <p className="print-section-heading">Borrower &amp; Loan Details</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-2">
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
                      {loan.customer.city ? `, ${loan.customer.city}` : ""}
                      {loan.customer.state ? `, ${loan.customer.state}` : ""}
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
                    <dt className="text-zinc-500">Dealer Name</dt>
                    <dd className="font-semibold text-zinc-900">{loan.vehicle.dealerName || "—"}</dd>
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
                <p className="mt-8 inline-block border-t border-zinc-300 px-6 pt-1 text-xs text-zinc-500">
                  {company?.companyName ?? "BS FINCORP"}
                </p>
              </div>
            </div>
              </div>
          </Card>

          {!reprintReceipt && (
            <>
              <div className="break-before-page hidden w-full print:block">
                <img
                  src="/loan-forms/FORM-35.png"
                  alt="Government Form 35 - Notice of Termination of Agreement of Hire-Purchase / Lease / Hypothecation"
                  className="h-auto w-full"
                />
              </div>
              <div className="break-before-page hidden w-full print:block">
                <img
                  src="/loan-forms/HP_Nirast.png"
                  alt="HP Nirast - Hypothecation cancellation letter"
                  className="h-auto w-full"
                />
              </div>
            </>
          )}

          {reprintReceipt && (
            <>
              <div className="no-print mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Reprint fee recorded</h2>
                  <p className="text-sm text-zinc-500">Receipt {reprintReceipt.receiptNo} generated. Print a copy below.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => window.print()}>
                    <Icon name="print" size={16} /> Print Receipt
                  </Button>
                  <Button variant="secondary" onClick={resetCharge}>
                    Reset
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
                    <p className="print-title text-base">NOC Reprint Receipt</p>
                    <p className="mt-1 font-mono text-sm text-zinc-700">{reprintReceipt.receiptNo}</p>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Date</dt>
                      <dd className="font-medium text-zinc-900">{formatDate(reprintReceipt.paidAt)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Customer</dt>
                      <dd className="font-medium text-zinc-900">{reprintReceipt.customerName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Loan No</dt>
                      <dd className="font-mono text-zinc-900">{reprintReceipt.loanNo}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Mode</dt>
                      <dd className="capitalize text-zinc-900">{reprintReceipt.mode}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Purpose</dt>
                      <dd className="text-zinc-900">NOC Reprint</dd>
                    </div>
                  </dl>
                  <div className="print-total mt-4 flex items-center justify-between rounded-lg px-4 py-3">
                    <span className="text-sm font-semibold">Amount Received</span>
                    <span className="text-xl font-bold">{inr(reprintReceipt.amount)}</span>
                  </div>
                  <div className="mt-8 flex items-end justify-between text-xs text-zinc-500">
                    <span>Received By: _______________</span>
                    <span>Customer Sign: _______________</span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
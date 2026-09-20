"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { Input } from "@/components/form";
import { Icon } from "@/components/icons";
import { downloadExcel } from "@/lib/excel";
import { formatDate, inr } from "@/lib/money";
import type { CustomerWithLoans } from "@/lib/customers";

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerWithLoans[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?all=1&search=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load customers.");
      const data = (await res.json()) as { customers: CustomerWithLoans[] };
      setCustomers(data.customers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "All Customers";
    const t = setTimeout(() => void load(""), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearchChange = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(v), 350);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const rows = customers.flatMap((c) =>
        c.loans.length
          ? c.loans.map((l) => ({
              "Customer": c.name,
              "Mobile": c.mobile,
              "Aadhaar": c.aadhaar ?? "",
              "Father Name": c.fatherName ?? "",
              "Loan No": l.loanNo,
              "Vehicle": l.vehicle,
              "Loan Amount": l.loanAmount,
              "Monthly EMI": l.monthlyEmi,
              "Start Date": formatDate(l.startDate ?? ""),
              "Status": l.status,
              "EMIs Paid": l.paidCount,
              "EMIs Pending": l.pendingCount,
              "EMIs Overdue": l.overdueCount,
            }))
          : [
              {
                "Customer": c.name,
                "Mobile": c.mobile,
                "Aadhaar": c.aadhaar ?? "",
                "Father Name": c.fatherName ?? "",
                "Loan No": "",
                "Vehicle": "",
                "Loan Amount": 0,
                "Monthly EMI": 0,
                "Start Date": "",
                "Status": "no loan",
                "EMIs Paid": 0,
                "EMIs Pending": 0,
                "EMIs Overdue": 0,
              },
            ]
      );
      if (!rows.length) return;
      await downloadExcel("customers", Object.keys(rows[0]), rows);
    } finally {
      setExporting(false);
    }
  };

  const activeCount = customers.filter((c) => c.loans.some((l) => l.status === "active")).length;
  const totalLoans = customers.reduce((n, c) => n + c.loans.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">All Customers</h1>
          <p className="text-sm text-zinc-500">Search, review loan status and export to Excel.</p>
        </div>
        <Button variant="secondary" onClick={onExport} disabled={exporting || customers.length === 0}>
          <Icon name="print" size={16} />
          {exporting ? "Exporting…" : "Export to Excel"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
            <Icon name="search" size={16} />
          </span>
          <Input
            placeholder="Search name, mobile or Aadhaar…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {loading && <span className="text-sm text-zinc-400">Loading…</span>}
        {!loading && !search && (
          <span className="text-xs text-zinc-500">
            {customers.length} customers · {totalLoans} loans · {activeCount} active
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      <Card>
        {customers.length === 0 && !loading ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">
            {search ? "No customers match your search." : "No customers yet. Register the first loan in New Loan."}
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-3 py-2.5 font-medium sm:px-5">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Mobile</th>
                  <th className="px-3 py-2.5 font-medium">Loan No</th>
                  <th className="px-3 py-2.5 font-medium">Vehicle</th>
                  <th className="px-3 py-2.5 text-right font-medium">Loan Amount</th>
                  <th className="px-3 py-2.5 text-center font-medium">EMIs Paid / Pending</th>
                  <th className="px-3 py-2.5 text-center font-medium">Overdue</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium sm:px-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {customers.map((c) => {
                  const latest = c.loans[0];
                  return (
                    <tr
                      key={c._id}
                      onClick={() => router.push(`/customers/${c._id}`)}
                      className="cursor-pointer hover:bg-zinc-50/60"
                    >
                      <td className="px-3 py-3 sm:px-5">
                        <p className="font-medium text-zinc-900">{c.name}</p>
                        <p className="text-[11px] text-zinc-400">{c.aadhaar || "No Aadhaar"}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-zinc-600">{c.mobile}</td>
                      <td className="px-3 py-3 font-mono text-xs text-zinc-500">{latest?.loanNo ?? "—"}</td>
                      <td className="px-3 py-3 text-zinc-600">{latest?.vehicle || "—"}</td>
                      <td className="px-3 py-3 text-right font-medium text-zinc-900">
                        {latest ? inr(latest.loanAmount) : "—"}
                      </td>
                      <td className="px-3 py-3 text-center text-zinc-600">
                        {latest ? `${latest.paidCount} / ${latest.pendingCount}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {latest && latest.overdueCount > 0 ? (
                          <Badge tone="red">{latest.overdueCount}</Badge>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {latest ? (
                          latest.status === "closed" ? (
                            <Badge tone="zinc">Closed</Badge>
                          ) : (
                            <Badge tone="green">Active</Badge>
                          )
                        ) : (
                          <Badge tone="blue">No loan</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right sm:px-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/customers/${c._id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`View ${c.name}`}
                            title="View full details"
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
                          >
                            <Icon name="view" size={14} /> View
                          </Link>
                          <Link
                            href={`/customers/${c._id}?print=1`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Print statement for ${c.name}`}
                            title="Print full statement"
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
                          >
                            <Icon name="print" size={14} /> Print
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
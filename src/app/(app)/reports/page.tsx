"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";
import { downloadExcel } from "@/lib/excel";
import { inr } from "@/lib/money";

type ReportType = "loans-active" | "loans-closed" | "collections";

interface ReportData {
  columns: string[];
  rows: Record<string, string | number>[];
  summary: { count: number; totalAmount: number; totalPenalty?: number };
}

const TYPES: { value: ReportType; label: string }[] = [
  { value: "loans-active", label: "Active Loans" },
  { value: "loans-closed", label: "Closed Loans" },
  { value: "collections", label: "Collections" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>("loans-active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Reports";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, to });
      if (from) params.set("from", from);
      const res = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load report.");
      const json = (await res.json()) as ReportData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [type, from, to]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const onExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await downloadExcel(`report-${type}`, data.columns, data.rows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Reports</h1>
          <p className="text-sm text-zinc-500">Loan and collection reports with Excel export.</p>
        </div>
        <Button variant="secondary" onClick={onExport} disabled={exporting || !data || data.rows.length === 0}>
          <Icon name="print" size={16} />
          {exporting ? "Exporting…" : "Export to Excel"}
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === t.value ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <Card className="p-4">
            <p className="text-xs text-zinc-500">
              {type === "collections" ? "Payments" : "Loans"} in range
            </p>
            <p className="mt-1 text-xl font-bold text-zinc-900">{data.summary.count}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-zinc-500">Total Amount</p>
            <p className="mt-1 truncate text-xl font-bold text-emerald-700">{inr(data.summary.totalAmount)}</p>
          </Card>
          {type === "collections" && (
            <Card className="p-4">
              <p className="text-xs text-zinc-500">Total Penalty</p>
              <p className="mt-1 text-xl font-bold text-red-600">{inr(data.summary.totalPenalty ?? 0)}</p>
            </Card>
          )}
        </div>
      )}

      <Card>
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">Loading report…</p>
        ) : data && data.rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">No records in the selected range.</p>
        ) : data ? (
          <>
            <CardHeader
              title={`${type === "collections" ? "Collection" : "Loan"} detail`}
              subtitle={`${from || "All history"} to ${to}`}
            />
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                    {data.columns.map((c) => (
                      <th key={c} className="px-3 py-2.5 font-medium first:sm:pl-5 last:sm:pr-5">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {data.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50/60">
                      {data.columns.map((c, j) => {
                        const value = row[c];
                        const isMoney = typeof value === "number";
                        return (
                          <td
                            key={c}
                            className={`px-3 py-3 ${j === 0 ? "font-medium text-zinc-900 sm:pl-5" : "text-zinc-600"} ${
                              c === "Status" ? "capitalize" : ""
                            } ${isMoney ? "text-right font-medium text-zinc-900 first:font-normal last:sm:pr-5" : "last:sm:pr-5"}`}
                          >
                            {isMoney ? inr(value) : String(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
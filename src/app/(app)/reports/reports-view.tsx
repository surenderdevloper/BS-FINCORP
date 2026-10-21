"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";
import { downloadExcel } from "@/lib/excel";
import { cachedGet, peekCached, seedCached } from "@/lib/client-fetch";
import { inr } from "@/lib/money";
import type { ReportData, ReportType } from "@/lib/reports";

const TYPES: { value: ReportType; label: string }[] = [
  { value: "loans-active", label: "Active Loans" },
  { value: "loans-closed", label: "Closed Loans" },
  { value: "collections", label: "Collections" },
];

// Columns holding money values (formatted with ₹, right-aligned) vs. plain
// numeric columns that must stay centered and unformatted (e.g. tenure).
const MONEY_COLUMNS = new Set(["Amount", "Principal", "Interest", "Penalty", "Loan Amount", "Monthly EMI"]);
const CENTER_COLUMNS = new Set(["Tenure (months)", "EMIs"]);
const alignClass = (c: string) =>
  MONEY_COLUMNS.has(c) ? "text-right" : CENTER_COLUMNS.has(c) ? "text-center" : "";

export function ReportsView({
  initialData,
  initialRange,
}: {
  initialData: ReportData | null;
  initialRange: { type: ReportType; from: string; to: string };
}) {
  const [type, setType] = useState<ReportType>(initialRange.type);
  const [from, setFrom] = useState(() => initialRange.from);
  const [to, setTo] = useState(() => initialRange.to);
  const [data, setData] = useState<ReportData | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Reports";
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ type, to });
      if (from) params.set("from", from);
      const url = `/api/reports?${params.toString()}`;
      // The server already rendered this exact report into the page — seed the
      // client cache so the fetch below is a cache hit instead of running the
      // same loan/payment queries a second time on every visit.
      if (
        initialData &&
        type === initialRange.type &&
        from === initialRange.from &&
        to === initialRange.to
      ) {
        seedCached(url, initialData);
      }
      // Show the previously loaded report instantly (same tab, same range)
      // while a fresh copy is fetched in the background.
      const cached = peekCached<ReportData>(url);
      // The server already rendered the default report, so keep it on screen
      // instead of flashing a spinner for the one range we already have.
      const alreadyRendered =
        type === initialRange.type && from === initialRange.from && to === initialRange.to;
      if (cached) {
        setData(cached.data);
        setLoading(false);
      } else if (!alreadyRendered || !initialData) {
        setLoading(true);
      }
      const { data } = await cachedGet<ReportData>(url);
      setData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [type, from, to, initialRange, initialData]);

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
                onClick={() => {
                  setType(t.value);
                  // Keep the selected report in the URL so a refresh (or a
                  // copied link) opens the same tab the user picked.
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", t.value);
                  window.history.replaceState(window.history.state, "", url);
                }}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === t.value ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {type === "collections" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="From">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          ) : (
            <p className="max-w-xs text-xs text-zinc-500">
              {type === "loans-active"
                ? "All active loans are listed. The date range applies to Collections."
                : "All closed loans are listed. The date range applies to Collections."}
            </p>
          )}
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
              {type === "collections"
                ? "Payments in range"
                : type === "loans-active"
                  ? "Active loans"
                  : "Closed loans"}
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
          <p className="px-5 py-12 text-center text-sm text-zinc-500">
            {type === "loans-active"
              ? "No active loans."
              : type === "loans-closed"
                ? "No closed loans."
                : "No records in the selected range."}
          </p>
        ) : data ? (
          <>
            <CardHeader
              title={`${type === "collections" ? "Collection" : "Loan"} detail`}
              subtitle={
                type === "loans-active"
                  ? "All active loans"
                  : type === "loans-closed"
                    ? "All closed loans"
                    : `${from || "All history"} to ${to}`
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                    {data.columns.map((c) => (
                      <th
                        key={c}
                        className={`whitespace-nowrap px-3 py-2.5 font-medium first:sm:pl-5 last:sm:pr-5 ${alignClass(c)}`}
                      >
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
                        const isMoney = MONEY_COLUMNS.has(c);
                        return (
                          <td
                            key={c}
                            className={`whitespace-nowrap px-3 py-3 ${j === 0 ? "font-medium text-zinc-900 sm:pl-5" : "text-zinc-600"} ${
                              c === "Status" ? "capitalize" : ""
                            } ${alignClass(c)} ${isMoney ? "font-medium text-zinc-900" : ""} last:sm:pr-5`}
                          >
                            {isMoney ? inr(Number(value) || 0) : String(value)}
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
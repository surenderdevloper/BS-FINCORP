"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, StatCard } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";
import { downloadExcel } from "@/lib/excel";
import { cachedGet, peekCached, seedCached } from "@/lib/client-fetch";
import { inr } from "@/lib/money";
import type { ReportData, ReportType } from "@/lib/reports";
import { isoDateIST } from "@/lib/dates";

const TYPES: { value: ReportType; label: string; icon: "dashboard" | "close" | "cash" | "alert" }[] = [
  { value: "loans-active", label: "Active Loans", icon: "dashboard" },
  { value: "loans-closed", label: "Closed Loans", icon: "close" },
  { value: "collections", label: "Collections", icon: "cash" },
  { value: "penalties", label: "Penalties", icon: "alert" },
];

const MONEY_COLUMNS = new Set(["Amount", "Principal", "Interest", "Penalty", "Loan Amount", "Monthly EMI", "EMI Amount"]);
const CENTER_COLUMNS = new Set(["Tenure (months)", "EMIs", "EMI No", "Days Late", "Status"]);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [penaltyStatusFilter, setPenaltyStatusFilter] = useState<"all" | "pending" | "collected">("all");
  const [onlyWithPenalty, setOnlyWithPenalty] = useState(false);

  useEffect(() => {
    document.title = "Reports • Financial Ledger";
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ type, to });
      if (from) params.set("from", from);
      const url = `/api/reports?${params.toString()}`;

      if (
        initialData &&
        type === initialRange.type &&
        from === initialRange.from &&
        to === initialRange.to
      ) {
        seedCached(url, initialData);
      }

      const cached = peekCached<ReportData>(url);
      const alreadyRendered =
        type === initialRange.type && from === initialRange.from && to === initialRange.to;

      if (cached) {
        setData(cached.data);
        setLoading(false);
      } else if (!alreadyRendered || !initialData) {
        setLoading(true);
      }
      const { data: fetchedData } = await cachedGet<ReportData>(url);
      setData(fetchedData);
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

  // Quick date presets for Collections and Penalties
  const applyQuickPreset = (preset: "today" | "month" | "30days") => {
    const now = new Date();
    const todayStr = isoDateIST(now);
    if (preset === "today") {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(isoDateIST(firstDay));
      setTo(todayStr);
    } else if (preset === "30days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFrom(isoDateIST(thirtyDaysAgo));
      setTo(todayStr);
    }
  };

  // Instant real-time search & filters across table rows
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    let rows = data.rows;

    if (type === "penalties" && penaltyStatusFilter !== "all") {
      rows = rows.filter((r) => {
        const s = String(r["Status"] ?? "").toLowerCase();
        if (penaltyStatusFilter === "pending") return s.includes("pending") || s.includes("due");
        if (penaltyStatusFilter === "collected") return s.includes("collected") || s.includes("paid");
        return true;
      });
    }

    if (type === "collections" && onlyWithPenalty) {
      rows = rows.filter((r) => Number(r["Penalty"] ?? 0) > 0);
    }

    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((row) =>
      Object.values(row).some((val) => String(val ?? "").toLowerCase().includes(q))
    );
  }, [data, searchQuery, type, penaltyStatusFilter, onlyWithPenalty]);

  const onExport = async () => {
    if (!data || filteredRows.length === 0) return;
    setExporting(true);
    try {
      await downloadExcel(`report-${type}`, data.columns, filteredRows);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl">Financial Reports</h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
              Audit Ready
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
            Loan disbursement, recovery breakdown & statement ledger
          </p>
        </div>

        <button
          onClick={onExport}
          disabled={exporting || !data || filteredRows.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:opacity-95 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="print" size={16} />
          {exporting ? "Exporting Excel…" : "Export to Excel"}
        </button>
      </div>

      {/* Filter and Tab Controller Card */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Segmented Tab Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1.5 shadow-xs">
            {TYPES.map((t) => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setType(t.value);
                    const url = new URL(window.location.href);
                    url.searchParams.set("tab", t.value);
                    window.history.replaceState(window.history.state, "", url);
                  }}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all duration-200 sm:text-sm ${
                    active
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20"
                      : "text-zinc-600 hover:bg-white/60 hover:text-zinc-900"
                  }`}
                >
                  <Icon
                    name={t.icon}
                    size={15}
                    className={active ? "text-white" : "text-zinc-400"}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Date Selector for Collections and Penalties */}
          {type === "collections" || type === "penalties" ? (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyQuickPreset("today")}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickPreset("month")}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickPreset("30days")}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                >
                  30 Days
                </button>
              </div>

              {/* Exact Dates */}
              <div className="flex items-center gap-2">
                <div className="w-36">
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <span className="text-xs text-zinc-400 font-medium">to</span>
                <div className="w-36">
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                {type === "loans-active"
                  ? "All active loan accounts currently running"
                  : "All settled and completed loan accounts"}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-xs">
          <Icon name="alert" size={18} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Cards with Gradient Sparklines */}
      {data && !loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {type === "penalties" ? (
            <>
              <StatCard
                label="Total Penalty"
                value={inr(data.summary.totalPenalty ?? 0)}
                icon={<Icon name="alert" />}
                tone="red"
                trend="Incurred"
                trendUp={false}
                sparkline={[14, 20, 28, 35, 42, 55, Math.max(60, data.summary.totalPenalty ?? 0)]}
              />
              <StatCard
                label="Pending / Due"
                value={inr(data.summary.pendingPenalty ?? 0)}
                icon={<Icon name="alert" />}
                tone="amber"
                trend="Unpaid Late Fee"
                trendUp={false}
                sparkline={[10, 15, 22, 30, 38, 48, Math.max(50, data.summary.pendingPenalty ?? 0)]}
              />
              <StatCard
                label="Collected Penalty"
                value={inr(data.summary.collectedPenalty ?? 0)}
                icon={<Icon name="cash" />}
                tone="emerald"
                trend="Recovered"
                trendUp={true}
                sparkline={[8, 14, 20, 26, 34, 45, Math.max(48, data.summary.collectedPenalty ?? 0)]}
              />
              <StatCard
                label="Penalty Cases"
                value={String(data.summary.count)}
                icon={<Icon name="users" />}
                tone="sky"
                trend="Incidents"
                trendUp={true}
                sparkline={[5, 12, 18, 25, 30, 38, Math.max(40, data.summary.count)]}
              />
            </>
          ) : (
            <>
              <StatCard
                label={
                  type === "collections"
                    ? "Total Receipts"
                    : type === "loans-active"
                    ? "Active Loans"
                    : "Closed Loans"
                }
                value={String(data.summary.count)}
                icon={<Icon name={type === "collections" ? "cash" : "dashboard"} />}
                tone={type === "collections" ? "emerald" : type === "loans-active" ? "sky" : "zinc"}
                trend="Count"
                trendUp={true}
                sparkline={[15, 22, 28, 38, 45, 55, Math.max(60, data.summary.count)]}
              />

              <StatCard
                label="Total Amount"
                value={inr(data.summary.totalAmount)}
                icon={<Icon name="cash" />}
                tone="emerald"
                trend={type === "collections" ? "Recovered" : "Portfolio Value"}
                trendUp={true}
                sparkline={[25, 40, 52, 68, 80, 95, 110]}
              />

              {type === "collections" && (
                <StatCard
                  label="Total Penalty"
                  value={inr(data.summary.totalPenalty ?? 0)}
                  icon={<Icon name="alert" />}
                  tone="red"
                  trend={data.summary.totalPenalty ? "Collected" : "Zero"}
                  trendUp={false}
                  sparkline={[12, 10, 14, 8, 11, 7, Math.max(2, (data.summary.totalPenalty ?? 0) > 0 ? 14 : 2)]}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Table Card with Real-time Search and Sub-filters */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 shadow-sm backdrop-blur-sm">
        {/* Table Top Bar */}
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
              {type === "collections"
                ? "Collection Register"
                : type === "penalties"
                ? "Penalty Register & Overdue Tracking"
                : "Loan Portfolio Ledger"}
            </h2>
            <p className="text-xs text-zinc-500">
              {type === "loans-active"
                ? "Showing all active loans"
                : type === "loans-closed"
                ? "Showing all closed/settled loans"
                : type === "penalties"
                ? "Customers with late-fee penalty details (both pending dues & collected penalties)"
                : `Transactions from ${from || "All"} to ${to}`}
            </p>
            {/* Penalty Status Filter Pills */}
            {type === "penalties" && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPenaltyStatusFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    penaltyStatusFilter === "all"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  All ({data?.rows.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setPenaltyStatusFilter("pending")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    penaltyStatusFilter === "pending"
                      ? "bg-red-600 text-white shadow-xs"
                      : "border border-zinc-200 bg-zinc-50 text-red-700 hover:bg-red-50"
                  }`}
                >
                  <Icon name="alert" size={11} />
                  Pending / Due
                </button>
                <button
                  type="button"
                  onClick={() => setPenaltyStatusFilter("collected")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    penaltyStatusFilter === "collected"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "border border-zinc-200 bg-zinc-50 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  <Icon name="check" size={11} />
                  Collected (Paid)
                </button>
              </div>
            )}
            {/* Collections with Penalty quick toggle */}
            {type === "collections" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setOnlyWithPenalty((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    onlyWithPenalty
                      ? "bg-red-600 text-white shadow-xs"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <Icon name="alert" size={12} />
                  Only With Penalty
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Search filter input */}
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Search name, loan no, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="pointer-events-none absolute left-2.5 top-2.5 text-zinc-400">
                <Icon name="reports" size={14} />
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-xs font-bold text-zinc-400 hover:text-zinc-600"
                >
                  ×
                </button>
              )}
            </div>

            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
              {filteredRows.length} {filteredRows.length === 1 ? "Row" : "Rows"}
            </span>
          </div>
        </div>

        {/* Table Body or States */}
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex animate-pulse items-center justify-between rounded-xl bg-zinc-50 p-4">
                <div className="h-4 w-40 rounded bg-zinc-200" />
                <div className="h-4 w-28 rounded bg-zinc-200" />
                <div className="h-4 w-20 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : data && filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <Icon name="reports" size={24} />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-800">No records found</p>
            <p className="mt-1 text-xs text-zinc-500">
              {searchQuery
                ? `No results matching "${searchQuery}". Clear your search.`
                : "No entries exist for the selected criteria."}
            </p>
          </div>
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100/80 bg-zinc-50/70 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                  {data.columns.map((c) => (
                    <th
                      key={c}
                      className={`whitespace-nowrap px-4 py-3.5 first:sm:pl-6 last:sm:pr-6 ${alignClass(c)}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/70">
                {filteredRows.map((row, i) => (
                  <tr
                    key={i}
                    className="transition-colors hover:bg-emerald-50/40"
                  >
                    {data.columns.map((c, j) => {
                      const value = row[c];
                      const isMoney = MONEY_COLUMNS.has(c);
                      const isStatus = c.toLowerCase() === "status";
                      const strVal = String(value ?? "");

                      return (
                        <td
                          key={c}
                          className={`whitespace-nowrap px-4 py-3.5 text-xs sm:text-sm ${
                            j === 0
                              ? "font-semibold text-zinc-900 first:sm:pl-6"
                              : "text-zinc-600"
                          } ${alignClass(c)} ${
                            isMoney ? "font-bold text-zinc-900" : ""
                          } last:sm:pr-6`}
                        >
                          {isStatus ? (
                            <Badge
                              tone={
                                strVal.toLowerCase().includes("pending") || strVal.toLowerCase().includes("due")
                                  ? "red"
                                  : strVal.toLowerCase().includes("collected") || strVal.toLowerCase().includes("paid")
                                  ? "green"
                                  : strVal.toLowerCase() === "active"
                                  ? "green"
                                  : strVal.toLowerCase() === "closed"
                                  ? "blue"
                                  : "zinc"
                              }
                            >
                              {strVal}
                            </Badge>
                          ) : isMoney ? (
                            <span className={c === "Penalty" && Number(value) > 0 ? "font-bold text-red-600" : ""}>
                              {inr(Number(value) || 0)}
                            </span>
                          ) : c === "Loan No" && strVal ? (
                            <a
                              href={`/emi-pay?loan=${encodeURIComponent(strVal)}`}
                              className="font-semibold text-emerald-700 hover:underline"
                              title="Go to EMI Pay"
                            >
                              {strVal}
                            </a>
                          ) : (
                            strVal || "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

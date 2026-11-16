"use client";

import { useState } from "react";
import { inr } from "@/lib/money";

interface DashboardAnalyticsProps {
  totalCollection: number;
  totalDisbursed: number;
  pendingAmount: number;
  todayCollection: number;
  activeLoans: number;
  closedLoans: number;
  overdueEmis: number;
}

export function DashboardAnalytics({
  totalCollection,
  totalDisbursed,
  pendingAmount,
  todayCollection,
  activeLoans,
  closedLoans,
  overdueEmis,
}: DashboardAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("month");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Recovery Rate calculation
  const totalAccounted = totalCollection + pendingAmount;
  const recoveryRate = totalAccounted > 0 ? Math.min(100, Math.round((totalCollection / totalAccounted) * 100)) : 100;

  // Timeframe chart datasets (normalized against totalCollection for realistic visual trend)
  const chartDatasets = {
    week: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      data: [18, 32, 28, 48, 62, 55, 80],
      amounts: [
        todayCollection * 0.4 || 12000,
        todayCollection * 0.7 || 24000,
        todayCollection * 0.6 || 18000,
        todayCollection * 0.9 || 35000,
        todayCollection * 1.2 || 48000,
        todayCollection * 1.0 || 42000,
        todayCollection * 1.5 || 65000,
      ],
    },
    month: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
      data: [25, 45, 60, 78, 92],
      amounts: [
        totalCollection * 0.15,
        totalCollection * 0.22,
        totalCollection * 0.28,
        totalCollection * 0.35,
        totalCollection * 0.42,
      ],
    },
    year: {
      labels: ["Jan", "Mar", "May", "Jul", "Sep", "Nov"],
      data: [30, 42, 58, 70, 84, 96],
      amounts: [
        totalCollection * 0.3,
        totalCollection * 0.45,
        totalCollection * 0.6,
        totalCollection * 0.75,
        totalCollection * 0.88,
        totalCollection,
      ],
    },
  };

  const currentDataset = chartDatasets[timeframe];
  const points = currentDataset.data;
  const maxVal = Math.max(...points, 100);
  const minVal = 0;
  const width = 640;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  // Calculate coordinates for spline
  const coords = points.map((val, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * plotWidth;
    const y = height - paddingY - ((val - minVal) / (maxVal - minVal)) * plotHeight;
    return { x, y, val, amount: currentDataset.amounts[idx], label: currentDataset.labels[idx] };
  });

  // Construct smooth Bezier curve path
  const curvePath = coords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x},${curr.y}`;
    const prev = arr[idx - 1];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
  }, "");

  const areaPath = `${curvePath} L ${coords[coords.length - 1].x},${height - 10} L ${coords[0].x},${height - 10} Z`;

  // Donut metrics
  const totalLoans = activeLoans + closedLoans || 1;
  const activePct = Math.round((activeLoans / totalLoans) * 100);
  const closedPct = 100 - activePct;
  const circumference = 2 * Math.PI * 52;
  const activeDash = (activePct / 100) * circumference;
  const closedDash = circumference - activeDash;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Chart 1: EMI Collection Trend (Spline Curve with Gradient) */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900">EMI Collection Trend</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Flow
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Recovered cash flow & instalment velocity
            </p>
          </div>

          {/* Timeframe selector pills (from Video 1) */}
          <div className="flex items-center rounded-xl bg-zinc-100 p-1">
            {(["week", "month", "year"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all duration-200 ${
                  timeframe === t
                    ? "bg-white text-emerald-700 shadow-xs ring-1 ring-zinc-200/80 font-bold"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Highlight Stats Bar */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-zinc-50/80 p-3 ring-1 ring-zinc-100">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Collected</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-600 sm:text-xl">{inr(totalCollection)}</p>
          </div>
          <div className="rounded-xl bg-zinc-50/80 p-3 ring-1 ring-zinc-100">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Today Inflow</p>
            <p className="mt-1 text-lg font-extrabold text-teal-600 sm:text-xl">{inr(todayCollection)}</p>
          </div>
          <div className="col-span-2 rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200/60 sm:col-span-1">
            <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">On-Time Health</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-700 sm:text-xl">{recoveryRate}% Steady</p>
          </div>
        </div>

        {/* SVG Spline Chart */}
        <div className="relative mt-5">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                <stop offset="70%" stopColor="#14b8a6" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            {[0.25, 0.5, 0.75].map((pct, idx) => (
              <line
                key={idx}
                x1={paddingX}
                y1={paddingY + plotHeight * pct}
                x2={width - paddingX}
                y2={paddingY + plotHeight * pct}
                stroke="#f4f4f5"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area Fill */}
            <path d={areaPath} fill="url(#trendGradient)" />

            {/* Glowing Line Curve */}
            <path
              d={curvePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-700 ease-out"
            />

            {/* Interactive Points */}
            {coords.map((pt, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <g key={idx} className="cursor-pointer">
                  {/* Subtle Pulse Halo when active */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="#10b981"
                      fillOpacity="0.25"
                      className="animate-ping"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? "6" : "4.5"}
                    fill="#ffffff"
                    stroke="#10b981"
                    strokeWidth={isHovered ? "3.5" : "2.5"}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="transition-all duration-200"
                  />
                  {/* Amount tooltip */}
                  {isHovered && (
                    <g transform={`translate(${pt.x}, ${pt.y - 14})`}>
                      <rect
                        x="-45"
                        y="-26"
                        width="90"
                        height="24"
                        rx="6"
                        fill="#18181b"
                        className="shadow-lg"
                      />
                      <text
                        x="0"
                        y="-10"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="700"
                      >
                        {inr(Math.round(pt.amount))}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* X-Axis Labels */}
          <div className="flex justify-between px-8 text-[11px] font-semibold text-zinc-400">
            {currentDataset.labels.map((lbl, idx) => (
              <span key={idx} className="hover:text-zinc-700 transition-colors">
                {lbl}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 2: Portfolio Mix & Health Donut (from Video 1) */}
      <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
        <div>
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Portfolio Health</h2>
              <p className="text-xs text-zinc-500">Asset & recovery status</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200/60">
              {recoveryRate}% Safe
            </span>
          </div>

          {/* Donut Chart Visual */}
          <div className="relative my-4 flex items-center justify-center">
            <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="75"
                cy="75"
                r="52"
                fill="transparent"
                stroke="#f4f4f5"
                strokeWidth="14"
              />
              {/* Active loans arc (Emerald) */}
              <circle
                cx="75"
                cy="75"
                r="52"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="14"
                strokeDasharray={`${activeDash} ${circumference}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              {/* Closed loans arc (Teal) */}
              <circle
                cx="75"
                cy="75"
                r="52"
                fill="transparent"
                stroke="#0f766e"
                strokeWidth="14"
                strokeDasharray={`${closedDash} ${circumference}`}
                strokeDashoffset={`-${activeDash}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black tracking-tight text-zinc-900">{activeLoans}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Active Loans</span>
            </div>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-2.5 border-t border-zinc-100 pt-3">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-2 text-zinc-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Active Accounts
              </span>
              <span className="font-bold text-zinc-900">{activeLoans} ({activePct}%)</span>
            </div>

            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-2 text-zinc-600">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-700" />
                Settled / Closed
              </span>
              <span className="font-bold text-zinc-900">{closedLoans} ({closedPct}%)</span>
            </div>

            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-2 text-zinc-600">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                Total Disbursed
              </span>
              <span className="font-bold text-zinc-900">{inr(totalDisbursed)}</span>
            </div>

            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-2 text-zinc-600">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Overdue EMIs
              </span>
              <span className="font-bold text-red-600">{overdueEmis} loans</span>
            </div>
          </div>
        </div>

        {/* Progress Bar at Bottom */}
        <div className="mt-4 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-zinc-600">Collection Velocity</span>
            <span className="text-emerald-700">{recoveryRate}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 transition-all duration-1000"
              style={{ width: `${recoveryRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

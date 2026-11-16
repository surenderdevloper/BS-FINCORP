import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  secondary:
    "bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-60",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost: "text-zinc-600 hover:bg-zinc-100 disabled:opacity-60",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200/90 bg-white/95 shadow-xs backdrop-blur-xs transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="break-words text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-0.5 break-words text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function Badge({
  tone = "zinc",
  children,
}: {
  tone?: "green" | "red" | "amber" | "blue" | "zinc";
  children: ReactNode;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "emerald",
  sub,
  href,
  trend,
  trendUp = true,
  sparkline,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "emerald" | "red" | "amber" | "sky" | "zinc";
  sub?: string;
  href?: string;
  trend?: string;
  trendUp?: boolean;
  sparkline?: number[];
}) {
  const tones = {
    emerald: {
      bg: "bg-emerald-50 text-emerald-600 ring-emerald-200/60",
      stroke: "#10b981",
      fillStart: "rgba(16, 185, 129, 0.28)",
      trendBg: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    },
    red: {
      bg: "bg-red-50 text-red-600 ring-red-200/60",
      stroke: "#ef4444",
      fillStart: "rgba(239, 68, 68, 0.28)",
      trendBg: "bg-red-50 text-red-700 ring-red-200/60",
    },
    amber: {
      bg: "bg-amber-50 text-amber-600 ring-amber-200/60",
      stroke: "#f59e0b",
      fillStart: "rgba(245, 158, 11, 0.28)",
      trendBg: "bg-amber-50 text-amber-700 ring-amber-200/60",
    },
    sky: {
      bg: "bg-sky-50 text-sky-600 ring-sky-200/60",
      stroke: "#0ea5e9",
      fillStart: "rgba(14, 165, 233, 0.28)",
      trendBg: "bg-sky-50 text-sky-700 ring-sky-200/60",
    },
    zinc: {
      bg: "bg-zinc-100 text-zinc-600 ring-zinc-200/60",
      stroke: "#71717a",
      fillStart: "rgba(113, 113, 122, 0.20)",
      trendBg: "bg-zinc-100 text-zinc-700 ring-zinc-200/60",
    },
  } as const;

  const currentTone = tones[tone];
  const dataPoints = sparkline ?? [28, 42, 35, 52, 48, 68, 62, 85, 78, 96];
  const minVal = Math.min(...dataPoints);
  const maxVal = Math.max(...dataPoints);
  const range = maxVal - minVal || 1;
  const width = 120;
  const height = 30;

  const coords = dataPoints.map((val, idx) => {
    const x = Math.round((idx / (dataPoints.length - 1)) * width);
    const y = Math.round(height - 2 - ((val - minVal) / range) * (height - 8));
    return `${x},${y}`;
  });

  const lineD = `M ${coords.join(" L ")}`;
  const areaD = `M ${coords.join(" L ")} L ${width},${height} L 0,${height} Z`;
  const gradId = `sparkline-grad-${label.replace(/[^a-zA-Z0-9]/g, "")}-${tone}`;

  const content = (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 p-3.5 shadow-sm backdrop-blur-sm transition-all duration-300 sm:p-4 ${
        href ? "cursor-pointer hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:text-xs">
          {label}
        </p>
        <span className={`shrink-0 rounded-xl p-2 shadow-xs ring-1 ${currentTone.bg}`}>
          {icon}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-1.5 gap-y-1">
        <p
          title={value}
          className="whitespace-nowrap text-[17px] sm:text-lg lg:text-xl font-extrabold tracking-tight text-zinc-900 leading-tight"
        >
          {value}
        </p>
        {trend && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
              trendUp ? currentTone.trendBg : "bg-zinc-100 text-zinc-600 ring-zinc-200"
            }`}
          >
            {trendUp ? "↑ " : "↓ "}
            {trend}
          </span>
        )}
      </div>

      {sub && <p className="mt-0.5 text-[11px] font-medium text-zinc-400">{sub}</p>}

      {/* Sparkline Wave Chart at Bottom (Pure SVG, 0 load time) */}
      <div className="mt-3 -mx-3.5 -mb-3.5 overflow-hidden rounded-b-2xl sm:-mx-4 sm:-mb-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-8 w-full transition-transform duration-500 group-hover:scale-105"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentTone.fillStart} />
              <stop offset="100%" stopColor={currentTone.fillStart} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} />
          <path
            d={lineD}
            fill="none"
            stroke={currentTone.stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
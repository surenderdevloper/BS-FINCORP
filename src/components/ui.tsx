import type { ButtonHTMLAttributes, ReactNode } from "react";

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
    <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
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
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {action}
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
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "emerald" | "red" | "amber" | "sky" | "zinc";
  sub?: string;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
    zinc: "bg-zinc-100 text-zinc-600",
  } as const;
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:text-xs sm:normal-case sm:tracking-normal">
          {label}
        </p>
        <span className={`shrink-0 rounded-lg p-1.5 sm:p-2 ${tones[tone]}`}>{icon}</span>
      </div>
      <p
        title={value}
        className="mt-1.5 truncate text-lg font-bold text-zinc-900 sm:mt-2 sm:text-xl"
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
    </Card>
  );
}
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Field({
  label,
  required,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-2 focus:outline-offset-1 focus:outline-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-400";

export function Input({
  className = "",
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${baseInput} ${
        invalid ? "border-red-400 focus:outline-red-500" : "border-zinc-300"
      } ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${baseInput} border-zinc-300 pr-8 ${className}`}
      {...props}
    />
  );
}

export function SectionHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        {step}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  );
}
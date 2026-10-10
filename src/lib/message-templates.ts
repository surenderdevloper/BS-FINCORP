import { inr } from "@/lib/money";

/**
 * Placeholder-based message templates for WhatsApp/SMS. The Developer Console
 * stores template strings containing `{tokens}`; this module renders them with
 * real values. When a template is empty the caller's built-in message is used,
 * so nothing changes until the developer actually customises a template.
 */

function formatMessageDate(d: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

export interface TemplateVars {
  name: string;
  amount: number;
  loan: string;
  date: string | Date;
  brand: string;
  phone?: string;
  receipt?: string;
  totalLoan?: number;
  totalPaid?: number;
  outstanding?: number;
}

export const TEMPLATE_TOKENS = [
  "{name}",
  "{amount}",
  "{loan}",
  "{date}",
  "{brand}",
  "{phone}",
  "{receipt}",
  "{total_loan}",
  "{total_paid}",
  "{outstanding}",
] as const;

/** Replace `{token}` placeholders in a template string with real values. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  const map: Record<string, string> = {
    name: vars.name?.trim() || "ग्राहक",
    amount: inr(vars.amount ?? 0),
    loan: vars.loan?.trim() || "",
    date: formatMessageDate(vars.date),
    brand: vars.brand?.trim() || "",
    phone: vars.phone?.trim() || "",
    receipt: vars.receipt?.trim() || "",
    total_loan: vars.totalLoan != null ? String(vars.totalLoan) : "",
    total_paid: vars.totalPaid != null ? inr(vars.totalPaid) : "",
    outstanding: vars.outstanding != null ? inr(vars.outstanding) : "",
  };
  return template.replace(/\{([a-z_]+)\}/gi, (whole, key: string) => {
    const k = key.toLowerCase();
    return k in map ? map[k] : whole;
  });
}

/**
 * Return the rendered template when one is configured (non-empty), otherwise
 * the caller-provided built-in message. Guarantees identical behaviour when no
 * custom template is set.
 */
export function templateOrBuiltin(
  template: string | null | undefined,
  vars: TemplateVars,
  builtin: string
): string {
  const t = (template ?? "").trim();
  return t ? renderTemplate(t, vars) : builtin;
}

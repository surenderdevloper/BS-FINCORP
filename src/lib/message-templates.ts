import { inr, APP_TIME_ZONE } from "@/lib/money";

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
    timeZone: APP_TIME_ZONE,
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

export const WA_TEMPLATES_META: { key: string; label: string; hint: string }[] = [
  { key: "upcoming", label: "EMI Upcoming Reminder", hint: "Reminder before an EMI is due" },
  { key: "duetoday", label: "EMI Due Today", hint: "On the date when EMI is due" },
  { key: "overdue", label: "EMI Overdue Alert", hint: "After the due date has passed" },
  { key: "payment", label: "Payment Confirmation", hint: "Instant receipt confirmation when payment is recorded" },
  { key: "followupFriendly", label: "Follow-up (Friendly)", hint: "Polite reminder for overdue collection" },
  { key: "followupStatus", label: "Follow-up (Ask Date)", hint: "Asks customer when they can pay" },
  { key: "followupContact", label: "Follow-up (Call Office)", hint: "Invites customer to call the office" },
  { key: "statement", label: "Account Statement", hint: "Summary of customer's active loans and outstanding dues" },
  { key: "chat", label: "Direct Chat Greeting", hint: "Standard initial greeting when opening WhatsApp chat" },
];

export const SMS_TEMPLATES_META: { key: string; label: string; hint: string }[] = [
  { key: "upcoming", label: "EMI Upcoming Reminder (SMS)", hint: "SMS reminder sent before an installment is due" },
  { key: "overdue", label: "EMI Overdue Reminder (SMS)", hint: "SMS reminder sent after an installment is past due" },
];

/** Replace `{token}` placeholders in a template string with real values. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  const brand = vars.brand?.trim() || "";
  const defaultPhone = brand.toUpperCase().includes("BS FINCORP") ? "9828295643, 8890732992" : "";
  const phone = vars.phone?.trim() || defaultPhone;
  const map: Record<string, string> = {
    name: vars.name?.trim() || "ग्राहक",
    amount: inr(vars.amount ?? 0),
    loan: vars.loan?.trim() || "",
    date: formatMessageDate(vars.date),
    brand,
    phone,
    receipt: vars.receipt?.trim() || "",
    total_loan: vars.totalLoan != null ? String(vars.totalLoan) : "",
    total_paid: vars.totalPaid != null ? inr(vars.totalPaid) : "",
    outstanding: vars.outstanding != null ? inr(vars.outstanding) : "",
  };
  let rendered = template.replace(/\{([a-z_]+)\}/gi, (whole, key: string) => {
    const k = key.toLowerCase();
    return k in map ? map[k] : whole;
  });

  // If message includes brand signoff (e.g. "- BS FINCORP") but didn't include the contact number:
  if (
    phone &&
    rendered.toUpperCase().includes("BS FINCORP") &&
    !rendered.toLowerCase().includes("contact") &&
    !rendered.includes(phone)
  ) {
    rendered = rendered.replace(/(-?\s*BS\s*FINCORP)/i, `$1\nContact: ${phone}`);
  }

  return rendered;
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

import { inr } from "@/lib/money";
import { normalizeMobile } from "@/lib/sms";

export const WHATSAPP_BRANDING = "BS FINCORP";

/**
 * Normalize a stored customer mobile number into the international form
 * WhatsApp click-to-chat expects: country code + national number, digits only,
 * no spaces, brackets or leading "+".
 *
 * The application only stores Indian mobile numbers (10 digits, starting 6-9),
 * so a valid number is prefixed with the 91 country code. Returns null when the
 * number is missing or structurally invalid, so callers never build a link to a
 * wrong recipient.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const national = normalizeMobile(raw);
  return national ? `91${national}` : null;
}

/** Format a date for message text as DD/MM/YYYY. */
export function formatMessageDate(d: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

/**
 * Build a WhatsApp click-to-chat URL for a recipient in international format.
 * The message is URL-encoded; an empty message yields a bare chat link.
 */
export function buildWhatsAppUrl(number: string, message: string): string {
  const digits = number.replace(/\D/g, "");
  const body = message.trim();
  return body ? `https://wa.me/${digits}?text=${encodeURIComponent(body)}` : `https://wa.me/${digits}`;
}

function branding(name?: string): string {
  return name?.trim() || WHATSAPP_BRANDING;
}

function customerName(name?: string): string {
  return name?.trim() || "ग्राहक";
}

export type WaReminderKind = "upcoming" | "duetoday" | "overdue";

export interface WaEmiReminderInput {
  customerName: string;
  loanNo: string;
  amount: number;
  dueDate: string;
  brandingName?: string;
}

/** Hindi EMI reminder for an upcoming, due-today or overdue installment. */
export function buildEmiReminderMessage(kind: WaReminderKind, input: WaEmiReminderInput): string {
  const name = customerName(input.customerName);
  const amount = inr(input.amount);
  const date = formatMessageDate(input.dueDate);
  const b = branding(input.brandingName);
  const loan = input.loanNo.trim();

  if (kind === "upcoming") {
    return [
      `नमस्ते ${name} जी,`,
      `आपके लोन ${loan} की EMI ${amount} दिनांक ${date} को देय है।`,
      `कृपया समय पर भुगतान करें।`,
      ``,
      `- ${b}`,
    ].join("\n");
  }
  if (kind === "duetoday") {
    return [
      `नमस्ते ${name} जी,`,
      `आपके लोन ${loan} की EMI ${amount} आज दिनांक ${date} को देय है।`,
      `कृपया आज ही भुगतान करें।`,
      ``,
      `- ${b}`,
    ].join("\n");
  }
  return [
    `नमस्ते ${name} जी,`,
    `आपके लोन ${loan} की EMI ${amount} दिनांक ${date} को देय थी, जो अब बकाया है।`,
    `कृपया शीघ्र भुगतान करें।`,
    ``,
    `- ${b}`,
  ].join("\n");
}

export interface WaPaymentInput {
  customerName: string;
  amount: number;
  paidAt: string;
  receiptNo?: string;
  loanNo?: string;
  brandingName?: string;
}

/**
 * Payment confirmation message. Only call this once a payment has actually been
 * saved, so the customer is never told about a payment that was not recorded.
 */
export function buildPaymentConfirmationMessage(input: WaPaymentInput): string {
  const name = customerName(input.customerName);
  const amount = inr(input.amount);
  const date = formatMessageDate(input.paidAt);
  const b = branding(input.brandingName);

  const lines = [
    `नमस्ते ${name} जी,`,
    `आपका ${amount} का भुगतान दिनांक ${date} को प्राप्त हो गया है।`,
  ];
  if (input.receiptNo?.trim()) lines.push(`रसीद संख्या: ${input.receiptNo.trim()}`);
  if (input.loanNo?.trim()) lines.push(`लोन नंबर: ${input.loanNo.trim()}`);
  lines.push("", `धन्यवाद,`, `- ${b}`);
  return lines.join("\n");
}

export type WaFollowUpKind = "friendly" | "status" | "contact_office";

export interface WaFollowUpInput {
  customerName: string;
  loanNo: string;
  amount: number;
  officePhone?: string;
  brandingName?: string;
}

/** Professional, non-threatening collection follow-up message. */
export function buildCollectionFollowUpMessage(kind: WaFollowUpKind, input: WaFollowUpInput): string {
  const name = customerName(input.customerName);
  const amount = inr(input.amount);
  const loan = input.loanNo.trim();
  const b = branding(input.brandingName);

  if (kind === "status") {
    return [
      `नमस्ते ${name} जी,`,
      `कृपया बताएं कि आपके लोन ${loan} की बकाया EMI (${amount}) का भुगतान आप किस तिथि तक कर पाएंगे।`,
      `आपकी जानकारी के लिए धन्यवाद।`,
      ``,
      `- ${b}`,
    ].join("\n");
  }
  if (kind === "contact_office") {
    const phone = input.officePhone?.trim();
    return [
      `नमस्ते ${name} जी,`,
      `आपके लोन ${loan} की बकाया EMI (${amount}) के संबंध में कृपया कार्यालय से संपर्क करें${phone ? ` (${phone})` : ""}।`,
      `आपके सहयोग के लिए धन्यवाद।`,
      ``,
      `- ${b}`,
    ].join("\n");
  }
  return [
    `नमस्ते ${name} जी,`,
    `यह आपके लोन ${loan} की बकाया EMI (${amount}) के बारे में एक विनम्र अनुस्मारक है।`,
    `कृपया सुविधानुसार शीघ्र भुगतान करें।`,
    ``,
    `- ${b}`,
  ].join("\n");
}

export interface WaStatementInput {
  customerName: string;
  loanCount: number;
  totalPaid: number;
  outstanding: number;
  brandingName?: string;
}

/** Short account summary used when sharing a customer's statement. */
export function buildStatementMessage(input: WaStatementInput): string {
  const name = customerName(input.customerName);
  const b = branding(input.brandingName);
  return [
    `नमस्ते ${name} जी,`,
    `आपके खाते का संक्षिप्त विवरण:`,
    `कुल लोन: ${input.loanCount}`,
    `कुल जमा: ${inr(input.totalPaid)}`,
    `बकाया राशि: ${inr(input.outstanding)}`,
    `पूरा स्टेटमेंट हम अलग से भेज रहे हैं।`,
    ``,
    `- ${b}`,
  ].join("\n");
}

/** Default greeting used when opening a direct chat from a customer profile. */
export function buildCustomChatMessage(name?: string, brandingName?: string): string {
  return [`नमस्ते ${customerName(name)} जी,`, ``, `- ${branding(brandingName)}`].join("\n");
}

import { inr } from "@/lib/money";
import { isValidMobile } from "@/lib/validators";

export type SmsReminderType = "upcoming" | "overdue";

export interface SmsMessageInput {
  customerName: string;
  loanNo: string;
  amount: number;
  dueDate: string;
  brandingName?: string;
}

export const SMS_BRANDING = "BS FINCORP";

/**
 * Normalize an Indian mobile number to a 10-digit national number.
 * Accepts plain digits, a leading 0, or a +91/91 prefix. Returns null when
 * the number is missing or not structurally valid (10 digits, starts 6-9).
 */
export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  let national: string | null = null;
  if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("91")) national = digits.slice(2);
  if (national && isValidMobile(national)) return national;
  return null;
}

/** Format a due date as a compact numeric date (DD/MM/YYYY) for SMS. */
function formatSmsDate(d: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

export function buildSmsMessage(type: SmsReminderType, input: SmsMessageInput): string {
  const name = input.customerName.trim() || "ग्राहक";
  const amount = inr(input.amount);
  const date = formatSmsDate(input.dueDate);
  const brand = input.brandingName?.trim() || SMS_BRANDING;
  const loan = input.loanNo.trim();
  if (type === "upcoming") {
    return [
      `नमस्ते ${name} जी,`,
      `आपके लोन ${loan} की EMI ${amount} दिनांक ${date} को देय है।`,
      `कृपया समय पर भुगतान करें।`,
      ``,
      `- ${brand}`,
    ].join("\n");
  }
  return [
    `नमस्ते ${name} जी,`,
    `आपके लोन ${loan} की EMI ${amount} दिनांक ${date} को देय थी, जो अब बकाया है।`,
    `कृपया शीघ्र भुगतान करें।`,
    ``,
    `- ${brand}`,
  ].join("\n");
}

export interface SmsParts {
  /** Unicode (UCS-2, 70 chars) when any non-ASCII character is present, else GSM-7 (160 chars). */
  encoding: "gsm7" | "unicode";
  length: number;
  /** Number of SMS segments the message will be split into. */
  parts: number;
  /** Characters allowed per segment (single vs. concatenated). */
  perPart: number;
}

/**
 * Estimate how many SMS segments a message needs. Hindi (Devanagari) and the
 * rupee sign are outside GSM-7, so any message we generate is treated as
 * UCS-2: 70 chars for one SMS, 67 per part when concatenated.
 */
export function countSmsParts(message: string): SmsParts {
  const length = message.length;
  const unicode = /[^\u0000-\u007F]/.test(message);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const parts = length <= single ? 1 : Math.ceil(length / multi);
  return {
    encoding: unicode ? "unicode" : "gsm7",
    length,
    parts,
    perPart: parts === 1 ? single : multi,
  };
}

export type SmsTarget = "ios" | "android" | "other";

export function detectSmsTarget(): SmsTarget {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/**
 * Build an `sms:` URL that opens the native messaging app with the recipient
 * and message prefilled, where the device supports it.
 *
 * Body prefill behaviour differs between platforms:
 * - iOS Safari only honours the body when the parameter follows "&".
 * - Android accepts the RFC-style "?" separator (and also "&").
 *
 * The number is sent in E.164 form (+91) which both platforms resolve.
 */
export function buildSmsUrl(mobileDigits: string, message: string, target: SmsTarget): string {
  const separator = target === "ios" ? "&" : "?";
  return `sms:+91${mobileDigits}${separator}body=${encodeURIComponent(message)}`;
}

/**
 * Same as buildSmsUrl but with the other separator. Some devices/browsers
 * ignore their "usual" parameter separator, so this alternate link is offered
 * as a manual fallback when prefill does not appear.
 */
export function buildSmsUrlAlt(mobileDigits: string, message: string, target: SmsTarget): string {
  const separator = target === "ios" ? "?" : "&";
  return `sms:+91${mobileDigits}${separator}body=${encodeURIComponent(message)}`;
}
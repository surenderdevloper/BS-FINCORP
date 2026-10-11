export const SESSION_COOKIE = "bs_fincorp_session";

/**
 * All dates/times are displayed in India Standard Time, regardless of the
 * server's timezone (Vercel runs in UTC). Without this, server-rendered times
 * (receipts, statements) would be shown 5:30 behind local time and could even
 * fall on the wrong calendar day.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const inrCents = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(n);

export const asNumber = (n: number) =>
  new Intl.NumberFormat("en-IN").format(n);

export const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(d));

export const formatDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(d));
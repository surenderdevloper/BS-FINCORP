export const SESSION_COOKIE = "bs_fincorp_session";

/**
 * All dates/times are displayed in India Standard Time by default, regardless of the
 * server's timezone (Vercel runs in UTC). Without this, server-rendered times
 * (receipts, statements) would be shown 5:30 behind local time and could even
 * fall on the wrong calendar day.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";

/**
 * Format an amount in the tenant's chosen currency.
 * Defaults to INR (₹) with Indian digit grouping (e.g. ₹1,00,000) for all existing accounts.
 * For international accounts, formats in the target currency (e.g. KES, $, ₦, ₱, AED).
 */
export const formatCurrency = (
  n: number,
  currency: string = "INR",
  currencySymbol?: string,
  locale?: string
): string => {
  const code = (currency || "INR").trim().toUpperCase();
  const loc =
    locale ||
    (code === "INR" ? "en-IN" : code === "USD" ? "en-US" : code === "GBP" ? "en-GB" : "en-US");
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    const symbol = currencySymbol || code;
    const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
    return `${symbol} ${formatted}`;
  }
};

/** Default currency formatter for backward compatibility (always INR ₹). */
export const inr = (n: number) => formatCurrency(n, "INR", "₹", "en-IN");

export const inrCents = (n: number, currency: string = "INR") => {
  const code = (currency || "INR").trim().toUpperCase();
  const loc = code === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: code,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
};

export const asNumber = (n: number) =>
  new Intl.NumberFormat("en-IN").format(n);

export const formatDate = (d: string | Date, timeZone: string = APP_TIME_ZONE) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(d));

export const formatDateTime = (d: string | Date, timeZone: string = APP_TIME_ZONE) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(d));
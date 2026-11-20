"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatCurrency } from "@/lib/money";

export interface CurrencyConfig {
  currency: string;
  currencySymbol: string;
  phoneDialCode: string;
  countryCode: string;
}

export interface CurrencyContextValue extends CurrencyConfig {
  formatMoney: (n: number) => string;
}

export const DEFAULT_CURRENCY: CurrencyConfig = {
  currency: "INR",
  currencySymbol: "₹",
  phoneDialCode: "91",
  countryCode: "IN",
};

const CurrencyContext = createContext<CurrencyContextValue>({
  ...DEFAULT_CURRENCY,
  formatMoney: (n: number) => formatCurrency(n, "INR", "₹", "en-IN"),
});

export function CurrencyProvider({
  currency = "INR",
  currencySymbol = "₹",
  phoneDialCode = "91",
  countryCode = "IN",
  children,
}: {
  currency?: string;
  currencySymbol?: string;
  phoneDialCode?: string;
  countryCode?: string;
  children: ReactNode;
}) {
  const value = useMemo<CurrencyContextValue>(() => {
    const cur = currency || "INR";
    const sym = currencySymbol || (cur === "INR" ? "₹" : cur);
    const dial = phoneDialCode ? phoneDialCode.replace(/\D/g, "") || "91" : "91";
    const country = countryCode || (dial === "91" ? "IN" : "GLOBAL");
    return {
      currency: cur,
      currencySymbol: sym,
      phoneDialCode: dial,
      countryCode: country,
      formatMoney: (n: number) => formatCurrency(n, cur, sym),
    };
  }, [currency, currencySymbol, phoneDialCode, countryCode]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}

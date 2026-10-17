import { getCompanySetting } from "@/models/CompanySetting";
import { getPenaltyRuleObj } from "@/models/PenaltyRule";

/** Company settings in the same shape the /api/settings GET returns. */
export interface CompanySettingsData {
  companyName: string;
  address: string;
  gst: string;
  phone: string;
  email: string;
  logo: string;
  receiptPrefix: string;
  nextReceiptNo: number;
  loanPrefix: string;
  nextLoanNo: number;
}

export interface PenaltySettingsData {
  enabled: boolean;
  graceDays: number;
  penaltyType: "fixed" | "percentage";
  penaltyPerDay: number;
  maxPenaltyAmount: number | null;
}

export interface SettingsSnapshot {
  company: CompanySettingsData;
  penalty: PenaltySettingsData;
}

/**
 * Read company + penalty settings for the active tenant in one shot.
 *
 * Used by the /api/settings route and by the Settings / Penalty Rules server
 * pages, so the forms render with real values in the first paint instead of
 * waiting on a client-side fetch.
 */
export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const [company, penalty] = await Promise.all([getCompanySetting(), getPenaltyRuleObj()]);
  return {
    company: {
      companyName: company.companyName,
      address: company.address,
      gst: company.gst,
      phone: company.phone,
      email: company.email,
      logo: company.logo ?? "",
      receiptPrefix: company.receiptPrefix,
      nextReceiptNo: company.nextReceiptNo,
      loanPrefix: company.loanPrefix,
      nextLoanNo: company.nextLoanNo,
    },
    penalty: {
      enabled: penalty?.enabled ?? true,
      graceDays: penalty?.graceDays ?? 3,
      penaltyType: penalty?.penaltyType ?? "fixed",
      penaltyPerDay: penalty?.penaltyPerDay ?? 10,
      maxPenaltyAmount: penalty?.maxPenaltyAmount ?? null,
    },
  };
}

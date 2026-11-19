import { getCompanySetting } from "@/models/CompanySetting";
import { getPenaltyRuleObj } from "@/models/PenaltyRule";
import { getAppConfig } from "@/models/AppConfig";
import { getDefaultMessageTemplates } from "@/lib/message-config";

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

export interface MessagesSettingsData {
  waTemplates: Record<string, string>;
  smsTemplates: Record<string, string>;
  defaults: {
    waTemplates: Record<string, string>;
    smsTemplates: Record<string, string>;
  };
}

export interface SettingsSnapshot {
  company: CompanySettingsData;
  penalty: PenaltySettingsData;
  messages: MessagesSettingsData;
}

/**
 * Read company + penalty + message settings for the active tenant in one shot.
 *
 * Used by the /api/settings route and by the Settings / Penalty Rules server
 * pages, so the forms render with real values in the first paint instead of
 * waiting on a client-side fetch.
 */
export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const [company, penalty, config] = await Promise.all([
    getCompanySetting(),
    getPenaltyRuleObj(),
    getAppConfig(),
  ]);

  const brand = company.companyName || "Gigabyte Finance Manager";
  const defaults = getDefaultMessageTemplates(brand, company.phone || "");

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
    messages: {
      waTemplates: {
        upcoming: config.waTemplates?.upcoming ?? "",
        duetoday: config.waTemplates?.duetoday ?? "",
        overdue: config.waTemplates?.overdue ?? "",
        payment: config.waTemplates?.payment ?? "",
        followupFriendly: config.waTemplates?.followupFriendly ?? "",
        followupStatus: config.waTemplates?.followupStatus ?? "",
        followupContact: config.waTemplates?.followupContact ?? "",
        statement: config.waTemplates?.statement ?? "",
        chat: config.waTemplates?.chat ?? "",
      },
      smsTemplates: {
        upcoming: config.smsTemplates?.upcoming ?? "",
        overdue: config.smsTemplates?.overdue ?? "",
      },
      defaults,
    },
  };
}

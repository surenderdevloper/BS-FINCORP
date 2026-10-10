import { dbConnect } from "@/lib/db";
import { getAppConfig } from "@/models/AppConfig";
import { getCompanySetting } from "@/models/CompanySetting";
import { SMS_BRANDING } from "@/lib/sms";
import { WHATSAPP_BRANDING } from "@/lib/whatsapp";

/**
 * Server-side message configuration for the WhatsApp/SMS composers. Resolves
 * the company branding plus any developer-defined templates. Every template is
 * an empty string by default, which makes the composers fall back to their
 * built-in messages (identical to the original behaviour). Never throws.
 */
export interface MessageSettings {
  brand: string;
  officePhone: string;
  wa: {
    upcoming: string;
    duetoday: string;
    overdue: string;
    payment: string;
    followupFriendly: string;
    followupStatus: string;
    followupContact: string;
    statement: string;
    chat: string;
  };
  sms: { upcoming: string; overdue: string };
}

const EMPTY: MessageSettings = {
  brand: WHATSAPP_BRANDING || SMS_BRANDING,
  officePhone: "",
  wa: {
    upcoming: "",
    duetoday: "",
    overdue: "",
    payment: "",
    followupFriendly: "",
    followupStatus: "",
    followupContact: "",
    statement: "",
    chat: "",
  },
  sms: { upcoming: "", overdue: "" },
};

export async function getMessageSettings(): Promise<MessageSettings> {
  try {
    await dbConnect();
    const [config, company] = await Promise.all([getAppConfig(), getCompanySetting()]);
    return {
      brand: company.companyName?.trim() || WHATSAPP_BRANDING || SMS_BRANDING,
      officePhone: company.phone?.trim() || "",
      wa: {
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
      sms: {
        upcoming: config.smsTemplates?.upcoming ?? "",
        overdue: config.smsTemplates?.overdue ?? "",
      },
    };
  } catch {
    return EMPTY;
  }
}

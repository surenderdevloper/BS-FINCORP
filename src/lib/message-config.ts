import { dbConnect } from "@/lib/db";
import { getAppConfig } from "@/models/AppConfig";
import { getCompanySetting } from "@/models/CompanySetting";
import { SMS_BRANDING, buildSmsMessage } from "@/lib/sms";
import {
  WHATSAPP_BRANDING,
  buildCollectionFollowUpMessage,
  buildCustomChatMessage,
  buildEmiReminderMessage,
  buildPaymentConfirmationMessage,
  buildStatementMessage,
} from "@/lib/whatsapp";

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

export { WA_TEMPLATES_META, SMS_TEMPLATES_META } from "@/lib/message-templates";

export function getDefaultMessageTemplates(brand: string, officePhone: string = "") {
  const today = new Date();
  const sampleLoan = "GFM-0001";
  const sampleAmount = 4917;

  return {
    waTemplates: {
      upcoming: buildEmiReminderMessage("upcoming", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        dueDate: today.toISOString(),
        brandingName: brand,
      }),
      duetoday: buildEmiReminderMessage("duetoday", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        dueDate: today.toISOString(),
        brandingName: brand,
      }),
      overdue: buildEmiReminderMessage("overdue", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        dueDate: today.toISOString(),
        brandingName: brand,
      }),
      payment: buildPaymentConfirmationMessage({
        customerName: "Ramesh Kumar",
        amount: sampleAmount,
        paidAt: today.toISOString(),
        receiptNo: "RCPT-0001",
        loanNo: sampleLoan,
        brandingName: brand,
      }),
      followupFriendly: buildCollectionFollowUpMessage("friendly", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        officePhone,
        brandingName: brand,
      }),
      followupStatus: buildCollectionFollowUpMessage("status", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        officePhone,
        brandingName: brand,
      }),
      followupContact: buildCollectionFollowUpMessage("contact_office", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        officePhone,
        brandingName: brand,
      }),
      statement: buildStatementMessage({
        customerName: "Ramesh Kumar",
        loanCount: 2,
        totalPaid: 20000,
        outstanding: 15000,
        brandingName: brand,
      }),
      chat: buildCustomChatMessage("Ramesh Kumar", brand),
    },
    smsTemplates: {
      upcoming: buildSmsMessage("upcoming", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        dueDate: today.toISOString(),
        brandingName: brand,
      }),
      overdue: buildSmsMessage("overdue", {
        customerName: "Ramesh Kumar",
        loanNo: sampleLoan,
        amount: sampleAmount,
        dueDate: today.toISOString(),
        brandingName: brand,
      }),
    },
  };
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

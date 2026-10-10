import type { Metadata } from "next";
import { getAppConfig } from "@/models/AppConfig";
import { getMessageSettings } from "@/lib/message-config";
import { EmiPayForm } from "./emi-pay-form";

export const metadata: Metadata = { title: "EMI Pay" };

export const dynamic = "force-dynamic";

export default async function EmiPayPage({ searchParams }: { searchParams: Promise<{ loan?: string }> }) {
  const { loan } = await searchParams;
  const [config, msgs] = await Promise.all([getAppConfig(), getMessageSettings()]);
  const docs = config.documents;
  return (
    <EmiPayForm
      preselectedLoan={loan}
      paymentTemplate={msgs.wa.payment}
      documents={{
        receiptTitle: docs.receiptTitle,
        receiptFooterNote: docs.receiptFooterNote,
        signOffReceived: docs.signOffReceived,
        signOffCustomer: docs.signOffCustomer,
        showGstOnReceipt: docs.showGstOnReceipt,
        showLogoOnPrint: docs.showLogoOnPrint,
        printLogo: config.printLogo,
      }}
    />
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { getPaymentReceipt } from "@/lib/customers";
import { getCompanySetting } from "@/models/CompanySetting";
import { getAppConfig } from "@/models/AppConfig";
import { getMessageSettings } from "@/lib/message-config";
import { Customer } from "@/models/Customer";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { buildPaymentConfirmationMessage } from "@/lib/whatsapp";
import { inr, formatDate } from "@/lib/money";
import { ReceiptActions } from "./receipt-actions";

export const metadata: Metadata = { title: "Payment Receipt" };

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;

  await dbConnect();
  const [payment, company, config, msgs] = await Promise.all([
    getPaymentReceipt(paymentId, id),
    getCompanySetting(),
    getAppConfig(),
    getMessageSettings(),
  ]);
  if (!payment) notFound();

  const docs = config.documents;

  const customer =
    Types.ObjectId.isValid(id)
      ? await Customer.findById(id).select("mobile name").lean()
      : null;

  const emiTotal = payment.principal + payment.interest;
  const customerName = payment.customerName?.trim() || "—";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/customers/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          <Icon name="arrowLeft" size={16} /> Back to Customer
        </Link>
        <div className="no-print flex flex-wrap items-center gap-2">
          <WhatsAppShare
            recipientName={customerName}
            mobile={customer?.mobile ?? ""}
            title="Share Receipt"
            subtitle={`Receipt ${payment.receiptNo} · Loan ${payment.loanNo}`}
            triggerVariant="secondary"
            triggerLabel="Share on WhatsApp"
            templates={[
              {
                key: "receipt",
                label: "Receipt summary",
                message: buildPaymentConfirmationMessage(
                  {
                    customerName: customerName === "—" ? "" : customerName,
                    amount: payment.amount,
                    paidAt: payment.paidAt,
                    receiptNo: payment.receiptNo,
                    loanNo: payment.loanNo,
                    brandingName: msgs.brand || company.companyName,
                  },
                  msgs.wa.payment
                ),
              },
            ]}
          />
          <ReceiptActions />
        </div>
      </div>

      <Card className="print-doc mx-auto max-w-md overflow-hidden p-0">
        <div className="print-letterhead px-5 pb-5 pt-6 text-center sm:px-6">
          {docs.showLogoOnPrint && config.printLogo ? (
            <img src={config.printLogo} alt="" className="print-logo mx-auto mb-2" />
          ) : null}
          <p className="print-letterhead-name break-words">{company.companyName || "BS FINCORP"}</p>
          {company.address && (
            <p className="print-letterhead-detail mt-1 break-words text-xs">{company.address}</p>
          )}
          {(company.phone || company.email || (docs.showGstOnReceipt && company.gst)) && (
            <div className="print-letterhead-detail mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs">
              {company.phone && <span>Ph: {company.phone}</span>}
              {company.email && <span className="break-all">{company.email}</span>}
              {docs.showGstOnReceipt && company.gst && <span className="break-all">GST: {company.gst}</span>}
            </div>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="text-center">
            <p className="print-title text-base">{docs.receiptTitle || "Payment Receipt"}</p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-700">{payment.receiptNo}</p>
            {docs.receiptHeaderNote && (
              <p className="mt-1 text-[11px] italic text-zinc-500">{docs.receiptHeaderNote}</p>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Date</dt>
              <dd className="text-right font-medium text-zinc-900">{formatDate(payment.paidAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Customer</dt>
              <dd className="min-w-0 break-words text-right font-medium text-zinc-900">{customerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Loan No</dt>
              <dd className="text-right font-mono text-zinc-900">{payment.loanNo}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">EMIs</dt>
              <dd className="text-right text-zinc-900">{payment.paidCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Mode</dt>
              <dd className="text-right capitalize text-zinc-900">{payment.mode}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">EMI Total</dt>
              <dd className="text-right text-zinc-900">{inr(emiTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Penalty</dt>
              <dd className="text-right text-zinc-800">{inr(payment.penalty)}</dd>
            </div>
            {payment.discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Discount</dt>
                <dd className="text-right text-zinc-800">-{inr(payment.discount)}</dd>
              </div>
            )}
            {payment.advanceUsed > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Advance Used</dt>
                <dd className="text-right text-zinc-800">-{inr(payment.advanceUsed)}</dd>
              </div>
            )}
            {payment.advanceAdded > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Advance Saved</dt>
                <dd className="text-right text-zinc-800">{inr(payment.advanceAdded)}</dd>
              </div>
            )}
          </dl>

          <div className="print-total mt-4 flex items-center justify-between gap-3 rounded-lg px-4 py-3">
            <span className="text-sm font-semibold">Amount Received</span>
            <span className="text-xl font-bold">{inr(payment.amount)}</span>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span className="break-all">
              {docs.signOffReceived || "Received By"}: {payment.receivedBy?.trim() || "_______________"}
            </span>
            <span className="break-all">{docs.signOffCustomer || "Customer Sign"}: _______________</span>
          </div>

          {docs.receiptFooterNote && (
            <p className="mt-4 text-center text-[11px] italic text-zinc-500">{docs.receiptFooterNote}</p>
          )}
        </div>
      </Card>
    </div>
  );
}

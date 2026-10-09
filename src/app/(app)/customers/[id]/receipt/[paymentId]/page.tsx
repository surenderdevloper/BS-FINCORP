import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { getPaymentReceipt } from "@/lib/customers";
import { getCompanySetting } from "@/models/CompanySetting";
import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";
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
  const [payment, company] = await Promise.all([
    getPaymentReceipt(paymentId, id),
    getCompanySetting(),
  ]);
  if (!payment) notFound();

  const emiTotal = payment.principal + payment.interest;
  const customer = payment.customerName?.trim() || "—";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/customers/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          <Icon name="arrowLeft" size={16} /> Back to Customer
        </Link>
        <ReceiptActions />
      </div>

      <Card className="print-doc mx-auto max-w-md overflow-hidden p-0">
        <div className="print-letterhead px-5 pb-5 pt-6 text-center sm:px-6">
          <p className="print-letterhead-name break-words">{company.companyName || "BS FINCORP"}</p>
          {company.address && (
            <p className="print-letterhead-detail mt-1 break-words text-xs">{company.address}</p>
          )}
          {(company.phone || company.email || company.gst) && (
            <div className="print-letterhead-detail mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs">
              {company.phone && <span>Ph: {company.phone}</span>}
              {company.email && <span className="break-all">{company.email}</span>}
              {company.gst && <span className="break-all">GST: {company.gst}</span>}
            </div>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="text-center">
            <p className="print-title text-base">Payment Receipt</p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-700">{payment.receiptNo}</p>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Date</dt>
              <dd className="text-right font-medium text-zinc-900">{formatDate(payment.paidAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Customer</dt>
              <dd className="min-w-0 break-words text-right font-medium text-zinc-900">{customer}</dd>
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
          </dl>

          <div className="print-total mt-4 flex items-center justify-between gap-3 rounded-lg px-4 py-3">
            <span className="text-sm font-semibold">Amount Received</span>
            <span className="text-xl font-bold">{inr(payment.amount)}</span>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span className="break-all">Received By: {payment.receivedBy?.trim() || "_______________"}</span>
            <span className="break-all">Customer Sign: _______________</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

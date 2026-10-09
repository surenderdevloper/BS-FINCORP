"use client";

import { useEffect, useState } from "react";
import type { CustomerPaymentRow } from "@/lib/customers";
import { Button, Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { inr, formatDate } from "@/lib/money";

interface Company {
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function ReceiptViewer({
  payment,
  company,
}: {
  payment: CustomerPaymentRow;
  company: Company | null;
}) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const emiTotal = payment.principal + payment.interest;
  const companyName = company?.companyName?.trim() || "BS FINCORP";
  const paidAt = formatDate(payment.paidAt);
  const customer = payment.customerName?.trim() || "—";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openPrint = () => {
    const meta = [company?.address, company?.phone && `Ph: ${company.phone}`, company?.email, company?.gst && `GST: ${company.gst}`]
      .filter(Boolean)
      .map((line) => `<p>${esc(String(line))}</p>`)
      .join("");

    const discountRow =
      payment.discount > 0
        ? `<div class="r"><span>Discount</span><span>-${esc(inr(payment.discount))}</span></div>`
        : "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt ${esc(payment.receiptNo)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:32px;color:#111;background:#fff}
  .sheet{max-width:520px;margin:0 auto;border:1px solid #e2e2e2;border-radius:12px;overflow:hidden}
  .letterhead{text-align:center;padding:26px 24px 16px;border-bottom:1px solid #eee}
  .letterhead h1{font-size:22px;margin:0;font-weight:800;letter-spacing:.02em}
  .letterhead p{margin:3px 0 0;font-size:12px;color:#666}
  .body{padding:26px}
  .title{text-align:center}
  .title h2{font-size:16px;margin:0;font-weight:700}
  .title .no{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#555;margin-top:3px}
  .rows{margin-top:18px;font-size:14px}
  .r{display:flex;justify-content:space-between;gap:16px;padding:6px 0}
  .r span:first-child{color:#666}
  .r span:last-child{text-align:right;font-weight:500}
  .total{display:flex;justify-content:space-between;align-items:center;background:#f4f5f6;border-radius:10px;padding:14px 16px;font-weight:700;font-size:16px;margin-top:18px}
  .total .amt{font-size:22px}
  .sig{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 16px;margin-top:44px;font-size:12px;color:#666}
  .toolbar{max-width:520px;margin:16px auto 0;text-align:center}
  .toolbar button{font:inherit;font-weight:600;background:#059669;color:#fff;border:0;border-radius:9px;padding:10px 18px;cursor:pointer}
  .toolbar p{margin:10px 0 0;font-size:12px;color:#888}
  @media print{.toolbar{display:none}body{padding:0}.sheet{border:none;border-radius:0}}
</style></head>
<body>
  <div class="sheet">
    <div class="letterhead">
      <h1>${esc(companyName)}</h1>
      ${meta}
    </div>
    <div class="body">
      <div class="title">
        <h2>Payment Receipt</h2>
        <p class="no">${esc(payment.receiptNo)}</p>
      </div>
      <div class="rows">
        <div class="r"><span>Date</span><span>${esc(paidAt)}</span></div>
        <div class="r"><span>Customer</span><span>${esc(customer)}</span></div>
        <div class="r"><span>Loan No</span><span>${esc(payment.loanNo)}</span></div>
        <div class="r"><span>EMIs</span><span>${payment.paidCount}</span></div>
        <div class="r"><span>Mode</span><span style="text-transform:capitalize">${esc(payment.mode)}</span></div>
        <div class="r"><span>EMI Total</span><span>${esc(inr(emiTotal))}</span></div>
        <div class="r"><span>Penalty</span><span>${esc(inr(payment.penalty))}</span></div>
        ${discountRow}
      </div>
      <div class="total"><span>Amount Received</span><span class="amt">${esc(inr(payment.amount))}</span></div>
      <div class="sig">
        <span>Received By: ${esc(payment.receivedBy?.trim() || "_______________")}</span>
        <span>Customer Sign: _______________</span>
      </div>
    </div>
  </div>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
    <p>Tip: choose &ldquo;Save as PDF&rdquo; in the print dialog to download this receipt.</p>
  </div>
</body></html>`;

    const w = window.open("", "_blank", "width=560,height=760");
    if (!w) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      try {
        w.print();
      } catch {
        /* user can use the in-window button */
      }
    }, 350);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        title={`View / download receipt ${payment.receiptNo}`}
        aria-label={`View / download receipt ${payment.receiptNo}`}
      >
        <Icon name="download" size={16} />
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-zinc-900/60" onClick={() => setOpen(false)} />
          <Card className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">Payment Receipt</p>
                <p className="truncate font-mono text-xs text-zinc-500">{payment.receiptNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="min-w-0 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="text-center">
                <p className="text-base font-bold text-zinc-900">{companyName}</p>
                {company?.address && <p className="mt-0.5 text-[11px] text-zinc-500">{company.address}</p>}
                {(company?.phone || company?.gst) && (
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {company?.phone ? `Ph: ${company.phone}` : ""}
                    {company?.phone && company?.gst ? " · " : ""}
                    {company?.gst ? `GST: ${company.gst}` : ""}
                  </p>
                )}
              </div>

              <div className="mt-3 border-y border-dashed border-zinc-200 py-2 text-center">
                <p className="text-sm font-semibold text-zinc-800">Payment Receipt</p>
                <p className="font-mono text-xs text-zinc-500">{payment.receiptNo}</p>
              </div>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Date</dt>
                  <dd className="font-medium text-zinc-900">{paidAt}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Customer</dt>
                  <dd className="truncate font-medium text-zinc-900">{customer}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Loan No</dt>
                  <dd className="font-mono text-zinc-900">{payment.loanNo}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">EMIs</dt>
                  <dd className="text-zinc-900">{payment.paidCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Mode</dt>
                  <dd className="capitalize text-zinc-900">{payment.mode}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">EMI Total</dt>
                  <dd className="text-zinc-900">{inr(emiTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Penalty</dt>
                  <dd className="text-zinc-800">{inr(payment.penalty)}</dd>
                </div>
                {payment.discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Discount</dt>
                    <dd className="text-zinc-800">-{inr(payment.discount)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3">
                <span className="text-sm font-semibold text-zinc-700">Amount Received</span>
                <span className="text-lg font-bold text-zinc-900">{inr(payment.amount)}</span>
              </div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 text-[11px] text-zinc-500">
                <span className="break-all">Received By: {payment.receivedBy?.trim() || "_______________"}</span>
                <span className="break-all">Customer Sign: _______________</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-zinc-100 px-4 py-3">
              {blocked && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
                  Popup blocked. Allow popups for this site, then tap Download again.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="primary" size="md" className="flex-1" onClick={openPrint}>
                  <Icon name="download" size={16} /> Download / Print
                </Button>
                <Button variant="secondary" size="md" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

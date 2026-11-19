"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useFeatures } from "@/components/feature-context";
import { inr, formatDate } from "@/lib/money";
import {
  buildSmsMessage,
  buildSmsUrl,
  countSmsParts,
  detectSmsTarget,
  normalizeMobile,
  type SmsReminderType,
  type SmsTarget,
} from "@/lib/sms";

export interface SmsComposerProps {
  type: SmsReminderType;
  customerName: string;
  mobile: string;
  loanNo: string;
  amount: number;
  dueDate: string;
  /** Optional developer-defined template. Empty → built-in message. */
  template?: string;
  /** Optional brand name appended to the message. */
  brandingName?: string;
  /** Optional office contact phone number. */
  officePhone?: string;
}

export function SmsComposer({
  type,
  customerName,
  mobile,
  loanNo,
  amount,
  dueDate,
  template,
  brandingName,
  officePhone,
}: SmsComposerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("");
  const [target] = useState<SmsTarget>(() => detectSmsTarget());
  const features = useFeatures();

  const mobileDigits = normalizeMobile(mobile);
  const displayMobile = mobileDigits ? `+91 ${mobileDigits}` : mobile.trim() || "No number on record";
  const parts = countSmsParts(message);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openComposer = () => {
    setMessage(
      buildSmsMessage(
        type,
        { customerName, loanNo, amount, dueDate, brandingName, officePhone },
        template
      )
    );
    setOpen(true);
  };

  const closeComposer = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComposer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!features.sms) return null;

  const url = mobileDigits ? buildSmsUrl(mobileDigits, message, target) : null;

  const modalContent = open && mounted && (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center overflow-y-auto p-3 pt-6 sm:p-4 sm:pt-10">
      <div
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={closeComposer}
      />
      <div className="relative my-0 sm:my-2 flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl z-10 animate-in zoom-in-95 duration-150">
        {/* Modal Header - Fixed at Top */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 bg-white">
          <div className="min-w-0">
            <h2 className="break-words text-sm font-bold text-zinc-900">SMS EMI Reminder</h2>
            <p className="mt-0.5 break-words text-xs text-zinc-500">
              Loan {loanNo} · {type === "overdue" ? "Overdue" : "Upcoming"} installment
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={type === "overdue" ? "red" : "amber"}>
              {type === "overdue" ? "Overdue" : "Upcoming"}
            </Badge>
            <button
              type="button"
              onClick={closeComposer}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="min-w-0 flex-1 overflow-y-auto space-y-3.5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3.5 py-2.5 ring-1 ring-zinc-200">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{customerName.trim() || "—"}</p>
              <p className="truncate text-xs text-zinc-500">{displayMobile}</p>
            </div>
            <p className="shrink-0 text-right">
              <span className="block text-sm font-bold text-emerald-700">{inr(amount)}</span>
              <span className="block text-[11px] text-zinc-400">due {formatDate(dueDate)}</span>
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor={`sms-message-${loanNo}`}
                className="text-xs font-medium text-zinc-600"
              >
                Message (editable)
              </label>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  parts.parts > 1 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {parts.length} chars · {parts.parts} SMS
              </span>
            </div>
            <textarea
              id={`sms-message-${loanNo}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs sm:text-sm leading-relaxed text-zinc-900 shadow-xs transition-colors focus:border-emerald-500 focus:outline-2 focus:outline-emerald-600 font-sans"
            />
          </div>

          <p className="w-full whitespace-normal break-words rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200/80 [overflow-wrap:anywhere]">
            Amount is the pending amount for this single installment only, not the total loan balance.
            You send the SMS yourself from your own phone.
          </p>

          {!mobileDigits && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-200">
              No valid 10-digit mobile number on record for this customer. Add a mobile number to enable
              the SMS link.
            </p>
          )}
        </div>

        {/* Sticky Action Footer - Fixed at Bottom */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 bg-zinc-50/90 px-4 py-3 sm:px-5 backdrop-blur-xs">
          {mobileDigits ? (
            <button
              type="button"
              onClick={() => {
                if (url) {
                  window.location.href = url;
                  closeComposer();
                }
              }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 shadow-sm"
            >
              <Icon name="chat" size={16} /> Open Messages
            </button>
          ) : (
            <Button variant="primary" size="md" className="w-full cursor-not-allowed opacity-60" disabled>
              Open Messages
            </Button>
          )}

          <button
            type="button"
            onClick={closeComposer}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        title={`Send EMI reminder to ${customerName.trim() || "customer"}`}
      >
        <Icon name="chat" size={15} /> SMS
      </button>

      {mounted && open ? createPortal(modalContent, document.body) : null}
    </>
  );
}
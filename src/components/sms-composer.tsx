"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
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
}

export function SmsComposer({ type, customerName, mobile, loanNo, amount, dueDate }: SmsComposerProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [target] = useState<SmsTarget>(() => detectSmsTarget());

  const mobileDigits = normalizeMobile(mobile);
  const displayMobile = mobileDigits ? `+91 ${mobileDigits}` : mobile.trim() || "No number on record";
  const parts = countSmsParts(message);

  const openComposer = () => {
    setMessage(buildSmsMessage(type, { customerName, loanNo, amount, dueDate }));
    setOpen(true);
  };

  const closeComposer = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComposer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const url = mobileDigits ? buildSmsUrl(mobileDigits, message, target) : null;

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

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/50" onClick={closeComposer} />
          <Card className="relative w-full max-w-md">
            <CardHeader
              title="SMS EMI Reminder"
              subtitle={`Loan ${loanNo} · ${type === "overdue" ? "Overdue" : "Upcoming"} installment`}
              action={
                <div className="flex items-center gap-2">
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
              }
            />

            <div className="min-w-0 space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3.5 py-3 ring-1 ring-zinc-200">
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
                  rows={5}
                  className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-2 focus:outline-emerald-600"
                />
              </div>

              <p className="w-full whitespace-normal break-words rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200 [overflow-wrap:anywhere]">
                Amount is the pending amount for this single installment only, not the total loan balance.
                You send the SMS yourself from your own phone.
              </p>

              {!mobileDigits && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-200">
                  No valid 10-digit mobile number on record for this customer. Add a mobile number to enable
                  the SMS link.
                </p>
              )}

              <div className="space-y-2">
                {mobileDigits ? (
                  <button
                    type="button"
                    onClick={() => url && (window.location.href = url)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <Icon name="chat" size={16} /> Open Messages
                  </button>
                ) : (
                  <Button variant="primary" size="md" className="w-full" disabled>
                    Open Messages
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
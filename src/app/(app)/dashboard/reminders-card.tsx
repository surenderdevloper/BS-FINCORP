"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Card, CardHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SmsComposer } from "@/components/sms-composer";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { buildEmiReminderMessage } from "@/lib/whatsapp";
import { inr, formatDate } from "@/lib/money";
import type { ReminderRow } from "@/types";

function daysLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function RemindersCard({
  reminders,
  count,
  brandingName = "",
}: {
  reminders: ReminderRow[];
  count: number;
  brandingName?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Upcoming EMIs — Next 7 Days"
        subtitle="Reminders for installments falling due in the coming week"
        action={
          count > 0 ? (
            <Badge tone="amber">{count} upcoming</Badge>
          ) : (
            <Badge tone="green">All clear</Badge>
          )
        }
      />
      {reminders.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          No EMIs due in the next 7 days.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-50">
          {reminders.map((row) => {
            const isOpen = open === row.emiId;
            return (
              <li key={row.emiId}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : row.emiId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50/70 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-900">
                      {row.customerName || "—"}
                      <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      EMI #{row.emiNo} · Due {formatDate(row.dueDate)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-right sm:block">
                      <span className="block text-sm font-semibold text-zinc-900">{inr(row.amount)}</span>
                      <span className={row.daysLeft <= 1 ? "text-xs font-medium text-red-600" : "text-xs font-medium text-amber-600"}>
                        {daysLabel(row.daysLeft)}
                      </span>
                    </span>
                    <Badge tone={row.daysLeft <= 1 ? "red" : "amber"}>{row.daysLeft}d</Badge>
                    <Icon
                      name="chevron"
                      size={16}
                      className={`text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div className="grid gap-3 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 sm:grid-cols-4 sm:px-5">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Customer</p>
                      <p className="text-sm font-medium text-zinc-900">{row.customerName || "—"}</p>
                      {row.mobile && <p className="text-xs text-zinc-500">{row.mobile}</p>}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Vehicle</p>
                      <p className="text-sm font-medium text-zinc-900">{row.vehicle || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Due amount</p>
                      <p className="text-sm font-semibold text-emerald-700">{inr(row.amount)}</p>
                    </div>
                    <div className="flex flex-wrap items-end justify-end gap-2">
                      <SmsComposer
                        type="upcoming"
                        customerName={row.customerName}
                        mobile={row.mobile}
                        loanNo={row.loanNo}
                        amount={row.amount}
                        dueDate={row.dueDate}
                      />
                      <WhatsAppShare
                        recipientName={row.customerName}
                        mobile={row.mobile}
                        title="WhatsApp Reminder"
                        subtitle={`${row.loanNo} · EMI #${row.emiNo}`}
                        templates={[
                          {
                            key: "upcoming",
                            label: "Upcoming reminder",
                            message: buildEmiReminderMessage("upcoming", {
                              customerName: row.customerName,
                              loanNo: row.loanNo,
                              amount: row.amount,
                              dueDate: row.dueDate,
                              brandingName,
                            }),
                          },
                          {
                            key: "duetoday",
                            label: "Due today / now",
                            message: buildEmiReminderMessage("duetoday", {
                              customerName: row.customerName,
                              loanNo: row.loanNo,
                              amount: row.amount,
                              dueDate: row.dueDate,
                              brandingName,
                            }),
                          },
                        ]}
                      />
                      <Link
                        href={`/emi-pay?loan=${row.loanNo}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                      >
                        <Icon name="cash" size={15} /> Collect
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
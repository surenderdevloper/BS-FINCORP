"use client";

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
  waUpcoming = "",
  waDuetoday = "",
  smsUpcoming = "",
}: {
  reminders: ReminderRow[];
  count: number;
  brandingName?: string;
  waUpcoming?: string;
  waDuetoday?: string;
  smsUpcoming?: string;
}) {
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
        <div className="relative">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:px-5">
            {reminders.map((row) => (
              <article
                key={row.emiId}
                className="flex w-[78%] shrink-0 snap-start flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:w-72"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {row.customerName || "—"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                      {row.loanNo} · EMI #{row.emiNo}
                    </p>
                  </div>
                  <Badge tone={row.daysLeft <= 1 ? "red" : "amber"}>{daysLabel(row.daysLeft)}</Badge>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span className="min-w-0 truncate">{row.vehicle || "—"}</span>
                  <span className="shrink-0">Due {formatDate(row.dueDate)}</span>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                  <span className="text-base font-bold text-zinc-900">{inr(row.amount)}</span>
                  <span className="text-xs text-zinc-500">{row.mobile || "—"}</span>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <SmsComposer
                    type="upcoming"
                    customerName={row.customerName}
                    mobile={row.mobile}
                    loanNo={row.loanNo}
                    amount={row.amount}
                    dueDate={row.dueDate}
                    template={smsUpcoming}
                    brandingName={brandingName}
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
                        message: buildEmiReminderMessage(
                          "upcoming",
                          {
                            customerName: row.customerName,
                            loanNo: row.loanNo,
                            amount: row.amount,
                            dueDate: row.dueDate,
                            brandingName,
                          },
                          waUpcoming
                        ),
                      },
                      {
                        key: "duetoday",
                        label: "Due today / now",
                        message: buildEmiReminderMessage(
                          "duetoday",
                          {
                            customerName: row.customerName,
                            loanNo: row.loanNo,
                            amount: row.amount,
                            dueDate: row.dueDate,
                            brandingName,
                          },
                          waDuetoday
                        ),
                      },
                    ]}
                  />
                  <Link
                    href={`/emi-pay?loan=${row.loanNo}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    <Icon name="cash" size={14} /> Collect
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {reminders.length > 1 && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
          )}
        </div>
      )}
    </Card>
  );
}

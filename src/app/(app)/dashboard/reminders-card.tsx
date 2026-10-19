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
  function actions(row: ReminderRow) {
    return (
      <div className="flex items-center justify-end gap-1.5">
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
    );
  }

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
        <div>
          <ul className="divide-y divide-zinc-50 md:hidden">
            {reminders.map((row) => (
              <li key={row.emiId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                    {row.customerName || "—"}
                    <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                  </span>
                  <Badge tone={row.daysLeft <= 1 ? "red" : "amber"}>{daysLabel(row.daysLeft)}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span className="min-w-0 truncate">
                    {row.vehicle || "—"} · EMI #{row.emiNo} · Due {formatDate(row.dueDate)}
                  </span>
                  <span className="shrink-0 font-semibold text-zinc-900">{inr(row.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{row.mobile || "—"}</span>
                  {actions(row)}
                </div>
              </li>
            ))}
          </ul>
          <div className="-mx-4 hidden overflow-x-auto px-4 sm:mx-0 sm:px-0 md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium sm:px-5">Customer</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Mobile</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Vehicle</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center font-medium">EMI</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Due Date</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Due In</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium sm:px-5">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {reminders.map((row) => (
                  <tr key={row.emiId} className="hover:bg-zinc-50/60">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-900 sm:px-5">
                      {row.customerName || "—"}
                      <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{row.loanNo}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{row.mobile || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{row.vehicle || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-center text-zinc-600">#{row.emiNo}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{formatDate(row.dueDate)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-zinc-900">{inr(row.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Badge tone={row.daysLeft <= 1 ? "red" : "amber"}>{daysLabel(row.daysLeft)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right sm:px-5">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

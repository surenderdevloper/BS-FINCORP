"use client";

import { useParams } from "next/navigation";
import type { CustomerPaymentRow } from "@/lib/customers";
import { Icon } from "@/components/icons";

/**
 * Icon-only action that opens the standalone, printable receipt page in a new
 * tab. Rendering a real server page (instead of a scripting popup) keeps it
 * reliable and responsive on mobile, and printable on its own.
 */
export function ReceiptViewer({ payment }: { payment: CustomerPaymentRow }) {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const href = id ? `/customers/${id}/receipt/${payment._id}` : "#";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
      title={`View / download receipt ${payment.receiptNo}`}
      aria-label={`View / download receipt ${payment.receiptNo}`}
    >
      <Icon name="download" size={16} />
    </a>
  );
}

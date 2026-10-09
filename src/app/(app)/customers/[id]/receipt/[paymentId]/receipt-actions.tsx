"use client";

import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

export function ReceiptActions() {
  return (
    <Button onClick={() => window.print()} className="px-4 py-2 text-sm">
      <Icon name="print" size={16} /> Print / Save as PDF
    </Button>
  );
}

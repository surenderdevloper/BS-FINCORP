"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

export function ReceiptActions({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [autoPrint]);

  return (
    <Button onClick={() => window.print()} className="px-4 py-2 text-sm">
      <Icon name="print" size={16} /> Print / Save as PDF
    </Button>
  );
}

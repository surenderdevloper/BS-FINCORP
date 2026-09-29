"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

export function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    timerRef.current = setTimeout(() => setRefreshing(false), 700);
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      aria-label="Refresh dashboard"
    >
      <Icon name="refresh" size={16} className={refreshing ? "animate-spin" : ""} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
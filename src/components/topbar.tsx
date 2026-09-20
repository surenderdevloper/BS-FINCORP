"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/money";

export function Topbar({
  userName,
  onMenu,
}: {
  userName: string;
  onMenu: () => void;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur sm:gap-3 sm:px-6 print:static">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
      >
        <Icon name="menu" size={22} />
      </button>

      <div className="flex min-w-0 items-center md:hidden">
        <span className="text-sm font-bold text-zinc-900">BS FINCORP</span>
      </div>

      <div className="hidden items-center gap-1.5 text-sm text-zinc-500 sm:flex">
        <Icon name="calendar" size={16} className="text-emerald-600" />
        <span className="font-medium">{formatDate(new Date())}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-900">{userName}</p>
            <p className="text-[11px] text-zinc-400">Administrator</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Icon name="logout" size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
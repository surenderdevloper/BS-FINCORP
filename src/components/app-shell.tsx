"use client";

import { useState, type ReactNode } from "react";
import { SidebarContent } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-100">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-zinc-200 bg-white md:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-zinc-900/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 animate-in bg-white shadow-xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen w-full flex-col md:pl-60">
        <Topbar userName={userName} onMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-16 sm:px-6 sm:py-8 sm:pb-10 print:static print:px-0">
          {children}
        </main>
      </div>
    </div>
  );
}
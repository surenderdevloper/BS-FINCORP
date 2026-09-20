"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
  {
    title: "Loans",
    items: [
      { href: "/loans/new", label: "New Loan", icon: "plus" },
      { href: "/customers", label: "All Customers", icon: "users" },
      { href: "/customers/edit", label: "Edit Customer", icon: "edit" },
      { href: "/emi-pay", label: "EMI Pay", icon: "cash" },
      { href: "/close-loan", label: "Close Loan", icon: "close" },
      { href: "/noc", label: "NOC Reprint", icon: "noc" },
    ],
  },
  { title: "Business", items: [{ href: "/reports", label: "Reports", icon: "reports" }] },
  {
    title: "System",
    items: [
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/backup", label: "Backup", icon: "backup" },
      { href: "/login-settings", label: "Login Settings", icon: "lock" },
      { href: "/penalty-rules", label: "Penalty Rules", icon: "rules" },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-extrabold text-white">
          BF
        </span>
        <div>
          <p className="text-sm font-bold text-zinc-900">BS FINCORP</p>
          <p className="text-[11px] text-zinc-500">Loan Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-emerald-50 font-semibold text-emerald-700"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      <Icon name={item.icon} size={18} className={active ? "text-emerald-600" : ""} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-100 px-5 py-3">
        <p className="text-[10px] text-zinc-400">© {new Date().getFullYear()} BS FINCORP</p>
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import type { CompanyBranding } from "@/components/app-shell";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/** Uppercase initials from a company name, e.g. "Khalsa Finance" → "KF". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "")[0] ?? "")
    .join("");
  return (letters || name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3)).toUpperCase().slice(0, 3) || "GF";
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

export function SidebarContent({
  onNavigate,
  branding,
}: {
  onNavigate?: () => void;
  branding?: CompanyBranding;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const logo = branding?.logo ?? "";
  const companyName = branding?.companyName || "Gigabyte Finance Manager";
  const sections = NAV_SECTIONS;

  return (
    <div className="flex h-full flex-col justify-between bg-gradient-to-b from-white via-white to-zinc-50/70">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 border-b border-zinc-100/80 px-5 py-4">
          {logo ? (
            <img
              src={logo}
              alt="Company logo"
              className="h-10 w-10 rounded-2xl object-contain ring-2 ring-emerald-500/20 shadow-xs"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-xs font-black tracking-wider text-white shadow-md shadow-emerald-600/30">
              {initials(companyName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold tracking-tight text-zinc-900">{companyName}</p>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <p className="text-[11px] font-medium text-emerald-700">Online • Loan Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-4 px-3 py-3 overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        onMouseEnter={() => router.prefetch(item.href)}
                        onTouchStart={() => router.prefetch(item.href)}
                        onClick={onNavigate}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25"
                            : "text-zinc-600 hover:bg-emerald-50/60 hover:text-emerald-900 hover:translate-x-1"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            name={item.icon}
                            size={18}
                            className={`transition-transform duration-200 ${
                              active ? "text-white" : "text-zinc-400 group-hover:text-emerald-600 group-hover:scale-110"
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Bulletin / System Card (from Video 2) */}
      <div className="p-3 border-t border-zinc-100/80">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              GB Cloud v2.8
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
              Active
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-zinc-900">High-Speed Engine</p>
          <p className="text-[10px] text-zinc-500">Auto Backup & Audit Ready</p>
        </div>
      </div>
    </div>
  );
}
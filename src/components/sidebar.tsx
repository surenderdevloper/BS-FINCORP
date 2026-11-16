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
    <div className="flex h-full flex-col justify-between bg-white">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
          {logo ? (
            <img
              src={logo}
              alt="Company logo"
              className="h-9 w-9 rounded-xl object-contain ring-1 ring-zinc-200 shadow-xs"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-xs font-black tracking-wider text-white shadow-xs">
              {initials(companyName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-zinc-900">{companyName}</p>
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
        <nav className="space-y-4 px-3 py-3 overflow-y-auto max-h-[calc(100vh-140px)]">
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
                        className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ${
                          active
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20 font-semibold"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            name={item.icon}
                            size={18}
                            className={`transition-colors ${
                              active ? "text-white" : "text-zinc-400 group-hover:text-emerald-600"
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

      {/* Clean Bottom Footer */}
      <div className="border-t border-zinc-100 px-5 py-3.5">
        <p className="text-[11px] font-medium text-zinc-400">© {new Date().getFullYear()} {companyName}</p>
      </div>
    </div>
  );
}
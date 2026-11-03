"use client";

import { useState, type ReactNode } from "react";
import { SidebarContent } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Icon } from "@/components/icons";
import { SessionTimeout } from "@/components/session-timeout";
import { FeatureProvider, type AppFeatures } from "@/components/feature-context";

export interface CompanyBranding {
  logo: string;
  companyName: string;
}

export interface MaintenanceNotice {
  enabled: boolean;
  message: string;
}

export interface SubscriptionAlert {
  /** Whole days left before the subscription lapses. */
  daysLeft: number;
  tone: "amber" | "red";
  /** Preformatted expiry date shown in the message. */
  expiresOn: string;
}

export function AppShell({
  userName,
  branding,
  isDeveloper = false,
  features = { whatsapp: true, sms: true },
  maintenance = { enabled: false, message: "" },
  subscription = null,
  children,
}: {
  userName: string;
  branding: CompanyBranding;
  isDeveloper?: boolean;
  features?: AppFeatures;
  maintenance?: MaintenanceNotice;
  subscription?: SubscriptionAlert | null;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <FeatureProvider features={features}>
    <div className="flex min-h-screen bg-zinc-100">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-zinc-200 bg-white md:block">
        <SidebarContent branding={branding} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-zinc-900/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 animate-in bg-white shadow-xl">
            <SidebarContent
              branding={branding}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen w-full flex-col md:pl-60">
        <Topbar
          userName={userName}
          onMenu={() => setDrawerOpen(true)}
          branding={branding}
          isDeveloper={isDeveloper}
        />
        {subscription && (
          <div
            role="status"
            className={`no-print flex items-start gap-2 border-b px-4 py-2.5 text-sm sm:px-6 ${
              subscription.tone === "red"
                ? "border-red-300 bg-red-100 text-red-900"
                : "border-amber-300 bg-amber-100 text-amber-900"
            }`}
          >
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <p className="font-medium">
              {subscription.tone === "red"
                ? `Your subscription expires in less than 24 hours (${subscription.expiresOn}). Contact your administrator immediately to keep your account active.`
                : `Your subscription expires in ${subscription.daysLeft} days (${subscription.expiresOn}). Please contact your administrator to renew.`}
            </p>
          </div>
        )}
        {maintenance.enabled && (
          <div className="no-print border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 sm:px-6">
            {maintenance.message || "This system is temporarily under maintenance."}
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-16 sm:px-6 sm:py-8 sm:pb-10 print:static print:px-0">
          {children}
        </main>
      </div>

      <SessionTimeout />
    </div>
    </FeatureProvider>
  );
}
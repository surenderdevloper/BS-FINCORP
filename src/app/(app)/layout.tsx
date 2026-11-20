import { redirect } from "next/navigation";
import { AppShell, type SubscriptionAlert } from "@/components/app-shell";
import { CurrencyProvider } from "@/components/currency-context";
import { isSuperadmin, isSuspended, readSession } from "@/lib/auth";
import { multiTenantEnabled, runForSession } from "@/lib/tenant";
import { buildSubscriptionNotice } from "@/lib/subscription-notice";
import { formatDate } from "@/lib/money";
import { getCompanySetting } from "@/models/CompanySetting";
import { getAppConfig } from "@/models/AppConfig";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }
  if (isSuspended(session)) {
    redirect("/account-suspended");
  }
  // Global roles must never render tenant pages without an explicit tenant
  // context, where model queries would otherwise be unscoped.
  if (multiTenantEnabled()) {
    if (isSuperadmin(session)) redirect("/superadmin-panel");
    if (session.role === "developer") redirect("/developer");
  }

  let branding = { logo: "", companyName: "Gigabyte Finance Manager" };
  let currencySettings = { currency: "INR", currencySymbol: "₹", phoneDialCode: "91", countryCode: "IN" };
  let features = { whatsapp: true, sms: true };
  let maintenance = { enabled: false, message: "" };
  try {
    const tenantSettings = await runForSession(session.tenantId, async () => {
      // Both lookups are independent, so run them together: one round-trip of
      // latency instead of two.
      const [company, config] = await Promise.all([getCompanySetting(), getAppConfig()]);
      return {
        branding: {
          logo: company.logo ?? "",
          companyName: company.companyName || "Gigabyte Finance Manager",
        },
        currencySettings: {
          currency: company.currency || "INR",
          currencySymbol: company.currencySymbol || "₹",
          phoneDialCode: company.phoneDialCode || "91",
          countryCode: company.countryCode || "IN",
        },
        features: {
          whatsapp: config.features?.whatsapp ?? true,
          sms: config.features?.sms ?? true,
        },
        maintenance: {
          enabled: config.maintenance?.enabled ?? false,
          message: config.maintenance?.message ?? "",
        },
      };
    });
    branding = tenantSettings.branding;
    currencySettings = tenantSettings.currencySettings;
    features = tenantSettings.features;
    maintenance = tenantSettings.maintenance;
  } catch {
    // Feature flags are optional; default to everything enabled.
  }

  const expiresAt = session.subscriptionExpiresAt ?? null;
  const notice = expiresAt ? buildSubscriptionNotice(expiresAt) : null;
  const subscription: SubscriptionAlert | null =
    notice && expiresAt ? { ...notice, expiresOn: formatDate(expiresAt) } : null;

  return (
    <CurrencyProvider
      currency={currencySettings.currency}
      currencySymbol={currencySettings.currencySymbol}
      phoneDialCode={currencySettings.phoneDialCode}
      countryCode={currencySettings.countryCode}
    >
      <AppShell
        userName={session.name}
        branding={branding}
        isDeveloper={session.role === "developer"}
        features={features}
        maintenance={maintenance}
        subscription={subscription}
      >
        {children}
      </AppShell>
    </CurrencyProvider>
  );
}
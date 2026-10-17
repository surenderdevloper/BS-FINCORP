import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isSuperadmin, isSuspended, readSession } from "@/lib/auth";
import { multiTenantEnabled, runForSession } from "@/lib/tenant";
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
  // A superadmin has no tenant: browsing the tenant app would run unscoped and
  // expose every tenant's data. Send them to their own panel instead.
  if (multiTenantEnabled() && isSuperadmin(session)) {
    redirect("/superadmin-panel");
  }

  let branding = { logo: "", companyName: "Gigabyte Finance Manager" };
  let features = { whatsapp: true, sms: true };
  let maintenance = { enabled: false, message: "" };
  try {
    const tenantSettings = await runForSession(session.tenantId, async () => {
      const company = await getCompanySetting();
      const config = await getAppConfig();
      return {
        branding: {
          logo: company.logo ?? "",
          companyName: company.companyName || "Gigabyte Finance Manager",
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
    features = tenantSettings.features;
    maintenance = tenantSettings.maintenance;
  } catch {
    // Feature flags are optional; default to everything enabled.
  }

  return (
    <AppShell
      userName={session.name}
      branding={branding}
      isDeveloper={session.role === "developer"}
      features={features}
      maintenance={maintenance}
    >
      {children}
    </AppShell>
  );
}
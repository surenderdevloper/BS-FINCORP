import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";
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

  let branding = { logo: "", companyName: "Gigabyte Finance Manager" };
  try {
    const company = await getCompanySetting();
    branding = {
      logo: company.logo ?? "",
      companyName: company.companyName || "Gigabyte Finance Manager",
    };
  } catch {
    // Keep fallback branding if settings cannot be read right now.
  }

  let features = { whatsapp: true, sms: true };
  let maintenance = { enabled: false, message: "" };
  try {
    const config = await getAppConfig();
    features = {
      whatsapp: config.features?.whatsapp ?? true,
      sms: config.features?.sms ?? true,
    };
    maintenance = {
      enabled: config.maintenance?.enabled ?? false,
      message: config.maintenance?.message ?? "",
    };
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
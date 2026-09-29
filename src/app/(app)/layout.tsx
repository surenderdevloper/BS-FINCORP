import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";
import { getCompanySetting } from "@/models/CompanySetting";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }

  let branding = { logo: "", companyName: "BS FINCORP" };
  try {
    const company = await getCompanySetting();
    branding = {
      logo: company.logo ?? "",
      companyName: company.companyName || "BS FINCORP",
    };
  } catch {
    // Keep fallback branding if settings cannot be read right now.
  }

  return (
    <AppShell userName={session.name} branding={branding}>
      {children}
    </AppShell>
  );
}
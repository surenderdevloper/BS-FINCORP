import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { runUnscoped } from "@/lib/tenant";
import { getCompanySetting } from "@/models/CompanySetting";

export const dynamic = "force-dynamic";

async function getBranding() {
  const envLogo = process.env.CLIENT_LOGO_URL ?? "";
  const envName = process.env.NEXT_PUBLIC_APP_NAME || "Gigabyte Brothers";
  try {
    await dbConnect();
    // No tenant yet on the login page: branding falls back to the global settings.
    const company = await runUnscoped(() => getCompanySetting());
    const dbName = company?.companyName;
    const isOldBrand =
      !dbName ||
      dbName.toLowerCase().includes("bs fincorp") ||
      dbName.toLowerCase().includes("bs_fincorp") ||
      dbName === "Gigabyte Finance Manager";
    return {
      logo: envLogo || (isOldBrand ? "" : (company.logo ?? "")),
      companyName: envName || (isOldBrand ? "Gigabyte Brothers" : dbName),
    };
  } catch {
    return { logo: envLogo, companyName: envName };
  }
}

export default async function LoginPage() {
  const session = await readSession();
  if (session) {
    redirect("/dashboard");
  }

  const { logo, companyName } = await getBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <LoginForm logo={logo || undefined} companyName={companyName} />
      </Suspense>
    </div>
  );
}
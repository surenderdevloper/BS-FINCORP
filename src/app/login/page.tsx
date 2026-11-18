import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { runUnscoped } from "@/lib/tenant";
import { getCompanySetting } from "@/models/CompanySetting";

export const dynamic = "force-dynamic";

let loginBrandingCache: { logo: string; companyName: string; at: number } | null = null;
const BRANDING_CACHE_TTL_MS = 60_000;

async function getBranding() {
  if (loginBrandingCache && Date.now() - loginBrandingCache.at < BRANDING_CACHE_TTL_MS) {
    return { logo: loginBrandingCache.logo, companyName: loginBrandingCache.companyName };
  }

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
    const res = {
      logo: envLogo || (isOldBrand ? "" : (company?.logo ?? "")),
      companyName: envName || (isOldBrand ? "Gigabyte Brothers" : dbName),
    };
    loginBrandingCache = { ...res, at: Date.now() };
    return res;
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
      <DynamicFavicon logo={logo} />
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <LoginForm logo={logo || undefined} companyName={companyName} />
      </Suspense>
    </div>
  );
}
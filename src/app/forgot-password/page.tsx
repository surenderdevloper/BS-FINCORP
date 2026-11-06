import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";
import { dbConnect } from "@/lib/db";
import { runUnscoped } from "@/lib/tenant";
import { getCompanySetting } from "@/models/CompanySetting";

export const dynamic = "force-dynamic";

async function getBranding() {
  const envName = process.env.NEXT_PUBLIC_APP_NAME || "Gigabyte Brothers";
  try {
    await dbConnect();
    const company = await runUnscoped(() => getCompanySetting());
    const dbName = company?.companyName;
    const isOldBrand =
      !dbName ||
      dbName.toLowerCase().includes("bs fincorp") ||
      dbName.toLowerCase().includes("bs_fincorp") ||
      dbName === "Gigabyte Finance Manager";
    return {
      logo: isOldBrand ? "" : (company.logo ?? ""),
      companyName: envName || (isOldBrand ? "Gigabyte Brothers" : dbName),
    };
  } catch {
    return { logo: "", companyName: envName };
  }
}

export default async function ForgotPasswordPage() {
  const { logo, companyName } = await getBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <ForgotPasswordForm logo={logo || undefined} companyName={companyName} />
      </Suspense>
    </div>
  );
}
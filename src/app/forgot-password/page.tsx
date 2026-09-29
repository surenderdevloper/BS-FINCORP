import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";
import { dbConnect } from "@/lib/db";
import { getCompanySetting } from "@/models/CompanySetting";

export const dynamic = "force-dynamic";

async function getBranding() {
  try {
    await dbConnect();
    const company = await getCompanySetting();
    return {
      logo: company.logo ?? "",
      companyName: company.companyName ?? "BS FINCORP",
    };
  } catch {
    return { logo: "", companyName: "BS FINCORP" };
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
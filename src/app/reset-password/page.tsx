import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";
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

export default async function ResetPasswordPage() {
  const { logo, companyName } = await getBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <ResetPasswordForm logo={logo || undefined} companyName={companyName} />
      </Suspense>
    </div>
  );
}
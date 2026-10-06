import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { getCompanySetting } from "@/models/CompanySetting";

export const dynamic = "force-dynamic";

async function getBranding() {
  const envLogo = process.env.CLIENT_LOGO_URL ?? "";
  const envName = process.env.NEXT_PUBLIC_APP_NAME ?? "";
  try {
    await dbConnect();
    const company = await getCompanySetting();
    return {
      logo: envLogo || (company.logo ?? ""),
      companyName: envName || company.companyName || "BS FINCORP",
    };
  } catch {
    return { logo: envLogo, companyName: envName || "BS FINCORP" };
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
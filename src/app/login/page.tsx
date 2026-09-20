import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { dbConnect } from "@/lib/db";
import { CompanySetting } from "@/models/CompanySetting";

export const dynamic = "force-dynamic";

async function getBranding() {
  try {
    await dbConnect();
    const doc = await CompanySetting.findOne({ singleton: "company" }).lean();
    return {
      logo: doc?.logo ?? "",
      companyName: doc?.companyName ?? "BS FINCORP",
    };
  } catch {
    return { logo: "", companyName: "BS FINCORP" };
  }
}

export default async function LoginPage() {
  const { logo, companyName } = await getBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <LoginForm logo={logo || undefined} companyName={companyName} />
      </Suspense>
    </div>
  );
}
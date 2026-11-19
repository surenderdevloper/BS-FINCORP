import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isDeveloper, readSession } from "@/lib/auth";
import { hasDeveloperAccess } from "@/lib/developer-access";
import { DeveloperConsole } from "@/components/developer/developer-console";
import { DeveloperAccessForm } from "@/components/developer/developer-access-form";
import { AppShell } from "@/components/app-shell";
import { developerConsoleEnabled } from "@/lib/developer-access";

export const metadata: Metadata = { title: "Developer Console" };

export const dynamic = "force-dynamic";

export default async function DeveloperPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; devError?: string }>;
}) {
  const { key, devError } = await searchParams;
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isDeveloper(session)) notFound();

  // Legacy key links must not keep the key in the browser's address bar.
  if (key) {
    redirect("/developer");
  }

  const accessGranted = await hasDeveloperAccess();

  return (
    <AppShell
      userName={session.name}
      branding={{
        logo: "",
        companyName: process.env.NEXT_PUBLIC_APP_NAME || "Gigabyte Finance Manager",
      }}
      isDeveloper
    >
      {accessGranted ? (
        <DeveloperConsole ownerEmail={session.email} />
      ) : (
        <DeveloperAccessForm enabled={developerConsoleEnabled()} locked={devError === "locked"} />
      )}
    </AppShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSuspended, readSession } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "Account Suspended" };

export const dynamic = "force-dynamic";

export default async function AccountSuspendedPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  // An active tenant should never land here.
  if (!isSuspended(session)) redirect("/dashboard");

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Gigabyte Finance Manager";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Icon name="lock" size={28} className="text-amber-600" />
        </div>
        <h1 className="mt-5 text-lg font-bold text-zinc-900">Subscription suspended</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your {appName} subscription is currently suspended, so your data is
          read-only and unavailable.
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          Please contact the administrator to restore access. You have not lost any data.
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}

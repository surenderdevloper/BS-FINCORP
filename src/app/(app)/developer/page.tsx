import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { hasDeveloperAccess } from "@/lib/developer-access";
import { DeveloperConsole } from "@/components/developer/developer-console";

export const metadata: Metadata = { title: "Developer Console" };

export const dynamic = "force-dynamic";

export default async function DeveloperPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; devError?: string }>;
}) {
  const { key, devError } = await searchParams;

  // Visiting /developer?key=... hands the key to the unlock endpoint, which
  // verifies it and stores a signed access cookie before redirecting back here.
  if (key) {
    redirect(`/api/developer/access?key=${encodeURIComponent(key)}`);
  }

  if (!(await hasDeveloperAccess())) {
    if (devError) return <DeveloperAccessNotice reason={devError} />;
    notFound();
  }

  const session = await readSession();
  return <DeveloperConsole ownerEmail={session?.email ?? ""} />;
}

function DeveloperAccessNotice({ reason }: { reason: string }) {
  const message =
    reason === "badkey"
      ? "That access key is not correct. Check the link and try again."
      : reason === "locked"
        ? "The developer console has been locked on this device."
        : "The developer console is not enabled. Set the DEVELOPER_KEY environment variable to turn it on.";

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-zinc-900">Developer Console</p>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

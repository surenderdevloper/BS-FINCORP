import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth";
import { SuperadminConsole } from "@/components/superadmin/superadmin-console";

export const metadata: Metadata = { title: "Superadmin Panel" };

export const dynamic = "force-dynamic";

export default async function SuperadminPanelPage() {
  const session = await requireSuperadmin();
  if (!session) notFound();
  return <SuperadminConsole ownerEmail={session.email} ownerId={session.id} />;
}

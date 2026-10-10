import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireDeveloper } from "@/lib/auth";
import { DeveloperConsole } from "@/components/developer/developer-console";

export const metadata: Metadata = { title: "Developer Console" };

export default async function DeveloperPage() {
  const session = await requireDeveloper();
  if (!session) {
    redirect("/dashboard");
  }
  return <DeveloperConsole ownerEmail={session.email} />;
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }
  return <AppShell userName={session.name}>{children}</AppShell>;
}
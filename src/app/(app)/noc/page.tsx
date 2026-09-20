import type { Metadata } from "next";
import { NocForm } from "./noc-form";

export const metadata: Metadata = { title: "NOC Reprint" };

export const dynamic = "force-dynamic";

export default async function NocPage({ searchParams }: { searchParams: Promise<{ loan?: string }> }) {
  const { loan } = await searchParams;
  return <NocForm preselectedLoan={loan} />;
}
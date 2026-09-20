import type { Metadata } from "next";
import { EmiPayForm } from "./emi-pay-form";

export const metadata: Metadata = { title: "EMI Pay" };

export const dynamic = "force-dynamic";

export default async function EmiPayPage({ searchParams }: { searchParams: Promise<{ loan?: string }> }) {
  const { loan } = await searchParams;
  return <EmiPayForm preselectedLoan={loan} />;
}
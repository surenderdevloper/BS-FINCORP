import type { Metadata } from "next";
import { EditCustomerForm } from "./edit-customer-form";
import { dbConnect } from "@/lib/db";
import { getAppConfig, activeLoanTypeNames } from "@/models/AppConfig";

export const metadata: Metadata = { title: "Edit Customer" };

export const dynamic = "force-dynamic";

async function loadLoanTypes(): Promise<string[] | undefined> {
  try {
    await dbConnect();
    const config = await getAppConfig();
    const names = activeLoanTypeNames(config.toObject());
    return names;
  } catch {
    return undefined;
  }
}

export default async function EditCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; loan?: string }>;
}) {
  const { id, loan } = await searchParams;
  const loanTypes = await loadLoanTypes();
  return <EditCustomerForm preselectedId={id} preselectedLoan={loan} loanTypes={loanTypes} />;
}
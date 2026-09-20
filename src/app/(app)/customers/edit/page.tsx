import type { Metadata } from "next";
import { EditCustomerForm } from "./edit-customer-form";

export const metadata: Metadata = { title: "Edit Customer" };

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; loan?: string }>;
}) {
  const { id, loan } = await searchParams;
  return <EditCustomerForm preselectedId={id} preselectedLoan={loan} />;
}
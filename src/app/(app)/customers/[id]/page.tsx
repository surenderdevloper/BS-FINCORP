import type { Metadata } from "next";
import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { getCustomerDetail } from "@/lib/customers";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { CustomerStatement } from "./customer-statement";

export const metadata: Metadata = { title: "Customer Detail" };

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;

  await dbConnect();
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          <Icon name="chevron" size={16} className="-rotate-90" /> All Customers
        </Link>
      </div>
      <CustomerStatement customer={customer} autoPrint={print === "1"} />
    </div>
  );
}
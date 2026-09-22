import type { Metadata } from "next";
import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { getCustomerDetail } from "@/lib/customers";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { CustomerStatement } from "./customer-statement";
import { DocumentsTab } from "./documents-tab";

export const metadata: Metadata = { title: "Customer Detail" };

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { print, tab } = await searchParams;

  await dbConnect();
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const activeTab = tab === "documents" ? "documents" : "statement";

  const tabClasses = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-emerald-600 text-white"
        : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
    }`;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          <Icon name="chevron" size={16} className="-rotate-90" /> All Customers
        </Link>
        <nav className="no-print flex gap-1.5" aria-label="Customer sections">
          <Link href={`/customers/${id}`} className={tabClasses(activeTab === "statement")}>
            Statement
          </Link>
          <Link href={`/customers/${id}?tab=documents`} className={tabClasses(activeTab === "documents")}>
            Documents
          </Link>
        </nav>
      </div>
      {activeTab === "documents" ? (
        <DocumentsTab customerId={customer._id} customerName={customer.name} />
      ) : (
        <CustomerStatement customer={customer} autoPrint={print === "1"} />
      )}
    </div>
  );
}
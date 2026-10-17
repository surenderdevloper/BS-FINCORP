import { readSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { runForSession } from "@/lib/tenant";
import { listCustomers, type CustomerWithLoans } from "@/lib/customers";
import { CustomersList } from "./customers-list";

export const metadata = { title: "All Customers" };

/**
 * The customers list is fetched on the server so the table is part of the first
 * paint. The interactive list (search / paging / export) hydrates on top of it
 * and quietly revalidates in the background, so there is no blank page waiting
 * on a client-side fetch.
 */
export default async function CustomersPage() {
  let customers: CustomerWithLoans[] = [];
  try {
    const session = await readSession();
    await dbConnect();
    customers = await runForSession(session?.tenantId ?? null, () => listCustomers({ limit: 2000 }));
  } catch {
    // The list component falls back to its own fetch when the server render
    // cannot reach the database.
  }
  return <CustomersList initialCustomers={customers} />;
}

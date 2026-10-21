import { readSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { runForSession } from "@/lib/tenant";
import { isoDateIST } from "@/lib/dates";
import { buildReport, type ReportData, type ReportType } from "@/lib/reports";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Reports" };

/**
 * The default report (Active Loans for the current business day) is built on
 * the server so the table is part of the first paint. Changing the type or the
 * date range still fetches client-side, as before.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const requested = params?.tab;
  const type: ReportType =
    requested === "loans-closed" || requested === "collections" || requested === "loans-active"
      ? requested
      : "loans-active";
  const today = isoDateIST(new Date());
  let initialData: ReportData | null = null;
  try {
    const session = await readSession();
    await dbConnect();
    initialData = await runForSession(session?.tenantId ?? null, () =>
      buildReport({ type, from: today, to: today })
    );
  } catch {
    // The view falls back to its own fetch when the server render fails.
  }
  return <ReportsView initialData={initialData} initialRange={{ type, from: today, to: today }} />;
}

import type { Metadata } from "next";
import { LoanForm, type LoanTypeOption } from "@/components/loan-form";
import { dbConnect } from "@/lib/db";
import { getAppConfig, DEFAULT_LOAN_TYPES } from "@/models/AppConfig";

export const metadata: Metadata = { title: "New Loan" };

export const dynamic = "force-dynamic";

async function loadLoanTypes(): Promise<LoanTypeOption[]> {
  try {
    await dbConnect();
    const config = await getAppConfig();
    const configured = (config.loanTypes ?? []).filter((t) => t.active && t.name?.trim());
    if (configured.length > 0) {
      return configured.map((t) => ({
        name: t.name,
        defaultInterestType: t.defaultInterestType,
        defaultRate: t.defaultRate,
        defaultTenureMonths: t.defaultTenureMonths,
        defaultEmiDay: t.defaultEmiDay,
      }));
    }
  } catch {
    // Fall back to the built-in options below.
  }
  return DEFAULT_LOAN_TYPES.map((t) => ({ name: t.name }));
}

export default async function NewLoanPage() {
  const loanTypes = await loadLoanTypes();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">New Loan</h1>
        <p className="text-sm text-zinc-500">
          Register a customer, vehicle and repayment plan to disburse a new loan.
        </p>
      </div>
      <LoanForm loanTypes={loanTypes} />
    </div>
  );
}
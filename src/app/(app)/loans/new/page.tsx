import type { Metadata } from "next";
import { LoanForm } from "@/components/loan-form";

export const metadata: Metadata = { title: "New Loan" };

export default function NewLoanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">New Loan</h1>
        <p className="text-sm text-zinc-500">
          Register a customer, vehicle and repayment plan to disburse a new loan.
        </p>
      </div>
      <LoanForm />
    </div>
  );
}
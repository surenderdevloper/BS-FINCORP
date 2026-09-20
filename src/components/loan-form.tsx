"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select, SectionHeading } from "@/components/form";
import { Icon } from "@/components/icons";
import { calcLoanSummary, type InterestType } from "@/lib/emi";
import {
  isValidAadhaar,
  isValidMobile,
  isValidPan,
  validateFinancialShape,
} from "@/lib/validators";
import { inr } from "@/lib/money";
import type { LoanFormPayload } from "@/types";

interface CustomerSearchResult {
  _id: string;
  name: string;
  fatherName: string;
  mobile: string;
  aadhaar: string;
  pan: string;
  dob: string | null;
  address: string;
}

interface ApiError {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const emptyCustomer = {
  name: "",
  fatherName: "",
  mobile: "",
  aadhaar: "",
  pan: "",
  dob: "",
  address: "",
};

const emptyVehicle = { name: "", model: "", engineNo: "", chassisNo: "", regNo: "", loanType: "2 Wheeler" };
const emptyGuarantor = { name: "", mobile: "", relation: "", address: "" };

export function LoanForm() {
  const router = useRouter();

  const [tab, setTab] = useState(0);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  const [vehicle, setVehicle] = useState(emptyVehicle);
  const [financial, setFinancial] = useState({
    vehiclePrice: "",
    downPayment: "",
    interestRate: "12",
    interestType: "flat" as InterestType,
    tenureMonths: "12",
    emiDay: "5",
    startDate: "",
  });
  const [guarantor, setGuarantor] = useState(emptyGuarantor);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdLoan, setCreatedLoan] = useState<{
    loanNo: string;
    monthlyEmi: number;
    totalPayable: number;
    totalInterest: number;
    customerName: string;
  } | null>(null);

  const vehiclePrice = Number(financial.vehiclePrice) || 0;
  const downPayment = Number(financial.downPayment) || 0;
  const loanAmount = vehiclePrice - downPayment;
  const interestRate = Number(financial.interestRate) || 0;
  const tenureMonths = Number(financial.tenureMonths) || 0;
  const emiDay = Number(financial.emiDay) || 0;

  const finError = validateFinancialShape({
    vehiclePrice,
    downPayment,
    interestRate,
    tenureMonths,
    emiDay,
  });

  const summary = useMemo(
    () =>
      calcLoanSummary({
        principal: Math.max(0, loanAmount),
        interestRate,
        tenureMonths,
        interestType: financial.interestType,
      }),
    [loanAmount, interestRate, tenureMonths, financial.interestType]
  );

  const canCalculate =
    Object.keys(finError).length === 0 && loanAmount > 0 && interestRate > 0 && tenureMonths > 0;

  const sections = ["Customer", "Vehicle", "Financial", "Guarantor"];

  async function runSearch(q: string) {
    setSearch(q);
    setSelectedCustomer(null);
    setCustomerId(undefined);
    setCustomer(emptyCustomer);
    setFieldErrors({});
    if (!q.trim() || q.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchBusy(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setSearchResults(data.customers ?? []);
    } finally {
      setSearchBusy(false);
    }
  }

  function chooseCustomer(c: CustomerSearchResult) {
    setSelectedCustomer(c);
    setCustomerId(c._id);
    setCustomer({
      name: c.name,
      fatherName: c.fatherName ?? "",
      mobile: c.mobile,
      aadhaar: c.aadhaar ?? "",
      pan: c.pan ?? "",
      dob: c.dob ? c.dob.slice(0, 10) : "",
      address: c.address ?? "",
    });
    setSearch("");
    setSearchResults([]);
    setTab(1);
  }

  function setField(group: "customer" | "vehicle" | "financial" | "guarantor", key: string, value: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    if (group === "customer") setCustomer((c) => ({ ...c, [key]: value }));
    if (group === "vehicle") setVehicle((v) => ({ ...v, [key]: value }));
    if (group === "guarantor") setGuarantor((g) => ({ ...g, [key]: value }));
    if (group === "financial") setFinancial((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError("");
    const errors: Record<string, string> = {};

    if (!customerId) {
      if (!customer.name.trim()) errors.name = "Customer name is required.";
      if (!isValidMobile(customer.mobile)) errors.mobile = "Enter a valid 10-digit mobile number.";
      if (customer.aadhaar && !isValidAadhaar(customer.aadhaar))
        errors.aadhaar = "Aadhaar must be 12 digits.";
      if (customer.pan && !isValidPan(customer.pan)) errors.pan = "Invalid PAN format.";
    }
    if (!vehicle.name.trim()) errors.vehicleName = "Vehicle name is required.";
    Object.entries(finError).forEach(([k, v]) => (errors[k] = v));

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstWithError = ["name", "mobile", "vehicleName", "vehiclePrice"].find((k) => errors[k]);
      const targetTab = firstWithError === "vehicleName" ? 1 : ["vehiclePrice", "downPayment", "interestRate", "tenureMonths", "emiDay", "startDate"].includes(firstWithError ?? "") ? 2 : 0;
      setTab(targetTab);
      return;
    }

    const payload: LoanFormPayload = {
      customerId,
      customer,
      vehicle,
      financial: {
        vehiclePrice,
        downPayment,
        interestRate,
        interestType: financial.interestType,
        tenureMonths,
        emiDay,
        startDate: financial.startDate,
      },
      guarantor,
    };

    setBusy(true);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: (LoanFormPayload & ApiError & { loan?: { loanNo: string; monthlyEmi: number; totalPayable: number; totalInterest: number } }) =
        await res.json();
      if (!res.ok || !data.loan) {
        const apiErrors = (data as ApiError).fieldErrors ?? {};
        setFieldErrors(apiErrors);
        setError((data as ApiError).error ?? "Could not create the loan.");
        if (Object.keys(apiErrors).length) {
          const firstErr = Object.keys(apiErrors)[0];
          if (firstErr === "vehicleName") setTab(1);
          else if (["name", "mobile", "aadhaar", "pan", "dob", "fatherName"].includes(firstErr)) setTab(0);
          else setTab(2);
        }
        return;
      }
      setCreatedLoan({
        loanNo: data.loan.loanNo,
        monthlyEmi: data.loan.monthlyEmi,
        totalPayable: data.loan.totalPayable,
        totalInterest: data.loan.totalInterest,
        customerName: customer.name || selectedCustomer?.name || "",
      });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (createdLoan) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon name="check" size={28} />
          </span>
          <h2 className="text-xl font-bold text-zinc-900">Loan created successfully</h2>
          <p className="mt-1 text-sm text-zinc-500">for {createdLoan.customerName}</p>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Loan No</dt>
              <dd className="mt-1 font-mono text-sm font-bold text-zinc-900">{createdLoan.loanNo}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Monthly EMI</dt>
              <dd className="mt-1 text-sm font-bold text-emerald-700">{inr(createdLoan.monthlyEmi)}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Total Payable</dt>
              <dd className="mt-1 text-sm font-bold text-zinc-900">{inr(createdLoan.totalPayable)}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Total Interest</dt>
              <dd className="mt-1 text-sm font-bold text-amber-700">{inr(createdLoan.totalInterest)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setCreatedLoan(null);
                resetForm();
              }}
            >
              Create Another Loan
            </Button>
            <Button className="flex-1" onClick={() => router.push("/customers")}>
              Go to Customers
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  function resetForm() {
    setCustomer(emptyCustomer);
    setCustomerId(undefined);
    setSelectedCustomer(null);
    setSearch("");
    setSearchResults([]);
    setVehicle(emptyVehicle);
    setFinancial({ ...financial, startDate: "" });
    setGuarantor(emptyGuarantor);
    setFieldErrors({});
    setError("");
    setTab(0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          {/* Section tabs (kept visible on all screen sizes) */}
          <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 p-2">
            {sections.map((s, i) => (
              <button
                key={s}
                onClick={() => setTab(i)}
                className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
                  tab === i ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                <span className="mr-1.5 hidden sm:inline">{i + 1}.</span>
                {s}
              </button>
            ))}
          </div>

          <div className="space-y-6 p-4 sm:p-6">
            {tab === 0 && (
              <section>
                <SectionHeading
                  step={1}
                  title="Customer Details"
                  description="Search for an existing customer or enter a new one."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Search existing customer (3+ characters)" hint="By name, mobile or Aadhaar">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                          <Icon name="search" size={16} />
                        </span>
                        <Input
                          className="pl-9"
                          placeholder="e.g. Ramesh Kumar or 98xxxxxx21"
                          value={search}
                          onChange={(e) => runSearch(e.target.value)}
                        />
                      </div>
                    </Field>
                    {searching && search.length >= 3 && (
                      <ul className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
                        {searchBusy && !searchResults.length ? (
                          <li className="px-3 py-2.5 text-sm text-zinc-500">Searching…</li>
                        ) : searchResults.length === 0 ? (
                          <li className="px-3 py-2.5 text-sm text-zinc-500">
                            No matches. Fill the new-customer form below.
                          </li>
                        ) : (
                          searchResults.map((c) => (
                            <li key={c._id}>
                              <button
                                type="button"
                                onClick={() => chooseCustomer(c)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-emerald-50"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-zinc-900">{c.name}</span>
                                  <span className="block text-xs text-zinc-500">
                                    {c.mobile} · {c.aadhaar || "no aadhaar"}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs font-medium text-emerald-600">Select</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                    {selectedCustomer ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                        <Icon name="check" size={14} />
                        Using existing customer — {selectedCustomer.name} ({selectedCustomer.mobile})
                        <button
                          type="button"
                          className="ml-1 font-semibold underline"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerId(undefined);
                            setCustomer(emptyCustomer);
                          }}
                        >
                          Change
                        </button>
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">
                        For a new customer, fill in the details below.
                      </p>
                    )}
                  </div>

                  <Field label="Customer Name" required error={fieldErrors.name}>
                    <Input
                      disabled={!!selectedCustomer}
                      value={customer.name}
                      invalid={!!fieldErrors.name}
                      placeholder="Full name as per ID proof"
                      onChange={(e) => setField("customer", "name", e.target.value)}
                    />
                  </Field>
                  <Field label="Father's Name">
                    <Input
                      disabled={!!selectedCustomer}
                      value={customer.fatherName}
                      placeholder="Father / husband name"
                      onChange={(e) => setField("customer", "fatherName", e.target.value)}
                    />
                  </Field>
                  <Field label="Mobile Number" required error={fieldErrors.mobile}>
                    <Input
                      disabled={!!selectedCustomer}
                      value={customer.mobile}
                      invalid={!!fieldErrors.mobile}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      onChange={(e) => setField("customer", "mobile", e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                  <Field label="Aadhaar Number" error={fieldErrors.aadhaar}>
                    <Input
                      disabled={!!selectedCustomer}
                      value={customer.aadhaar}
                      invalid={!!fieldErrors.aadhaar}
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="12-digit Aadhaar"
                      onChange={(e) => setField("customer", "aadhaar", e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                  <Field label="PAN Number" error={fieldErrors.pan}>
                    <Input
                      disabled={!!selectedCustomer}
                      value={customer.pan}
                      invalid={!!fieldErrors.pan}
                      maxLength={10}
                      className="uppercase"
                      placeholder="ABCDE1234F"
                      onChange={(e) => setField("customer", "pan", e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Date of Birth">
                    <Input
                      disabled={!!selectedCustomer}
                      type="date"
                      value={customer.dob}
                      onChange={(e) => setField("customer", "dob", e.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <Input
                        disabled={!!selectedCustomer}
                        value={customer.address}
                        placeholder="House no, street, area, city"
                        onChange={(e) => setField("customer", "address", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </section>
            )}

            {tab === 1 && (
              <section>
                <SectionHeading
                  step={2}
                  title="Vehicle Details"
                  description="The vehicle that is financed under this loan."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vehicle Name" required error={fieldErrors.vehicleName}>
                    <Input
                      value={vehicle.name}
                      invalid={!!fieldErrors.vehicleName}
                      placeholder="e.g. Honda Activa 6G"
                      onChange={(e) => setField("vehicle", "name", e.target.value)}
                    />
                  </Field>
                  <Field label="Model">
                    <Input
                      value={vehicle.model}
                      placeholder="e.g. DX BS6"
                      onChange={(e) => setField("vehicle", "model", e.target.value)}
                    />
                  </Field>
                  <Field label="Engine Number">
                    <Input
                      value={vehicle.engineNo}
                      placeholder="Engine no."
                      onChange={(e) => setField("vehicle", "engineNo", e.target.value)}
                    />
                  </Field>
                  <Field label="Chassis Number">
                    <Input
                      value={vehicle.chassisNo}
                      placeholder="Chassis no."
                      onChange={(e) => setField("vehicle", "chassisNo", e.target.value)}
                    />
                  </Field>
                  <Field label="Registration Number">
                    <Input
                      value={vehicle.regNo}
                      className="uppercase"
                      placeholder="e.g. GJ01AB1234"
                      onChange={(e) => setField("vehicle", "regNo", e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Loan Type">
                    <Select
                      value={vehicle.loanType}
                      onChange={(e) => setField("vehicle", "loanType", e.target.value)}
                    >
                      <option>2 Wheeler</option>
                      <option>3 Wheeler</option>
                      <option>4 Wheeler</option>
                      <option>Other</option>
                    </Select>
                  </Field>
                </div>
              </section>
            )}

            {tab === 2 && (
              <section>
                <SectionHeading
                  step={3}
                  title="Loan Financial Details"
                  description="Price, down payment and repayment plan."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vehicle Price (₹)" required error={fieldErrors.vehiclePrice}>
                    <Input
                      type="number"
                      min={0}
                      value={financial.vehiclePrice}
                      invalid={!!fieldErrors.vehiclePrice}
                      placeholder="e.g. 90000"
                      onChange={(e) => setField("financial", "vehiclePrice", e.target.value)}
                    />
                  </Field>
                  <Field label="Down Payment (₹)" required error={fieldErrors.downPayment}>
                    <Input
                      type="number"
                      min={0}
                      value={financial.downPayment}
                      invalid={!!fieldErrors.downPayment}
                      placeholder="e.g. 15000"
                      onChange={(e) => setField("financial", "downPayment", e.target.value)}
                    />
                  </Field>
                  <Field label="Loan Amount (₹)" hint="Auto-calculated: price − down payment">
                    <Input value={loanAmount > 0 ? String(loanAmount) : ""} disabled placeholder="—" />
                  </Field>
                  <Field label="Interest Rate (%)" required error={fieldErrors.interestRate}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={financial.interestRate}
                      invalid={!!fieldErrors.interestRate}
                      onChange={(e) => setField("financial", "interestRate", e.target.value)}
                    />
                  </Field>
                  <Field label="Interest Scheme" required>
                    <Select
                      value={financial.interestType}
                      onChange={(e) => setField("financial", "interestType", e.target.value)}
                    >
                      <option value="flat">Flat Interest</option>
                      <option value="reducing">Reducing Balance</option>
                    </Select>
                  </Field>
                  <Field label="Tenure (months)" required error={fieldErrors.tenureMonths}>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={financial.tenureMonths}
                      invalid={!!fieldErrors.tenureMonths}
                      onChange={(e) => setField("financial", "tenureMonths", e.target.value)}
                    />
                  </Field>
                  <Field label="EMI Date (day of month)" required error={fieldErrors.emiDay}>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={financial.emiDay}
                      invalid={!!fieldErrors.emiDay}
                      onChange={(e) => setField("financial", "emiDay", e.target.value)}
                    />
                  </Field>
                  <Field label="Loan Start Date" required hint="First EMI falls due one month after this date">
                    <Input
                      type="date"
                      value={financial.startDate}
                      onChange={(e) => setField("financial", "startDate", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        EMI Calculator
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-600">
                        {canCalculate
                          ? `Live calculation for a ₹${loanAmount.toLocaleString("en-IN")} loan at ${interestRate}% ${
                              financial.interestType === "flat" ? "flat" : "reducing-balance"
                            } over ${tenureMonths} months.`
                          : "Fill the highlighted fields to calculate the EMI."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!canCalculate}
                      onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
                    >
                      <Icon name="cash" size={16} /> Calculate EMI
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                    <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
                      <p className="text-[11px] font-medium text-zinc-400">Monthly EMI</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">
                        {canCalculate ? inr(summary.monthlyEmi) : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
                      <p className="text-[11px] font-medium text-zinc-400">Total Payable</p>
                      <p className="mt-1 text-lg font-bold text-zinc-900">
                        {canCalculate ? inr(summary.totalPayable) : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
                      <p className="text-[11px] font-medium text-zinc-400">Total Interest</p>
                      <p className="mt-1 text-lg font-bold text-amber-600">
                        {canCalculate ? inr(summary.totalInterest) : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
                      <p className="text-[11px] font-medium text-zinc-400">Loan Amount</p>
                      <p className="mt-1 text-lg font-bold text-zinc-900">
                        {loanAmount > 0 ? inr(loanAmount) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === 3 && (
              <section>
                <SectionHeading
                  step={4}
                  title="Guarantor Details"
                  description="Optional co-borrower / guarantor for the loan."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guarantor Name">
                    <Input
                      value={guarantor.name}
                      placeholder="Guarantor full name"
                      onChange={(e) => setField("guarantor", "name", e.target.value)}
                    />
                  </Field>
                  <Field label="Mobile">
                    <Input
                      value={guarantor.mobile}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      onChange={(e) => setField("guarantor", "mobile", e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                  <Field label="Relation">
                    <Input
                      value={guarantor.relation}
                      placeholder="e.g. Friend, Relative"
                      onChange={(e) => setField("guarantor", "relation", e.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <Input
                        value={guarantor.address}
                        placeholder="Guarantor address"
                        onChange={(e) => setField("guarantor", "address", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </section>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              <Button variant="ghost" disabled={tab === 0} onClick={() => setTab((t) => Math.max(0, t - 1))}>
                Previous
              </Button>
              {tab < 3 ? (
                <Button onClick={() => setTab((t) => Math.min(3, t + 1))}>
                  Next: {sections[tab + 1]}
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={busy}>
                  {busy ? "Creating loan…" : "Create Loan"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Side summary */}
      <aside className="space-y-4 lg:col-span-1">
        <Card>
          <CardHeader title="Loan Summary" />
          <dl className="space-y-2.5 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Vehicle</dt>
              <dd className="font-medium text-zinc-900">{vehicle.name || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Customer</dt>
              <dd className="font-medium text-zinc-900">{customer.name || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Loan Amount</dt>
              <dd className="font-medium text-zinc-900">{loanAmount > 0 ? inr(loanAmount) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Rate / Tenure</dt>
              <dd className="font-medium text-zinc-900">
                {interestRate > 0 ? `${interestRate}%` : "—"}
                {tenureMonths > 0 ? ` · ${tenureMonths}m` : ""}
              </dd>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2.5">
              <dt className="font-medium text-zinc-500">Monthly EMI</dt>
              <dd className="font-bold text-emerald-700">
                {canCalculate ? inr(summary.monthlyEmi) : "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-zinc-500">
            The loan, its EMI schedule and a receipt series are created automatically when you submit.
            Overdue EMIs are penalized according to the penalty rules configured in Settings.
          </p>
        </Card>
      </aside>
    </div>
  );
}
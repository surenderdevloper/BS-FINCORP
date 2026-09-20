"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select, SectionHeading } from "@/components/form";
import { Icon } from "@/components/icons";
import {
  isValidMobile,
  isValidAadhaar,
  isValidPan,
  validateFinancialShape,
} from "@/lib/validators";
import { calcLoanSummary, type InterestType } from "@/lib/emi";
import { formatDate, inr } from "@/lib/money";
import type { CustomerFormData, FinancialFormData, GuarantorFormData, VehicleFormData } from "@/types";
import type { LoanDetail, LoanSummary } from "@/lib/loans";

const emptyCustomer = (): CustomerFormData => ({
  name: "",
  fatherName: "",
  mobile: "",
  altMobile: "",
  aadhaar: "",
  pan: "",
  dob: "",
  address: "",
  city: "",
  state: "",
});

const emptyVehicle = (): VehicleFormData => ({
  name: "",
  model: "",
  engineNo: "",
  chassisNo: "",
  regNo: "",
  loanType: "2 Wheeler",
  dealerName: "",
});

const emptyFinancial = (): FinancialFormData => ({
  vehiclePrice: 0,
  downPayment: 0,
  interestRate: 12,
  interestType: "flat",
  tenureMonths: 12,
  emiDay: 5,
  startDate: "",
});

const emptyGuarantor = (): GuarantorFormData => ({ name: "", mobile: "", relation: "", address: "" });

interface CustomerSummary {
  _id: string;
  name: string;
  fatherName?: string;
  mobile: string;
  altMobile?: string;
  aadhaar?: string;
  pan?: string;
  dob?: string | null;
  address?: string;
  city?: string;
  state?: string;
}

function fillFromLoan(l: LoanDetail) {
  return {
    personal: {
      name: l.customer.name,
      fatherName: l.customer.fatherName ?? "",
      mobile: l.customer.mobile,
      altMobile: l.customer.altMobile ?? "",
      aadhaar: l.customer.aadhaar ?? "",
      pan: l.customer.pan ?? "",
      dob: l.customer.dob ? l.customer.dob.slice(0, 10) : "",
      address: l.customer.address ?? "",
      city: l.customer.city ?? "",
      state: l.customer.state ?? "",
    },
    vehicle: {
      name: l.vehicle.name,
      model: l.vehicle.model ?? "",
      engineNo: l.vehicle.engineNo ?? "",
      chassisNo: l.vehicle.chassisNo ?? "",
      regNo: l.vehicle.regNo ?? "",
      loanType: l.vehicle.loanType ?? "2 Wheeler",
      dealerName: l.vehicle.dealerName ?? "",
    },
    financial: {
      vehiclePrice: l.financial.vehiclePrice,
      downPayment: l.financial.downPayment,
      interestRate: l.financial.interestRate,
      interestType: (l.financial.interestType as InterestType) ?? "flat",
      tenureMonths: l.financial.tenureMonths,
      emiDay: l.financial.emiDay,
      startDate: l.startDate.slice(0, 10),
    },
    guarantor: {
      name: l.guarantor?.name ?? "",
      mobile: l.guarantor?.mobile ?? "",
      relation: l.guarantor?.relation ?? "",
      address: l.guarantor?.address ?? "",
    },
  };
}

export function EditCustomerForm({
  preselectedId,
  preselectedLoan,
}: {
  preselectedId?: string;
  preselectedLoan?: string;
}) {
  const [search, setSearch] = useState(preselectedLoan ?? "");
  const [results, setResults] = useState<LoanSummary[]>([]);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [customerOnly, setCustomerOnly] = useState(false);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [personal, setPersonal] = useState<CustomerFormData>(emptyCustomer());
  const [vehicle, setVehicle] = useState<VehicleFormData>(emptyVehicle());
  const [financial, setFinancial] = useState<FinancialFormData>(emptyFinancial());
  const [guarantor, setGuarantor] = useState<GuarantorFormData>(emptyGuarantor());
  const [tab, setTab] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyLoan = useCallback((l: LoanDetail, searchText: string) => {
    const filled = fillFromLoan(l);
    setLoan(l);
    setCustomerOnly(false);
    setCustomerId(l.customer._id);
    setPersonal(filled.personal);
    setVehicle(filled.vehicle);
    setFinancial(filled.financial);
    setGuarantor(filled.guarantor);
    if (searchText) setSearch(searchText);
    setResults([]);
    setTab(0);
    setFieldErrors({});
    setError(null);
    setSaved(false);
    setSavedMsg("");
  }, []);

  const loadLoan = useCallback(
    async (loanNo: string) => {
      try {
        const res = await fetch(`/api/loans/${loanNo}`, { cache: "no-store" });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { loan: LoanDetail };
        applyLoan(data.loan, loanNo);
      } catch {
        setError("Could not load the loan. Please check the loan number.");
      }
    },
    [applyLoan]
  );

  const applyCustomerOnly = useCallback((c: CustomerSummary) => {
    setLoan(null);
    setCustomerOnly(true);
    setCustomerId(c._id);
    setPersonal({
      name: c.name,
      fatherName: c.fatherName ?? "",
      mobile: c.mobile,
      altMobile: c.altMobile ?? "",
      aadhaar: c.aadhaar ?? "",
      pan: c.pan ?? "",
      dob: c.dob ? c.dob.slice(0, 10) : "",
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
    });
    setResults([]);
    setFieldErrors({});
    setError(null);
    setSaved(false);
    setSavedMsg("");
  }, []);

  useEffect(() => {
    if (preselectedLoan) {
      const t = setTimeout(() => void loadLoan(preselectedLoan), 0);
      return () => clearTimeout(t);
    }
    if (preselectedId) {
      const t = setTimeout(() => {
        void (async () => {
          try {
            const res = await fetch(`/api/customers/${preselectedId}`, { cache: "no-store" });
            if (res.ok) {
              const data = (await res.json()) as { customer: CustomerSummary };
              applyCustomerOnly(data.customer);
            }
          } catch {
            /* ignore prefetch failure */
          }
        })();
      }, 0);
      return () => clearTimeout(t);
    }
    return;
  }, [preselectedLoan, preselectedId, loadLoan, applyCustomerOnly]);

  const onSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!v.trim()) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/loans?search=${encodeURIComponent(v)}&limit=10`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { loans: LoanSummary[] };
        setResults(data.loans.filter((l) => l.customer.name));
        setLoan(null);
        setCustomerOnly(false);
      } catch {
        setError("Search failed.");
      }
    }, 350);
  };

  const setField = (group: "personal" | "vehicle" | "financial" | "guarantor", key: string, value: string | number) => {
    setFieldErrors((prev) => ({ ...prev, [key]: "", vehicleName: "", startDate: "" }));
    setSaved(false);
    setSavedMsg("");
    if (group === "personal") setPersonal((p) => ({ ...p, [key]: value }));
    if (group === "vehicle") setVehicle((v) => ({ ...v, [key]: value }));
    if (group === "guarantor") setGuarantor((g) => ({ ...g, [key]: value }));
    if (group === "financial") setFinancial((f) => ({ ...f, [key]: value }));
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!personal.name.trim()) errors.name = "Customer name is required.";
    if (!isValidMobile(personal.mobile.trim())) errors.mobile = "Enter a valid 10-digit mobile number.";
    if (personal.altMobile && !isValidMobile(personal.altMobile.trim()))
      errors.altMobile = "Alternative mobile must be a valid 10-digit number.";
    if (personal.aadhaar && !isValidAadhaar(personal.aadhaar)) errors.aadhaar = "Aadhaar must be 12 digits.";
    if (personal.pan && !isValidPan(personal.pan)) errors.pan = "PAN must be in format ABCDE1234F.";
    if (!customerOnly) {
      if (!vehicle.name.trim()) errors.vehicleName = "Vehicle name is required.";
      Object.assign(errors, validateFinancialShape({
        vehiclePrice: Number(financial.vehiclePrice),
        downPayment: Number(financial.downPayment),
        interestRate: Number(financial.interestRate),
        tenureMonths: Number(financial.tenureMonths),
        emiDay: Number(financial.emiDay),
      }));
      if (!financial.startDate) errors.startDate = "Start date is required.";
    }
    setFieldErrors(errors);
    return errors;
  };

  const financialLocked = !customerOnly && loan !== null && loan.totals.paidCount > 0;

  const onSave = async () => {
    if (!customerId) {
      setError("Select a loan (or a customer) first.");
      return;
    }
    const errors = validate();
    if (Object.keys(errors).length) {
      setTab(errors.name || errors.mobile ? 0 : errors.vehicleName ? 1 : 2);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let ok = false;
      let res: Response;
      if (customerOnly) {
        res = await fetch(`/api/customers/${customerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(personal),
        });
      } else if (loan) {
        res = await fetch(`/api/loans/${loan.loanNo}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              ...personal,
              aadhaar: personal.aadhaar.trim() || undefined,
              pan: personal.pan.trim().toUpperCase() || undefined,
            },
            vehicle,
            financial,
            guarantor,
          }),
        });
      } else {
        res = new Response(JSON.stringify({ error: "No record selected." }), { status: 400 });
      }
      const data = (await res.json()) as { loan?: LoanDetail; error?: string; fieldErrors?: Record<string, string> };
      ok = res.ok;
      if (!ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        setError(data.error ?? "Could not save changes.");
        return;
      }
      if (data.loan) applyLoan(data.loan, search || (loan?.loanNo ?? ""));
      setSavedMsg(customerOnly ? "Customer details saved." : `Changes saved${financialLocked ? "" : " and schedule updated"} for ${loan?.loanNo ?? ""}.`);
      setSaved(true);
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const sections = ["Customer", "Vehicle", "Financial", "Guarantor"];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Edit Customer</h1>
        <p className="text-sm text-zinc-500">
          Search a loan, then update personal details, vehicle, financial plan or guarantor.
        </p>
      </div>

      <Card>
        <CardHeader title="Find loan" subtitle="Search by loan number or customer name / mobile" />
        <div className="p-4 sm:p-5">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
              <Icon name="search" size={16} />
            </span>
            <Input
              className="pl-9"
              placeholder="e.g. BF-0006 or customer name…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
              {results.map((l) => (
                <li key={l._id}>
                  <button
                    onClick={() => void loadLoan(l.loanNo)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-zinc-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-zinc-900">{l.customer.name}</span>
                      <span className="block text-xs text-zinc-500">{l.vehicle}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={l.status === "closed" ? "zinc" : "green"}>{l.status}</Badge>
                      <span className="font-mono text-xs text-zinc-500">{l.loanNo}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {loan && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <Icon name="check" size={14} />
              Editing loan {loan.loanNo} — {loan.customer.name} ({loan.customer.mobile})
              <span className="mx-1 text-emerald-300">|</span>
              {loan.totals.paidCount} paid / {loan.totals.pendingCount} pending
              {loan.status === "closed" && (
                <span className="text-zinc-400">· closed {loan.closedAt ? formatDate(loan.closedAt) : ""}</span>
              )}
              <button
                type="button"
                className="ml-1 font-semibold underline"
                onClick={() => {
                  setLoan(null);
                  setCustomerOnly(false);
                  setCustomerId(undefined);
                  setSearch("");
                }}
              >
                Change
              </button>
            </p>
          )}
          {customerOnly && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <Icon name="check" size={14} />
              Editing customer {personal.name} ({personal.mobile}) — no loan on record
              <button
                type="button"
                className="ml-1 font-semibold underline"
                onClick={() => {
                  setCustomerOnly(false);
                  setCustomerId(undefined);
                  setSearch("");
                }}
              >
                Change
              </button>
            </p>
          )}
        </div>
      </Card>

      {(loan || customerOnly) && (
        <Card>
          {!customerOnly && (
            <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 p-2">
              {sections.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setTab(i)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
                    tab === i ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-6 p-4 sm:p-6">
            {(!customerOnly ? tab === 0 : true) && (
              <section>
                <SectionHeading step={1} title="Customer Details" description="Personal information of the borrower." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Customer Name" required error={fieldErrors.name}>
                    <Input value={personal.name} invalid={!!fieldErrors.name} onChange={(e) => setField("personal", "name", e.target.value)} />
                  </Field>
                  <Field label="Father's Name">
                    <Input value={personal.fatherName} onChange={(e) => setField("personal", "fatherName", e.target.value)} />
                  </Field>
                  <Field label="Mobile Number" required error={fieldErrors.mobile}>
                    <Input value={personal.mobile} invalid={!!fieldErrors.mobile} inputMode="numeric" maxLength={10} onChange={(e) => setField("personal", "mobile", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="Alternative Mobile Number" error={fieldErrors.altMobile}>
                    <Input value={personal.altMobile} invalid={!!fieldErrors.altMobile} inputMode="numeric" maxLength={10} onChange={(e) => setField("personal", "altMobile", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="Aadhaar Number" error={fieldErrors.aadhaar}>
                    <Input value={personal.aadhaar} invalid={!!fieldErrors.aadhaar} inputMode="numeric" maxLength={12} onChange={(e) => setField("personal", "aadhaar", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="PAN Number" error={fieldErrors.pan}>
                    <Input value={personal.pan} invalid={!!fieldErrors.pan} maxLength={10} className="uppercase" onChange={(e) => setField("personal", "pan", e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Date of Birth">
                    <Input type="date" value={personal.dob} onChange={(e) => setField("personal", "dob", e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <Input value={personal.address} onChange={(e) => setField("personal", "address", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="City">
                    <Input value={personal.city} onChange={(e) => setField("personal", "city", e.target.value)} />
                  </Field>
                  <Field label="State">
                    <Input value={personal.state} onChange={(e) => setField("personal", "state", e.target.value)} />
                  </Field>
                </div>
              </section>
            )}

            {!customerOnly && tab === 1 && (
              <section>
                <SectionHeading step={2} title="Vehicle Details" description="The vehicle financed under this loan." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vehicle Name" required error={fieldErrors.vehicleName}>
                    <Input value={vehicle.name} invalid={!!fieldErrors.vehicleName} onChange={(e) => setField("vehicle", "name", e.target.value)} />
                  </Field>
                  <Field label="Model">
                    <Input value={vehicle.model} onChange={(e) => setField("vehicle", "model", e.target.value)} />
                  </Field>
                  <Field label="Engine Number">
                    <Input value={vehicle.engineNo} onChange={(e) => setField("vehicle", "engineNo", e.target.value)} />
                  </Field>
                  <Field label="Chassis Number">
                    <Input value={vehicle.chassisNo} onChange={(e) => setField("vehicle", "chassisNo", e.target.value)} />
                  </Field>
                  <Field label="Registration Number">
                    <Input value={vehicle.regNo} className="uppercase" onChange={(e) => setField("vehicle", "regNo", e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Dealer Name">
                    <Input value={vehicle.dealerName} onChange={(e) => setField("vehicle", "dealerName", e.target.value)} />
                  </Field>
                  <Field label="Loan Type">
                    <Select value={vehicle.loanType} onChange={(e) => setField("vehicle", "loanType", e.target.value)}>
                      <option>2 Wheeler</option>
                      <option>3 Wheeler</option>
                      <option>4 Wheeler</option>
                      <option>Other</option>
                    </Select>
                  </Field>
                </div>
              </section>
            )}

            {!customerOnly && tab === 2 && (
              <section>
                <SectionHeading step={3} title="Loan Financial Details" description="Price, down payment and repayment plan." />
                {financialLocked && (
                  <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <Icon name="alert" size={15} />
                    Repayment plan is locked because EMIs have already been paid. Loan amount, rate and tenure cannot be changed.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vehicle Price (₹)" required error={financialLocked ? undefined : fieldErrors.vehiclePrice}>
                    <Input type="number" min={0} disabled={financialLocked} value={financial.vehiclePrice} invalid={!!fieldErrors.vehiclePrice} onChange={(e) => setField("financial", "vehiclePrice", Number(e.target.value))} />
                  </Field>
                  <Field label="Down Payment (₹)" required error={financialLocked ? undefined : fieldErrors.downPayment}>
                    <Input type="number" min={0} disabled={financialLocked} value={financial.downPayment} invalid={!!fieldErrors.downPayment} onChange={(e) => setField("financial", "downPayment", Number(e.target.value))} />
                  </Field>
                  <Field label="Interest Rate (%)" required error={financialLocked ? undefined : fieldErrors.interestRate}>
                    <Input type="number" min={0} max={100} step="0.5" disabled={financialLocked} value={financial.interestRate} invalid={!!fieldErrors.interestRate} onChange={(e) => setField("financial", "interestRate", Number(e.target.value))} />
                  </Field>
                  <Field label="Interest Scheme" required>
                    <Select disabled={financialLocked} value={financial.interestType} onChange={(e) => setField("financial", "interestType", e.target.value)}>
                      <option value="flat">Flat Interest</option>
                      <option value="reducing">Reducing Balance</option>
                    </Select>
                  </Field>
                  <Field label="Tenure (months)" required error={financialLocked ? undefined : fieldErrors.tenureMonths}>
                    <Input type="number" min={1} max={60} disabled={financialLocked} value={financial.tenureMonths} invalid={!!fieldErrors.tenureMonths} onChange={(e) => setField("financial", "tenureMonths", Number(e.target.value))} />
                  </Field>
                  <Field label="EMI Date (day of month)" required error={financialLocked ? undefined : fieldErrors.emiDay}>
                    <Input type="number" min={1} max={31} disabled={financialLocked} value={financial.emiDay} invalid={!!fieldErrors.emiDay} onChange={(e) => setField("financial", "emiDay", Number(e.target.value))} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Loan Start Date" required hint="First EMI falls due one month after this date" error={financialLocked ? undefined : fieldErrors.startDate}>
                      <Input type="date" disabled={financialLocked} value={financial.startDate} invalid={!!fieldErrors.startDate} onChange={(e) => setField("financial", "startDate", e.target.value)} />
                    </Field>
                  </div>
                </div>
                {!financialLocked && (
                  <FinancialPreview financial={financial} />
                )}
              </section>
            )}

            {!customerOnly && tab === 3 && (
              <section>
                <SectionHeading step={4} title="Guarantor Details" description="Optional co-borrower / guarantor for the loan." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guarantor Name">
                    <Input value={guarantor.name} onChange={(e) => setField("guarantor", "name", e.target.value)} />
                  </Field>
                  <Field label="Mobile">
                    <Input value={guarantor.mobile} inputMode="numeric" maxLength={10} onChange={(e) => setField("guarantor", "mobile", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                  <Field label="Relation">
                    <Input value={guarantor.relation} onChange={(e) => setField("guarantor", "relation", e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <Input value={guarantor.address} onChange={(e) => setField("guarantor", "address", e.target.value)} />
                    </Field>
                  </div>
                </div>
              </section>
            )}

            {error && (
              <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <Icon name="alert" size={16} /> {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-100 pt-4">
              <div>
                {saved && <span className="text-sm font-medium text-emerald-600">{savedMsg}</span>}
              </div>
              <div className="flex gap-2">
                {!customerOnly && (
                  <Button variant="ghost" disabled={tab === 0} onClick={() => setTab((t) => Math.max(0, t - 1))}>
                    Previous
                  </Button>
                )}
                {!customerOnly && tab < 3 ? (
                  <Button onClick={() => setTab((t) => Math.min(3, t + 1))}>Next: {sections[tab + 1]}</Button>
                ) : (
                  <Button onClick={() => void onSave()} disabled={saving}>
                    <Icon name="check" size={16} />
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FinancialPreview({ financial }: { financial: FinancialFormData }) {
  const loanAmount = Number(financial.vehiclePrice) - Number(financial.downPayment);
  const rate = Number(financial.interestRate);
  const tenure = Number(financial.tenureMonths);
  const valid = loanAmount > 0 && rate > 0 && tenure > 0;
  const summary = calcLoanSummary({ principal: Math.max(0, loanAmount), interestRate: rate, tenureMonths: tenure, interestType: financial.interestType });

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-center sm:grid-cols-4">
      <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
        <p className="text-[11px] font-medium text-zinc-400">Monthly EMI</p>
        <p className="mt-1 text-lg font-bold text-emerald-700">{valid ? inr(summary.monthlyEmi) : "—"}</p>
      </div>
      <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
        <p className="text-[11px] font-medium text-zinc-400">Total Payable</p>
        <p className="mt-1 text-lg font-bold text-zinc-900">{valid ? inr(summary.totalPayable) : "—"}</p>
      </div>
      <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
        <p className="text-[11px] font-medium text-zinc-400">Total Interest</p>
        <p className="mt-1 text-lg font-bold text-amber-600">{valid ? inr(summary.totalInterest) : "—"}</p>
      </div>
      <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
        <p className="text-[11px] font-medium text-zinc-400">Loan Amount</p>
        <p className="mt-1 text-lg font-bold text-zinc-900">{valid ? inr(loanAmount) : "—"}</p>
      </div>
    </div>
  );
}
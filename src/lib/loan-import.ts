import type { LoanFormPayload } from "@/types";
import { isValidMobile, validateCustomerShape, validateFinancialShape } from "@/lib/validators";

export interface LoanTypeDefaults {
  name: string;
  defaultInterestType?: "flat" | "reducing";
  defaultRate?: number;
  defaultTenureMonths?: number;
  defaultEmiDay?: number;
}

export interface LoanImportRecord {
  row: number;
  payload: LoanFormPayload;
  errors: string[];
}

export interface LoanImportParseResult {
  records: LoanImportRecord[];
  headerError?: string;
}

export const LOAN_IMPORT_COLUMNS = [
  "Customer Name",
  "Mobile",
  "Father Name",
  "Alt Mobile",
  "Aadhaar",
  "PAN",
  "DOB",
  "Address",
  "City",
  "State",
  "Vehicle Name",
  "Vehicle Model",
  "Engine No",
  "Chassis No",
  "Reg No",
  "Loan Type",
  "Dealer Name",
  "Vehicle Price",
  "Down Payment",
  "Interest Rate",
  "Interest Type",
  "Tenure Months",
  "EMI Day",
  "Start Date",
  "Guarantor Name",
  "Guarantor Mobile",
  "Guarantor Relation",
  "Guarantor Address",
];

export const LOAN_IMPORT_HELP: string[][] = [
  ["Customer Name", "Yes", "Borrower full name."],
  ["Mobile", "Yes", "10-digit Indian number starting with 6-9. Used to match an existing customer."],
  ["Father Name", "No", "Father, spouse or guardian name."],
  ["Alt Mobile", "No", "Second 10-digit mobile number."],
  ["Aadhaar", "No", "Exactly 12 digits."],
  ["PAN", "No", "Format ABCDE1234F."],
  ["DOB", "No", "Date of birth, e.g. 05-01-1990 or 1990-01-05."],
  ["Address", "No", "House / street address."],
  ["City", "No", "City or town."],
  ["State", "No", "State name."],
  ["Vehicle Name", "Yes", "Vehicle make and name, e.g. Honda Activa 6G."],
  ["Vehicle Model", "No", "Variant or model code."],
  ["Engine No", "No", "Engine serial number."],
  ["Chassis No", "No", "Chassis number."],
  ["Reg No", "No", "Registration / RC number."],
  ["Loan Type", "No", "Must match a loan type configured in Settings (defaults to the first type)."],
  ["Dealer Name", "No", "Dealer or showroom name."],
  ["Vehicle Price", "Yes*", "On-road price. *Alternatively provide Loan Amount if the price is unknown (down payment is then 0)."],
  ["Down Payment", "No", "Advance paid by the customer. Defaults to 0."],
  ["Interest Rate", "Yes", "Annual rate in percent, e.g. 12."],
  ["Interest Type", "No", "flat or reducing. Defaults to flat."],
  ["Tenure Months", "Yes", "Loan term in months, 1 to 60."],
  ["EMI Day", "Yes", "Day of month the EMI is due, 1 to 31."],
  ["Start Date", "Yes", "Disbursement date, e.g. 01-04-2026 or 2026-04-01."],
  ["Guarantor Name", "No", "Guarantor full name."],
  ["Guarantor Mobile", "No", "10-digit Indian number."],
  ["Guarantor Relation", "No", "Relation to the customer."],
  ["Guarantor Address", "No", "Guarantor address."],
];

const FIELD_ALIASES: Record<string, string> = {
  customername: "customerName",
  customer: "customerName",
  customerfullname: "customerName",
  name: "customerName",
  borrowername: "customerName",
  borrower: "customerName",
  applicantname: "customerName",
  applicant: "customerName",
  mobile: "mobile",
  mobileno: "mobile",
  mobilenumber: "mobile",
  phone: "mobile",
  phoneno: "mobile",
  phonenumber: "mobile",
  contactno: "mobile",
  contactnumber: "mobile",
  contact: "mobile",
  fathername: "fatherName",
  father: "fatherName",
  parentname: "fatherName",
  guardianname: "fatherName",
  altmobile: "altMobile",
  alternatemobile: "altMobile",
  alternatenumber: "altMobile",
  altnumber: "altMobile",
  secondarymobile: "altMobile",
  othermobile: "altMobile",
  aadhaar: "aadhaar",
  aadharnumber: "aadhaar",
  aadhaarno: "aadhaar",
  uidai: "aadhaar",
  pan: "pan",
  pannumber: "pan",
  panno: "pan",
  pancard: "pan",
  dob: "dob",
  dateofbirth: "dob",
  birthdate: "dob",
  address: "address",
  fulladdress: "address",
  permanentaddress: "address",
  city: "city",
  town: "city",
  village: "city",
  state: "state",
  statename: "state",
  vehiclename: "vehicleName",
  vehicle: "vehicleName",
  vehiclemake: "vehicleName",
  make: "vehicleName",
  vehicledescription: "vehicleName",
  productname: "vehicleName",
  product: "vehicleName",
  vehiclemodel: "vehicleModel",
  model: "vehicleModel",
  variant: "vehicleModel",
  engineno: "engineNo",
  engine: "engineNo",
  enginesrno: "engineNo",
  chassisno: "chassisNo",
  chassis: "chassisNo",
  regno: "regNo",
  registrationno: "regNo",
  registrationnumber: "regNo",
  vehicleregno: "regNo",
  vehicleregistrationno: "regNo",
  rcno: "regNo",
  rcnumber: "regNo",
  numberplate: "regNo",
  loantype: "loanType",
  loanproduct: "loanType",
  producttype: "loanType",
  dealer: "dealerName",
  dealername: "dealerName",
  showroom: "dealerName",
  showroomname: "dealerName",
  vehicleprice: "vehiclePrice",
  price: "vehiclePrice",
  exshowroomprice: "vehiclePrice",
  exprice: "vehiclePrice",
  onroadprice: "vehiclePrice",
  vehiclecost: "vehiclePrice",
  saleprice: "vehiclePrice",
  invoiceprice: "vehiclePrice",
  downpayment: "downPayment",
  advancepayment: "downPayment",
  downpaymentamount: "downPayment",
  dp: "downPayment",
  loanamount: "loanAmount",
  loanfinanced: "loanAmount",
  financedamount: "loanAmount",
  financeamount: "loanAmount",
  principal: "loanAmount",
  disbursedamount: "loanAmount",
  interestrate: "interestRate",
  rateofinterest: "interestRate",
  rate: "interestRate",
  ratepercent: "interestRate",
  roi: "interestRate",
  interest: "interestRate",
  interesttype: "interestType",
  ratetype: "interestType",
  calculationtype: "interestType",
  interestcalculation: "interestType",
  interestmethod: "interestType",
  tenuremonths: "tenureMonths",
  tenureinmonths: "tenureMonths",
  tenure: "tenureMonths",
  termmonths: "tenureMonths",
  term: "tenureMonths",
  periodmonths: "tenureMonths",
  period: "tenureMonths",
  noofemis: "tenureMonths",
  numberofemis: "tenureMonths",
  emiday: "emiDay",
  emidate: "emiDay",
  instalmentday: "emiDay",
  installmentday: "emiDay",
  paymentday: "emiDay",
  dueday: "emiDay",
  startdate: "startDate",
  disbursedate: "startDate",
  disbursedon: "startDate",
  disbursementdate: "startDate",
  loandate: "startDate",
  issuancedate: "startDate",
  start: "startDate",
  guarantorname: "guarantorName",
  guarantor: "guarantorName",
  guarantormobile: "guarantorMobile",
  guarantorphone: "guarantorMobile",
  guarantormobileno: "guarantorMobile",
  guarantorrelation: "guarantorRelation",
  relation: "guarantorRelation",
  guarantoraddress: "guarantorAddress",
};

const REQUIRED_HEADERS: { field: string; label: string }[] = [
  { field: "customerName", label: "Customer Name" },
  { field: "mobile", label: "Mobile" },
  { field: "vehicleName", label: "Vehicle Name" },
  { field: "interestRate", label: "Interest Rate" },
  { field: "tenureMonths", label: "Tenure Months" },
  { field: "emiDay", label: "EMI Day" },
  { field: "startDate", label: "Start Date" },
];

export function normalizeHeader(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function importText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function importNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value === null || value === undefined) return NaN;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return NaN;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function importDateToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0 || value > 2958465) return null;
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return isoDate(new Date(ms).getUTCFullYear(), new Date(ms).getUTCMonth() + 1, new Date(ms).getUTCDate());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += year > 70 ? 1900 : 2000;
    return isoDate(year, Number(match[2]), Number(match[1]));
  }

  if (/[a-z]/i.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return isoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
  }
  return null;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function firstFinite(value: number, fallback?: number): number {
  if (Number.isFinite(value)) return value;
  return Number.isFinite(fallback as number) ? (fallback as number) : NaN;
}

function parseInterestType(value: unknown): "flat" | "reducing" | null {
  const raw = normalizeHeader(value);
  if (!raw) return null;
  if (raw.includes("reduc")) return "reducing";
  if (raw.includes("flat") || raw.includes("simple")) return "flat";
  return null;
}

export function parseLoanImportSheet(
  aoa: unknown[][],
  loanTypes?: LoanTypeDefaults[]
): LoanImportParseResult {
  const rows = (aoa ?? []).filter((row) => Array.isArray(row));
  const headerRow = rows[0];
  if (!headerRow || headerRow.every((cell) => importText(cell) === "")) {
    return { records: [], headerError: "The file is empty. Download the template to see the expected columns." };
  }

  const colByField = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const field = FIELD_ALIASES[normalizeHeader(cell)];
    if (field && !colByField.has(field)) colByField.set(field, index);
  });

  const missing = REQUIRED_HEADERS.filter((header) => !colByField.has(header.field)).map((header) => header.label);
  if (!colByField.has("vehiclePrice") && !colByField.has("loanAmount")) {
    missing.push("Vehicle Price (or Loan Amount)");
  }
  if (missing.length) {
    return {
      records: [],
      headerError: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template for the expected format.`,
    };
  }

  const cell = (row: unknown[], field: string): unknown => {
    const index = colByField.get(field);
    return index === undefined ? "" : row[index];
  };

  const records: LoanImportRecord[] = [];
  const firstRowByLoan = new Map<string, number>();

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    if (!row.some((value) => importText(value) !== "")) return;

    const mobile = normalizeMobile(importText(cell(row, "mobile")));
    const vehicleName = importText(cell(row, "vehicleName"));
    const startDate = importDateToIso(cell(row, "startDate"));
    const dobRaw = importText(cell(row, "dob"));

    const loanTypeName = importText(cell(row, "loanType")) || loanTypes?.[0]?.name || "2 Wheeler";
    const typeDefaults = loanTypes?.find((option) => option.name.toLowerCase() === loanTypeName.toLowerCase());

    const priceFromSheet = importNumber(cell(row, "vehiclePrice"));
    const financedAmount = importNumber(cell(row, "loanAmount"));
    let vehiclePrice = priceFromSheet;
    let downPayment = importNumber(cell(row, "downPayment"));
    if (!Number.isFinite(vehiclePrice) && Number.isFinite(financedAmount)) vehiclePrice = financedAmount;
    if (!Number.isFinite(downPayment)) downPayment = 0;

    const payload: LoanFormPayload = {
      customer: {
        name: importText(cell(row, "customerName")),
        mobile,
        fatherName: importText(cell(row, "fatherName")),
        altMobile: normalizeMobile(importText(cell(row, "altMobile"))),
        aadhaar: importText(cell(row, "aadhaar")).replace(/\D/g, ""),
        pan: importText(cell(row, "pan")).toUpperCase(),
        dob: dobRaw ? importDateToIso(dobRaw) ?? "" : "",
        address: importText(cell(row, "address")),
        city: importText(cell(row, "city")),
        state: importText(cell(row, "state")),
      },
      vehicle: {
        name: vehicleName,
        model: importText(cell(row, "vehicleModel")),
        engineNo: importText(cell(row, "engineNo")),
        chassisNo: importText(cell(row, "chassisNo")),
        regNo: importText(cell(row, "regNo")),
        loanType: loanTypeName,
        dealerName: importText(cell(row, "dealerName")),
      },
      financial: {
        vehiclePrice,
        downPayment,
        interestRate: firstFinite(importNumber(cell(row, "interestRate")), typeDefaults?.defaultRate),
        interestType: parseInterestType(cell(row, "interestType")) ?? typeDefaults?.defaultInterestType ?? "flat",
        tenureMonths: firstFinite(importNumber(cell(row, "tenureMonths")), typeDefaults?.defaultTenureMonths),
        emiDay: firstFinite(importNumber(cell(row, "emiDay")), typeDefaults?.defaultEmiDay),
        startDate: startDate ?? "",
      },
      guarantor: {
        name: importText(cell(row, "guarantorName")),
        mobile: normalizeMobile(importText(cell(row, "guarantorMobile"))),
        relation: importText(cell(row, "guarantorRelation")),
        address: importText(cell(row, "guarantorAddress")),
      },
    };

    const errors: string[] = [];
    if (!payload.vehicle.name) errors.push("Vehicle name is required.");
    if (!startDate) errors.push("Start date is required (use a format like 01-04-2026 or 2026-04-01).");
    if (dobRaw && !payload.customer?.dob) errors.push("DOB must be a valid date.");

    Object.values(
      validateCustomerShape({
        name: payload.customer?.name ?? "",
        mobile: payload.customer?.mobile ?? "",
        altMobile: payload.customer?.altMobile,
        aadhaar: payload.customer?.aadhaar,
        pan: payload.customer?.pan,
      })
    ).forEach((message) => errors.push(message));
    Object.values(
      validateFinancialShape({
        vehiclePrice: payload.financial.vehiclePrice,
        downPayment: payload.financial.downPayment,
        interestRate: payload.financial.interestRate,
        tenureMonths: payload.financial.tenureMonths,
        emiDay: payload.financial.emiDay,
      })
    ).forEach((message) => errors.push(message));

    if (payload.guarantor.mobile && !isValidMobile(payload.guarantor.mobile)) {
      errors.push("Guarantor mobile must be a valid 10-digit number.");
    }

    const duplicateKey = `${mobile}|${vehicleName.toLowerCase()}|${startDate ?? ""}`;
    if (mobile) {
      const existingRow = firstRowByLoan.get(duplicateKey);
      if (existingRow) {
        errors.push(`Duplicate of row ${existingRow} inside this file.`);
      } else {
        firstRowByLoan.set(duplicateKey, rowNumber);
      }
    }

    records.push({ row: rowNumber, payload, errors: Array.from(new Set(errors)) });
  });

  if (!records.length) {
    return { records, headerError: "No data rows were found below the header row." };
  }
  return { records };
}

export async function downloadLoanTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const sheet = XLSX.utils.aoa_to_sheet([LOAN_IMPORT_COLUMNS]);
  sheet["!cols"] = LOAN_IMPORT_COLUMNS.map((column) => ({ wch: Math.max(column.length + 2, 14) }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Loans");

  const help = XLSX.utils.aoa_to_sheet([["Column", "Required", "Notes"], ...LOAN_IMPORT_HELP]);
  help["!cols"] = [{ wch: 22 }, { wch: 11 }, { wch: 74 }];
  XLSX.utils.book_append_sheet(workbook, help, "Help");

  XLSX.writeFile(workbook, `loan-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

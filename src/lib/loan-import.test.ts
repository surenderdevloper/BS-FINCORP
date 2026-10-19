import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_IMPORT_COLUMNS,
  importDateToIso,
  importNumber,
  importText,
  normalizeHeader,
  parseLoanImportSheet,
} from "./loan-import";

const HEADER = [...LOAN_IMPORT_COLUMNS];

function row(values: Partial<Record<string, unknown>>): unknown[] {
  return HEADER.map((column) => values[column] ?? "");
}

const baseRow = {
  "Customer Name": "Ramesh Kumar",
  Mobile: "9876543210",
  "Vehicle Name": "Honda Activa 6G",
  "Vehicle Price": 85000,
  "Down Payment": 15000,
  "Interest Rate": 12,
  "Interest Type": "Flat",
  "Tenure Months": 12,
  "EMI Day": 5,
  "Start Date": "2026-04-01",
};

test("normalizeHeader strips case, spaces and punctuation", () => {
  assert.equal(normalizeHeader("Vehicle Price"), "vehicleprice");
  assert.equal(normalizeHeader("  Down-Payment "), "downpayment");
  assert.equal(normalizeHeader(undefined), "");
});

test("importNumber strips currency symbols, grouping commas and percent signs", () => {
  assert.equal(importNumber(85000), 85000);
  assert.equal(importNumber("₹1,23,500.50"), 123500.5);
  assert.equal(importNumber("12%"), 12);
  assert.equal(importNumber("15,000"), 15000);
  assert.ok(Number.isNaN(importNumber("")));
  assert.ok(Number.isNaN(importNumber("free")));
});

test("importDateToIso accepts ISO, day-first, Date objects and Excel serials", () => {
  assert.equal(importDateToIso("2026-04-01"), "2026-04-01");
  assert.equal(importDateToIso("01-04-2026"), "2026-04-01");
  assert.equal(importDateToIso("1/4/2026"), "2026-04-01");
  assert.equal(importDateToIso("05-01-1990"), "1990-01-05");
  assert.equal(importDateToIso(46113), "2026-04-01");
  assert.equal(importDateToIso(new Date(Date.UTC(2026, 3, 1))), "2026-04-01");
  assert.equal(importDateToIso("31/02/2026"), null);
  assert.equal(importDateToIso(""), null);
  assert.equal(importDateToIso("not a date"), null);
});

test("importText renders Date cells as ISO dates and trims text", () => {
  assert.equal(importText(new Date(Date.UTC(2026, 3, 1))), "2026-04-01");
  assert.equal(importText("  Ramesh  "), "Ramesh");
  assert.equal(importText(null), "");
});

test("a valid row parses into a loan payload ready for submission", () => {
  const result = parseLoanImportSheet([HEADER, row(baseRow)]);

  assert.equal(result.headerError, undefined);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.row, 2);
  assert.deepEqual(record.errors, []);
  assert.equal(record.payload.customer?.name, "Ramesh Kumar");
  assert.equal(record.payload.customer?.mobile, "9876543210");
  assert.equal(record.payload.vehicle.name, "Honda Activa 6G");
  assert.equal(record.payload.vehicle.loanType, "2 Wheeler");
  assert.equal(record.payload.financial.vehiclePrice, 85000);
  assert.equal(record.payload.financial.downPayment, 15000);
  assert.equal(record.payload.financial.interestRate, 12);
  assert.equal(record.payload.financial.interestType, "flat");
  assert.equal(record.payload.financial.tenureMonths, 12);
  assert.equal(record.payload.financial.emiDay, 5);
  assert.equal(record.payload.financial.startDate, "2026-04-01");
});

test("alternative header spellings and phone formats are accepted", () => {
  const header = [
    "Borrower Name",
    "Phone No",
    "Vehicle",
    "Loan Financed",
    "Advance Payment",
    "ROI",
    "Tenure",
    "EMI Date",
    "Disbursed On",
    "Loan Type",
  ];
  const result = parseLoanImportSheet([
    header,
    ["Sunita Devi", "+91 98111 22333", "TVS Jupiter", 60000, 10000, 15, 24, 1, "2026-04-01", "3 Wheeler"],
  ]);

  assert.equal(result.headerError, undefined);
  const record = result.records[0];
  assert.deepEqual(record.errors, []);
  assert.equal(record.payload.customer?.name, "Sunita Devi");
  assert.equal(record.payload.customer?.mobile, "9811122333");
  assert.equal(record.payload.vehicle.name, "TVS Jupiter");
    assert.equal(record.payload.financial.vehiclePrice, 60000 + 10000);
    assert.equal(record.payload.financial.downPayment, 10000);
  assert.equal(record.payload.financial.interestRate, 15);
  assert.equal(record.payload.financial.tenureMonths, 24);
  assert.equal(record.payload.financial.startDate, "2026-04-01");
  assert.equal(record.payload.vehicle.loanType, "3 Wheeler");
});

test("loan type defaults fill in blank rate, tenure and EMI day cells", () => {
  const result = parseLoanImportSheet(
    [HEADER, row({ ...baseRow, "Interest Rate": "", "Tenure Months": "", "EMI Day": "", "Interest Type": "", "Loan Type": "Bike Loan" })],
    [
      { name: "Bike Loan", defaultInterestType: "reducing", defaultRate: 18, defaultTenureMonths: 36, defaultEmiDay: 10 },
      { name: "2 Wheeler" },
    ]
  );

  const record = result.records[0];
  assert.deepEqual(record.errors, []);
  assert.equal(record.payload.vehicle.loanType, "Bike Loan");
  assert.equal(record.payload.financial.interestRate, 18);
  assert.equal(record.payload.financial.interestType, "reducing");
  assert.equal(record.payload.financial.tenureMonths, 36);
  assert.equal(record.payload.financial.emiDay, 10);
});

test("missing required columns report a header error instead of records", () => {
  const result = parseLoanImportSheet([
    ["Customer Name", "Mobile", "Vehicle Name", "Vehicle Price"],
    ["Ramesh Kumar", "9876543210", "Honda Activa", 85000],
  ]);

  assert.equal(result.records.length, 0);
  assert.match(result.headerError ?? "", /Interest Rate/);
  assert.match(result.headerError ?? "", /Start Date/);
});

test("a Loan Amount column is used as the vehicle price with zero down payment", () => {
  const header = ["Customer Name", "Mobile", "Vehicle Name", "Loan Amount", "Interest Rate", "Tenure Months", "EMI Day", "Start Date"];
  const result = parseLoanImportSheet([header, ["Aman", "9812345678", "Splendor Plus", 45000, 14, 18, 7, "2026-04-01"]]);

  const record = result.records[0];
  assert.deepEqual(record.errors, []);
  assert.equal(record.payload.financial.vehiclePrice, 45000);
  assert.equal(record.payload.financial.downPayment, 0);
});

test("invalid values collect one readable error per problem", () => {
  const result = parseLoanImportSheet([
    HEADER,
    row({ ...baseRow, Mobile: "12345", "Vehicle Price": 85000, "Down Payment": 90000, "Start Date": "" }),
  ]);

  const record = result.records[0];
  const errors = record.errors.join(" | ");
  assert.match(errors, /10-digit/);
  assert.match(errors, /Down payment must be less than/);
  assert.match(errors, /Start date is required/);
  assert.equal(record.payload.customer?.mobile, "12345");
});

test("duplicate rows inside the same file are flagged and skipped on import", () => {
  const result = parseLoanImportSheet([HEADER, row(baseRow), row(baseRow)]);

  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0].errors, []);
  assert.equal(result.records[1].errors.length, 1);
  assert.match(result.records[1].errors[0], /Duplicate of row 2/);
});

test("blank rows between data are ignored", () => {
  const result = parseLoanImportSheet([HEADER, row(baseRow), ["", "", ""], row({ ...baseRow, "Customer Name": "Aman", Mobile: "9812345678" })]);

  assert.equal(result.records.length, 2);
  assert.equal(result.records[1].row, 4);
});

test("an empty file or header-only file reports a header error", () => {
  assert.match(parseLoanImportSheet([]).headerError ?? "", /empty/);
  assert.match(parseLoanImportSheet([HEADER]).headerError ?? "", /No data rows/);
});

import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

import { Tenant } from "../src/models/Tenant";
import { Customer } from "../src/models/Customer";
import { Loan } from "../src/models/Loan";
import { Emi } from "../src/models/Emi";
import { Payment } from "../src/models/Payment";
import { CompanySetting } from "../src/models/CompanySetting";
import { allocatePayment, type AllocEmi } from "../src/lib/payment-allocation";
import { generateSchedule, calcLoanSummary } from "../src/lib/emi";

/**
 * Imports the AVTechSolution export (multi-section CSV) into an empty tenant.
 *
 *   npx tsx scripts/import-avtech-csv.ts            # dry-run report (no writes)
 *   npx tsx scripts/import-avtech-csv.ts --apply    # write to MongoDB
 *
 * Safe by design: refuses --apply when the tenant already holds data.
 */

const TENANT = "khalsa_finance";
const DEFAULT_FILE = "/Users/surendermeghwal/Downloads/AVTechSolutionData.csv";
const APPLY = process.argv.includes("--apply");
const CLEAN = process.argv.includes("--clean");
const FILE = (() => {
  const i = process.argv.indexOf("--file");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : DEFAULT_FILE;
})();

type Row = Record<string, string>;

interface Section {
  name: string;
  header: string[];
  rows: Row[];
}

interface Issue {
  level: "error" | "warn";
  msg: string;
}

// ---------- CSV parsing (quotes + multi-line fields, no dependencies) ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseSections(text: string): Section[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const row of rows) {
    const first = (row[0] ?? "").trim();
    if (first.startsWith("### SECTION:")) {
      cur = { name: first.replace(/### SECTION:|###/g, "").trim(), header: [], rows: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;
    if (cur.header.length === 0) {
      cur.header = row.map((h) => h.trim());
      continue;
    }
    if (row.every((c) => c.trim() === "")) continue;
    const obj: Row = {};
    cur.header.forEach((h, i) => {
      obj[h] = (row[i] ?? "").trim();
    });
    cur.rows.push(obj);
  }
  return sections;
}

// ---------- normalization helpers ----------

const digits = (v: string | undefined) => (v ?? "").replace(/\D/g, "");

function normMobile(v: string | undefined): string {
  let d = digits(v);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const isMobile = (d: string) => /^[6-9]\d{9}$/.test(d);

function normPan(v: string | undefined): string {
  const p = (v ?? "").replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(p) ? p : "";
}

function parseDate(v: string | undefined): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(s);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
  }
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

const num = (v: string | undefined): number => {
  const n = Number((v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

function normMode(v: string | undefined): "cash" | "online" {
  return (v ?? "").toLowerCase().includes("cash") ? "cash" : "online";
}

function normEmiStatus(v: string | undefined): "pending" | "partial" | "paid" {
  const s = (v ?? "").toLowerCase();
  if (s.startsWith("paid")) return "paid";
  if (s.startsWith("partial")) return "partial";
  return "pending";
}

const receiptSeq = (value: string): number => {
  const m = /(\d+)$/.exec(value);
  return m ? Number(m[1]) : 0;
};

const keyOf = (loanNo: string, emiNo: number) => `${loanNo}#${emiNo}`;

// ---------- plan types ----------

interface EmiPlanRow {
  id: mongoose.Types.ObjectId;
  emiNo: number;
  dueDate: Date;
  amount: number;
  principal: number;
  interest: number;
  paidAmount: number;
  status: "pending" | "partial" | "paid";
  paidOn: Date | null;
  penalty: number;
  discount: number;
  receiptNo: string;
  cash: number;
  remarks: string;
  mode: string;
  hasRow: boolean;
  paymentId?: mongoose.Types.ObjectId;
}

interface LoanPlan {
  doc: Record<string, unknown>;
  loanNo: string;
  emis: EmiPlanRow[];
}

// ---------- main ----------

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const text = fs.readFileSync(FILE, "utf8");
  const sections = parseSections(text);
  const byName = new Map(sections.map((s) => [s.name, s]));
  const issues: Issue[] = [];
  const warn = (msg: string) => issues.push({ level: "warn", msg });
  const err = (msg: string) => issues.push({ level: "error", msg });

  const customersSec = byName.get("CUSTOMERS");
  const loansSec = byName.get("LOANS");
  const emiSec = byName.get("EMI_PAYMENTS");
  const closuresSec = byName.get("CLOSURES");
  const summarySec = byName.get("MASTER_SUMMARY");
  if (!customersSec || !loansSec || !emiSec) {
    console.error("Missing required sections (CUSTOMERS / LOANS / EMI_PAYMENTS).");
    process.exit(1);
  }

  // ---- pre-flight ----
  const tenant = await Tenant.findOne({ tenantId: TENANT }).lean();
  if (!tenant) {
    console.error(`Tenant "${TENANT}" not found.`);
    process.exit(1);
  }
  const existing = {
    customers: await Customer.countDocuments({ tenantId: TENANT }),
    loans: await Loan.countDocuments({ tenantId: TENANT }),
    emis: await Emi.countDocuments({ tenantId: TENANT }),
    payments: await Payment.countDocuments({ tenantId: TENANT }),
  };
  if (CLEAN && !APPLY) {
    console.error("--clean only makes sense together with --apply.");
    process.exit(1);
  }
  if (APPLY && Object.values(existing).some((n) => n > 0) && !CLEAN) {
    console.error(`Refusing --apply: tenant already has data ${JSON.stringify(existing)}.`);
    process.exit(1);
  }

  // ---- customers ----
  const customerDocs: Record<string, unknown>[] = [];
  const idxByMobile = new Map<string, number>();
  const idxByName = new Map<string, number>();
  const seenMobile = new Map<string, string>();
  const seenAadhaar = new Map<string, string>();

  for (const r of customersSec.rows) {
    const id = r.Customer_ID;
    const name = (r.Customer_Name ?? "").trim();
    const mobile = normMobile(r.Mobile);
    const aadhaar = digits(r.Aadhaar_Number);
    const pan = normPan(r.PAN_Number);

    if (!isMobile(mobile)) err(`Customer ${id} "${name}": invalid mobile "${r.Mobile}"`);
    if (aadhaar && !/^\d{12}$/.test(aadhaar))
      warn(`Customer ${id} "${name}": invalid aadhaar "${r.Aadhaar_Number}" (dropped)`);
    if (r.PAN_Number && !pan) warn(`Customer ${id} "${name}": invalid PAN "${r.PAN_Number}" (dropped)`);

    if (isMobile(mobile)) {
      const prev = seenMobile.get(mobile);
      if (prev) err(`Customer ${id} "${name}": duplicate mobile ${mobile} (also customer ${prev})`);
      else seenMobile.set(mobile, id);
    }
    if (/^\d{12}$/.test(aadhaar)) {
      const prev = seenAadhaar.get(aadhaar);
      if (prev) warn(`Customer ${id} "${name}": duplicate aadhaar (also customer ${prev})`);
      else seenAadhaar.set(aadhaar, id);
    }

    const alt = normMobile(r.Alt_Mobile);
    const createdAt = parseDate(r.Created_Date);
    const nameKey = name.toUpperCase().replace(/\s+/g, " ");
    const idx = customerDocs.length;
    customerDocs.push({
      _id: new mongoose.Types.ObjectId(),
      name,
      fatherName: r.Father_Name ?? "",
      mobile,
      altMobile: isMobile(alt) ? alt : "",
      aadhaar: /^\d{12}$/.test(aadhaar) ? aadhaar : undefined,
      pan: pan || undefined,
      dob: parseDate(r.Date_Of_Birth) ?? undefined,
      address: r.Address ?? "",
      city: r.City ?? "",
      state: r.State ?? "",
      tenantId: TENANT,
      ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
    });
    if (isMobile(mobile) && !idxByMobile.has(mobile)) idxByMobile.set(mobile, idx);
    if (!idxByName.has(nameKey)) idxByName.set(nameKey, idx);
  }

  // ---- EMI rows grouped by loan ----
  const emiGroups = new Map<string, Row[]>();
  for (const r of emiSec.rows) {
    const key = r.Loan_Number;
    if (!emiGroups.has(key)) emiGroups.set(key, []);
    emiGroups.get(key)!.push(r);
  }
  const receiptCount = new Map<string, number>();
  for (const r of emiSec.rows) {
    if (r.Receipt_Number) receiptCount.set(r.Receipt_Number, (receiptCount.get(r.Receipt_Number) ?? 0) + 1);
  }

  // ---- loans ----
  const loanPlans: LoanPlan[] = [];
  const planByLoanNo = new Map<string, LoanPlan>();
  const modes = new Set<string>();
  const statuses = new Set<string>();
  let paidRows = 0;
  let pendingRows = 0;
  let dueMismatch = 0;
  let zeroPaidRows = 0;

  for (const r of loansSec.rows) {
    const loanNo = r.Loan_Number;
    if (planByLoanNo.has(loanNo)) {
      err(`Duplicate loan number ${loanNo} in LOANS section`);
      continue;
    }
    const mobile = normMobile(r.Mobile);
    let cIdx = idxByMobile.get(mobile);
    if (cIdx == null) cIdx = idxByName.get(r.Customer_Name.toUpperCase().replace(/\s+/g, " "));
    if (cIdx == null) {
      err(`Loan ${loanNo}: no customer found for "${r.Customer_Name}" / ${r.Mobile}`);
      continue;
    }

    const loanAmount = num(r.Loan_Financed);
    const tenure = num(r.Tenure_Months);
    const emiDay = Math.min(31, Math.max(1, num(r.EMI_Day) || 1));
    const startDate = parseDate(r.Start_Date);
    if (!startDate) {
      err(`Loan ${loanNo}: unparseable Start_Date "${r.Start_Date}"`);
      continue;
    }
    const gen = generateSchedule({
      principal: loanAmount,
      interestRate: num(r.Interest_Rate),
      tenureMonths: tenure,
      interestType: "flat",
      startDate: startDate.toISOString().slice(0, 10),
      emiDay,
    });

    const csvRows = emiGroups.get(loanNo) ?? [];
    const rowByNo = new Map<number, Row>();
    for (const er of csvRows) {
      const n = num(er.EMI_Number);
      if (rowByNo.has(n)) {
        err(`Loan ${loanNo} EMI ${n}: duplicate row in EMI_PAYMENTS`);
        continue;
      }
      rowByNo.set(n, er);
    }

    const emis: EmiPlanRow[] = [];
    const unmatched = new Set(rowByNo.keys());
    for (const g of gen) {
      const er = rowByNo.get(g.emiNo);
      unmatched.delete(g.emiNo);
      const planRow: EmiPlanRow = {
        id: new mongoose.Types.ObjectId(),
        emiNo: g.emiNo,
        dueDate: new Date(g.dueDate),
        amount: g.amount,
        principal: g.principal,
        interest: g.interest,
        paidAmount: 0,
        status: "pending",
        paidOn: null,
        penalty: 0,
        discount: 0,
        receiptNo: "",
        cash: 0,
        remarks: "",
        mode: "",
        hasRow: false,
      };
      if (er) {
        planRow.hasRow = true;
        modes.add(er.Mode || "(blank)");
        statuses.add(er.Status || "(blank)");
        const status = normEmiStatus(er.Status);
        if (status !== "pending") paidRows++;
        else pendingRows++;
        const csvAmount = num(er.Due_Amount);
        if (Math.abs(csvAmount - g.amount) > 1) dueMismatch++;
        if (csvAmount > 0) {
          planRow.amount = csvAmount;
          planRow.interest = csvAmount - g.principal;
        }
        const csvDue = parseDate(er.Due_Date);
        if (csvDue) planRow.dueDate = csvDue;
        planRow.status = status;
        planRow.penalty = num(er.Penalty);
        planRow.discount = num(er.Discount);
        planRow.cash = num(er.Paid_Amount);
        planRow.receiptNo = er.Receipt_Number ?? "";
        planRow.remarks = er.Remarks ?? "";
        planRow.mode = er.Mode ?? "";
        planRow.paidOn = parseDate(er.Payment_Date);
        if (status === "paid" && planRow.cash <= 0 && planRow.discount <= 0) zeroPaidRows++;
      }
      emis.push(planRow);
    }
    for (const n of unmatched) {
      const er = rowByNo.get(n)!;
      warn(`Loan ${loanNo}: CSV has EMI ${n} beyond tenure ${tenure} (imported anyway)`);
      modes.add(er.Mode || "(blank)");
      statuses.add(er.Status || "(blank)");
      const status = normEmiStatus(er.Status);
      if (status !== "pending") paidRows++;
      else pendingRows++;
      const amount = num(er.Due_Amount);
      const principal = Math.round(loanAmount / tenure);
      emis.push({
        id: new mongoose.Types.ObjectId(),
        emiNo: n,
        dueDate: parseDate(er.Due_Date) ?? new Date(startDate),
        amount,
        principal,
        interest: amount - principal,
        paidAmount: 0,
        status,
        paidOn: parseDate(er.Payment_Date),
        penalty: num(er.Penalty),
        discount: num(er.Discount),
        receiptNo: er.Receipt_Number ?? "",
        cash: num(er.Paid_Amount),
        remarks: er.Remarks ?? "",
        mode: er.Mode ?? "",
        hasRow: true,
      });
    }
    emis.sort((a, b) => a.emiNo - b.emiNo);

    if (!csvRows.length) warn(`Loan ${loanNo}: no rows in EMI_PAYMENTS (schedule generated only)`);
    if (csvRows.length !== tenure) warn(`Loan ${loanNo}: ${csvRows.length} CSV EMI rows vs tenure ${tenure}`);

    const csvEmi = num(r.EMI_Amount);
    const flat = calcLoanSummary({
      principal: loanAmount,
      interestRate: num(r.Interest_Rate),
      tenureMonths: tenure,
      interestType: "flat",
    });
    if (csvEmi && Math.abs(csvEmi - flat.monthlyEmi) > 1) {
      warn(`Loan ${loanNo}: CSV EMI ${csvEmi} vs flat-calc ${flat.monthlyEmi} (using CSV value)`);
    }

    const totalPayable = emis.reduce((n, e) => n + e.amount, 0);
    const guarantorMobile = normMobile(r.Guarantor_Mobile);
    const createdAt = parseDate(r.Created_Date);
    const rawStatus = (r.Status ?? "").toLowerCase();
    const status = rawStatus.startsWith("closed") ? "closed" : "active";

    const doc: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(),
      loanNo,
      customerId: (customerDocs[cIdx] as { _id: mongoose.Types.ObjectId })._id,
      vehicle: {
        name: r.Vehicle_Name,
        model: r.Vehicle_Model ?? "",
        engineNo: r.Engine_Number ?? "",
        chassisNo: r.Chassis_Number ?? "",
        regNo: r.Reg_Number ?? "",
        loanType: "2 Wheeler",
        dealerName: r.Dealer ?? "",
      },
      financial: {
        vehiclePrice: num(r.Vehicle_Price),
        downPayment: num(r.Down_Payment),
        loanAmount,
        interestRate: num(r.Interest_Rate),
        interestType: "flat",
        tenureMonths: tenure,
        emiDay,
        startDate,
        firstDueDate: emis[0]?.dueDate,
      },
      paymentPlan: {
        monthlyEmi: csvEmi || flat.monthlyEmi,
        totalPayable,
        totalInterest: totalPayable - loanAmount,
      },
      guarantor: {
        name: r.Guarantor ?? "",
        mobile: isMobile(guarantorMobile) ? guarantorMobile : "",
        relation: "",
        address: "",
      },
      advance: 0,
      status,
      tenantId: TENANT,
      ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
    };
    const plan: LoanPlan = { doc, loanNo, emis };
    loanPlans.push(plan);
    planByLoanNo.set(loanNo, plan);
  }

  // ---- receipt / loan numbering plan ----
  let maxReceiptSeq = 0;
  for (const rc of receiptCount.keys()) maxReceiptSeq = Math.max(maxReceiptSeq, receiptSeq(rc));
  const receiptPrefix = maxReceiptSeq > 0 ? "RCPT-2026" : "RCPT";
  let nextReceiptSeq = maxReceiptSeq + 1;

  let maxLoanSeq = 0;
  for (const p of loanPlans) maxLoanSeq = Math.max(maxLoanSeq, receiptSeq(p.loanNo));
  const loanPrefix = maxLoanSeq > 0 ? "LN-2026" : "GFM";
  const nextLoanNo = maxLoanSeq + 1;

  const closures = (closuresSec?.rows ?? []).filter((r) => r.Loan_Number);

  // ---- payments from EMI rows (one Payment per receipt, mirrors app) ----
  const paymentDocs: Record<string, unknown>[] = [];
  for (const plan of loanPlans) {
    const groups = new Map<string, EmiPlanRow[]>();
    for (const e of plan.emis) {
      if (e.receiptNo) {
        if (!groups.has(e.receiptNo)) groups.set(e.receiptNo, []);
        groups.get(e.receiptNo)!.push(e);
      }
    }
    let advance = 0;
    for (const [receiptNo, rowsInReceipt] of groups) {
      const cash = rowsInReceipt.reduce((n, e) => n + e.cash, 0);
      const discount = rowsInReceipt.reduce((n, e) => n + e.discount, 0);
      const penalty = rowsInReceipt.reduce((n, e) => n + e.penalty, 0);
      const paidOn = rowsInReceipt.find((e) => e.paidOn)?.paidOn ?? rowsInReceipt[0].dueDate;
      const paymentId = new mongoose.Types.ObjectId();

      if (cash <= 0 && discount <= 0) {
        // "Paid" row with no money recorded (legacy) — settle EMIs, keep a 0-amount receipt.
        for (const e of rowsInReceipt) {
          if (e.status !== "paid") continue;
          e.paidAmount = e.amount;
          e.status = "paid";
          e.paidOn = e.paidOn ?? paidOn;
          e.paymentId = paymentId;
        }
        if (rowsInReceipt.every((e) => e.paymentId === paymentId)) {
          paymentDocs.push({
            _id: paymentId,
            receiptNo,
            loanId: plan.doc._id,
            loanNo: plan.loanNo,
            customerId: plan.doc.customerId,
            customerName: "",
            emiIds: rowsInReceipt.map((e) => e.id),
            amount: 0,
            principal: 0,
            interest: 0,
            penalty: 0,
            discount: 0,
            mode: normMode(rowsInReceipt[0].mode),
            receivedBy: "Data Import",
            notes: rowsInReceipt[0].remarks || "Imported (settled in legacy system)",
            type: "EMI",
            tenantId: TENANT,
            createdAt: paidOn,
            updatedAt: paidOn,
          });
        } else {
          for (const e of rowsInReceipt) e.receiptNo = "";
          warn(`Receipt ${receiptNo} (${plan.loanNo}): no money recorded, receipt dropped`);
        }
        continue;
      }

      const allocEmis: AllocEmi[] = rowsInReceipt.map((e) => ({
        _id: keyOf(plan.loanNo, e.emiNo),
        amount: e.amount,
        principal: e.principal,
        interest: e.interest,
        paidAmount: 0,
        status: "pending",
        penalty: 0,
      }));
      const alloc = allocatePayment({
        emis: allocEmis,
        cash,
        discount,
        advance,
        penaltyFor: () => penalty,
      });
      advance = alloc.newAdvance;

      for (const res of alloc.emis) {
        const e = rowsInReceipt.find((x) => keyOf(plan.loanNo, x.emiNo) === res._id)!;
        e.paidAmount = res.paidAmount;
        e.status = res.status;
        e.penalty = res.penalty;
        e.paidOn = e.paidOn ?? paidOn;
        e.paymentId = paymentId;
      }
      paymentDocs.push({
        _id: paymentId,
        receiptNo,
        loanId: plan.doc._id,
        loanNo: plan.loanNo,
        customerId: plan.doc.customerId,
        customerName: "",
        emiIds: rowsInReceipt.map((e) => e.id),
        amount: alloc.amount,
        principal: alloc.principal,
        interest: alloc.interest,
        penalty: alloc.penalty,
        discount: alloc.discount,
        advanceUsed: alloc.advanceUsed,
        advanceAdded: alloc.advanceAdded,
        mode: normMode(rowsInReceipt[0].mode),
        receivedBy: "Data Import",
        notes: rowsInReceipt[0].remarks || "",
        type: "EMI",
        tenantId: TENANT,
        createdAt: paidOn,
        updatedAt: paidOn,
      });
    }
    (plan.doc as { advance?: number }).advance = advance;
  }

  // ---- closure settlements ----
  const closureReceipts = closures.map(
    () => `${receiptPrefix}-${String(nextReceiptSeq++).padStart(4, "0")}`
  );
  let closureIdx = 0;
  for (const c of closures) {
    const plan = planByLoanNo.get(c.Loan_Number);
    if (!plan) {
      err(`Closure for unknown loan ${c.Loan_Number}`);
      continue;
    }
    const closureDate = parseDate(c.Closure_Date) ?? new Date();
    const pending = plan.emis.filter((e) => e.status !== "paid");
    const receiptNo = closureReceipts[closureIdx++];
    let advance = (plan.doc as { advance?: number }).advance ?? 0;

    if (pending.length) {
      const alloc = allocatePayment({
        emis: pending.map((e) => ({
          _id: keyOf(plan.loanNo, e.emiNo),
          amount: e.amount,
          principal: e.principal,
          interest: e.interest,
          paidAmount: e.paidAmount,
          status: e.status,
          penalty: e.penalty,
        })),
        cash: num(c.Final_Amount),
        discount: num(c.Discount_Amount),
        advance,
        penaltyFor: () => 0,
      });
      if (!alloc.emis.every((e) => e.status === "paid")) {
        // Integer rounding in the allocator can leave a sub-rupee tail
        // (e.g. discount 17988.41 -> 17988). Treat <= 1 as settled.
        for (const res of alloc.emis) {
          if (res.status === "paid") continue;
          const row = pending.find((x) => keyOf(plan.loanNo, x.emiNo) === res._id);
          if (!row) continue;
          if (row.amount - res.paidAmount <= 1) {
            res.paidAmount = row.amount;
            res.status = "paid";
            res.appliedBase = row.amount;
          }
        }
      }
      if (!alloc.emis.every((e) => e.status === "paid")) {
        const shortfall = alloc.emis
          .filter((e) => e.status !== "paid")
          .map((e) => `${e._id}: paid ${e.paidAmount}`)
          .join(", ");
        err(
          `Closure ${plan.loanNo}: settlement does not clear all EMIs (final ${c.Final_Amount}, discount ${c.Discount_Amount}) -> ${shortfall}`
        );
        continue;
      }
      advance = alloc.newAdvance;
      const paymentId = new mongoose.Types.ObjectId();
      for (const res of alloc.emis) {
        const e = pending.find((x) => keyOf(plan.loanNo, x.emiNo) === res._id)!;
        e.paidAmount = res.paidAmount;
        e.status = res.status;
        e.penalty = res.penalty;
        e.paidOn = closureDate;
        e.paymentId = paymentId;
      }
      paymentDocs.push({
        _id: paymentId,
        receiptNo,
        loanId: plan.doc._id,
        loanNo: plan.loanNo,
        customerId: plan.doc.customerId,
        customerName: "",
        emiIds: pending.map((e) => e.id),
        amount: alloc.amount,
        principal: alloc.principal,
        interest: alloc.interest,
        penalty: alloc.penalty,
        discount: alloc.discount,
        advanceUsed: alloc.advanceUsed,
        advanceAdded: alloc.advanceAdded,
        mode: normMode(c.Mode),
        receivedBy: "Data Import",
        notes: `Loan closed (imported): outstanding ${c.Outstanding}, discount ${c.Discount_Amount}`,
        type: "EMI",
        tenantId: TENANT,
        createdAt: closureDate,
        updatedAt: closureDate,
      });
    } else {
      warn(`Closure ${plan.loanNo}: no outstanding EMIs, closed without settlement payment`);
    }
    (plan.doc as { advance?: number }).advance = advance;
    (plan.doc as { status?: string }).status = "closed";
    (plan.doc as { closedAt?: Date }).closedAt = closureDate;
  }

  // ---- fill customer names on payments ----
  const custNameByIdx = new Map<number, string>();
  customerDocs.forEach((c, i) => custNameByIdx.set(i, c.name as string));
  const idxByLoanNo = new Map<string, number>();
  {
    // map loan -> customer index via customerId
    const custIdxById = new Map<string, number>();
    customerDocs.forEach((c, i) => custIdxById.set(String(c._id), i));
    for (const p of loanPlans) {
      idxByLoanNo.set(p.loanNo, custIdxById.get(String(p.doc.customerId)) ?? -1);
    }
  }
  for (const p of paymentDocs) {
    const name = custNameByIdx.get(idxByLoanNo.get(p.loanNo as string) ?? -1) ?? "";
    p.customerName = name;
  }

  // ---- EMI docs ----
  const emiDocs: Record<string, unknown>[] = [];
  for (const plan of loanPlans) {
    for (const e of plan.emis) {
      emiDocs.push({
        _id: e.id,
        loanId: plan.doc._id,
        loanNo: plan.loanNo,
        emiNo: e.emiNo,
        dueDate: e.dueDate,
        amount: e.amount,
        principal: e.principal,
        interest: e.interest,
        paidAmount: e.paidAmount,
        status: e.status,
        paidOn: e.paidOn ?? undefined,
        penalty: e.penalty,
        paymentId: e.paymentId,
        tenantId: TENANT,
      });
    }
  }

  // ---- summary cross-check ----
  let summaryChecked = 0;
  let summaryMismatch = 0;
  if (summarySec) {
    for (const r of summarySec.rows) {
      const plan = planByLoanNo.get(r.Loan_Number);
      if (!plan) {
        warn(`MASTER_SUMMARY references unknown loan ${r.Loan_Number}`);
        continue;
      }
      if ((plan.doc as { status?: string }).status === "closed") continue;
      const outstanding = plan.emis.reduce((n, e) => n + Math.max(0, e.amount - e.paidAmount), 0);
      const expected = num(r.Pending_Amount);
      summaryChecked++;
      if (Math.abs(outstanding - expected) > 2) {
        summaryMismatch++;
        if (summaryMismatch <= 5)
          warn(`Loan ${plan.loanNo}: computed outstanding ${outstanding.toFixed(2)} vs summary ${expected}`);
      }
    }
  }

  const dupReceipts = [...receiptCount.entries()].filter(([, n]) => n > 1);
  for (const [rc, n] of dupReceipts) warn(`Receipt ${rc} used on ${n} rows`);

  const negativeInterest = emiDocs.filter((e) => (e.interest as number) < 0);
  if (negativeInterest.length)
    warn(
      `${negativeInterest.length} EMI rows have negative interest (CSV amount < principal): ` +
        negativeInterest.slice(0, 3).map((e) => `${e.loanNo}#${e.emiNo}`).join(", ")
    );

  const emiStatusCount = { pending: 0, partial: 0, paid: 0 };
  for (const e of emiDocs) emiStatusCount[e.status as "pending"] += 1;
  const totalCollected = paymentDocs.reduce((n, p) => n + (p.amount as number), 0);
  const totalDiscount = paymentDocs.reduce((n, p) => n + ((p.discount as number) || 0), 0);

  const report = {
    file: FILE,
    mode: APPLY ? "APPLY" : "DRY-RUN",
    tenant: { tenantId: TENANT, companyName: (tenant as { companyName?: string }).companyName },
    existing,
    sections: sections.map((s) => ({ name: s.name, rows: s.rows.length })),
    willInsert: {
      customers: customerDocs.length,
      loans: loanPlans.length,
      emis: emiDocs.length,
      payments: paymentDocs.length,
      closedLoans: loanPlans.filter((p) => (p.doc as { status?: string }).status === "closed").length,
    },
    emiStatusCount,
    totals: {
      collected: totalCollected,
      discount: totalDiscount,
      pendingEmiAmount: emiDocs
        .filter((e) => e.status !== "paid")
        .reduce((n, e) => n + (e.amount as number) - (e.paidAmount as number), 0),
    },
    source: {
      paidRows,
      pendingRows,
      zeroPaidRows,
      negativeInterest: negativeInterest.length,
      modes: [...modes],
      statuses: [...statuses],
      duplicateReceipts: dupReceipts.map(([rc, n]) => `${rc} x${n}`),
      closures: closures.map((c) => c.Loan_Number),
      dueAmountVsGeneratedMismatches: dueMismatch,
    },
    countersPlan: { loanPrefix, nextLoanNo, receiptPrefix, nextReceiptNo: nextReceiptSeq },
    summaryCheck: { checked: summaryChecked, mismatches: summaryMismatch },
    issues,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    await mongoose.disconnect();
    return;
  }
  if (issues.some((i) => i.level === "error")) {
    console.error("\nRefusing --apply: fix the errors above first.");
    process.exit(1);
  }

  // ---- insert ----
  if (CLEAN) {
    const removed = {
      customers: (await Customer.deleteMany({ tenantId: TENANT })).deletedCount,
      loans: (await Loan.deleteMany({ tenantId: TENANT })).deletedCount,
      emis: (await Emi.deleteMany({ tenantId: TENANT })).deletedCount,
      payments: (await Payment.deleteMany({ tenantId: TENANT })).deletedCount,
    };
    console.log("CLEANED:", JSON.stringify(removed));
  }
  await Customer.insertMany(customerDocs, { ordered: true });
  await Loan.insertMany(
    loanPlans.map((p) => p.doc),
    { ordered: true }
  );
  await Emi.insertMany(emiDocs, { ordered: true });
  await Payment.insertMany(paymentDocs, { ordered: true });
  await CompanySetting.updateOne(
    { tenantId: TENANT, singleton: "company" },
    { $set: { loanPrefix, nextLoanNo, receiptPrefix, nextReceiptNo: nextReceiptSeq } }
  );

  const finalCounts = {
    customers: await Customer.countDocuments({ tenantId: TENANT }),
    loans: await Loan.countDocuments({ tenantId: TENANT }),
    emis: await Emi.countDocuments({ tenantId: TENANT }),
    payments: await Payment.countDocuments({ tenantId: TENANT }),
    closedLoans: await Loan.countDocuments({ tenantId: TENANT, status: "closed" }),
    paidEmis: await Emi.countDocuments({ tenantId: TENANT, status: "paid" }),
    collected: (
      (await Payment.aggregate([
        { $match: { tenantId: TENANT } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])) as { total: number }[]
    )[0]?.total,
    setting: await CompanySetting.findOne({ tenantId: TENANT }).lean(),
  };
  console.log("\nAPPLIED:", JSON.stringify(finalCounts, null, 2));
  if (issues.length) console.log("ISSUES:", JSON.stringify(issues, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

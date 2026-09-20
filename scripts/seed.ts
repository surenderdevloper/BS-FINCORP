import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { User } from "../src/models/User";
import { Customer } from "../src/models/Customer";
import { Loan } from "../src/models/Loan";
import { Emi } from "../src/models/Emi";
import { Payment } from "../src/models/Payment";
import { CompanySetting } from "../src/models/CompanySetting";
import { PenaltyRule } from "../src/models/PenaltyRule";
import { generateSchedule } from "../src/lib/emi";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bs_fincorp";

function iso(offsetMonths: number, day: number, hour = 10): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  d.setHours(hour, 0, 0, 0);
  return d;
}

const monthsBack = (m: number) => iso(-m, 15);

const customersToSeed = [
  {
    name: "Ramesh Kumar", fatherName: "Suresh Kumar", mobile: "9821011122", aadhaar: "123456789012",
    pan: "ABCDE1234F", dob: iso(-320, 10), address: "12 Nehru Road, Jaipur, Rajasthan",
  },
  {
    name: "Amit Sharma", fatherName: "Rajesh Sharma", mobile: "9830344556", aadhaar: "234567890123",
    pan: "FGHIJ5678K", dob: iso(-280, 5), address: "45 MG Road, Udaipur, Rajasthan",
  },
  {
    name: "Sunita Devi", fatherName: "Mahesh Prasad", mobile: "9877654321", aadhaar: "345678901234",
    pan: "KLMNO9012P", dob: iso(-340, 22), address: "88 Gandhi Nagar, Kota, Rajasthan",
  },
  {
    name: "Prakash Patel", fatherName: "Bhupendra Patel", mobile: "9903312244", aadhaar: "456789012345",
    pan: "PQRST2345U", dob: iso(-360, 18), address: "7 Lake View Rd, Bikaner, Rajasthan",
  },
  {
    name: "Kavita Joshi", fatherName: "Narayan Joshi", mobile: "9765123456", aadhaar: "567890123456",
    pan: "UVWXY6789Z", dob: iso(-240, 28), address: "21 Shastri Nagar, Jodhpur, Rajasthan",
  },
];

async function main() {
  await mongoose.connect(uri);
  console.log("Connected to", uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Could not access the database.");
  await db.dropDatabase();
  console.log("Dropped existing database.");

  // Admin user
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "admin123", 10);
  await User.create({
    name: "Admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@bsfincorp.com",
    passwordHash,
    role: "admin",
  });
  console.log("Seeded admin user.");

  // Company + penalty settings
  await CompanySetting.create({
    singleton: "company",
    companyName: "BS FINCORP",
    address: "123 Business Hub, Jaipur, Rajasthan – 302001",
    gst: "GSTIN08ABCDE1234F1Z5",
    phone: "+91 98765 43210",
    email: "contact@bsfincorp.com",
    receiptPrefix: "RCPT",
    nextReceiptNo: 1,
    loanPrefix: "BF",
    nextLoanNo: 1,
  });
  await PenaltyRule.create({
    singleton: "penalty",
    enabled: true,
    graceDays: 3,
    penaltyType: "fixed",
    penaltyPerDay: 10,
    maxPenaltyAmount: 500,
  });
  console.log("Seeded settings.");

  // Customers
  const customers = await Customer.insertMany(customersToSeed);
  console.log(`Seeded ${customers.length} customers.`);

  // Loan definitions (principal, rate, tenure, days of start date offset)
  const loanDefs = [
    { c: customers[0], vehicle: "Honda Activa 6G", price: 95000, down: 20000, rate: 12, tenure: 18, startOffset: -7, reducing: false },
    { c: customers[1], vehicle: "Hero Splendor Plus", price: 82000, down: 12000, rate: 14, tenure: 12, startOffset: -8, reducing: true },
    { c: customers[2], vehicle: "Bajaj RE (3W)", price: 240000, down: 40000, rate: 11, tenure: 24, startOffset: -2, reducing: false },
    { c: customers[3], vehicle: "TVS Ntorq 125", price: 85000, down: 15000, rate: 13, tenure: 15, startOffset: -12, reducing: false },
    { c: customers[4], vehicle: "Suzuki Access 125", price: 88000, down: 18000, rate: 12, tenure: 12, startOffset: -16, reducing: false },
  ];

  for (let li = 0; li < loanDefs.length; li++) {
    const def = loanDefs[li];
    const loanNo = `BF-${String(li + 1).padStart(4, "0")}`;
    const principal = def.price - def.down;
    const startDate = monthsBack(def.startOffset * -1); // monthsAgo helper
    // startDate = (today, subtract startOffset months)
    const sd = startDate;
    const schedule = generateSchedule({
      principal,
      interestRate: def.rate,
      tenureMonths: def.tenure,
      interestType: def.reducing ? "reducing" : "flat",
      startDate: `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`,
      emiDay: 5,
    });
    const totalPayable = schedule.reduce((s, r) => s + r.amount, 0);
    const monthlyEmi = schedule[0]?.amount ?? 0;

    const [loan] = await Loan.create([
      {
        loanNo,
        customerId: def.c._id,
        vehicle: { name: def.vehicle, model: "2024", regNo: `RJ14 AB ${1000 + li * 111}`, loanType: "2 Wheeler" },
        financial: {
          vehiclePrice: def.price,
          downPayment: def.down,
          loanAmount: principal,
          interestRate: def.rate,
          interestType: def.reducing ? "reducing" : "flat",
          tenureMonths: def.tenure,
          emiDay: 5,
          startDate: sd,
          firstDueDate: new Date(schedule[0].dueDate),
        },
        paymentPlan: { monthlyEmi, totalPayable, totalInterest: totalPayable - principal },
        guarantor: { name: "Guarantor", mobile: "9999999999", relation: "Friend", address: "Jaipur" },
        status: li === 1 || li === 2 ? "active" : li === 3 ? "closed" : "active",
        closedAt: li === 3 ? monthsBack(3) : undefined,
      },
    ]);

    // EMI statuses:
    //   loan 0 (BF-0001): first 5 paid, 6th overdue (past due), rest pending
    //   loan 1 (BF-0002): first 4 paid, 5th overdue & due today-ish (past), rest pending
    //   loan 2 (BF-0003): first 2 paid, rest pending (none overdue)
    //   loan 3 (BF-0004): closed — 9 of 15 paid then fully settled early? keep simple: mark 9 paid, close
    //   loan 4 (BF-0005): last 10 paid (all but 2), 2 overdue
    const paidCount = [5, 4, 2, 9, 10][li];

    for (let i = 0; i < schedule.length; i++) {
      const row = schedule[i];
      const emis = await Emi.create([
        {
          loanId: loan._id,
          loanNo,
          emiNo: row.emiNo,
          dueDate: new Date(row.dueDate),
          amount: row.amount,
          principal: row.principal,
          interest: row.interest,
          status: i < paidCount ? "paid" : "pending",
          paidOn: i < paidCount ? new Date(new Date(row.dueDate).getTime() + 24 * 3600 * 1000) : undefined,
        },
      ]);

      if (i < paidCount) {
        await Payment.create({
          receiptNo: `RCPT-${String(li * 100 + i + 1).padStart(4, "0")}`,
          loanId: loan._id,
          loanNo,
          customerId: def.c._id,
          customerName: def.c.name,
          emiIds: [emis[0]._id],
          amount: row.amount,
          principal: row.principal,
          interest: row.interest,
          penalty: 0,
          mode: i % 2 === 0 ? "cash" : "online",
          receivedBy: "Admin",
          createdAt: new Date(new Date(row.dueDate).getTime() + 20 * 3600 * 1000),
        });
      }
    }

    console.log(`Seeded loan ${loanNo} (${def.vehicle}) with ${schedule.length} EMIs.`);
  }

  // A couple of payments received today so the dashboard's "Today's Collection" is non-empty.
  const todayLoan = await Loan.findOne({ loanNo: "BF-0001" });
  if (!todayLoan) throw new Error("Expected seeded loan BF-0001.");
  const todayCustomer = await Customer.findById(todayLoan.customerId);
  if (!todayCustomer) throw new Error("Expected seeded customer for BF-0001.");
  const todayEmis = await Emi.find({ loanId: todayLoan._id, status: "pending" }).sort({ emiNo: 1 }).limit(2);
  let amt = 0;
  for (const e of todayEmis) {
    amt += e.amount;
    e.status = "paid";
    e.paidOn = new Date();
    await e.save();
  }
  await Payment.create({
    receiptNo: "RCPT-TODAY-001",
    loanId: todayLoan._id,
    loanNo: "BF-0001",
    customerId: todayCustomer._id,
    customerName: todayCustomer.name,
    emiIds: todayEmis.map((e) => e._id),
    amount: amt,
    principal: amt,
    interest: 0,
    penalty: 0,
    mode: "cash",
    receivedBy: "Admin",
    createdAt: new Date(),
  });
  await CompanySetting.updateOne(
    { singleton: "company" },
    { $set: { nextLoanNo: 6, nextReceiptNo: 601 } }
  );
  console.log("Seeded today's collection sample.");

  await mongoose.disconnect();
  console.log("\nSeeding complete. Login with admin@bsfincorp.com / admin123");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
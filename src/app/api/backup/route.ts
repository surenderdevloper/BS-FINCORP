import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";
import { CompanySetting } from "@/models/CompanySetting";
import { PenaltyRule } from "@/models/PenaltyRule";
import { readSession } from "@/lib/auth";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  const [customers, loans, emis, payments, users, companySettings, penaltyRules] = await Promise.all([
    Customer.find({}).lean(),
    Loan.find({}).lean(),
    Emi.find({}).lean(),
    Payment.find({}).lean(),
    User.find({}).lean(),
    CompanySetting.find({}).lean(),
    PenaltyRule.find({}).lean(),
  ]);

  // JSON.stringify converts ObjectId -> string and Date -> ISO string automatically,
  // so the download is plain JSON safe to import anywhere.
  const collections = {
    customers: JSON.parse(JSON.stringify(customers)),
    loans: JSON.parse(JSON.stringify(loans)),
    emis: JSON.parse(JSON.stringify(emis)),
    payments: JSON.parse(JSON.stringify(payments)),
    users: JSON.parse(JSON.stringify(users)),
    companySettings: JSON.parse(JSON.stringify(companySettings)),
    penaltyRules: JSON.parse(JSON.stringify(penaltyRules)),
  };

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    app: "bs-fincorp",
    counts: {
      customers: customers.length,
      loans: loans.length,
      emis: emis.length,
      payments: payments.length,
      users: users.length,
      companySettings: companySettings.length,
      penaltyRules: penaltyRules.length,
    },
    collections,
  });
}
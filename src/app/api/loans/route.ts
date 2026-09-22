import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { CompanySetting } from "@/models/CompanySetting";
import { readSession } from "@/lib/auth";
import { calcLoanSummary, generateSchedule } from "@/lib/emi";
import { validateCustomerShape, validateFinancialShape } from "@/lib/validators";
import { listLoans } from "@/lib/loans";
import { invalidateCustomersListCache } from "@/lib/customers";
import type { LoanFormPayload } from "@/types";

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam === "active" || statusParam === "closed" ? statusParam : undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);

  await dbConnect();
  const loans = await listLoans({ search, status, limit });
  return NextResponse.json({ loans });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: LoanFormPayload;
  try {
    payload = (await req.json()) as LoanFormPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const customerErrors = validateCustomerShape({
    name: payload.customer?.name ?? "",
    mobile: payload.customer?.mobile ?? "",
    altMobile: payload.customer?.altMobile,
    aadhaar: payload.customer?.aadhaar,
    pan: payload.customer?.pan,
  });
  const financialErrors = validateFinancialShape({
    vehiclePrice: payload.financial?.vehiclePrice,
    downPayment: payload.financial?.downPayment,
    interestRate: payload.financial?.interestRate,
    tenureMonths: payload.financial?.tenureMonths,
    emiDay: payload.financial?.emiDay,
  });

  if (Object.keys(customerErrors).length || Object.keys(financialErrors).length) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: { ...customerErrors, ...financialErrors } },
      { status: 400 }
    );
  }

  const vehicleName = payload.vehicle?.name?.trim();
  if (!vehicleName) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: { vehicleName: "Vehicle name is required." } },
      { status: 400 }
    );
  }

  const loanAmount = payload.financial.vehiclePrice - payload.financial.downPayment;

  // A new customer profile is mandatory unless an existing customer was selected.
  if (!payload.customerId && !payload.customer?.name?.trim()) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: { name: "Customer name is required." } },
      { status: 400 }
    );
  }
  const customerData = payload.customer as NonNullable<LoanFormPayload["customer"]>;

  // Track what we create so a failure can be rolled back. (MongoDB free tiers
  // do not support multi-document transactions, so we compensate manually.)
  let createdCustomerId: string | null = null;
  let allocatedLoanNo: string | null = null;
  let createdLoanId: string | null = null;

  try {
    await dbConnect();

    // 1. Resolve or create the customer (matched by mobile number).
    let customer: InstanceType<typeof Customer> | null;
    if (payload.customerId) {
      customer = await Customer.findById(payload.customerId);
      if (!customer) throw new Error("Selected customer not found.");
    } else {
      customer = await Customer.findOne({ mobile: customerData.mobile });
      if (customer) {
        if (customer.name !== customerData.name) customer.name = customerData.name;
        if (customerData.fatherName) customer.fatherName = customerData.fatherName;
        if (customerData.address) customer.address = customerData.address;
        if (customerData.city) customer.city = customerData.city;
        if (customerData.state) customer.state = customerData.state;
        if (customerData.altMobile) customer.altMobile = customerData.altMobile;
        if (customerData.pan) customer.pan = customerData.pan;
        if (customerData.aadhaar) customer.aadhaar = customerData.aadhaar;
        if (customerData.dob) customer.dob = new Date(customerData.dob);
        await customer.save();
      } else {
        customer = await Customer.create({
          name: customerData.name,
          fatherName: customerData.fatherName ?? "",
          mobile: customerData.mobile,
          altMobile: customerData.altMobile || undefined,
          aadhaar: customerData.aadhaar || undefined,
          pan: customerData.pan || undefined,
          dob: customerData.dob ? new Date(customerData.dob) : undefined,
          address: customerData.address ?? "",
          city: customerData.city ?? "",
          state: customerData.state ?? "",
        });
        createdCustomerId = customer._id.toString();
      }
    }

    invalidateCustomersListCache();

    // 2. Allocate the next loan number.
    const setting = await CompanySetting.findOneAndUpdate(
      { singleton: "company" },
      { $inc: { nextLoanNo: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const loanNo = `${setting.loanPrefix}-${String(setting.nextLoanNo - 1).padStart(4, "0")}`;
    allocatedLoanNo = loanNo;

    // 3. Compute the payment plan and schedule.
    const summary = calcLoanSummary({
      principal: loanAmount,
      interestRate: payload.financial.interestRate,
      tenureMonths: payload.financial.tenureMonths,
      interestType: payload.financial.interestType,
    });
    const schedule = generateSchedule({
      principal: loanAmount,
      interestRate: payload.financial.interestRate,
      tenureMonths: payload.financial.tenureMonths,
      interestType: payload.financial.interestType,
      startDate: payload.financial.startDate,
      emiDay: payload.financial.emiDay,
    });

    // 4. Create the loan.
    const loan = await Loan.create({
      loanNo,
      customerId: customer!._id,
      vehicle: {
        name: vehicleName,
        model: payload.vehicle.model ?? "",
        engineNo: payload.vehicle.engineNo ?? "",
        chassisNo: payload.vehicle.chassisNo ?? "",
        regNo: payload.vehicle.regNo ?? "",
        loanType: payload.vehicle.loanType ?? "2 Wheeler",
        dealerName: payload.vehicle.dealerName ?? "",
      },
      financial: {
        vehiclePrice: payload.financial.vehiclePrice,
        downPayment: payload.financial.downPayment,
        loanAmount,
        interestRate: payload.financial.interestRate,
        interestType: payload.financial.interestType,
        tenureMonths: payload.financial.tenureMonths,
        emiDay: payload.financial.emiDay,
        startDate: new Date(`${payload.financial.startDate}T00:00:00Z`),
        firstDueDate: schedule[0] ? new Date(schedule[0].dueDate) : undefined,
      },
      paymentPlan: {
        monthlyEmi: summary.monthlyEmi,
        totalPayable: summary.totalPayable,
        totalInterest: summary.totalInterest,
      },
      guarantor: {
        name: payload.guarantor?.name ?? "",
        mobile: payload.guarantor?.mobile ?? "",
        relation: payload.guarantor?.relation ?? "",
        address: payload.guarantor?.address ?? "",
      },
      status: "active",
    });
    createdLoanId = loan._id.toString();

    // 5. Generate all EMI records.
    await Emi.insertMany(
      schedule.map((row) => ({
        loanId: loan._id,
        loanNo,
        emiNo: row.emiNo,
        dueDate: new Date(row.dueDate),
        amount: row.amount,
        principal: row.principal,
        interest: row.interest,
        status: "pending" as const,
      }))
    );

    const result = {
      loanNo,
      monthlyEmi: summary.monthlyEmi,
      totalPayable: summary.totalPayable,
      totalInterest: summary.totalInterest,
    };
    return NextResponse.json({ loan: result }, { status: 201 });
  } catch (err) {
    console.error("create loan error", err);
    const message =
      err instanceof Error && err.message === "Selected customer not found."
        ? "The selected customer no longer exists. Please search again."
        : "Could not create the loan. Check that MongoDB is reachable (MONGODB_URI).";

    // Best-effort rollback so a failed attempt leaves no partial records.
    try {
      if (allocatedLoanNo) {
        await Loan.deleteOne({ loanNo: allocatedLoanNo });
        await Emi.deleteMany({ loanNo: allocatedLoanNo });
        await CompanySetting.updateOne({ singleton: "company" }, { $inc: { nextLoanNo: -1 } });
      }
      if (createdCustomerId) {
        await Customer.deleteOne({ _id: createdCustomerId });
      }
      if (createdLoanId) {
        await Loan.deleteOne({ _id: createdLoanId });
        await Emi.deleteMany({ loanId: createdLoanId });
      }
    } catch (cleanupErr) {
      console.error("loan rollback error", cleanupErr);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
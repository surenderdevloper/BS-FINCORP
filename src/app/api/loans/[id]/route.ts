import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Loan } from "@/models/Loan";
import { Emi } from "@/models/Emi";
import { Customer } from "@/models/Customer";
import { calcLoanSummary, generateSchedule } from "@/lib/emi";
import { validateCustomerShape, validateFinancialShape } from "@/lib/validators";
import { getLoanDetail } from "@/lib/loans";
import type { LoanFormPayload } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await dbConnect();

  const loan = await getLoanDetail(id);
  if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });

  return NextResponse.json({ loan });
}

export async function PUT(req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: Partial<LoanFormPayload>;
  try {
    body = (await req.json()) as Partial<LoanFormPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const customerData = body.customer;
  if (!customerData || !customerData.name?.trim()) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: { name: "Customer name is required." } },
      { status: 400 }
    );
  }
  const customerErrors = validateCustomerShape({
    name: customerData.name,
    mobile: customerData.mobile ?? "",
    aadhaar: customerData.aadhaar,
    pan: customerData.pan,
  });
  if (Object.keys(customerErrors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: customerErrors }, { status: 400 });
  }

  const fin = body.financial;
  const financialErrors = fin
    ? validateFinancialShape({
        vehiclePrice: fin.vehiclePrice,
        downPayment: fin.downPayment,
        interestRate: fin.interestRate,
        tenureMonths: fin.tenureMonths,
        emiDay: fin.emiDay,
      })
    : {};
  const vehicleName = body.vehicle?.name?.trim();
  if (!vehicleName) financialErrors.vehicleName = "Vehicle name is required.";
  if (fin && !fin.startDate) financialErrors.startDate = "Start date is required.";
  if (Object.keys(financialErrors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: financialErrors }, { status: 400 });
  }

  await dbConnect();

  const loan = await Loan.findOne({ loanNo: id });
  if (!loan) return NextResponse.json({ error: "Loan not found." }, { status: 404 });

  const prevFinancial = loan.financial;
  const prevStart = prevFinancial ? prevFinancial.startDate.toISOString().slice(0, 10) : "";
  const financialChanged =
    fin === undefined ||
    !prevFinancial ||
    fin.vehiclePrice !== prevFinancial.vehiclePrice ||
    fin.downPayment !== prevFinancial.downPayment ||
    fin.interestRate !== prevFinancial.interestRate ||
    fin.interestType !== prevFinancial.interestType ||
    fin.tenureMonths !== prevFinancial.tenureMonths ||
    fin.emiDay !== prevFinancial.emiDay ||
    fin.startDate !== prevStart;

  // 1. Update the customer's personal details.
  const customer = await Customer.findById(loan.customerId);
  if (!customer) return NextResponse.json({ error: "Loan customer not found." }, { status: 404 });

  const mobile = customerData.mobile.trim();
  const existing = await Customer.findOne({ mobile, _id: { $ne: customer._id } });
  if (existing) {
    return NextResponse.json(
      { error: "Another customer already uses this mobile number.", fieldErrors: { mobile: "Duplicate mobile number." } },
      { status: 409 }
    );
  }
  customer.name = customerData.name.trim();
  customer.mobile = mobile;
  customer.fatherName = customerData.fatherName?.trim() ?? "";
  customer.aadhaar = customerData.aadhaar?.trim() || undefined;
  customer.pan = customerData.pan?.trim().toUpperCase() || undefined;
  customer.dob = customerData.dob ? new Date(`${customerData.dob}T00:00:00Z`) : undefined;
  customer.address = customerData.address?.trim() ?? "";
  await customer.save();

  // 2. Update vehicle & guarantor.
  loan.set({
    vehicle: {
      name: vehicleName,
      model: body.vehicle?.model ?? "",
      engineNo: body.vehicle?.engineNo ?? "",
      chassisNo: body.vehicle?.chassisNo ?? "",
      regNo: body.vehicle?.regNo ?? "",
      loanType: body.vehicle?.loanType ?? "2 Wheeler",
    },
    guarantor: {
      name: body.guarantor?.name ?? "",
      mobile: body.guarantor?.mobile ?? "",
      relation: body.guarantor?.relation ?? "",
      address: body.guarantor?.address ?? "",
    },
  });

  // 3. If the repayment plan changed and no EMI has been paid, regenerate the schedule.
  if (financialChanged) {
    const paidCount = await Emi.countDocuments({ loanId: loan._id, status: "paid" });
    if (paidCount > 0) {
      return NextResponse.json(
        { error: "The repayment plan is locked because EMIs have already been paid on this loan." },
        { status: 400 }
      );
    }
    const loanAmount = fin!.vehiclePrice - fin!.downPayment;
    const summary = calcLoanSummary({
      principal: loanAmount,
      interestRate: fin!.interestRate,
      tenureMonths: fin!.tenureMonths,
      interestType: fin!.interestType,
    });
    const schedule = generateSchedule({
      principal: loanAmount,
      interestRate: fin!.interestRate,
      tenureMonths: fin!.tenureMonths,
      interestType: fin!.interestType,
      startDate: fin!.startDate,
      emiDay: fin!.emiDay,
    });

    loan.set({
      financial: {
        vehiclePrice: fin!.vehiclePrice,
        downPayment: fin!.downPayment,
        loanAmount,
        interestRate: fin!.interestRate,
        interestType: fin!.interestType,
        tenureMonths: fin!.tenureMonths,
        emiDay: fin!.emiDay,
        startDate: new Date(`${fin!.startDate}T00:00:00Z`),
        firstDueDate: schedule[0] ? new Date(schedule[0].dueDate) : undefined,
      },
      paymentPlan: {
        monthlyEmi: summary.monthlyEmi,
        totalPayable: summary.totalPayable,
        totalInterest: summary.totalInterest,
      },
    });

    await Emi.deleteMany({ loanId: loan._id });
    await Emi.insertMany(
      schedule.map((row) => ({
        loanId: loan._id,
        loanNo: loan.loanNo,
        emiNo: row.emiNo,
        dueDate: new Date(row.dueDate),
        amount: row.amount,
        principal: row.principal,
        interest: row.interest,
        status: "pending" as const,
      }))
    );
  }

  await loan.save();

  return NextResponse.json({ loan: await getLoanDetail(loan.loanNo) });
}
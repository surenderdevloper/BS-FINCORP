import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { readSession } from "@/lib/auth";
import { validateCustomerShape } from "@/lib/validators";
import { invalidateCustomersListCache } from "@/lib/customers";
import type { CustomerFormData } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: Partial<CustomerFormData>;
  try {
    body = (await req.json()) as Partial<CustomerFormData>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const errors = validateCustomerShape({
    name: body.name ?? "",
    mobile: body.mobile ?? "",
    altMobile: body.altMobile,
    aadhaar: body.aadhaar,
    pan: body.pan,
  });
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: errors }, { status: 400 });
  }

  await dbConnect();

  const customer = await Customer.findById(id);
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const mobile = body.mobile!.trim();
  const existing = await Customer.findOne({ mobile, _id: { $ne: id } });
  if (existing) {
    return NextResponse.json(
      { error: "Another customer already uses this mobile number.", fieldErrors: { mobile: "Duplicate mobile number." } },
      { status: 409 }
    );
  }

  customer.name = body.name!.trim();
  customer.mobile = mobile;
  customer.fatherName = body.fatherName?.trim() ?? "";
  customer.aadhaar = body.aadhaar?.trim() || undefined;
  customer.pan = body.pan?.trim().toUpperCase() || undefined;
  customer.dob = body.dob ? new Date(`${body.dob}T00:00:00Z`) : undefined;
  customer.address = body.address?.trim() ?? "";
  customer.city = body.city?.trim() ?? "";
  customer.state = body.state?.trim() ?? "";
  customer.altMobile = body.altMobile?.trim() ?? "";
  await customer.save();

  invalidateCustomersListCache();

  return NextResponse.json({
    customer: {
      _id: customer._id.toString(),
      name: customer.name,
      fatherName: customer.fatherName,
      mobile: customer.mobile,
      altMobile: customer.altMobile ?? "",
      aadhaar: customer.aadhaar,
      pan: customer.pan,
      dob: customer.dob ? customer.dob.toISOString() : null,
      address: customer.address,
      city: customer.city,
      state: customer.state,
    },
  });
}

export async function GET(req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  return NextResponse.json({
    customer: {
      _id: customer._id.toString(),
      name: customer.name,
      fatherName: customer.fatherName,
      mobile: customer.mobile,
      altMobile: customer.altMobile ?? "",
      aadhaar: customer.aadhaar,
      pan: customer.pan,
      dob: customer.dob ? customer.dob.toISOString() : null,
      address: customer.address,
      city: customer.city,
      state: customer.state,
    },
  });
}
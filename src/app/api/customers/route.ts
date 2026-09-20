import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { readSession } from "@/lib/auth";
import { sanitizeSearch } from "@/lib/search";
import { listCustomers } from "@/lib/customers";

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = sanitizeSearch(url.searchParams.get("search"));
  const all = url.searchParams.get("all") === "1";
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? (all ? 2000 : 10)),
    all ? 2000 : 25
  );

  await dbConnect();

  if (all) {
    const customers = await listCustomers({ search: search || undefined, limit });
    return NextResponse.json({ customers });
  }

  const filter = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
          { aadhaar: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const customers = await Customer.find(filter)
    .select("name fatherName mobile aadhaar pan dob address")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    customers: customers.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      fatherName: c.fatherName,
      mobile: c.mobile,
      aadhaar: c.aadhaar,
      pan: c.pan,
      dob: c.dob ? c.dob.toISOString() : null,
      address: c.address,
    })),
  });
}
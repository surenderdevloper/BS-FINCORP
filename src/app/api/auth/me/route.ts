import { NextResponse } from "next/server";
import { withTenant } from "@/lib/tenant-route";

export async function GET() {
  return withTenant(async (session) => {
    return NextResponse.json({ user: session });
  });
}
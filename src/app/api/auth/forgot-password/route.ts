import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCompanySetting } from "@/models/CompanySetting";
import {
  GENERIC_RESET_MESSAGE,
  emailResetLimiter,
  ipResetLimiter,
  createResetForUserIfExists,
} from "@/lib/password-reset";
import { sendPasswordResetEmail, isSmtpConfigured } from "@/lib/email";

async function companyName(): Promise<string> {
  try {
    const company = await getCompanySetting();
    return company.companyName || "BS FINCORP";
  } catch {
    return "BS FINCORP";
  }
}

export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    // Malformed bodies still get the generic response (no account enumeration).
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (email && !emailResetLimiter.allow(email)) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }
  if (!ipResetLimiter.allow(ip)) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  if (!isSmtpConfigured()) {
    console.error("Password reset is disabled because SMTP is not configured.");
    return NextResponse.json(
      { message: "Password reset is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  await dbConnect();

  const base = process.env.APP_PUBLIC_URL ?? new URL(req.url).origin;
  const resetUrl = email ? await createResetForUserIfExists(email, base) : null;

  if (resetUrl) {
    await sendPasswordResetEmail({
      to: email,
      resetUrl,
      companyName: await companyName(),
    });
  }

  return NextResponse.json({ message: GENERIC_RESET_MESSAGE });
}
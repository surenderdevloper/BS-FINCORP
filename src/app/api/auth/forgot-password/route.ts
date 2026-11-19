import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCompanySetting } from "@/models/CompanySetting";
import {
  GENERIC_RESET_MESSAGE,
  createResetForUserIfExists,
  EMAIL_RATE_LIMIT_MAX,
  IP_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/password-reset";
import { sendPasswordResetEmail, isSmtpConfigured } from "@/lib/email";
import { clientKey, persistentRateLimit } from "@/lib/rate-limit";

async function companyName(): Promise<string> {
  try {
    const company = await getCompanySetting();
    return company.companyName || "Gigabyte Finance Manager";
  } catch {
    return "Gigabyte Finance Manager";
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

  const ip = clientKey(req);
  const emailLimit = email
    ? await persistentRateLimit(
        `password-reset-email:${email}`,
        EMAIL_RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW_MS
      )
    : null;
  if (emailLimit && !emailLimit.ok) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } }
    );
  }
  const ipLimit = await persistentRateLimit(
    `password-reset-ip:${ip}`,
    IP_RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!ipLimit.ok) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
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
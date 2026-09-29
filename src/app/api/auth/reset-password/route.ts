import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  claimPasswordReset,
  changeUserPassword,
  validateNewPassword,
} from "@/lib/password-reset";

export async function POST(req: Request) {
  let body: { token?: string; password?: string; confirm?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? "");

  const fieldError = validateNewPassword(password, confirm);
  if (fieldError) {
    return NextResponse.json(
      {
        error: fieldError.error,
        fieldErrors: { [fieldError.field]: fieldError.error },
      },
      { status: 400 }
    );
  }

  await dbConnect();

  const userId = await claimPasswordReset(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const changed = await changeUserPassword(userId, password);
  if (!changed) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
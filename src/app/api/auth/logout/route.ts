import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { revokeSession } from "@/lib/sessions";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  // Mark this device's session revoked so the cookie cannot be replayed after
  // the browser clears it (and so it disappears from the superadmin panel).
  try {
    const user = await verifySessionToken(token);
    if (user?.sid) await revokeSession(user.id, user.sid);
  } catch {
    // Logging out must always succeed locally even if tracking fails.
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { revokeSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function LogoutPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  try {
    const user = await verifySessionToken(token);
    if (user?.sid) {
      await revokeSession(user.id, user.sid);
    }
  } catch {
    // Best-effort session revocation
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

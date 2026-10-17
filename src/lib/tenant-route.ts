import { NextResponse } from "next/server";
import { isSuperadmin, readSession, type SessionUser } from "@/lib/auth";
import { runForSession, runUnscoped } from "@/lib/tenant";

/**
 * Run a protected API handler bound to the caller's tenant.
 *
 * Reads the session once, returns 401 when there is none, then executes `fn`
 * inside the tenant context so every database query is automatically scoped
 * (when multi-tenancy is enabled). Routes must use this instead of calling
 * `readSession()` directly, otherwise their queries would run unscoped.
 */
export async function withTenant<T>(
  fn: (session: SessionUser) => Promise<T>
): Promise<T | NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // A suspended tenant may not write or read business data anymore.
  if (session.suspended) {
    return NextResponse.json(
      { error: "Your subscription is suspended. Please contact the administrator.", code: "TENANT_SUSPENDED" },
      { status: 403 }
    );
  }
  return runForSession(session.tenantId, () => fn(session));
}

/**
 * Run a superadmin-only API handler without tenant scoping.
 *
 * Returns 401 when signed out and 404 for any non-superadmin session so the
 * route does not leak its existence to ordinary tenants. The callback always
 * runs unscoped: superadmin work (tenants, plans, suspension) spans every tenant.
 */
export async function withSuperadmin<T>(
  fn: (session: SessionUser) => Promise<T>
): Promise<T | NextResponse> {
  const session = await readSession();
  if (!session || !isSuperadmin(session)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return runUnscoped(() => fn(session));
}

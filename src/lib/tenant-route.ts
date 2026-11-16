import { NextResponse } from "next/server";
import { isSuperadmin, readSession, type SessionUser } from "@/lib/auth";
import {
  isTenantAdminSession,
  multiTenantEnabled,
  runForSession,
  runUnscoped,
} from "@/lib/tenant";
import { persistentRateLimit } from "@/lib/rate-limit";
import { hasDeveloperAccess } from "@/lib/developer-access";

const API_RATE_LIMIT = 120;
const API_RATE_WINDOW_MS = 60 * 1000;

const inMemoryApiBuckets = new Map<string, { count: number; resetAt: number }>();

async function checkApiRateLimit(session: SessionUser): Promise<NextResponse | null> {
  const now = Date.now();
  const key = session.id;
  let bucket = inMemoryApiBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + API_RATE_WINDOW_MS };
    inMemoryApiBuckets.set(key, bucket);
    if (inMemoryApiBuckets.size > 200) {
      for (const [k, v] of inMemoryApiBuckets.entries()) {
        if (now >= v.resetAt) inMemoryApiBuckets.delete(k);
      }
    }
  } else {
    bucket.count++;
  }

  if (bucket.count > API_RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return null;
}

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
  if (multiTenantEnabled() && !isTenantAdminSession(session.role, session.tenantId)) {
    return NextResponse.json(
      { error: "A tenant administrator account is required.", code: "TENANT_REQUIRED" },
      { status: 403 }
    );
  }
  // A suspended tenant may not write or read business data anymore.
  if (session.suspended) {
    return NextResponse.json(
      { error: "Your subscription is suspended. Please contact the administrator.", code: "TENANT_SUSPENDED" },
      { status: 403 }
    );
  }
  const rateLimitResponse = await checkApiRateLimit(session);
  if (rateLimitResponse) return rateLimitResponse;
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
  const rateLimitResponse = await checkApiRateLimit(session);
  if (rateLimitResponse) return rateLimitResponse;
  return runUnscoped(() => fn(session));
}

/**
 * Run an owner-only developer-console API after checking both the signed-in
 * developer role and the separate console unlock cookie. These routes are
 * intentionally unscoped because they manage global developer configuration.
 */
export async function withDeveloper<T>(
  fn: (session: SessionUser) => Promise<T>
): Promise<T | NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "developer" || !(await hasDeveloperAccess())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const rateLimitResponse = await checkApiRateLimit(session);
  if (rateLimitResponse) return rateLimitResponse;
  return runUnscoped(() => fn(session));
}

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/money";
import { dbConnect } from "@/lib/db";
import { multiTenantEnabled, runUnscoped } from "@/lib/tenant";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";

export { SESSION_COOKIE };

export type UserRole = "admin" | "developer" | "superadmin";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
  tenantId?: string | null;
  /** True when the tenant's plan is suspended (multi-tenant mode only). */
  suspended?: boolean;
}

/** Coerce an arbitrary stored value to a known role, defaulting to "admin". */
export function normalizeRole(value: unknown): UserRole {
  return value === "developer" || value === "superadmin" ? value : "admin";
}

/** A session is a developer (owner-level) account when its role says so. */
export function isDeveloper(user: SessionUser | null): boolean {
  return user?.role === "developer";
}

/** A session is a superadmin (SaaS owner) account when its role says so. */
export function isSuperadmin(user: SessionUser | null): boolean {
  return user?.role === "superadmin";
}

/** True when the tenant's plan is suspended (never true in single-tenant mode). */
export function isSuspended(user: SessionUser | null): boolean {
  return user?.suspended === true;
}

/** Read the current session and require the superadmin role. */
export async function requireSuperadmin(): Promise<SessionUser | null> {
  const user = await readSession();
  return isSuperadmin(user) ? user : null;
}

/**
 * Read the current session and require the developer role. Returns null when
 * there is no session or the account is not a developer. Use in developer-only
 * pages and API routes so admin accounts cannot reach them.
 */
export async function requireDeveloper(): Promise<SessionUser | null> {
  const user = await readSession();
  return isDeveloper(user) ? user : null;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    // Failing loudly on a misconfigured production deployment is safer than
    // signing sessions with a publicly-known fallback key.
    throw new Error("AUTH_SECRET must be set when NODE_ENV is production.");
  }
  return new TextEncoder().encode(secret ?? "bs-fincorp-insecure-dev-secret");
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    v: user.tokenVersion ?? 0,
    ...(user.tenantId ? { tenantId: user.tenantId } : {}),
  } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setSubject(user.id)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: (payload.name as string) ?? "",
      email: (payload.email as string) ?? "",
      role: normalizeRole(payload.role),
      tokenVersion: (payload.v as number | undefined) ?? 0,
      tenantId: (payload.tenantId as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const user = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!user) return null;
  try {
    // Establish the connection before querying. Without this, a cold serverless
    // instance buffers the query (mongoose bufferTimeoutMS) until it throws,
    // which turns a slow start into a bogus 401 / forced logout.
    await dbConnect();
    // Login is global: users are looked up by id regardless of tenant, so this
    // read must never be tenant-scoped.
    const current = await runUnscoped(() =>
      User.findById(user.id).select("tokenVersion role tenantId").lean()
    );
    if (!current) return null;
    if ((current.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return null;
    // Role and tenant are read from the database on every request so a change
    // takes effect immediately without waiting for the session token to expire.
    user.role = normalizeRole(current.role);
    user.tenantId = current.tenantId ?? null;

    // Suspension is checked on every request so a suspend takes effect without
    // waiting for the session token to expire. Developers/superadmins (no
    // tenant) and single-tenant deployments are never suspended.
    user.suspended = false;
    if (multiTenantEnabled() && user.tenantId) {
      // Tenant is a global registry collection (not plugin-scoped).
      const tenant = await Tenant.findOne({ tenantId: user.tenantId })
        .select("planStatus")
        .lean();
      user.suspended = tenant?.planStatus === "suspended";
    }
  } catch {
    return null;
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * The developer console is unlocked with a secret key (see
 * `src/lib/developer-access.ts`). Once the key is verified we hand back a signed
 * cookie so the key never has to be repeated in the URL. This token is
 * independent from the login session.
 */
export async function signDeveloperAccessToken(): Promise<string> {
  return new SignJWT({ scope: "developer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyDeveloperAccessToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.scope === "developer";
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
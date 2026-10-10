import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/money";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";

export { SESSION_COOKIE };

export type UserRole = "admin" | "developer";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
}

/** A session is a developer (owner-level) account when its role says so. */
export function isDeveloper(user: SessionUser | null): boolean {
  return user?.role === "developer";
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
    const role = payload.role === "developer" ? "developer" : "admin";
    return {
      id: payload.sub,
      name: (payload.name as string) ?? "",
      email: (payload.email as string) ?? "",
      role,
      tokenVersion: (payload.v as number | undefined) ?? 0,
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
    const current = await User.findById(user.id).select("tokenVersion role").lean();
    if (!current) return null;
    if ((current.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return null;
    // Role is read from the database on every request so a role change takes
    // effect immediately without waiting for the session token to expire.
    user.role = current.role === "developer" ? "developer" : "admin";
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
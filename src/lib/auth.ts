import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/money";
import { User } from "@/models/User";

export { SESSION_COOKIE };

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  tokenVersion?: number;
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
    return {
      id: payload.sub,
      name: (payload.name as string) ?? "",
      email: (payload.email as string) ?? "",
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
    const current = await User.findById(user.id).select("tokenVersion").lean();
    if (!current) return null;
    if ((current.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return null;
  } catch {
    return null;
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
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
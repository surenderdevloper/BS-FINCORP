import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/money";

export { SESSION_COOKIE };

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "bs-fincorp-insecure-dev-secret"
  );
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
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
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
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
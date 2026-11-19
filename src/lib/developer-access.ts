import { cookies } from "next/headers";
import { signDeveloperAccessToken, verifyDeveloperAccessToken } from "@/lib/auth";

/**
 * Secret-key access for the Developer Console.
 *
 * A signed-in developer must enter the `DEVELOPER_KEY` environment value,
 * which is submitted in a POST body and exchanged for a signed access cookie.
 *
 * The cookie lasts 30 days. Clearing it or unsetting `DEVELOPER_KEY` locks
 * access again.
 *
 * When `DEVELOPER_KEY` is unset the console is disabled entirely — the route and
 * its API respond as if they do not exist.
 */

export const DEVELOPER_ACCESS_COOKIE = "bs_developer_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function developerKey(): string {
  return (process.env.DEVELOPER_KEY ?? "").trim();
}

export function developerConsoleEnabled(): boolean {
  return developerKey().length > 0;
}

/** Constant-time-ish comparison so a wrong key cannot be timed character by character. */
export function keyMatches(input: string | null | undefined): boolean {
  const expected = developerKey();
  const given = (input ?? "").trim();
  if (!expected || !given || expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

export async function hasDeveloperAccess(): Promise<boolean> {
  if (!developerConsoleEnabled()) return false;
  const store = await cookies();
  return verifyDeveloperAccessToken(store.get(DEVELOPER_ACCESS_COOKIE)?.value);
}

export async function grantDeveloperAccess(): Promise<void> {
  const token = await signDeveloperAccessToken();
  const store = await cookies();
  store.set(DEVELOPER_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function revokeDeveloperAccess(): Promise<void> {
  const store = await cookies();
  store.delete(DEVELOPER_ACCESS_COOKIE);
}

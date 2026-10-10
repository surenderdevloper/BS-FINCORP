import { cookies } from "next/headers";
import { signDeveloperAccessToken, verifyDeveloperAccessToken } from "@/lib/auth";

/**
 * Secret-URL access for the Developer Console.
 *
 * There is no role or password involved: set the `DEVELOPER_KEY` environment
 * variable to a long random string, then open
 *
 *     /developer?key=<DEVELOPER_KEY>
 *
 * once. A signed, httpOnly cookie is stored (30 days) so the console keeps
 * working at the plain `/developer` URL without the key. Clearing the cookie or
 * unsetting `DEVELOPER_KEY` locks it again.
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

import { NextResponse } from "next/server";
import {
  developerConsoleEnabled,
  grantDeveloperAccess,
  keyMatches,
  revokeDeveloperAccess,
} from "@/lib/developer-access";
import { isDeveloper, readSession } from "@/lib/auth";
import { clientKey, persistentRateLimit } from "@/lib/rate-limit";

/**
 * Unlock the developer console.
 *
 *   POST /api/developer/access  → verifies the key and sets the access cookie
 *   DELETE /api/developer/access → clears the access cookie
 *
 * The key is accepted only in the POST body, never in the URL.
 */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDeveloper(session)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limit = await persistentRateLimit(
    `developer-key:${session.id}:${clientKey(req)}`,
    10,
    15 * 60 * 1000
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (!developerConsoleEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { key?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!keyMatches(body.key)) return NextResponse.json({ error: "Invalid access key." }, { status: 401 });
  await grantDeveloperAccess();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDeveloper(session)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limit = await persistentRateLimit(`developer-access-lock:${session.id}`, 60, 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  await revokeDeveloperAccess();
  const target = new URL("/developer", new URL(req.url).origin);
  target.searchParams.set("devError", "locked");
  return NextResponse.redirect(target, 303);
}

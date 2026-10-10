import { NextResponse } from "next/server";
import {
  developerConsoleEnabled,
  grantDeveloperAccess,
  keyMatches,
  revokeDeveloperAccess,
} from "@/lib/developer-access";

/**
 * Unlock the developer console.
 *
 *   GET  /api/developer/access?key=<DEVELOPER_KEY>  → sets the access cookie
 *   DELETE /api/developer/access                     → clears the access cookie
 *
 * Both redirect back to `/developer` so the key never lingers in the address
 * bar of the console itself.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = new URL("/developer", url.origin);

  if (!developerConsoleEnabled()) {
    target.searchParams.set("devError", "disabled");
    return NextResponse.redirect(target);
  }

  if (keyMatches(url.searchParams.get("key"))) {
    await grantDeveloperAccess();
    return NextResponse.redirect(target);
  }

  target.searchParams.set("devError", "badkey");
  return NextResponse.redirect(target);
}

export async function DELETE(req: Request) {
  await revokeDeveloperAccess();
  const target = new URL("/developer", new URL(req.url).origin);
  target.searchParams.set("devError", "locked");
  return NextResponse.redirect(target, 303);
}

import { readSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { runForSession } from "@/lib/tenant";
import { getSettingsSnapshot, type SettingsSnapshot } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

/**
 * Company and message template settings are read on the server so the form
 * is prefilled in the first paint.
 */
export default async function SettingsPage() {
  let snapshot: SettingsSnapshot | null = null;
  try {
    const session = await readSession();
    await dbConnect();
    snapshot = await runForSession(session?.tenantId ?? null, () => getSettingsSnapshot());
  } catch {
    // The form falls back to its own fetch when the server render fails.
  }
  return (
    <SettingsForm
      initialCompany={snapshot?.company ?? null}
      initialMessages={snapshot?.messages ?? null}
    />
  );
}

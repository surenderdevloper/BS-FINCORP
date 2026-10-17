import { readSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { runForSession } from "@/lib/tenant";
import { getSettingsSnapshot, type CompanySettingsData } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

/**
 * Company settings are read on the server so the form is prefilled in the
 * first paint. The client form still refreshes in the background and saves
 * through the same API as before.
 */
export default async function SettingsPage() {
  let company: CompanySettingsData | null = null;
  try {
    const session = await readSession();
    await dbConnect();
    company = (await runForSession(session?.tenantId ?? null, () => getSettingsSnapshot())).company;
  } catch {
    // The form falls back to its own fetch when the server render fails.
  }
  return <SettingsForm initialCompany={company} />;
}

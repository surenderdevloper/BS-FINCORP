import { readSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { runForSession } from "@/lib/tenant";
import { getSettingsSnapshot, type PenaltySettingsData } from "@/lib/settings";
import { PenaltyRulesForm } from "./penalty-rules-form";

export const metadata = { title: "Penalty Rules" };

/** Penalty rules are read on the server so the form is prefilled immediately. */
export default async function PenaltyRulesPage() {
  let penalty: PenaltySettingsData | null = null;
  try {
    const session = await readSession();
    await dbConnect();
    penalty = (await runForSession(session?.tenantId ?? null, () => getSettingsSnapshot())).penalty;
  } catch {
    // The form falls back to its own fetch when the server render fails.
  }
  return <PenaltyRulesForm initialPenalty={penalty} />;
}

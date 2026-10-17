import { AuditLog } from "@/models/AuditLog";
import type { SessionUser } from "@/lib/auth";

export interface AuditEntry {
  actor: SessionUser;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: string;
}

/**
 * Record a superadmin action.
 *
 * Never throws: an audit write must never be able to fail the operation it is
 * describing. Call it after a successful mutation, without awaiting the outcome
 * of the mutation's response.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      actorId: entry.actor?.id ?? "",
      actorEmail: entry.actor?.email ?? "",
      actorRole: entry.actor?.role ?? "",
      action: entry.action,
      targetType: entry.targetType ?? "",
      targetId: entry.targetId ?? "",
      details: String(entry.details ?? "").slice(0, 500),
    });
  } catch {
    // Auditing is best-effort; the caller's operation already succeeded.
  }
}

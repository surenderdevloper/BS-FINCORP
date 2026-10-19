import { randomBytes } from "node:crypto";
import { DeviceSession } from "@/models/DeviceSession";
import { dbConnect } from "@/lib/db";
import { runUnscoped } from "@/lib/tenant";

/** Best-effort client IP (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "";
}

/**
 * Human readable device label from a user agent, e.g. "Chrome · Windows".
 * Dependency-free and intentionally forgiving — unknown agents just say
 * "Browser" / "Unknown device" instead of failing.
 */
export function parseDevice(userAgent: string): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : /curl|wget|node|axios|python|okhttp/i.test(userAgent)
              ? "API client"
              : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /(iPhone|iPad|iPod)/.test(userAgent)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export interface SessionSummary {
  sid: string;
  device: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
}

/**
 * Register a new device session on login and return its `sid`, which is embedded
 * in the JWT so a later request can be traced back to (and revoked from) here.
 */
export async function startSession(opts: {
  userId: string;
  tenantId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<string> {
  await dbConnect();
  const sid = randomBytes(16).toString("hex");
  const userAgent = (opts.userAgent ?? "").slice(0, 300);
  await runUnscoped(() =>
    DeviceSession.create({
      sid,
      userId: opts.userId,
      tenantId: opts.tenantId ?? "",
      device: parseDevice(userAgent),
      ip: (opts.ip ?? "").slice(0, 60),
      userAgent,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    })
  );
  // Keep the per-user list bounded: drop revoked/expired rows beyond the newest 20.
  await runUnscoped(async () => {
    const stale = await DeviceSession.find({ userId: opts.userId })
      .sort({ createdAt: -1 })
      .skip(20)
      .select("sid")
      .lean();
    if (stale.length) {
      await DeviceSession.deleteMany({ sid: { $in: stale.map((s) => s.sid) } });
    }
  });
  return sid;
}

/** True when the session exists and has not been revoked. */
export async function isSessionActive(sid: string): Promise<boolean> {
  try {
    await dbConnect();
    const doc = await runUnscoped(() =>
      DeviceSession.findOne({ sid, revokedAt: null }).select("sid").lean()
    );
    return !!doc;
  } catch {
    // Fail closed: a session we cannot verify is treated as logged out.
    return false;
  }
}

/** Record activity on a session, at most once a minute to avoid a write per request. */
export async function touchSession(sid: string, lastSeenAt: Date | null): Promise<void> {
  try {
    if (lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 60_000) return;
    await dbConnect();
    await runUnscoped(() =>
      DeviceSession.updateOne({ sid, revokedAt: null }, { $set: { lastSeenAt: new Date() } })
    );
  } catch {
    // Tracking is best-effort; never let it break a page.
  }
}

/** Active (non-revoked) sessions for a user, newest first. */
export async function listUserSessions(userId: string): Promise<SessionSummary[]> {
  await dbConnect();
  const rows = await runUnscoped(() =>
    DeviceSession.find({ userId, revokedAt: null }).sort({ lastSeenAt: -1 }).lean()
  );
  return rows.map((r) => ({
    sid: r.sid,
    device: r.device || "Unknown device",
    ip: r.ip ?? "",
    createdAt: new Date(r.createdAt).toISOString(),
    lastSeenAt: new Date(r.lastSeenAt).toISOString(),
  }));
}

/** Revoke one device session of a user. Returns true when something was revoked. */
export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  await dbConnect();
  const res = await runUnscoped(() =>
    DeviceSession.updateOne(
      { sid, userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    )
  );
  return res.modifiedCount > 0;
}

/**
 * Revoke every device session of a user, optionally keeping one alive.
 * Returns the number of sessions revoked.
 */
export async function revokeUserSessions(userId: string, keepSid?: string | null): Promise<number> {
  await dbConnect();
  const res = await runUnscoped(() =>
    DeviceSession.updateMany(
      { userId, revokedAt: null, ...(keepSid ? { sid: { $ne: keepSid } } : {}) },
      { $set: { revokedAt: new Date() } }
    )
  );
  return res.modifiedCount;
}

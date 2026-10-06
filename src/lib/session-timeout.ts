export const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const WARNING_BEFORE_MS = 60 * 1000;
export const MIN_ACTIVITY_INTERVAL_MS = 5000;
export const MAX_SCHEDULE_TICK_MS = 60 * 1000;

export type SessionTimeoutState = "idle" | "warning" | "expired";

export function evaluateState(
  now: number,
  lastActivityAt: number,
  timeoutMs: number = SESSION_TIMEOUT_MS,
  warningMs: number = WARNING_BEFORE_MS
): SessionTimeoutState {
  const elapsed = now - lastActivityAt;
  if (elapsed >= timeoutMs) return "expired";
  if (elapsed >= timeoutMs - warningMs) return "warning";
  return "idle";
}

export function shouldTrackActivity(
  now: number,
  lastRecordedAt: number,
  minIntervalMs: number = MIN_ACTIVITY_INTERVAL_MS
): boolean {
  return now - lastRecordedAt >= minIntervalMs;
}

export function computeNextDelay(
  warned: boolean,
  now: number,
  lastActivityAt: number,
  timeoutMs: number = SESSION_TIMEOUT_MS,
  warningMs: number = WARNING_BEFORE_MS
): number {
  const target = warned
    ? lastActivityAt + timeoutMs
    : lastActivityAt + timeoutMs - warningMs;
  return Math.min(1000, Math.max(1, target - now));
}

export type VisibilityResolution = "recordActivity" | "logout";

export function resolveVisibilityAction(
  now: number,
  lastActivityAt: number,
  timeoutMs: number = SESSION_TIMEOUT_MS
): VisibilityResolution {
  return evaluateState(now, lastActivityAt, timeoutMs) === "expired"
    ? "logout"
    : "recordActivity";
}

export type SessionTimeoutMessage =
  | { type: "activity"; at: number }
  | { type: "logout" };

export const SESSION_TIMEOUT_CHANNEL = "bs_fincorp_session_timeout";
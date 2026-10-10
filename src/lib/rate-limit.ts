/**
 * Minimal in-memory fixed-window rate limiter. Good enough to blunt password
 * guessing on a single warm serverless instance. It is intentionally
 * dependency-free and best-effort: cold starts reset the counters, but the
 * window still slows repeated attempts within a burst.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Record an attempt for `key`. When the number of attempts within `windowMs`
 * exceeds `max`, further calls are rejected until the window elapses.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: max - existing.count, retryAfterSeconds: 0 };
}

/** Clear a bucket, e.g. after a successful login. */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}

/** Best-effort client identifier derived from proxy headers. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

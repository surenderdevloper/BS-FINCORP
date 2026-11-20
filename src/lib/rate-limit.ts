import { createHash } from "node:crypto";
import { dbConnect } from "@/lib/db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface PersistentBucket {
  _id: string;
  count: number;
  expiresAt: Date;
}

let ttlIndexPromise: Promise<string> | undefined;

function bucketId(key: string, windowStart: number): string {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash}:${windowStart}`;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
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

export function rateLimitReset(key: string): void {
  memoryBuckets.delete(key);
}

async function getPersistentCollection() {
  const connection = await dbConnect();
  const database = connection.db;
  if (!database) throw new Error("Could not access the database for API rate limiting.");
  const collection = database.collection<PersistentBucket>("api_rate_limits");
  if (!ttlIndexPromise) {
    ttlIndexPromise = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      ttlIndexPromise = undefined;
      console.warn("api_rate_limits index creation warning:", error instanceof Error ? error.message : error);
      return "";
    });
  }
  await ttlIndexPromise;
  return collection;
}

/**
 * Persist fixed-window counters in MongoDB so limits are shared across serverless
 * instances. Only a one-way hash of the supplied key is stored.
 * If MongoDB has a transient error, falls back safely to in-memory limiting so legitimate
 * user logins are never blocked.
 */
export async function persistentRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const id = bucketId(key, windowStart);
    const collection = await getPersistentCollection();
    await collection.updateOne(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
      { upsert: true }
    );
    const bucket = await collection.findOne({ _id: id }, { projection: { count: 1 } });
    if (!bucket) throw new Error("API rate-limit counter could not be read after update.");
    if (bucket.count > max) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
      };
    }
    return { ok: true, remaining: max - bucket.count, retryAfterSeconds: 0 };
  } catch (err) {
    console.warn("persistentRateLimit falling back to memory:", err instanceof Error ? err.message : err);
    return rateLimit(key, max, windowMs);
  }
}

export async function persistentRateLimitReset(key: string, windowMs: number): Promise<void> {
  rateLimitReset(key);
  try {
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const collection = await getPersistentCollection();
    await collection.deleteOne({ _id: bucketId(key, windowStart) });
  } catch {
    // Best-effort cleanup in database
  }
}

/** Best-effort client identifier derived from proxy headers. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

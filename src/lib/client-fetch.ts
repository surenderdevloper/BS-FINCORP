interface CacheEntry<T> {
  data: T;
  at: number;
}

// Client-side in-memory cache for read-only (GET) responses. Lives in module
// memory, so it is naturally scoped to the current tab/page lifetime. Never
// used for POST/PUT/DELETE or authentication responses.
const memory = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const lastRevalidateAt = new Map<string, number>();

// Freshness window / background revalidation gate (30-60s recommended).
const DEFAULT_TTL_MS = 60_000;

// Cache key for the Customers full-list response rendered on the Customers tab.
// Mutations that alter that list's content must call invalidateCached with this
// key after they succeed.
export const CUSTOMERS_LIST_CACHE_KEY = "/api/customers?all=1";

function getEntry<T>(url: string): CacheEntry<T> | undefined {
  return memory.get(url) as CacheEntry<T> | undefined;
}

/**
 * Synchronously reads the current cached payload for a URL without triggering
 * any network activity. Used to render previously loaded data immediately.
 */
export function peekCached<T>(url: string): { data: T } | undefined {
  const entry = getEntry<T>(url);
  return entry ? { data: entry.data } : undefined;
}

export type CacheInvalidator = string | RegExp | ((url: string) => boolean);

/**
 * Removes cached GET responses for URLs matching the given exact string,
 * RegExp or predicate. Returns the number of entries removed.
 *
 * Call after successful mutations so stale data never persists beyond its
 * TTL by accident (e.g. after editing a customer or saving settings).
 */
export function invalidateCached(matcher: CacheInvalidator): number {
  const matches =
    typeof matcher === "string"
      ? (url: string) => url === matcher
      : matcher instanceof RegExp
        ? (url: string) => matcher.test(url)
        : matcher;

  let removed = 0;
  for (const url of Array.from(memory.keys())) {
    if (matches(url)) {
      memory.delete(url);
      inFlight.delete(url);
      lastRevalidateAt.delete(url);
      removed++;
    }
  }
  return removed;
}

async function fetchJson<T>(url: string): Promise<T> {
  const pending = inFlight.get(url) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Request to ${url} failed (${res.status}).`);
    const data = (await res.json()) as T;
    memory.set(url, { data, at: Date.now() });
    return data;
  })().finally(() => {
    inFlight.delete(url);
  });

  inFlight.set(url, promise);
  return promise;
}

function revalidateInBackground<T>(url: string): void {
  const now = Date.now();
  const previous = lastRevalidateAt.get(url) ?? 0;
  // Don't hammer the API every single remount — only refresh once the previous
  // payload is inside the TTL window.
  if (now - previous < DEFAULT_TTL_MS) return;
  lastRevalidateAt.set(url, now);
  void fetchJson<T>(url).catch(() => {
    // Background refresh failed: keep serving the cached payload untouched.
  });
}

export interface CachedResult<T> {
  source: "cache" | "network";
  data: T;
}

/**
 * Read a GET response, serving a cached copy when available.
 *
 * - First call fetches from the network and stores the response.
 * - Later calls return the cached payload immediately and kick off a silent
 *   background refresh (at most once per TTL window) so the cache is replaced
 *   with fresh data.
 * - If the network fails but a cached payload exists, the cached payload is
 *   kept and no error is surfaced.
 * - If no cached payload exists, errors propagate to the caller (preserving
 *   the existing error behavior).
 */
export async function cachedGet<T>(url: string): Promise<CachedResult<T>> {
  const entry = getEntry<T>(url);
  if (entry) {
    revalidateInBackground<T>(url);
    return { source: "cache", data: entry.data };
  }
  return { source: "network", data: await fetchJson<T>(url) };
}
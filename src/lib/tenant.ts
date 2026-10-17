import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Tenant request context.
 *
 * The application is multi-tenant only when MULTI_TENANT is enabled. While it is
 * disabled every helper here is a no-op so the original single-tenant behaviour
 * is preserved exactly.
 *
 * When enabled, server code must run tenant-scoped database work inside
 * `runWithTenant(tenantId, fn)`. The tenant id must come from the verified
 * server-side session — never from the URL, query string, or request body.
 */

export interface TenantContext {
  /** The active tenant, or null when the scope is explicitly unscoped. */
  tenantId: string | null;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** True when the deployment runs in multi-tenant mode. Defaults to off. */
export function multiTenantEnabled(): boolean {
  const value = (process.env.MULTI_TENANT ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

/** Run `fn` with all tenant-scoped database work bound to `tenantId`. */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

/**
 * Run `fn` without tenant scoping. Reserve this for global work that is
 * authenticated separately: login, superadmin operations, and migrations.
 * Every call site must be reviewed — it bypasses tenant isolation.
 */
export function runUnscoped<T>(fn: () => T): T {
  return storage.run({ tenantId: null }, fn);
}

/** The active tenant id, or undefined when no context is bound. */
export function currentTenantId(): string | undefined {
  return storage.getStore()?.tenantId ?? undefined;
}

/** True when the current context was explicitly marked unscoped. */
export function isUnscoped(): boolean {
  const store = storage.getStore();
  return store !== undefined && store.tenantId === null;
}

export class TenantScopeError extends Error {
  constructor(message = "Tenant scope is required but no tenant is bound to this request.") {
    super(message);
    this.name = "TenantScopeError";
  }
}

/**
 * The Mongo filter fragment for the active tenant.
 *
 * - Multi-tenancy disabled → `{}` (single-tenant behaviour).
 * - Explicitly unscoped → `{}` (caller has been reviewed).
 * - Tenant bound → `{ tenantId }`.
 * - Multi-tenancy enabled but no tenant bound → throws, so a forgotten scope
 *   fails closed instead of silently reading across every tenant.
 */
export function tenantScope(): { tenantId?: string } {
  if (!multiTenantEnabled()) return {};
  if (isUnscoped()) return {};
  const tenantId = currentTenantId();
  if (!tenantId) throw new TenantScopeError();
  return { tenantId };
}

/** Merge the tenant scope into an existing Mongo filter. */
export function scopeFilter<T extends Record<string, unknown>>(filter: T): T & { tenantId?: string } {
  return { ...filter, ...tenantScope() };
}

/**
 * Run `fn` bound to the session's tenant. When multi-tenancy is disabled this
 * simply runs `fn` unchanged, so single-tenant deployments are unaffected.
 * A session with no tenant (superadmin/developer) runs explicitly unscoped.
 */
export function runForSession<T>(tenantId: string | null | undefined, fn: () => T): T {
  if (!multiTenantEnabled()) return fn();
  return tenantId ? runWithTenant(tenantId, fn) : runUnscoped(fn);
}

/** The active tenant id, or throws when multi-tenancy is enabled and none is bound. */
export function requireTenantId(): string {
  if (!multiTenantEnabled()) {
    throw new TenantScopeError("Multi-tenant mode is not enabled.");
  }
  const tenantId = currentTenantId();
  if (!tenantId) throw new TenantScopeError();
  return tenantId;
}

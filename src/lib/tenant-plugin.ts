import type { Schema } from "mongoose";
import { currentTenantId, isUnscoped, multiTenantEnabled } from "@/lib/tenant";

/**
 * Mongoose plugin that automatically enforces tenant isolation.
 *
 * When MULTI_TENANT is enabled and a tenant is bound to the current request
 * (see `runForSession` / `runWithTenant`), every query gets a `tenantId` filter,
 * every inserted document gets `tenantId` stamped, and every aggregation gets a
 * leading `$match` on `tenantId`.
 *
 * When multi-tenancy is disabled — or the request is explicitly unscoped — the
 * plugin does nothing, so the original single-tenant behaviour is preserved.
 *
 * This is a defence-in-depth layer. It is never a substitute for deriving the
 * tenant from the verified server-side session; a caller-supplied tenant id is
 * never trusted.
 */

const FIELD = "tenantId";

// Query middleware names to scope. The regexes also cover close relatives
// (findOneAndUpdate, countDocuments, estimatedDocumentCount, …).
const READ_AND_WRITE_OPS = /^(find|count|distinct|exists|update|delete|replace)/;

function activeTenantId(): string | undefined {
  if (!multiTenantEnabled()) return undefined;
  if (isUnscoped()) return undefined;
  return currentTenantId();
}

export function tenantPlugin(schema: Schema): void {
  const scopeQuery = function (this: {
    where(conditions: Record<string, unknown>): unknown;
  }) {
    const tenantId = activeTenantId();
    if (!tenantId) return;
    this.where({ [FIELD]: tenantId });
  };

  schema.pre(READ_AND_WRITE_OPS, scopeQuery as never);

  schema.pre("aggregate", function (this: { pipeline(): Array<Record<string, unknown>> }) {
    const tenantId = activeTenantId();
    if (!tenantId) return;
    this.pipeline().unshift({ $match: { [FIELD]: tenantId } });
  } as never);

  schema.pre("save", function (this: Record<string, unknown>) {
    const tenantId = activeTenantId();
    if (!tenantId) return;
    if (this[FIELD] == null) this[FIELD] = tenantId;
  } as never);

  schema.pre("insertMany", function (this: unknown, docs: unknown) {
    const tenantId = activeTenantId();
    if (tenantId && Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc && typeof doc === "object" && (doc as Record<string, unknown>)[FIELD] == null) {
          (doc as Record<string, unknown>)[FIELD] = tenantId;
        }
      }
    }
  } as never);
}

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  currentTenantId,
  isUnscoped,
  multiTenantEnabled,
  runForSession,
  runUnscoped,
  runWithTenant,
  scopeFilter,
  tenantScope,
  TenantScopeError,
} from "@/lib/tenant";

const original = process.env.MULTI_TENANT;

afterEach(() => {
  if (original === undefined) delete process.env.MULTI_TENANT;
  else process.env.MULTI_TENANT = original;
});

function enable() {
  process.env.MULTI_TENANT = "on";
}

function disable() {
  process.env.MULTI_TENANT = "off";
}

test("multiTenantEnabled is off by default and truthy only for known flags", () => {
  disable();
  assert.equal(multiTenantEnabled(), false);
  for (const value of ["1", "true", "on", "yes", "ON", " True "]) {
    process.env.MULTI_TENANT = value;
    assert.equal(multiTenantEnabled(), true, `expected ${value} to enable`);
  }
  for (const value of ["", "0", "false", "no", "off", "maybe"]) {
    process.env.MULTI_TENANT = value;
    assert.equal(multiTenantEnabled(), false, `expected ${value} to disable`);
  }
});

test("single-tenant mode leaves every helper as a no-op", () => {
  disable();
  assert.deepEqual(tenantScope(), {});
  assert.equal(currentTenantId(), undefined);
  assert.equal(isUnscoped(), false);
  // runForSession must not bind a tenant when the flag is off.
  assert.equal(runForSession("tenant-a", () => currentTenantId()), undefined);
  assert.deepEqual(scopeFilter({ status: "active" }), { status: "active" });
});

test("scoped context filters queries by the bound tenant", () => {
  enable();
  runWithTenant("tenant-a", () => {
    assert.equal(currentTenantId(), "tenant-a");
    assert.deepEqual(tenantScope(), { tenantId: "tenant-a" });
    assert.deepEqual(scopeFilter({ status: "active" }), {
      status: "active",
      tenantId: "tenant-a",
    });
  });
  // The binding must not leak past the callback.
  assert.equal(currentTenantId(), undefined);
});

test("runForSession binds a real tenant and unscopes a null tenant", () => {
  enable();
  assert.equal(runForSession("tenant-a", () => currentTenantId()), "tenant-a");
  runForSession(null, () => {
    assert.equal(isUnscoped(), true);
    assert.deepEqual(tenantScope(), {});
  });
  runForSession(undefined, () => {
    assert.equal(isUnscoped(), true);
    assert.deepEqual(tenantScope(), {});
  });
});

test("scoped queries fail closed when multi-tenancy is on but no tenant is bound", () => {
  enable();
  assert.throws(() => tenantScope(), TenantScopeError);
  assert.throws(() => scopeFilter({}), TenantScopeError);
});

test("runUnscoped bypasses tenant scoping even when enabled", () => {
  enable();
  runUnscoped(() => {
    assert.equal(isUnscoped(), true);
    assert.deepEqual(tenantScope(), {});
    assert.equal(currentTenantId(), undefined);
  });
});

test("nested contexts resolve to the innermost tenant", () => {
  enable();
  runWithTenant("outer", () => {
    assert.equal(currentTenantId(), "outer");
    runWithTenant("inner", () => {
      assert.equal(currentTenantId(), "inner");
      assert.deepEqual(tenantScope(), { tenantId: "inner" });
    });
    assert.equal(currentTenantId(), "outer");
  });
});

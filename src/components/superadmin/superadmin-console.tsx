"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";

interface TenantRow {
  tenantId: string;
  businessName: string;
  adminEmail: string;
  planName: string;
  planStatus: "active" | "suspended";
  expiresAt: string | null;
  counts: { customers: number; loans: number; users: number };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "developer" | "superadmin";
  tenantId: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return body;
}

export function SuperadminConsole({ ownerEmail }: { ownerEmail: string }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        api<{ tenants: TenantRow[] }>("/api/superadmin/tenants"),
        api<{ users: UserRow[] }>("/api/superadmin/users"),
      ]);
      setTenants(t.tenants);
      setUsers(u.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function toggleStatus(row: TenantRow) {
    const next = row.planStatus === "active" ? "suspended" : "active";
    setBusy(row.tenantId);
    setError(null);
    try {
      await api(`/api/superadmin/tenants/${encodeURIComponent(row.tenantId)}`, {
        method: "PATCH",
        body: JSON.stringify({ planStatus: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Superadmin Panel</h1>
        <p className="text-sm text-zinc-500">
          Manage tenants, plans and accounts. Signed in as {ownerEmail}.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Tenants" subtitle="Every client company on this deployment." />
        {loading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">No tenants yet. Create the first one below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Usage</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.tenantId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-900">{t.businessName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{t.tenantId}</td>
                    <td className="px-4 py-3 text-zinc-600">{t.planName || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={t.planStatus === "active" ? "green" : "amber"}>{t.planStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {t.counts.users} users · {t.counts.customers} customers · {t.counts.loans} loans
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={t.planStatus === "active" ? "danger" : "primary"}
                        size="sm"
                        disabled={busy === t.tenantId}
                        onClick={() => toggleStatus(t)}
                      >
                        {t.planStatus === "active" ? "Suspend" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateTenantCard onCreated={load} onError={setError} />

      <CreateUserCard tenants={tenants} onCreated={load} onError={setError} />

      <Card>
        <CardHeader title="Accounts" subtitle="All login accounts and their tenant." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Tenant</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-900">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "superadmin" ? "green" : "zinc"}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.tenantId ?? "global"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CreateTenantCard({
  onCreated,
  onError,
}: {
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [planName, setPlanName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api("/api/superadmin/tenants", {
        method: "POST",
        body: JSON.stringify({ tenantId, businessName, adminEmail, planName }),
      });
      setTenantId("");
      setBusinessName("");
      setAdminEmail("");
      setPlanName("");
      await onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="New tenant" subtitle="Register a client company." />
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <Field label="Tenant ID" required hint="lowercase letters, numbers, _ or -">
          <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="acme_finance" />
        </Field>
        <Field label="Business name" required>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Finance" />
        </Field>
        <Field label="Admin email">
          <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="owner@acme.com" />
        </Field>
        <Field label="Plan name">
          <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Standard" />
        </Field>
      </div>
      <div className="px-4 pb-4">
        <Button onClick={submit} disabled={saving || !tenantId || !businessName}>
          {saving ? "Creating…" : "Create tenant"}
        </Button>
      </div>
    </Card>
  );
}

function CreateUserCard({
  tenants,
  onCreated,
  onError,
}: {
  tenants: TenantRow[];
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "developer" | "superadmin">("admin");
  const [tenantId, setTenantId] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api("/api/superadmin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role, tenantId: role === "admin" ? tenantId : null }),
      });
      setName("");
      setEmail("");
      setPassword("");
      await onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="New account" subtitle="Create an admin for a tenant, or another global operator." />
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Owner name" />
        </Field>
        <Field label="Email" required>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@acme.com" />
        </Field>
        <Field label="Password" required hint="minimum 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Role" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="admin">admin (tenant user)</option>
            <option value="developer">developer (global)</option>
            <option value="superadmin">superadmin (global)</option>
          </Select>
        </Field>
        {role === "admin" && (
          <Field label="Tenant" required>
            <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">Select a tenant…</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.businessName} ({t.tenantId})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="px-4 pb-4">
        <Button
          onClick={submit}
          disabled={saving || !email || !password || (role === "admin" && !tenantId)}
        >
          {saving ? "Creating…" : "Create account"}
        </Button>
      </div>
    </Card>
  );
}

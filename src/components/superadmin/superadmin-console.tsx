"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";

interface TenantRow {
  tenantId: string;
  businessName: string;
  adminEmail: string;
  planName: string;
  planStatus: "active" | "suspended";
  expiresAt: string | null;
  archived: boolean;
  notes: string;
  expired: boolean;
  daysLeft: number | null;
  counts: { customers: number; loans: number; users: number };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "developer" | "superadmin";
  tenantId: string | null;
  lastLoginAt: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string | null;
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

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

type Tab = "tenants" | "accounts" | "audit";

export function SuperadminConsole({ ownerEmail, ownerId }: { ownerEmail: string; ownerId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tenants");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function flash(message: string) {
    setNotice(message);
    setError(null);
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Superadmin Panel</h1>
          <p className="text-sm text-zinc-500">Signed in as {ownerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <ChangePasswordButton onDone={() => flash("Password changed.")} onError={setError} />
          <Button variant="secondary" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {(["tenants", "accounts", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === "tenants" && <TenantsTab flash={flash} onError={setError} />}
      {tab === "accounts" && <AccountsTab ownerId={ownerId} flash={flash} onError={setError} />}
      {tab === "audit" && <AuditTab onError={setError} />}
    </div>
  );
}

function ChangePasswordButton({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api("/api/superadmin/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setOpen(false);
      setCurrent("");
      setNext("");
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Change password
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm p-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Change your password</h3>
            <div className="space-y-3">
              <Field label="Current password" required>
                <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </Field>
              <Field label="New password" required hint="minimum 8 characters">
                <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving || !current || next.length < 8} onClick={submit}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function TenantsTab({
  flash,
  onError,
}: {
  flash: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (showArchived) params.set("archived", "1");
      const res = await api<{ tenants: TenantRow[] }>(`/api/superadmin/tenants?${params}`);
      setTenants(res.tenants);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [q, showArchived, onError]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  async function toggleStatus(row: TenantRow) {
    setBusy(row.tenantId);
    try {
      await api(`/api/superadmin/tenants/${encodeURIComponent(row.tenantId)}`, {
        method: "PATCH",
        body: JSON.stringify({ planStatus: row.planStatus === "active" ? "suspended" : "active" }),
      });
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function archive(row: TenantRow, restore: boolean) {
    const verb = restore ? "Restore" : "Archive";
    if (!restore && !window.confirm(`Archive "${row.businessName}"? It will be suspended and hidden from the list.`)) {
      return;
    }
    setBusy(row.tenantId);
    try {
      await api(`/api/superadmin/tenants/${encodeURIComponent(row.tenantId)}?restore=${restore ? "1" : "0"}`, {
        method: "DELETE",
      });
      flash(`${verb}d "${row.businessName}".`);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(row: TenantRow) {
    if (!window.confirm(`Generate a new password for every admin of "${row.businessName}"?`)) return;
    setBusy(row.tenantId);
    try {
      const res = await api<{ password: string | null; accounts: string[]; generated: boolean }>(
        `/api/superadmin/tenants/${encodeURIComponent(row.tenantId)}/reset-password`,
        { method: "POST", body: JSON.stringify({}) }
      );
      flash(
        res.generated
          ? `New password for ${res.accounts.join(", ")}: ${res.password}  (copy it now — it is shown once)`
          : `Password reset for ${res.accounts.join(", ")}.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Tenants"
          subtitle="Every client company on this deployment."
          action={
            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-8 w-40 py-1"
              />
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Archived
              </label>
            </div>
          }
        />
        {loading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">No tenants match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Expiry</th>
                  <th className="px-4 py-2">Usage</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <TenantTableRow
                    key={t.tenantId}
                    row={t}
                    busy={busy === t.tenantId}
                    editing={editing === t.tenantId}
                    onEdit={() => setEditing(editing === t.tenantId ? null : t.tenantId)}
                    onToggle={() => toggleStatus(t)}
                    onArchive={() => archive(t, false)}
                    onRestore={() => archive(t, true)}
                    onReset={() => resetPassword(t)}
                    onSaved={async () => {
                      setEditing(null);
                      flash(`Saved "${t.businessName}".`);
                      await load();
                    }}
                    onError={onError}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateTenantCard onCreated={load} onError={onError} flash={flash} />
    </div>
  );
}

function statusBadge(t: TenantRow) {
  if (t.archived) return <Badge tone="zinc">archived</Badge>;
  if (t.expired) return <Badge tone="red">expired</Badge>;
  if (t.planStatus === "suspended") return <Badge tone="amber">suspended</Badge>;
  if (t.daysLeft !== null && t.daysLeft <= 7)
    return <Badge tone="amber">{t.daysLeft}d left</Badge>;
  return <Badge tone="green">active</Badge>;
}

function TenantTableRow({
  row,
  busy,
  editing,
  onEdit,
  onToggle,
  onArchive,
  onRestore,
  onReset,
  onSaved,
  onError,
}: {
  row: TenantRow;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onReset: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-zinc-100 last:border-0">
        <td className="px-4 py-3">
          <div className="font-medium text-zinc-900">{row.businessName}</div>
          <div className="font-mono text-xs text-zinc-400">{row.tenantId}</div>
        </td>
        <td className="px-4 py-3 text-zinc-600">{row.planName || "—"}</td>
        <td className="px-4 py-3">{statusBadge(row)}</td>
        <td className="px-4 py-3 text-xs text-zinc-500">
          {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "no expiry"}
        </td>
        <td className="px-4 py-3 text-xs text-zinc-500">
          {row.counts.users} users · {row.counts.customers} cust · {row.counts.loans} loans
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {editing ? "Close" : "Edit"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onReset}>
              Reset pw
            </Button>
            {row.archived ? (
              <Button variant="secondary" size="sm" disabled={busy} onClick={onRestore}>
                Restore
              </Button>
            ) : (
              <>
                <Button
                  variant={row.planStatus === "active" ? "danger" : "primary"}
                  size="sm"
                  disabled={busy}
                  onClick={onToggle}
                >
                  {row.planStatus === "active" ? "Suspend" : "Activate"}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={onArchive}>
                  Archive
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-zinc-100 bg-zinc-50">
          <td colSpan={6} className="px-4 py-4">
            <EditTenantForm row={row} onSaved={onSaved} onError={onError} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditTenantForm({
  row,
  onSaved,
  onError,
}: {
  row: TenantRow;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [businessName, setBusinessName] = useState(row.businessName);
  const [adminEmail, setAdminEmail] = useState(row.adminEmail);
  const [planName, setPlanName] = useState(row.planName);
  const [expiresAt, setExpiresAt] = useState(toDateInput(row.expiresAt));
  const [notes, setNotes] = useState(row.notes);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/superadmin/tenants/${encodeURIComponent(row.tenantId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          businessName,
          adminEmail,
          planName,
          notes,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Business name" required>
        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </Field>
      <Field label="Admin email">
        <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
      </Field>
      <Field label="Plan name">
        <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
      </Field>
      <Field label="Expires on" hint="leave empty for no expiry">
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex items-end">
        <Button size="sm" disabled={saving || !businessName} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function CreateTenantCard({
  onCreated,
  onError,
  flash,
}: {
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
  flash: (message: string) => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [planName, setPlanName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api("/api/superadmin/tenants", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          businessName,
          adminEmail,
          planName,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      setTenantId("");
      setBusinessName("");
      setAdminEmail("");
      setPlanName("");
      setExpiresAt("");
      flash("Tenant created.");
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
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-3">
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
        <Field label="Expires on" hint="optional">
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button onClick={submit} disabled={saving || !tenantId || !businessName}>
            {saving ? "Creating…" : "Create tenant"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AccountsTab({
  ownerId,
  flash,
  onError,
}: {
  ownerId: string;
  flash: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        api<{ tenants: TenantRow[] }>("/api/superadmin/tenants?archived=1"),
        api<{ users: UserRow[] }>("/api/superadmin/users"),
      ]);
      setTenants(t.tenants);
      setUsers(u.users);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function resetUser(row: UserRow) {
    const next = window.prompt(`New password for ${row.email} (minimum 8 characters):`);
    if (next === null) return;
    if (next.length < 8) {
      onError("Password must be at least 8 characters.");
      return;
    }
    setBusy(row.id);
    try {
      await api(`/api/superadmin/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: next }),
      });
      flash(`Password updated for ${row.email}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function removeUser(row: UserRow) {
    if (!window.confirm(`Delete account ${row.email}? This cannot be undone.`)) return;
    setBusy(row.id);
    try {
      await api(`/api/superadmin/users/${row.id}`, { method: "DELETE" });
      flash(`Deleted ${row.email}.`);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <CreateUserCard tenants={tenants} onCreated={load} onError={onError} flash={flash} />

      <Card>
        <CardHeader title="Accounts" subtitle="All login accounts and their tenant." />
        {loading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Tenant</th>
                  <th className="px-4 py-2">Last login</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 text-zinc-900">{u.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "superadmin" ? "green" : u.role === "developer" ? "blue" : "zinc"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.tenantId ?? "global"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" disabled={busy === u.id} onClick={() => resetUser(u)}>
                          Reset pw
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === u.id || u.id === ownerId}
                          title={u.id === ownerId ? "You cannot delete your own account" : undefined}
                          onClick={() => removeUser(u)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateUserCard({
  tenants,
  onCreated,
  onError,
  flash,
}: {
  tenants: TenantRow[];
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
  flash: (message: string) => void;
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
      flash("Account created.");
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
          disabled={saving || !email || password.length < 8 || (role === "admin" && !tenantId)}
        >
          {saving ? "Creating…" : "Create account"}
        </Button>
      </div>
    </Card>
  );
}

function AuditTab({ onError }: { onError: (message: string) => void }) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await api<{ logs: AuditRow[] }>(`/api/superadmin/audit?${params}`);
      setLogs(res.logs);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [q, onError]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <Card>
      <CardHeader
        title="Audit log"
        subtitle="Every superadmin action, newest first."
        action={
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-40 py-1" />
        }
      />
      {loading ? (
        <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">By</th>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(l.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700">{l.action}</td>
                  <td className="px-4 py-3 text-zinc-600">{l.actorEmail}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{l.targetId || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

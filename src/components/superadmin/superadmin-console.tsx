"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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
  lastLoginDevice?: string;
  lastLoginIp?: string;
  activeDevices?: number;
}

interface DeviceRow {
  sid: string;
  device: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
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
  const [restoreFor, setRestoreFor] = useState<TenantRow | null>(null);

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
                    onRestoreBackup={() => setRestoreFor(t)}
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

      {restoreFor && (
        <RestoreBackupModal
          tenant={restoreFor}
          onClose={() => setRestoreFor(null)}
          onSuccess={(msg) => {
            flash(msg);
            setRestoreFor(null);
            void load();
          }}
          onError={onError}
        />
      )}
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

function expiryLabel(t: TenantRow): string {
  if (t.expiresAt === null || t.daysLeft === null) return "no expiry";
  if (t.expired || t.daysLeft <= 0) return "expired";
  return t.daysLeft === 1 ? "1 day left" : `${t.daysLeft} days left`;
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
  onRestoreBackup,
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
  onRestoreBackup: () => void;
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
        <td className="px-4 py-3 text-xs text-zinc-500">{expiryLabel(row)}</td>
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
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRestoreBackup}>
              Restore Backup
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
  const [editing, setEditing] = useState<string | null>(null);
  const [openDevices, setOpenDevices] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  async function removeUser(row: UserRow, scope: "account" | "data" | "both") {
    const label =
      scope === "account"
        ? `Delete ONLY the login ${row.email}? Their tenant data stays.`
        : scope === "data"
          ? `Delete ALL data of tenant "${row.tenantId}" (customers, loans, EMIs, payments)? Logins stay.`
          : `Delete ${row.email} AND all data of tenant "${row.tenantId}"? This cannot be undone.`;
    if (!window.confirm(`${label}\n\nType-less confirm: press OK to proceed.`)) return;
    setBusy(row.id);
    try {
      await api(`/api/superadmin/users/${row.id}?scope=${scope}`, { method: "DELETE" });
      flash(scope === "account" ? `Deleted ${row.email}.` : scope === "data" ? `Wiped data for ${row.tenantId}.` : `Deleted ${row.email} and all ${row.tenantId} data.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeDevice(row: UserRow, params: string, message: string) {
    setBusy(row.id);
    try {
      await api(`/api/superadmin/users/${row.id}/sessions?${params}`, { method: "DELETE" });
      flash(message);
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
                  <th className="px-4 py-2">Devices</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-3 text-zinc-900">{u.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge tone={u.role === "superadmin" ? "green" : u.role === "developer" ? "blue" : "zinc"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.tenantId ?? "global"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {formatDate(u.lastLoginAt)}
                        {u.lastLoginDevice ? (
                          <span className="mt-0.5 block text-[11px] text-zinc-400">
                            {u.lastLoginDevice}
                            {u.lastLoginIp ? ` · ${u.lastLoginIp}` : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={u.activeDevices ? "blue" : "zinc"}>{u.activeDevices ?? 0} live</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpenDevices(openDevices === u.id ? null : u.id)}
                          >
                            {openDevices === u.id ? "Hide" : "Where"}
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditing(editing === u.id ? null : u.id)}
                          >
                            {editing === u.id ? "Close" : "Edit"}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy === u.id} onClick={() => resetUser(u)}>
                            Reset pw
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === u.id || u.id === ownerId || u.role === "superadmin"}
                            title={
                              u.id === ownerId
                                ? "You cannot impersonate your own account"
                                : u.role === "superadmin"
                                  ? "Cannot impersonate a superadmin account"
                                  : undefined
                            }
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Login as ${u.email}? You will be signed in as this account.`
                                )
                              )
                                return;
                              setBusy(u.id);
                              try {
                                const res = (await api(`/api/superadmin/users/${u.id}/impersonate`, { method: "POST" })) as { ok?: boolean; error?: string };
                                if (!res.ok) throw new Error(res.error || "Failed to impersonate");
                                flash(`Signed in as ${u.email}. Redirecting…`);
                                window.location.href = "/dashboard";
                              } catch (e: unknown) {
                                onError(e instanceof Error ? e.message : "Failed to impersonate account");
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Login as
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === u.id || u.id === ownerId}
                            title={u.id === ownerId ? "You cannot delete your own account" : undefined}
                            onClick={() => setConfirmDelete(confirmDelete === u.id ? null : u.id)}
                          >
                            {confirmDelete === u.id ? "Cancel" : "Delete"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {confirmDelete === u.id && (
                      <tr className="border-b border-zinc-100 bg-red-50">
                        <td colSpan={7} className="px-4 py-4">
                          <p className="mb-2 text-xs font-semibold text-red-700">
                            Choose what to delete for {u.email}:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy === u.id}
                              onClick={() => removeUser(u, "account")}
                            >
                              1. User only
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy === u.id || !u.tenantId}
                              title={
                                u.tenantId
                                  ? "Delete all business data of this tenant, keep every login"
                                  : "This account has no tenant data"
                              }
                              onClick={() => removeUser(u, "data")}
                            >
                              2. Data only{u.tenantId ? ` (${u.tenantId})` : ""}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy === u.id || !u.tenantId}
                              title={u.tenantId ? "Delete this login and the whole tenant's data" : "No tenant attached"}
                              onClick={() => removeUser(u, "both")}
                            >
                              3. Both
                            </Button>
                          </div>
                          <p className="mt-2 text-[11px] text-red-600">
                            Data-only and Both wipe customers, loans, EMIs and payments and restart
                            numbering. Every action is written to the audit log.
                          </p>
                        </td>
                      </tr>
                    )}
                    {openDevices === u.id && (
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        <td colSpan={7} className="px-4 py-4">
                          <DevicePanel
                            row={u}
                            busy={busy === u.id}
                            onRevoke={(params, message) => revokeDevice(u, params, message)}
                          />
                        </td>
                      </tr>
                    )}
                    {editing === u.id && (
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        <td colSpan={7} className="px-4 py-4">
                          <EditUserForm
                            row={u}
                            tenants={tenants}
                            onSaved={() => {
                              setEditing(null);
                              flash(`Saved ${u.email}.`);
                              void load();
                            }}
                            onError={onError}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DevicePanel({
  row,
  busy,
  onRevoke,
}: {
  row: UserRow;
  busy: boolean;
  onRevoke: (params: string, message: string) => void;
}) {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      api<{ sessions: DeviceRow[] }>(`/api/superadmin/users/${row.id}/sessions`)
        .then((r) => setDevices(r.sessions))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed."));
    }, 0);
    return () => clearTimeout(id);
  }, [row.id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-700">
          Signed-in devices — {row.email}
          {row.lastLoginDevice ? ` (last: ${row.lastLoginDevice})` : ""}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !devices || devices.length < 2}
          title={devices && devices.length < 2 ? "Only one device is signed in" : "Sign this account out everywhere else"}
          onClick={() => onRevoke("all=1", `Signed out all devices of ${row.email}.`)}
        >
          Logout all devices
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {devices === null ? (
        <p className="text-xs text-zinc-500">Loading devices…</p>
      ) : devices.length === 0 ? (
        <p className="text-xs text-zinc-500">No active session. The account is signed out everywhere.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 bg-white">
          {devices.map((d) => (
            <li key={d.sid} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-800">{d.device}</p>
                <p className="text-[11px] text-zinc-500">
                  {d.ip ? `${d.ip} · ` : ""}last seen {formatDate(d.lastSeenAt)} · joined {formatDate(d.createdAt)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => onRevoke(`sid=${encodeURIComponent(d.sid)}`, `Signed out ${d.device}.`)}
              >
                Logout
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditUserForm({
  row,
  tenants,
  onSaved,
  onError,
}: {
  row: UserRow;
  tenants: TenantRow[];
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(row.name);
  const [role, setRole] = useState<UserRow["role"]>(row.role);
  const [tenantId, setTenantId] = useState(row.tenantId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (role === "admin" && !tenantId) {
      onError("Tenant is required for an admin.");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/superadmin/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          role,
          ...(role === "admin" ? { tenantId } : {}),
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
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value as UserRow["role"])}>
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
      <div className="flex items-end">
        <Button size="sm" disabled={saving || !name} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
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

function RestoreBackupModal({
  tenant,
  onClose,
  onSuccess,
  onError,
}: {
  tenant: TenantRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [purge, setPurge] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!file) {
      onError("Select a backup JSON file");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purge", purge ? "true" : "false");
      const res = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}/restore`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Restore failed");
      const c = body.results || {};
      const total = Object.values(c).reduce((a: number, b: any) => a + (b?.inserted || 0), 0);
      onSuccess(`Restored ${total} records for ${tenant.businessName}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader title={`Restore Backup - ${tenant.businessName}`} subtitle={tenant.tenantId} />
        <div className="space-y-3 p-4">
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} />
            Purge existing data for this tenant first (recommended)
          </label>
          <p className="text-xs text-zinc-500">Use a backup JSON downloaded from R2 or manual backup.</p>
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={uploading || !file}>
            {uploading ? "Restoring…" : "Restore"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

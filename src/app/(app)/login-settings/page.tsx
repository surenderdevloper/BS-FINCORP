"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";

export default function LoginSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Login Settings";
  }, []);

  const onSubmit = async () => {
    setMessage(null);
    setError(null);
    setFieldErrors({});
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = "Required.";
    if (newPassword.length < 8) errors.newPassword = "Minimum 8 characters.";
    if (newPassword !== confirm) errors.confirm = "Passwords do not match.";
    if (newPassword && newPassword === currentPassword) errors.newPassword = "New password must differ from current.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        setError(data.error ?? "Could not change password.");
        return;
      }
      setMessage("Password changed successfully. Use it next time you log in.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Network error while changing password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Login Settings</h1>
        <p className="text-sm text-zinc-500">Change the admin password used to sign in.</p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Icon name="check" size={16} /> {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      <Card className="max-w-xl">
        <CardHeader title="Change Password" subtitle="Enter your current password and set a new one" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
          <Field label="Current Password" required error={fieldErrors.currentPassword}>
            <Input
              type="password"
              value={currentPassword}
              invalid={!!fieldErrors.currentPassword}
              placeholder="Old password"
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field label="New Password" required hint="Minimum 8 characters" error={fieldErrors.newPassword}>
            <Input
              type="password"
              value={newPassword}
              invalid={!!fieldErrors.newPassword}
              placeholder="New password"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm New Password" required error={fieldErrors.confirm}>
            <Input
              type="password"
              value={confirm}
              invalid={!!fieldErrors.confirm}
              placeholder="Re-enter new password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <div className="flex justify-end border-t border-zinc-100 pt-4">
            <Button onClick={() => void onSubmit()} disabled={saving}>
              <Icon name="lock" size={16} />
              {saving ? "Saving…" : "Change Password"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
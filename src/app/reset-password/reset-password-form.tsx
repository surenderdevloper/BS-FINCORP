"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";

export function ResetPasswordForm({
  logo,
  companyName,
}: {
  logo?: string;
  companyName: string;
}) {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!token) {
      setError("This reset link is invalid or missing. Please request a new one.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm }),
      });
      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        setError(data.error ?? "Could not reset your password. Please try again.");
        setBusy(false);
        return;
      }
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <span>Your password has been changed. Please sign in with your new password.</span>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Go to Login
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        {logo ? (
          <img
            src={logo}
            alt={companyName}
            className="mx-auto mb-3 h-12 w-12 rounded-xl object-contain"
          />
        ) : (
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-extrabold text-white">
            BF
          </span>
        )}
        <h1 className="text-lg font-bold text-zinc-900">Set a New Password</h1>
        <p className="text-sm text-zinc-500">
          Choose a new password for your {companyName} account.
        </p>
      </div>

      {!token ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>This reset link is invalid or missing.</span>
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Request a New Link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="New Password" required error={fieldErrors.password}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              invalid={!!fieldErrors.password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm New Password" required error={fieldErrors.confirm}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              invalid={!!fieldErrors.confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>

          {error && !fieldErrors.password && !fieldErrors.confirm && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" size="md" disabled={busy}>
            {busy ? "Saving…" : "Change Password"}
          </Button>
        </form>
      )}
    </Card>
  );
}
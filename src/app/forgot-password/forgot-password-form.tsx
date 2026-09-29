"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";

export function ForgotPasswordForm({
  logo,
  companyName,
}: {
  logo?: string;
  companyName: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string };
      setMessage(
        data.message ??
          "If an account exists with this information, you will receive password reset instructions."
      );
    } catch {
      setMessage(
        "If an account exists with this information, you will receive password reset instructions."
      );
    } finally {
      setBusy(false);
    }
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
        <h1 className="text-lg font-bold text-zinc-900">Forgot Password</h1>
        <p className="text-sm text-zinc-500">
          Enter your account email to receive reset instructions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" required>
          <Input
            type="email"
            autoComplete="username"
            placeholder="admin@bsfincorp.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" className="w-full" size="md" disabled={busy}>
          {busy ? "Sending…" : "Send Reset Instructions"}
        </Button>
      </form>

      {message && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="font-medium text-emerald-600 hover:underline">
          Back to login
        </Link>
      </p>
    </Card>
  );
}
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DeveloperAccessForm({
  enabled,
  locked = false,
}: {
  enabled: boolean;
  locked?: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/developer/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "That access key is not correct."
            : response.status === 429
              ? "Too many attempts. Please wait before trying again."
              : "The console could not be unlocked. Please try again."
        );
        return;
      }
      setKey("");
      router.replace("/developer");
      router.refresh();
    } catch {
      setError("Could not verify the key. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-semibold text-zinc-900">Developer Console</p>
      {enabled ? (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            {locked ? "The console is locked on this device." : "Enter your developer access key to continue."}
          </p>
          <form onSubmit={submit} className="mt-5 space-y-3 text-left">
            <label htmlFor="developer-key" className="block text-sm font-medium text-zinc-700">
              Access key
            </label>
            <input
              id="developer-key"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              required
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !key}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "Unlock console"}
            </button>
          </form>
        </>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">
          The console is disabled. Set the DEVELOPER_KEY environment variable to enable it.
        </p>
      )}
    </div>
  );
}

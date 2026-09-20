"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

interface BackupInfo {
  exportedAt: string;
  counts: Record<string, number>;
}

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<BackupInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Backup";
  }, []);

  const download = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/backup", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not create backup.");
      const data = (await res.json()) as BackupInfo;
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = data.exportedAt.slice(0, 10);
      a.href = url;
      a.download = `bsfincorp-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLast(data);
      setMessage("Backup downloaded. Keep this file safe — it contains all your records.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setLoading(false);
    }
  };

  const total = last ? Object.values(last.counts).reduce((n, c) => n + c, 0) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Backup</h1>
        <p className="text-sm text-zinc-500">Download a full copy of your data as a JSON file.</p>
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
        <CardHeader title="Full data backup" subtitle="Customers, loans, EMIs, payments, users, settings & penalty rules" />
        <div className="p-4 sm:p-5">
          <p className="text-sm text-zinc-600">
            The backup file contains every record in your system. Download it regularly and keep it on your device or
            cloud drive so your data is never lost.
          </p>
          <Button onClick={() => void download()} disabled={loading} className="mt-4">
            <Icon name="backup" size={16} />
            {loading ? "Preparing backup…" : "Download Full Backup (JSON)"}
          </Button>

          {last && (
            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Exported</dt>
                <dd className="font-medium text-zinc-900">{new Date(last.exportedAt).toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Records</dt>
                <dd className="font-medium text-zinc-900">{total.toLocaleString("en-IN")}</dd>
              </div>
            </dl>
          )}
        </div>
      </Card>
    </div>
  );
}
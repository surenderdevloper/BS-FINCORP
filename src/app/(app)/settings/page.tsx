"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";
import { Icon } from "@/components/icons";

interface CompanyData {
  companyName: string;
  address: string;
  gst: string;
  phone: string;
  email: string;
  receiptPrefix: string;
  loanPrefix: string;
}

interface PenaltyData {
  enabled: boolean;
  graceDays: number;
  penaltyType: "fixed" | "percentage";
  penaltyPerDay: number;
  maxPenaltyAmount: number | null;
}

const emptyCompany: CompanyData = {
  companyName: "BS FINCORP",
  address: "",
  gst: "",
  phone: "",
  email: "",
  receiptPrefix: "RCPT",
  loanPrefix: "BF",
};

const emptyPenalty: PenaltyData = {
  enabled: true,
  graceDays: 3,
  penaltyType: "fixed",
  penaltyPerDay: 10,
  maxPenaltyAmount: null,
};

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyData>(emptyCompany);
  const [penalty, setPenalty] = useState<PenaltyData>(emptyPenalty);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"company" | "penalty" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Settings";
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { company: CompanyData; penalty: PenaltyData };
        setCompany({ ...emptyCompany, ...data.company });
        setPenalty({ ...emptyPenalty, ...data.penalty });
      } catch {
        setError("Could not load settings.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const save = async (section: "company" | "penalty") => {
    setSaving(section);
    setMessage(null);
    setError(null);
    try {
      const body = section === "company" ? { section, company } : { section, penalty };
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save settings.");
        return;
      }
      setMessage(`${section === "company" ? "Company details" : "Penalty rules"} saved.`);
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">Company profile and penalty rules used across the system.</p>
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

      {!loaded ? (
        <p className="text-sm text-zinc-500">Loading settings…</p>
      ) : (
        <>
          <Card>
            <CardHeader title="Company details" subtitle="Shown on receipts, NOC letters and reports" />
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <Field label="Company Name">
                <Input value={company.companyName} onChange={(e) => setCompany((c) => ({ ...c, companyName: e.target.value }))} />
              </Field>
              <Field label="Address">
                <Input value={company.address} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} />
              </Field>
              <Field label="GST Number">
                <Input value={company.gst} onChange={(e) => setCompany((c) => ({ ...c, gst: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={company.phone} onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} />
              </Field>
              <Field label="Email">
                <Input value={company.email} onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Receipt Prefix">
                  <Input value={company.receiptPrefix} onChange={(e) => setCompany((c) => ({ ...c, receiptPrefix: e.target.value }))} />
                </Field>
                <Field label="Loan Prefix">
                  <Input value={company.loanPrefix} onChange={(e) => setCompany((c) => ({ ...c, loanPrefix: e.target.value }))} />
                </Field>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button onClick={() => void save("company")} disabled={saving === "company"}>
                  <Icon name="check" size={16} />
                  {saving === "company" ? "Saving…" : "Save Company Details"}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Penalty rules" subtitle="Late-fee calculation for overdue EMIs" />
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">Enable late-fee penalty</p>
                  <p className="text-xs text-zinc-500">When active, overdue EMIs accrue late fees.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={penalty.enabled}
                  onClick={() => setPenalty((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    penalty.enabled ? "bg-emerald-600" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      penalty.enabled ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              <Field label="Grace Days">
                <Input
                  type="number"
                  value={penalty.graceDays}
                  min={0}
                  onChange={(e) => setPenalty((p) => ({ ...p, graceDays: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Penalty Type">
                <Select
                  value={penalty.penaltyType}
                  onChange={(e) => setPenalty((p) => ({ ...p, penaltyType: e.target.value as PenaltyData["penaltyType"] }))}
                >
                  <option value="fixed">Fixed ₹ per day</option>
                  <option value="percentage">% of EMI per day</option>
                </Select>
              </Field>
              <Field label={penalty.penaltyType === "fixed" ? "Fixed Amount (₹ / day)" : "Percentage (% / day)"}>
                <Input
                  type="number"
                  value={penalty.penaltyPerDay}
                  min={0}
                  step="0.01"
                  onChange={(e) => setPenalty((p) => ({ ...p, penaltyPerDay: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Maximum Penalty per EMI (₹)" hint="Leave empty for no cap">
                <Input
                  type="number"
                  value={penalty.maxPenaltyAmount ?? ""}
                  min={0}
                  placeholder="No cap"
                  onChange={(e) =>
                    setPenalty((p) => ({ ...p, maxPenaltyAmount: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                />
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button onClick={() => void save("penalty")} disabled={saving === "penalty"}>
                  <Icon name="check" size={16} />
                  {saving === "penalty" ? "Saving…" : "Save Penalty Rules"}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
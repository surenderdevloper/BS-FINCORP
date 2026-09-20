"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";

interface CompanyData {
  companyName: string;
  address: string;
  gst: string;
  phone: string;
  email: string;
  logo: string;
  receiptPrefix: string;
  loanPrefix: string;
}

const emptyCompany: CompanyData = {
  companyName: "BS FINCORP",
  address: "",
  gst: "",
  phone: "",
  email: "",
  logo: "",
  receiptPrefix: "RCPT",
  loanPrefix: "BF",
};

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyData>(emptyCompany);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = "Settings";
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { company: CompanyData };
        setCompany({ ...emptyCompany, ...data.company });
      } catch {
        setError("Could not load settings.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "company", company }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save settings.");
        return;
      }
      setMessage("Company details saved.");
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file (PNG, JPG, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo image must be under 2 MB.");
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCompany((c) => ({ ...c, logo: String(reader.result ?? "") }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">Company profile shown on receipts, NOC letters and reports.</p>
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
        <Card>
          <CardHeader title="Company details" subtitle="Shown on receipts, NOC letters and reports" />
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="sm:col-span-2">
              <p className="mb-1.5 inline-block text-xs font-medium text-zinc-700">Company Logo</p>
              <div className="flex items-center gap-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
                {company.logo ? (
                  <img src={company.logo} alt="Company logo" className="h-16 w-16 rounded-lg bg-white object-contain ring-1 ring-zinc-200" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-zinc-300 ring-1 ring-zinc-200">
                    <Icon name="user" size={28} />
                  </span>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                      <Icon name="edit" size={14} /> Upload Logo
                    </Button>
                    {company.logo && (
                      <Button variant="ghost" size="sm" onClick={() => setCompany((c) => ({ ...c, logo: "" }))}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">PNG / JPG / SVG, under 2 MB. Shows on NOC & receipts.</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onLogoFile(e.target.files?.[0])}
                />
              </div>
              {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
            </div>

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
            <div className="sm:col-span-2">
              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  <Icon name="check" size={16} />
                  {saving ? "Saving…" : "Save Company Details"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
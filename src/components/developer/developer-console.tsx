"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Badge } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";
import { Icon } from "@/components/icons";
import { buildBrandScale } from "@/lib/brand";
import { APP_TIME_ZONE } from "@/lib/money";

interface CompanyState {
  companyName: string;
  address: string;
  gst: string;
  phone: string;
  email: string;
  logo: string;
  printLogo: string;
  tagline: string;
  website: string;
  receiptPrefix: string;
  loanPrefix: string;
}

interface DocumentsState {
  receiptTitle: string;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  signOffReceived: string;
  signOffCustomer: string;
  showGstOnReceipt: boolean;
  showLogoOnPrint: boolean;
  letterheadColor: string;
  accentColor: string;
  textColor: string;
}

interface LoanTypeState {
  name: string;
  defaultInterestType: "flat" | "reducing";
  defaultRate: number;
  defaultTenureMonths: number;
  defaultEmiDay: number;
  active: boolean;
}

interface MessageState {
  [key: string]: string;
}

interface ThemeState {
  primary: string;
}

interface MaintenanceState {
  enabled: boolean;
  message: string;
}

interface FeaturesState {
  whatsapp: boolean;
  sms: boolean;
}

interface AuditEntry {
  at: string;
  by: string;
  summary: string;
}

interface MetaState {
  dbState: string;
  node: string;
  next: string;
  env: { name: string; set: boolean }[];
  now: string;
}

interface Payload {
  company: CompanyState;
  documents: DocumentsState;
  loanTypes: LoanTypeState[];
  waTemplates: MessageState;
  smsTemplates: MessageState;
  theme: ThemeState;
  maintenance: MaintenanceState;
  features: FeaturesState;
  audit: AuditEntry[];
  defaults: { waTemplates: MessageState; smsTemplates: MessageState };
  meta: MetaState;
}

const WA_TEMPLATES: { key: string; label: string; hint: string }[] = [
  { key: "upcoming", label: "EMI upcoming", hint: "Reminder before an EMI is due" },
  { key: "duetoday", label: "EMI due today", hint: "On the due date" },
  { key: "overdue", label: "EMI overdue", hint: "After the due date" },
  { key: "payment", label: "Payment received", hint: "After a payment is recorded" },
  { key: "followupFriendly", label: "Follow-up (friendly)", hint: "Gentle collection reminder" },
  { key: "followupStatus", label: "Follow-up (ask date)", hint: "Ask when they can pay" },
  { key: "followupContact", label: "Follow-up (call office)", hint: "Invite to call the office" },
  { key: "statement", label: "Account statement", hint: "Customer statement summary" },
  { key: "chat", label: "Direct chat greeting", hint: "Opening message for a chat" },
];

const SMS_TEMPLATES: { key: string; label: string; hint: string }[] = [
  { key: "upcoming", label: "EMI upcoming", hint: "Reminder before an EMI is due" },
  { key: "overdue", label: "EMI overdue", hint: "After the due date" },
];

const TEMPLATE_TOKENS = [
  "{name}",
  "{amount}",
  "{loan}",
  "{date}",
  "{brand}",
  "{phone}",
  "{receipt}",
  "{total_loan}",
  "{total_paid}",
  "{outstanding}",
];

type Tab = "company" | "documents" | "loans" | "messages" | "theme" | "tools";

const TABS: { key: Tab; label: string; icon: "settings" | "file" | "rules" | "chat" | "view" | "backup" }[] = [
  { key: "company", label: "Company & Branding", icon: "settings" },
  { key: "documents", label: "Receipt & Documents", icon: "file" },
  { key: "loans", label: "Loan Types & EMI Rules", icon: "rules" },
  { key: "messages", label: "Messages", icon: "chat" },
  { key: "theme", label: "Website Theme", icon: "view" },
  { key: "tools", label: "Developer Tools", icon: "backup" },
];

export function DeveloperConsole({ ownerEmail }: { ownerEmail: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("company");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState<CompanyState | null>(null);
  const [documents, setDocuments] = useState<DocumentsState | null>(null);
  const [loanTypes, setLoanTypes] = useState<LoanTypeState[]>([]);
  const [waTemplates, setWaTemplates] = useState<MessageState>({});
  const [smsTemplates, setSmsTemplates] = useState<MessageState>({});
  const [theme, setTheme] = useState<ThemeState>({ primary: "#059669" });
  const [maintenance, setMaintenance] = useState<MaintenanceState>({ enabled: false, message: "" });
  const [features, setFeatures] = useState<FeaturesState>({ whatsapp: true, sms: true });
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const applyPayload = useCallback((payload: Payload) => {
    setData(payload);
    setCompany(payload.company);
    setDocuments(payload.documents);
    setLoanTypes(payload.loanTypes ?? []);
    setWaTemplates(payload.waTemplates ?? {});
    setSmsTemplates(payload.smsTemplates ?? {});
    setTheme(payload.theme ?? { primary: "#059669" });
    setMaintenance(payload.maintenance ?? { enabled: false, message: "" });
    setFeatures(payload.features ?? { whatsapp: true, sms: true });
    setAudit(payload.audit ?? []);
  }, []);

  useEffect(() => {
    document.title = "Developer Console";
    void (async () => {
      try {
        const res = await fetch("/api/developer", { cache: "no-store" });
        if (!res.ok) {
          setLoadError(res.status === 404 ? "Developer access required." : "Could not load developer settings.");
          return;
        }
        const payload = (await res.json()) as Payload;
        applyPayload(payload);
      } catch {
        setLoadError("Network error while loading developer settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [applyPayload]);

  const palette = useMemo(() => buildBrandScale(theme.primary), [theme.primary]);

  async function saveSection(section: string, payload: Record<string, unknown>, summary: string, onOk?: (res: Record<string, unknown>) => void) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/developer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: payload }),
      });
      const body = (await res.json()) as Record<string, unknown> & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save.");
        return;
      }
      if (onOk) onOk(body);
      setMessage(summary);
      // Record an audit entry (best effort).
      void fetch("/api/developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (b && Array.isArray((b as { audit?: AuditEntry[] }).audit)) {
            setAudit((b as { audit: AuditEntry[] }).audit);
          }
        })
        .catch(() => {});
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading developer console…</p>;
  }

  if (loadError || !data || !company || !documents) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <Icon name="alert" size={18} /> {loadError ?? "Developer settings unavailable."}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900">
            <Icon name="settings" size={20} className="text-emerald-600" /> Developer Console
          </h1>
          <p className="text-sm text-zinc-500">
            Owner-only settings. Visible and editable only by developer accounts — signed in as{" "}
            <span className="font-medium text-zinc-700">{ownerEmail}</span>.
          </p>
        </div>
        <Badge tone="green">developer access</Badge>
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

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setMessage(null);
              setError(null);
            }}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-emerald-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <Icon name={t.icon} size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "company" && (
        <CompanyTab
          data={data}
          company={company}
          setCompany={(updater) => setCompany((c) => (c ? updater(c) : c))}
          saving={saving}
          onSave={(c) => saveSection("company", { ...c }, "Company & branding saved.")}
        />
      )}

      {tab === "documents" && (
        <DocumentsTab
          company={company}
          documents={documents}
          setDocuments={(updater) => setDocuments((d) => (d ? updater(d) : d))}
          saving={saving}
          onSave={(d) => saveSection("documents", { documents: d }, "Receipt & document settings saved.")}
        />
      )}

      {tab === "loans" && (
        <LoanTypesTab
          loanTypes={loanTypes}
          setLoanTypes={setLoanTypes}
          saving={saving}
          onSave={(rows) => saveSection("loanTypes", { loanTypes: rows }, "Loan types & EMI rules saved.")}
        />
      )}

      {tab === "messages" && (
        <MessagesTab
          waTemplates={waTemplates}
          setWaTemplates={setWaTemplates}
          smsTemplates={smsTemplates}
          setSmsTemplates={setSmsTemplates}
          defaults={data.defaults}
          saving={saving}
          onSaveWa={(t) => saveSection("waTemplates", { waTemplates: t }, "WhatsApp templates saved.")}
          onSaveSms={(t) => saveSection("smsTemplates", { smsTemplates: t }, "SMS templates saved.")}
        />
      )}

      {tab === "theme" && (
        <ThemeTab
          theme={theme}
          setTheme={setTheme}
          palette={palette}
          saving={saving}
          onSave={(t) => saveSection("theme", { theme: t }, "Website theme color saved.")}
        />
      )}

      {tab === "tools" && (
        <ToolsTab
          meta={data.meta}
          maintenance={maintenance}
          setMaintenance={setMaintenance}
          features={features}
          setFeatures={setFeatures}
          audit={audit}
          saving={saving}
          onSaveMaintenance={(m) => saveSection("maintenance", { maintenance: m }, "Maintenance mode updated.")}
          onSaveFeatures={(f) => saveSection("features", { features: f }, "Feature switches updated.")}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Company & branding                                                  */
/* ------------------------------------------------------------------ */

function CompanyTab({
  data,
  company,
  setCompany,
  saving,
  onSave,
}: {
  data: Payload;
  company: CompanyState;
  setCompany: (updater: (c: CompanyState) => CompanyState) => void;
  saving: boolean;
  onSave: (c: CompanyState) => void;
}) {
  const logoRef = useLogoPicker((url) => setCompany((c) => ({ ...c, logo: url })));
  const printRef = useLogoPicker((url) => setCompany((c) => ({ ...c, printLogo: url })));

  return (
    <Card>
      <CardHeader
        title="Company & Branding"
        subtitle="Name, logo and contact details shown across the app, receipts and messages"
      />
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <LogoPicker
            label="App logo (sidebar / login)"
            value={company.logo}
            onClick={logoRef.open}
            onClear={() => setCompany((c) => ({ ...c, logo: "" }))}
            inputRef={logoRef.ref}
            onFile={logoRef.onFile}
            error={logoRef.error}
          />
          <LogoPicker
            label="Print logo (receipts / NOC, optional)"
            value={company.printLogo}
            onClick={printRef.open}
            onClear={() => setCompany((c) => ({ ...c, printLogo: "" }))}
            inputRef={printRef.ref}
            onFile={printRef.onFile}
            error={printRef.error}
          />
        </div>

        <Field label="Company Name">
          <Input value={company.companyName} onChange={(e) => setCompany((c) => ({ ...c, companyName: e.target.value }))} />
        </Field>
        <Field label="Tagline" hint="Shown under the company name in the sidebar.">
          <Input value={company.tagline} onChange={(e) => setCompany((c) => ({ ...c, tagline: e.target.value }))} />
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
        <Field label="Website" hint="Optional, shown on documents when set.">
          <Input value={company.website} onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Receipt Prefix" hint="Existing receipts keep their number.">
            <Input value={company.receiptPrefix} onChange={(e) => setCompany((c) => ({ ...c, receiptPrefix: e.target.value }))} />
          </Field>
          <Field label="Loan Prefix">
            <Input value={company.loanPrefix} onChange={(e) => setCompany((c) => ({ ...c, loanPrefix: e.target.value }))} />
          </Field>
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <Button onClick={() => onSave(company)} disabled={saving}>
            <Icon name="check" size={16} /> {saving ? "Saving…" : "Save Company & Branding"}
          </Button>
        </div>
      </div>
      <p className="border-t border-zinc-100 px-4 py-3 text-[11px] text-zinc-400 sm:px-5">
        Tip: company name and phone also drive the branding on WhatsApp/SMS messages (see Messages tab).
        Data currently stored: logo {data.company.logo ? "set" : "not set"}, print logo{" "}
        {data.company.printLogo ? "set" : "not set"}.
      </p>
    </Card>
  );
}

function LogoPicker({
  label,
  value,
  onClick,
  onClear,
  inputRef,
  onFile,
  error,
}: {
  label: string;
  value: string;
  onClick: () => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
}) {
  return (
    <div>
      <p className="mb-1.5 inline-block text-xs font-medium text-zinc-700">{label}</p>
      <div className="flex items-center gap-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-lg bg-white object-contain ring-1 ring-zinc-200" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-zinc-300 ring-1 ring-zinc-200">
            <Icon name="file" size={26} />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClick}>
              <Icon name="edit" size={14} /> Upload
            </Button>
            {value && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">PNG / JPG / SVG (auto-resized).</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function useLogoPicker(onPick: (dataUrl: string) => void) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isSvg = file.type.includes("svg") || file.name.toLowerCase().endsWith(".svg");
    if (!isSvg && !file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, SVG).");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (isSvg) {
        if (file.size > 2 * 1024 * 1024) {
          setError("SVG must be under 2 MB.");
          return;
        }
        onPick(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const MAX = 512;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return onPick(dataUrl);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return onPick(dataUrl);
          const fr = new FileReader();
          fr.onload = () => onPick(String(fr.result ?? dataUrl));
          fr.readAsDataURL(blob);
        }, "image/png");
      };
      img.onerror = () => setError("Could not read this image. Try PNG or JPG.");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return { ref, error, onFile, open: () => ref.current?.click() };
}

/* ------------------------------------------------------------------ */
/* Receipt & documents                                                 */
/* ------------------------------------------------------------------ */

function DocumentsTab({
  company,
  documents,
  setDocuments,
  saving,
  onSave,
}: {
  company: CompanyState;
  documents: DocumentsState;
  setDocuments: (updater: (d: DocumentsState) => DocumentsState) => void;
  saving: boolean;
  onSave: (d: DocumentsState) => void;
}) {
  const set = <K extends keyof DocumentsState>(key: K, value: DocumentsState[K]) =>
    setDocuments((d) => ({ ...d, [key]: value }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title="Receipt & Documents" subtitle="Header, footer, titles and colours used on printable documents" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Receipt Title">
            <Input value={documents.receiptTitle} onChange={(e) => set("receiptTitle", e.target.value)} />
          </Field>
          <Field label="Sign-off — Company side">
            <Input value={documents.signOffReceived} onChange={(e) => set("signOffReceived", e.target.value)} />
          </Field>
          <Field label="Sign-off — Customer side">
            <Input value={documents.signOffCustomer} onChange={(e) => set("signOffCustomer", e.target.value)} />
          </Field>
          <div className="flex flex-col justify-center gap-2">
            <Toggle label="Show GST on receipt" checked={documents.showGstOnReceipt} onChange={(v) => set("showGstOnReceipt", v)} />
            <Toggle label="Show logo on print" checked={documents.showLogoOnPrint} onChange={(v) => set("showLogoOnPrint", v)} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Header note" hint="Small line under the letterhead on receipts.">
              <textarea
                value={documents.receiptHeaderNote}
                onChange={(e) => set("receiptHeaderNote", e.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-500"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Footer note" hint="Printed at the bottom of receipts.">
              <textarea
                value={documents.receiptFooterNote}
                onChange={(e) => set("receiptFooterNote", e.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-500"
              />
            </Field>
          </div>
          <ColorField label="Letterhead colour" value={documents.letterheadColor} onChange={(v) => set("letterheadColor", v)} />
          <ColorField label="Accent colour" value={documents.accentColor} onChange={(v) => set("accentColor", v)} />
          <ColorField label="Text colour" value={documents.textColor} onChange={(v) => set("textColor", v)} />

          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => onSave(documents)} disabled={saving}>
              <Icon name="check" size={16} /> {saving ? "Saving…" : "Save Document Settings"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Live preview" subtitle="Approximate receipt look" />
        <div className="p-4">
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <div
              className="flex items-center justify-between px-3 py-2.5"
              style={{ backgroundColor: documents.letterheadColor, color: "#fff" }}
            >
              <div className="flex items-center gap-2">
                {documents.showLogoOnPrint && company.printLogo ? (
                  <img src={company.printLogo} alt="" className="h-8 w-8 rounded bg-white object-contain p-0.5" />
                ) : null}
                <div>
                  <p className="text-sm font-bold leading-tight">{company.companyName || "Company"}</p>
                  <p className="text-[10px] opacity-90">{company.address || "Address"}</p>
                </div>
              </div>
              <span className="text-[10px] opacity-90">{documents.receiptTitle}</span>
            </div>
            <div className="bg-white p-3" style={{ color: documents.textColor }}>
              {documents.receiptHeaderNote && (
                <p className="mb-2 text-[10px] italic opacity-80">{documents.receiptHeaderNote}</p>
              )}
              <div className="space-y-1 text-[11px]">
                <Row k="Customer" v="Ramesh Kumar" />
                <Row k="Loan No" v="BF-0001" />
                {documents.showGstOnReceipt && <Row k="GST" v={company.gst || "—"} />}
              </div>
              <div
                className="mt-3 flex items-center justify-between rounded px-2 py-1.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: documents.accentColor }}
              >
                <span>Total Paid</span>
                <span>₹4,917</span>
              </div>
              <div className="mt-3 flex justify-between text-[10px] opacity-80">
                <span>{documents.signOffReceived}</span>
                <span>{documents.signOffCustomer}</span>
              </div>
              <p className="mt-2 text-center text-[9px] opacity-70">{documents.receiptFooterNote}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-70">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loan types                                                          */
/* ------------------------------------------------------------------ */

function LoanTypesTab({
  loanTypes,
  setLoanTypes,
  saving,
  onSave,
}: {
  loanTypes: LoanTypeState[];
  setLoanTypes: (rows: LoanTypeState[]) => void;
  saving: boolean;
  onSave: (rows: LoanTypeState[]) => void;
}) {
  const update = (i: number, patch: Partial<LoanTypeState>) =>
    setLoanTypes(loanTypes.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const addRow = () =>
    setLoanTypes([
      ...loanTypes,
      { name: "", defaultInterestType: "flat", defaultRate: 0, defaultTenureMonths: 12, defaultEmiDay: 5, active: true },
    ]);

  return (
    <Card>
      <CardHeader
        title="Loan Types & EMI Rules"
        subtitle="Loan-type dropdown options and the defaults applied when a new loan is created"
        action={
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Icon name="plus" size={14} /> Add type
          </Button>
        }
      />
      <div className="space-y-3 p-4 sm:p-5">
        {loanTypes.length === 0 && (
          <p className="text-sm text-zinc-500">No loan types yet. Add one to get started.</p>
        )}
        {loanTypes.map((row, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-6">
            <div className="col-span-2 sm:col-span-2">
              <Field label="Name">
                <Input value={row.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. 2 Wheeler" />
              </Field>
            </div>
            <Field label="Interest type">
              <Select
                value={row.defaultInterestType}
                onChange={(e) => update(i, { defaultInterestType: e.target.value as "flat" | "reducing" })}
              >
                <option value="flat">Flat</option>
                <option value="reducing">Reducing</option>
              </Select>
            </Field>
            <Field label="Rate %">
              <Input
                type="number"
                value={String(row.defaultRate)}
                onChange={(e) => update(i, { defaultRate: Number(e.target.value) })}
              />
            </Field>
            <Field label="Tenure (m)">
              <Input
                type="number"
                value={String(row.defaultTenureMonths)}
                onChange={(e) => update(i, { defaultTenureMonths: Number(e.target.value) })}
              />
            </Field>
            <div className="flex items-center justify-between gap-2">
              <Field label="EMI day">
                <Input
                  type="number"
                  value={String(row.defaultEmiDay)}
                  onChange={(e) => update(i, { defaultEmiDay: Number(e.target.value) })}
                />
              </Field>
              <button
                type="button"
                onClick={() => setLoanTypes(loanTypes.filter((_, idx) => idx !== i))}
                className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"
                title="Remove"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="col-span-2 sm:col-span-6">
              <Toggle label="Active (show in the loan form dropdown)" checked={row.active} onChange={(v) => update(i, { active: v })} />
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={() => onSave(loanTypes)} disabled={saving}>
            <Icon name="check" size={16} /> {saving ? "Saving…" : "Save Loan Types"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function MessagesTab({
  waTemplates,
  setWaTemplates,
  smsTemplates,
  setSmsTemplates,
  defaults,
  saving,
  onSaveWa,
  onSaveSms,
}: {
  waTemplates: MessageState;
  setWaTemplates: (t: MessageState) => void;
  smsTemplates: MessageState;
  setSmsTemplates: (t: MessageState) => void;
  defaults: { waTemplates: MessageState; smsTemplates: MessageState };
  saving: boolean;
  onSaveWa: (t: MessageState) => void;
  onSaveSms: (t: MessageState) => void;
}) {
  const [channel, setChannel] = useState<"wa" | "sms">("wa");
  const templates = channel === "wa" ? waTemplates : smsTemplates;
  const setTemplates = channel === "wa" ? setWaTemplates : setSmsTemplates;
  const defs = channel === "wa" ? defaults.waTemplates : defaults.smsTemplates;
  const meta = channel === "wa" ? WA_TEMPLATES : SMS_TEMPLATES;
  const [expanded, setExpanded] = useState<string | null>(meta[0]?.key ?? null);

  return (
    <Card>
      <CardHeader
        title="Message Templates"
        subtitle="Leave a template empty to use the built-in default. Use tokens to personalise."
        action={
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setChannel("wa")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${
                channel === "wa" ? "bg-emerald-600 text-white" : "border border-zinc-300 bg-white text-zinc-600"
              }`}
            >
              <Icon name="whatsapp" size={14} /> WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setChannel("sms")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${
                channel === "sms" ? "bg-emerald-600 text-white" : "border border-zinc-300 bg-white text-zinc-600"
              }`}
            >
              <Icon name="chat" size={14} /> SMS
            </button>
          </div>
        }
      />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
          <p className="text-[11px] font-medium text-zinc-600">Available tokens</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TEMPLATE_TOKENS.map((t) => (
              <code key={t} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-emerald-700 ring-1 ring-zinc-200">
                {t}
              </code>
            ))}
          </div>
        </div>

        {meta.map((m) => {
          const isOpen = expanded === m.key;
          const value = templates[m.key] ?? "";
          const effective = value.trim() ? value : defs[m.key] ?? "";
          return (
            <div key={m.key} className="rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : m.key)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">{m.label}</span>
                  <span className="block text-xs text-zinc-500">{m.hint}</span>
                </span>
                <span className="flex items-center gap-2">
                  {value.trim() ? <Badge tone="green">custom</Badge> : <Badge tone="zinc">default</Badge>}
                  <Icon name="chevron" size={16} className={`text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-zinc-100 p-3">
                  <textarea
                    value={value}
                    onChange={(e) => setTemplates({ ...templates, [m.key]: e.target.value })}
                    rows={6}
                    placeholder={defs[m.key]}
                    className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-400">
                      {value.trim() ? `${value.length} chars` : "Currently using the built-in default (shown as placeholder)."}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setTemplates({ ...templates, [m.key]: "" })}>
                        Reset to default
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setTemplates({ ...templates, [m.key]: defs[m.key] ?? "" })}
                      >
                        Load default
                      </Button>
                    </div>
                  </div>
                  <details className="text-[11px] text-zinc-500">
                    <summary className="cursor-pointer text-zinc-600">Preview (with sample data)</summary>
                    <pre className="mt-1.5 whitespace-pre-wrap rounded bg-zinc-50 p-2 text-zinc-700 ring-1 ring-zinc-200">
                      {effective.replace(/\{name\}/g, "Ramesh Kumar")
                        .replace(/\{amount\}/g, "₹4,917")
                        .replace(/\{loan\}/g, "BF-0001")
                        .replace(/\{date\}/g, "13/10/2026")
                        .replace(/\{brand\}/g, "BS FINCORP")
                        .replace(/\{phone\}/g, "+91 98765 43210")
                        .replace(/\{receipt\}/g, "RCPT-0001")
                        .replace(/\{total_loan\}/g, "2")
                        .replace(/\{total_paid\}/g, "₹20,000")
                        .replace(/\{outstanding\}/g, "₹15,000")}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex justify-end">
          {channel === "wa" ? (
            <Button onClick={() => onSaveWa(waTemplates)} disabled={saving}>
              <Icon name="check" size={16} /> {saving ? "Saving…" : "Save WhatsApp Templates"}
            </Button>
          ) : (
            <Button onClick={() => onSaveSms(smsTemplates)} disabled={saving}>
              <Icon name="check" size={16} /> {saving ? "Saving…" : "Save SMS Templates"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

function ThemeTab({
  theme,
  setTheme,
  palette,
  saving,
  onSave,
}: {
  theme: ThemeState;
  setTheme: (t: ThemeState) => void;
  palette: Record<string, string>;
  saving: boolean;
  onSave: (t: ThemeState) => void;
}) {
  return (
    <Card>
      <CardHeader title="Website Theme" subtitle="Choose the primary colour used across buttons, links and highlights" />
      <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-4">
          <ColorField label="Primary colour" value={theme.primary} onChange={(v) => setTheme({ primary: v })} />
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="mb-2 text-[11px] font-medium text-zinc-600">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {["#059669", "#1d4ed8", "#1e40af", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#0f766e", "#334155"].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setTheme({ primary: c })}
                    className={`h-8 w-8 rounded-full ring-2 ${theme.primary.toLowerCase() === c ? "ring-zinc-900" : "ring-zinc-200"}`}
                    style={{ backgroundColor: c }}
                  />
                )
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onSave(theme)} disabled={saving}>
              <Icon name="check" size={16} /> {saving ? "Saving…" : "Save Theme"}
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium text-zinc-600">Generated palette</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Object.entries(palette).map(([shade, color]) => (
              <div key={shade} className="overflow-hidden rounded-lg ring-1 ring-zinc-200">
                <div className="h-10" style={{ backgroundColor: color }} />
                <p className="px-1.5 py-0.5 text-[10px] text-zinc-500">{shade}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: palette["600"] }}>
              Primary button
            </span>
            <span className="rounded-lg px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: palette["50"], color: palette["700"] }}>
              Soft highlight
            </span>
          </div>
          <p className="mt-3 text-[11px] text-zinc-400">
            Changes apply to the whole app on next save/refresh. The default is the existing green, so nothing
            changes until you pick a new colour.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

function ToolsTab({
  meta,
  maintenance,
  setMaintenance,
  features,
  setFeatures,
  audit,
  saving,
  onSaveMaintenance,
  onSaveFeatures,
}: {
  meta: MetaState;
  maintenance: MaintenanceState;
  setMaintenance: (m: MaintenanceState) => void;
  features: FeaturesState;
  setFeatures: (f: FeaturesState) => void;
  audit: AuditEntry[];
  saving: boolean;
  onSaveMaintenance: (m: MaintenanceState) => void;
  onSaveFeatures: (f: FeaturesState) => void;
}) {
  const [toolMsg, setToolMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function runAction(action: string) {
    setBusy(true);
    setToolMsg(null);
    try {
      const res = await fetch("/api/developer/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as { message?: string; error?: string };
      setToolMsg(body.message ?? body.error ?? "Done.");
    } catch {
      setToolMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function lockConsole() {
    setBusy(true);
    try {
      await fetch("/api/developer/access", { method: "DELETE" });
    } catch {
      /* still navigate away below */
    }
    router.push("/developer?devError=locked");
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="System status" subtitle="Read-only environment information" />
        <div className="space-y-3 p-4 sm:p-5">
          <StatusRow label="Database" value={meta.dbState} ok={meta.dbState === "connected"} />
          <StatusRow label="Node" value={meta.node} ok />
          <StatusRow label="Next.js" value={meta.next} ok />
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-zinc-600">Environment variables</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.env.map((e) => (
                <span
                  key={e.name}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                    e.set ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-zinc-100 text-zinc-500 ring-zinc-200"
                  }`}
                >
                  {e.name}: {e.set ? "set" : "missing"}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-400">Only presence is shown — secret values are never exposed.</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => runAction("check-db")} disabled={busy}>
              <Icon name="refresh" size={14} /> Check database
            </Button>
            <Button variant="secondary" size="sm" onClick={() => runAction("invalidate-cache")} disabled={busy}>
              <Icon name="refresh" size={14} /> Clear server cache
            </Button>
            <Button variant="secondary" size="sm" onClick={lockConsole} disabled={busy}>
              <Icon name="lock" size={14} /> Lock console
            </Button>
          </div>
          <p className="text-[11px] text-zinc-400">
            Locking signs this device out of the console. Re-open it with your secret key link.
          </p>
          {toolMsg && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700 ring-1 ring-zinc-200">{toolMsg}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Maintenance & features" subtitle="Temporarily pause the app or switch optional tools" />
        <div className="space-y-4 p-4 sm:p-5">
          <Toggle
            label="Maintenance mode banner"
            checked={maintenance.enabled}
            onChange={(v) => setMaintenance({ ...maintenance, enabled: v })}
          />
          <Field label="Maintenance message">
            <textarea
              value={maintenance.message}
              onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
              rows={2}
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-500"
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={() => onSaveMaintenance(maintenance)} disabled={saving}>
              <Icon name="check" size={16} /> Save maintenance
            </Button>
          </div>

          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <Toggle label="WhatsApp features enabled" checked={features.whatsapp} onChange={(v) => setFeatures({ ...features, whatsapp: v })} />
            <Toggle label="SMS features enabled" checked={features.sms} onChange={(v) => setFeatures({ ...features, sms: v })} />
            <div className="flex justify-end">
              <Button onClick={() => onSaveFeatures(features)} disabled={saving}>
                <Icon name="check" size={16} /> Save features
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Change log" subtitle="Recent developer-console changes" />
        <div className="p-4 sm:p-5">
          {audit.length === 0 ? (
            <p className="text-sm text-zinc-500">No changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {audit.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-zinc-700">{a.summary}</span>
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {a.by} · {new Date(a.at).toLocaleString("en-IN", { timeZone: APP_TIME_ZONE })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? "text-emerald-700" : "text-red-600"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared small controls                                               */
/* ------------------------------------------------------------------ */

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-zinc-300"
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}

"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Field, Input } from "@/components/form";
import { Icon } from "@/components/icons";
import { cachedGet, invalidateCached, peekCached } from "@/lib/client-fetch";
import { TEMPLATE_TOKENS, WA_TEMPLATES_META, SMS_TEMPLATES_META } from "@/lib/message-templates";
import type { CompanySettingsData, MessagesSettingsData, SettingsSnapshot } from "@/lib/settings";

const SETTINGS_URL = "/api/settings";

type Tab = "company" | "messages";

const emptyCompany: CompanySettingsData = {
  companyName: "Gigabyte Finance Manager",
  address: "",
  gst: "",
  phone: "",
  email: "",
  logo: "",
  receiptPrefix: "RCPT",
  nextReceiptNo: 1,
  loanPrefix: "GFM",
  nextLoanNo: 1,
};

const emptyMessages: MessagesSettingsData = {
  waTemplates: {},
  smsTemplates: {},
  defaults: {
    waTemplates: {},
    smsTemplates: {},
  },
};

export function SettingsForm({
  initialCompany,
  initialMessages,
}: {
  initialCompany: CompanySettingsData | null;
  initialMessages?: MessagesSettingsData | null;
}) {
  const [tab, setTab] = useState<Tab>("company");
  const [company, setCompany] = useState<CompanySettingsData>(
    initialCompany ? { ...emptyCompany, ...initialCompany } : emptyCompany
  );
  const [messages, setMessages] = useState<MessagesSettingsData>(
    initialMessages ? { ...emptyMessages, ...initialMessages } : emptyMessages
  );
  const [loaded, setLoaded] = useState(initialCompany !== null);
  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Message template sub-channel ("wa" | "sms") & expanded template key
  const [msgChannel, setMsgChannel] = useState<"wa" | "sms">("wa");
  const [expandedKey, setExpandedKey] = useState<string | null>("upcoming");

  useEffect(() => {
    document.title = "Settings";
    if (initialCompany && initialMessages) return;
    void (async () => {
      const cached = peekCached<SettingsSnapshot>(SETTINGS_URL);
      if (cached) {
        setCompany({ ...emptyCompany, ...cached.data.company });
        if (cached.data.messages) setMessages({ ...emptyMessages, ...cached.data.messages });
        setLoaded(true);
      }
      try {
        const { data } = await cachedGet<SettingsSnapshot>(SETTINGS_URL);
        setCompany({ ...emptyCompany, ...data.company });
        if (data.messages) setMessages({ ...emptyMessages, ...data.messages });
        setLoaded(true);
      } catch {
        if (!cached) setError("Could not load settings.");
        setLoaded(true);
      }
    })();
  }, [initialCompany, initialMessages]);

  const saveCompany = async () => {
    setSaving(true);
    setFeedbackMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "company", company }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save company details.");
        return;
      }
      invalidateCached(SETTINGS_URL);
      setFeedbackMessage("Company details saved successfully.");
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const saveMessageTemplates = async () => {
    setSaving(true);
    setFeedbackMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "messages",
          waTemplates: messages.waTemplates,
          smsTemplates: messages.smsTemplates,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save message templates.");
        return;
      }
      invalidateCached(SETTINGS_URL);
      setFeedbackMessage("Message templates saved. All future WhatsApp & SMS reminders will use these templates.");
    } catch {
      setError("Network error while saving message templates.");
    } finally {
      setSaving(false);
    }
  };

  const onLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isSvg = file.type.includes("svg") || file.name.toLowerCase().endsWith(".svg");
    if (!isSvg && !file.type.startsWith("image/")) {
      setLogoError("Please choose an image file (PNG, JPG, SVG).");
      return;
    }

    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (isSvg) {
        if (file.size > 2 * 1024 * 1024) {
          setLogoError("SVG logo must be under 2 MB.");
          return;
        }
        setCompany((c) => ({ ...c, logo: dataUrl }));
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
        if (!ctx) {
          setCompany((c) => ({ ...c, logo: dataUrl }));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) {
            setCompany((c) => ({ ...c, logo: dataUrl }));
            return;
          }
          const fr = new FileReader();
          fr.onload = () => setCompany((c) => ({ ...c, logo: String(fr.result ?? dataUrl) }));
          fr.readAsDataURL(blob);
        }, "image/png");
      };
      img.onerror = () => setLogoError("Could not read this image. Try a PNG or JPG.");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const currentMeta = msgChannel === "wa" ? WA_TEMPLATES_META : SMS_TEMPLATES_META;
  const currentTemplates = msgChannel === "wa" ? messages.waTemplates : messages.smsTemplates;
  const currentDefaults = msgChannel === "wa" ? messages.defaults.waTemplates : messages.defaults.smsTemplates;

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Settings</h1>
          <p className="text-xs text-zinc-500 sm:text-sm">
            Company profile, branding and customizable WhatsApp / SMS reminder templates.
          </p>
        </div>
      </div>

      {feedbackMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-xs">
          <Icon name="check" size={16} className="text-emerald-600" /> {feedbackMessage}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-xs">
          <Icon name="alert" size={16} className="text-red-600" /> {error}
        </div>
      )}

      {/* Primary Section Tabs: Company Profile vs Message Templates */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setTab("company");
            setFeedbackMessage(null);
            setError(null);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            tab === "company"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          <Icon name="settings" size={15} /> Company Profile &amp; Logo
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("messages");
            setFeedbackMessage(null);
            setError(null);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            tab === "messages"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          <Icon name="whatsapp" size={15} /> WhatsApp &amp; SMS Templates
        </button>
      </div>

      {!loaded ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          Loading settings…
        </div>
      ) : tab === "company" ? (
        <Card>
          <CardHeader title="Company details" subtitle="Shown on receipts, NOC letters and reports" />
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="sm:col-span-2">
              <p className="mb-1.5 inline-block text-xs font-medium text-zinc-700">Company Logo</p>
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
                {company.logo ? (
                  <img
                    src={company.logo}
                    alt="Company logo"
                    className="h-16 w-16 rounded-full bg-white object-contain ring-2 ring-emerald-500/30 p-1"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-lg shadow-xs">
                    GB
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
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
                  <p className="text-[11px] text-zinc-400">
                    PNG / JPG / SVG. Rendered in a clean circular badge on browser tabs and customer documents.
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onLogoFile}
                />
              </div>
              {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
            </div>

            <Field label="Company Name">
              <Input
                value={company.companyName}
                onChange={(e) => setCompany((c) => ({ ...c, companyName: e.target.value }))}
              />
            </Field>
            <Field label="Address">
              <Input
                value={company.address}
                onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))}
              />
            </Field>
            <Field label="GST Number">
              <Input
                value={company.gst}
                onChange={(e) => setCompany((c) => ({ ...c, gst: e.target.value }))}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={company.phone}
                onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input
                value={company.email}
                onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <div className="flex justify-end">
                <Button onClick={() => void saveCompany()} disabled={saving}>
                  <Icon name="check" size={16} />
                  {saving ? "Saving…" : "Save Company Details"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        /* Message Templates Tab (WhatsApp & SMS) */
        <Card>
          <CardHeader
            title="Notification Message Templates"
            subtitle="Customize the default message text used when sending WhatsApp or SMS reminders."
            action={
              <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMsgChannel("wa");
                    setExpandedKey("upcoming");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    msgChannel === "wa"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Icon name="whatsapp" size={14} /> WhatsApp ({WA_TEMPLATES_META.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMsgChannel("sms");
                    setExpandedKey("upcoming");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    msgChannel === "sms"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Icon name="chat" size={14} /> SMS ({SMS_TEMPLATES_META.length})
                </button>
              </div>
            }
          />

          <div className="space-y-4 p-4 sm:p-5">
            {/* Available Tokens Bar */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-900">
                  Dynamic Placeholders (Variables)
                </span>
                <span className="text-[11px] text-emerald-700">
                  These tokens automatically replace with the real borrower &amp; loan details
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATE_TOKENS.map((token) => (
                  <span
                    key={token}
                    className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800 shadow-2xs"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>

            {/* Template Editors */}
            <div className="space-y-3">
              {currentMeta.map((m) => {
                const isOpen = expandedKey === m.key;
                const value = currentTemplates[m.key] ?? "";
                const isCustom = Boolean(value.trim());
                const effective = isCustom ? value : currentDefaults[m.key] ?? "";

                // Live simulated preview with real sample customer data
                const samplePreview = effective
                  .replace(/\{name\}/g, "Ramesh Kumar")
                  .replace(/\{amount\}/g, "₹4,917")
                  .replace(/\{loan\}/g, "GFM-0001")
                  .replace(/\{date\}/g, "20/11/2026")
                  .replace(/\{brand\}/g, company.companyName || "Gigabyte Finance Manager")
                  .replace(/\{phone\}/g, company.phone || "+91 98765 43210")
                  .replace(/\{receipt\}/g, "RCPT-0001")
                  .replace(/\{total_loan\}/g, "2")
                  .replace(/\{total_paid\}/g, "₹20,000")
                  .replace(/\{outstanding\}/g, "₹15,000");

                return (
                  <div
                    key={m.key}
                    className={`rounded-xl border transition-all ${
                      isOpen ? "border-emerald-300 ring-2 ring-emerald-500/10" : "border-zinc-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isOpen ? null : m.key)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50/70"
                    >
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-sm font-bold text-zinc-900">{m.label}</span>
                        <span className="block text-[11px] text-zinc-500">{m.hint}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isCustom ? (
                          <Badge tone="green">custom</Badge>
                        ) : (
                          <Badge tone="zinc">system default</Badge>
                        )}
                        <Icon
                          name="chevron"
                          size={16}
                          className={`text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/50 p-4">
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-xs font-semibold text-zinc-700">Template Text</label>
                            <span className="text-[11px] text-zinc-400">
                              {value.trim() ? `${value.length} characters` : "Using system default"}
                            </span>
                          </div>
                          <textarea
                            value={value}
                            onChange={(e) => {
                              const updatedVal = e.target.value;
                              if (msgChannel === "wa") {
                                setMessages((prev) => ({
                                  ...prev,
                                  waTemplates: { ...prev.waTemplates, [m.key]: updatedVal },
                                }));
                              } else {
                                setMessages((prev) => ({
                                  ...prev,
                                  smsTemplates: { ...prev.smsTemplates, [m.key]: updatedVal },
                                }));
                              }
                            }}
                            rows={5}
                            placeholder={currentDefaults[m.key]}
                            className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-xs leading-relaxed text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-zinc-500">
                            Leave empty to use the system default template.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (msgChannel === "wa") {
                                  setMessages((prev) => ({
                                    ...prev,
                                    waTemplates: { ...prev.waTemplates, [m.key]: "" },
                                  }));
                                } else {
                                  setMessages((prev) => ({
                                    ...prev,
                                    smsTemplates: { ...prev.smsTemplates, [m.key]: "" },
                                  }));
                                }
                              }}
                            >
                              Reset to Default
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const def = currentDefaults[m.key] ?? "";
                                if (msgChannel === "wa") {
                                  setMessages((prev) => ({
                                    ...prev,
                                    waTemplates: { ...prev.waTemplates, [m.key]: def },
                                  }));
                                } else {
                                  setMessages((prev) => ({
                                    ...prev,
                                    smsTemplates: { ...prev.smsTemplates, [m.key]: def },
                                  }));
                                }
                              }}
                            >
                              Load Default Text
                            </Button>
                          </div>
                        </div>

                        {/* Live Message Preview */}
                        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-2xs">
                          <span className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Live Preview (As Customer Receives)
                          </span>
                          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800 bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                            {samplePreview}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button onClick={() => void saveMessageTemplates()} disabled={saving}>
                <Icon name="check" size={16} />
                {saving
                  ? "Saving…"
                  : msgChannel === "wa"
                  ? "Save WhatsApp Templates"
                  : "Save SMS Templates"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

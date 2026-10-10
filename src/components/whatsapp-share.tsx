"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/lib/whatsapp";

export interface WhatsAppTemplate {
  key: string;
  label: string;
  message: string;
}

export interface WhatsAppShareProps {
  recipientName: string;
  mobile: string;
  templates: WhatsAppTemplate[];
  title?: string;
  subtitle?: string;
  triggerLabel?: string;
  triggerVariant?: "link" | "primary" | "secondary";
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

const primaryButton =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

const secondaryButton =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";

export function WhatsAppShare({
  recipientName,
  mobile,
  templates,
  title = "WhatsApp Message",
  subtitle,
  triggerLabel = "WhatsApp",
  triggerVariant = "link",
}: WhatsAppShareProps) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<"message" | "phone" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const number = useMemo(() => toWhatsAppNumber(mobile), [mobile]);
  const displayMobile = number ? `+${number}` : mobile.trim() || "No number on record";
  const name = recipientName.trim() || "—";

  const openComposer = () => {
    const first = templates[0];
    setSelectedKey(first?.key ?? "");
    setMessage(first?.message ?? "");
    setCopied(null);
    setCopyFailed(false);
    setOpen(true);
  };

  const closeComposer = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComposer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onCopy = useCallback(async (kind: "message" | "phone", text: string) => {
    const ok = await writeClipboard(text);
    setCopied(ok ? kind : null);
    setCopyFailed(!ok);
    window.setTimeout(() => setCopied(null), 1600);
  }, []);

  const url = number ? buildWhatsAppUrl(number, message) : null;

  return (
    <>
      {triggerVariant === "link" ? (
        <button
          type="button"
          onClick={openComposer}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
          title={`WhatsApp ${recipientName.trim() || "customer"}`}
        >
          <Icon name="whatsapp" size={15} /> {triggerLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={openComposer}
          className={
            triggerVariant === "primary"
              ? "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              : "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          }
        >
          <Icon name="whatsapp" size={16} /> {triggerLabel}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/50" onClick={closeComposer} />
          <Card className="relative w-full max-w-md">
            <CardHeader
              title={title}
              subtitle={subtitle}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone="green">WhatsApp</Badge>
                  <button
                    type="button"
                    onClick={closeComposer}
                    aria-label="Close"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              }
            />

            <div className="min-w-0 space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3.5 py-3 ring-1 ring-zinc-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
                  <p className="truncate text-xs text-zinc-500">{displayMobile}</p>
                </div>
                {number ? (
                  <Badge tone="green">valid</Badge>
                ) : (
                  <Badge tone="red">no number</Badge>
                )}
              </div>

              {templates.length > 1 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-600">Message template</p>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(t.key);
                          setMessage(t.message);
                        }}
                        className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition-colors ${
                          selectedKey === t.key
                            ? "bg-emerald-600 text-white"
                            : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="whatsapp-message" className="text-xs font-medium text-zinc-600">
                    Message (editable)
                  </label>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                    {message.length} chars
                  </span>
                </div>
                <textarea
                  id="whatsapp-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-2 focus:outline-emerald-600"
                />
              </div>

              <p className="w-full whitespace-normal break-words rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200 [overflow-wrap:anywhere]">
                Open WhatsApp → the chat opens with this text. Nothing is sent automatically; you press
                send inside WhatsApp. Attach any PDF/statement yourself from your phone or computer.
              </p>

              {!number && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 ring-1 ring-red-200">
                  No valid 10-digit mobile number on record. Add a number to open the WhatsApp chat; you can
                  still copy the message and paste it manually.
                </p>
              )}

              <div className="space-y-2">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={primaryButton}
                    onClick={closeComposer}
                  >
                    <Icon name="whatsapp" size={16} /> Open WhatsApp
                  </a>
                ) : (
                  <button type="button" className={`${primaryButton} cursor-not-allowed opacity-60`} disabled>
                    <Icon name="whatsapp" size={16} /> Open WhatsApp
                  </button>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => void onCopy("message", message)}
                  >
                    {copied === "message" && <Icon name="check" size={16} />}
                    {copied === "message" ? "Copied" : "Copy Message"}
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={!number}
                    onClick={() => number && void onCopy("phone", `+${number}`)}
                  >
                    {copied === "phone" && <Icon name="check" size={16} />}
                    {copied === "phone" ? "Copied" : "Copy Number"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={closeComposer}
                  className="inline-flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800"
                >
                  Cancel
                </button>

                {copyFailed && (
                  <p className="text-center text-[11px] text-red-600">
                    Could not write to clipboard. Copy manually instead.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

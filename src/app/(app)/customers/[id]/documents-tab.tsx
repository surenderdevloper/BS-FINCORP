"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { Field, Input, Select } from "@/components/form";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/money";
import {
  DOCUMENT_TYPES,
  ACCEPT_FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_DESCRIPTION_LENGTH,
  type DocumentTypeValue,
} from "@/lib/documentConstants";

interface DocumentRow {
  _id: string;
  documentType: DocumentTypeValue;
  documentTypeLabel: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  description: string;
  createdAt: string;
}

interface ChosenFile {
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
}

const typeTone: Record<DocumentTypeValue, "green" | "red" | "amber" | "blue" | "zinc"> = {
  aadhaar: "blue",
  pan: "red",
  loan_agreement: "green",
  address_proof: "zinc",
  rc_vehicle: "amber",
  other: "zinc",
};

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

export function DocumentsTab({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentTypeValue>("aadhaar");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<ChosenFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const reload = useCallback((showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    document.title = `${customerName} — Documents`;
    let cancelled = false;
    fetch(`/api/customers/${customerId}/documents`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load documents.");
        return res.json() as Promise<{ documents: DocumentRow[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setDocuments(data.documents);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load documents for this customer.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, customerName, reloadToken]);

  const openUpload = () => {
    setUploadOpen(true);
    setDocumentType("aadhaar");
    setDescription("");
    setFile(null);
    setFileError(null);
    setUploadError(null);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    const mimeType = (selected.type || "").toLowerCase();
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mimeType);
    const extensionOk = /\.(pdf|png|jpe?g|webp)$/i.test(selected.name);
    if (!allowed && !extensionOk) {
      setFileError("Only PDF, PNG, JPEG or WebP files are allowed.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFileError(`File is too large. Maximum allowed size is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
      setFile(null);
      return;
    }
    if (selected.size < 1) {
      setFileError("The selected file is empty.");
      setFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileError(null);
      setFile({ name: selected.name, size: selected.size, mimeType, dataUrl: String(reader.result ?? "") });
    };
    reader.onerror = () => {
      setFileError("Could not read this file. Try again.");
      setFile(null);
    };
    reader.readAsDataURL(selected);
  };

  const submitUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          originalFileName: file.name,
          data: file.dataUrl,
          description,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
        return;
      }
      setUploadOpen(false);
      setNotice({ kind: "ok", text: "Document uploaded." });
      reload(false);
    } catch {
      setUploadError("Network error while uploading.");
    } finally {
      setUploading(false);
    }
  };

  const viewDocument = (doc: DocumentRow) => {
    window.open(`/api/customers/${customerId}/documents/${doc._id}/file`, "_blank", "noopener,noreferrer");
  };

  const printDocument = (doc: DocumentRow) => {
    const isImage = (doc.mimeType || "").startsWith("image/");
    const url = isImage
      ? `/api/customers/${customerId}/documents/${doc._id}/print`
      : `/api/customers/${customerId}/documents/${doc._id}/file`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/documents/${deleteTarget._id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? "Delete failed.");
        return;
      }
      setDeleteTarget(null);
      setNotice({ kind: "ok", text: "Document deleted." });
      reload(false);
    } catch {
      setDeleteError("Network error while deleting.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Customer Documents</h1>
          <p className="text-sm text-zinc-500">{customerName}</p>
        </div>
        <Button onClick={openUpload}>
          <Icon name="upload" size={16} /> Upload Document
        </Button>
      </div>

      {notice && (
        <div
          className={`no-print flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name={notice.kind === "ok" ? "check" : "alert"} size={16} /> {notice.text}
          </span>
          <button className="text-zinc-400 hover:text-zinc-700" onClick={() => setNotice(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <Card>
        {loading ? (
          <p className="p-5 text-sm text-zinc-500">Loading documents…</p>
        ) : loadError ? (
          <div className="flex items-center justify-between gap-2 p-5">
            <p className="flex items-center gap-2 text-sm text-red-700">
              <Icon name="alert" size={16} /> {loadError}
            </p>
            <Button variant="secondary" size="sm" onClick={() => reload(true)}>
              Retry
            </Button>
          </div>
        ) : documents.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-zinc-500">No documents uploaded for this customer yet.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Upload Aadhaar, PAN, loan agreements, address proof or RC / vehicle documents.
            </p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-3 py-2.5 sm:px-5">Document</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded On</th>
                  <th className="px-3 py-2.5 text-right font-medium sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {documents.map((doc) => (
                  <tr key={doc._id} className="hover:bg-zinc-50/60">
                    <td className="max-w-[280px] px-3 py-3 sm:px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                          <Icon name="file" size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-900">{doc.originalFileName}</p>
                          <p className="truncate text-xs text-zinc-400">
                            {formatBytes(doc.fileSize)}
                            {doc.description ? ` • ${doc.description}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={typeTone[doc.documentType]}>{doc.documentTypeLabel}</Badge>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{doc.createdAt ? formatDate(doc.createdAt) : "—"}</td>
                    <td className="px-3 py-3 text-right sm:px-5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => viewDocument(doc)} title="View">
                          <Icon name="view" size={16} /> View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => printDocument(doc)} title="Print">
                          <Icon name="print" size={16} /> Print
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(doc)} title="Delete" className="text-red-600 hover:bg-red-50">
                          <Icon name="trash" size={16} /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {uploadOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Upload Document</h2>
                <p className="mt-0.5 text-xs text-zinc-500">PDF, PNG, JPEG or WebP up to 3 MB.</p>
              </div>
              <button className="text-zinc-400 hover:text-zinc-700" onClick={() => setUploadOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <Field label="Document Type" required>
                <Select value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentTypeValue)}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="File"
                required
                hint={file ? `${file.name} • ${formatBytes(file.size)}` : `Accepted: ${ACCEPT_FILE_EXTENSIONS}. Maximum ${MAX_FILE_BYTES / (1024 * 1024)} MB.`}
              >
                <input ref={fileRef} type="file" accept={ACCEPT_FILE_EXTENSIONS} className="hidden" onChange={onPickFile} />
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="w-full">
                  <Icon name="upload" size={14} /> {file ? "Change file" : "Choose file"}
                </Button>
              </Field>
              {fileError && (
                <p className="flex items-center gap-2 text-xs text-red-600">
                  <Icon name="alert" size={14} /> {fileError}
                </p>
              )}

              <Field label="Document Name / Description (optional)" hint={`For “Other Document” and extra context. Max ${MAX_DESCRIPTION_LENGTH} characters.`}>
                <Input
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Lease copy, signed on 12 Sep 2026…"
                />
              </Field>

              {uploadError && (
                <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <Icon name="alert" size={16} /> {uploadError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
                <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>
                  Cancel
                </Button>
                <Button onClick={() => void submitUpload()} disabled={uploading || !file}>
                  <Icon name="upload" size={16} />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-zinc-900">Delete document</h2>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-sm text-zinc-700">
                Are you sure you want to delete this document?{" "}
                <span className="font-medium text-zinc-900">{deleteTarget.originalFileName}</span> will be removed.
              </p>
              {deleteError && (
                <p className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <Icon name="alert" size={16} /> {deleteError}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
                  <Icon name="trash" size={16} />
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
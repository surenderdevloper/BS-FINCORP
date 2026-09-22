import mongoose, { type Types } from "mongoose";
import { CustomerDocument, type CustomerDocumentType } from "@/models/CustomerDocument";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  DOCUMENT_TYPES,
  documentTypeLabel,
  isDocumentType,
  type DocumentTypeValue,
} from "@/lib/documentConstants";

export {
  DOCUMENT_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  documentTypeLabel,
  isDocumentType,
  type DocumentTypeValue,
};

export interface CustomerDocumentMeta {
  _id: string;
  documentType: DocumentTypeValue;
  documentTypeLabel: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** A stored customer document record including the document id (omitted by InferSchemaType). */
export type CustomerDocumentDoc = CustomerDocumentType & { _id: Types.ObjectId };

/**
 * Strips path components and control characters from an uploaded file name.
 * Never trusted for filesystem paths — only used for display/headers.
 */
export function sanitizeFileName(raw: string): string {
  const segment = String(raw ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = segment.replace(/[\u0000-\u001f\u007f"\r\n]+/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_FILE_NAME_LENGTH) : "document";
}

export interface ParsedDataUrl {
  mimeType: string;
  decoded: Buffer;
}

/**
 * Parses a `data:<mimeType>;base64,<payload>` string. The MIME type is derived
 * from the header (server-authoritative) rather than trusting the client.
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  if (typeof dataUrl !== "string") return null;
  const comma = dataUrl.indexOf(",");
  if (comma <= 0) return null;
  const header = dataUrl.slice(0, comma);
  if (!/^data:[^;,\s]+;base64$/i.test(header)) return null;
  const mimeType = header.slice("data:".length, header.length - ";base64".length).toLowerCase();
  const decoded = Buffer.from(dataUrl.slice(comma + 1), "base64");
  if (decoded.length === 0) return null;
  return { mimeType, decoded };
}

export interface DocumentUploadInput {
  documentType: string;
  originalFileName: string;
  data: string;
  description?: string;
}

export interface DocumentUpload {
  ok: boolean;
  errors: Partial<Record<"documentType" | "file" | "fileName" | "description", string>>;
  documentType?: DocumentTypeValue;
  originalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  data?: string;
  description?: string;
}

/**
 * Server-side upload validation. The MIME type and byte size are always derived
 * from the uploaded payload — the client cannot override them.
 */
export function validateDocumentUpload(input: DocumentUploadInput): DocumentUpload {
  const errors: NonNullable<DocumentUpload["errors"]> = {};

  if (!isDocumentType(input.documentType)) {
    errors.documentType = "Choose a valid document type.";
  }

  const parsed = parseDataUrl(input.data);
  const mimeType = parsed?.mimeType ?? "";
  if (!parsed) {
    errors.file = "The selected file could not be read. Try uploading it again.";
  } else if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    errors.file = "Only PDF, PNG, JPEG or WebP files are allowed.";
  } else if (parsed.decoded.length > MAX_FILE_BYTES) {
    errors.file = `File is too large. Maximum allowed size is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`;
  }

  const originalFileName = sanitizeFileName(input.originalFileName ?? "");
  if (!originalFileName || originalFileName === "document") {
    errors.fileName = "A file name is required.";
  }

  const description = String(input.description ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH);

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    documentType: ok ? (input.documentType as DocumentTypeValue) : undefined,
    originalFileName: ok ? originalFileName : undefined,
    mimeType: ok ? mimeType : undefined,
    fileSize: ok && parsed ? parsed.decoded.length : undefined,
    data: ok ? input.data : undefined,
    description,
  };
}

export function toDocumentMeta(doc: CustomerDocumentDoc): CustomerDocumentMeta {
  return {
    _id: doc._id.toString(),
    documentType: doc.documentType as DocumentTypeValue,
    documentTypeLabel: documentTypeLabel(doc.documentType),
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    description: doc.description ?? "",
    createdAt: doc.createdAt?.toISOString() ?? "",
    updatedAt: doc.updatedAt?.toISOString() ?? "",
  };
}

export function isValidObjectId(value: unknown): boolean {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

export async function listCustomerDocuments(customerId: string): Promise<CustomerDocumentMeta[]> {
  const docs = (await CustomerDocument.find({ customerId })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as CustomerDocumentDoc[];
  return docs.map(toDocumentMeta);
}

/**
 * Fetches a document only if it belongs to the given customer. Ownership is part
 * of the query so cross-customer lookups simply return null (no existence oracle).
 */
export async function findOwnedDocument(
  customerId: string,
  documentId: string
): Promise<CustomerDocumentDoc | null> {
  if (!isValidObjectId(customerId) || !isValidObjectId(documentId)) return null;
  const doc = (await CustomerDocument.findOne({ _id: documentId, customerId })
    .lean()
    .exec()) as unknown as CustomerDocumentDoc | null;
  return doc ?? null;
}
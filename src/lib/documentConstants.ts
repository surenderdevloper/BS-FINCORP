export const DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "loan_agreement", label: "Loan Agreement" },
  { value: "address_proof", label: "Address Proof" },
  { value: "rc_vehicle", label: "RC / Vehicle Document" },
  { value: "other", label: "Other" },
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number]["value"];

export function isDocumentType(value: unknown): value is DocumentTypeValue {
  return typeof value === "string" && DOCUMENT_TYPES.some((t) => t.value === value);
}

export function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? "Other";
}

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

export const ACCEPT_FILE_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp";

// 3 MB binary → ≈ 4.2 MB base64 JSON body, safe under serverless request limits.
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 500;
export function sanitizeSearch(value: string | null | undefined): string {
  if (!value) return "";
  const s = value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return s.slice(0, 60);
}
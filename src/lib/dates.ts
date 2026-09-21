export function startOfToday(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function endOfToday(d: Date): Date {
  const t = startOfToday(d);
  t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

export function dayOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromQuery(s: string | null | undefined): Date {
  return new Date(`${s || dayOf(new Date())}T00:00:00Z`);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Strictly parses a YYYY-MM-DD calendar date into a UTC-midnight Date.
 * Rejects non-numeric, malformed, or impossible dates (e.g. 2026-02-31).
 * The returned Date has no timezone ambiguity: its UTC calendar date is exactly
 * the given calendar date on any server timezone.
 */
export function parseCalendarDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const ok = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return ok ? date : null;
}
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
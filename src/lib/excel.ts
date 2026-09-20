export async function downloadExcel(filename: string, columns: string[], rows: Record<string, string | number>[]): Promise<void> {
  const XLSX = await import("xlsx");
  const aoa: (string | number)[][] = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.length + 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
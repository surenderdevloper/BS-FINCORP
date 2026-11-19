export interface WorkbookSheet {
  name: string;
  rows: (string | number)[][];
  widths?: number[];
}

export async function downloadWorkbook(
  filename: string,
  sheets: WorkbookSheet[]
): Promise<void> {
  const writeExcelFile = (await import("write-excel-file/browser")).default;
  const blob = await writeExcelFile(
    sheets.map(({ name, rows, widths }) => ({
      data: rows,
      sheet: name,
      columns: widths?.map((width) => ({ width })),
    }))
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadExcel(filename: string, columns: string[], rows: Record<string, string | number>[]): Promise<void> {
  const data: (string | number)[][] = [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? "")),
  ];
  await downloadWorkbook(filename, [
    {
      name: "Sheet1",
      rows: data,
      widths: columns.map((column) => Math.max(column.length + 2, 12)),
    },
  ]);
}
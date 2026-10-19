"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { inr } from "@/lib/money";
import { CUSTOMERS_LIST_CACHE_KEY, invalidateCached } from "@/lib/client-fetch";
import {
  downloadLoanTemplate,
  parseLoanImportSheet,
  type LoanImportRecord,
} from "@/lib/loan-import";
import type { LoanTypeOption } from "@/components/loan-form";

interface ImportOutcome {
  row: number;
  customer: string;
  ok: boolean;
  loanNo?: string;
  message?: string;
}

type Step = "idle" | "preview" | "importing" | "done";

export function LoanExcelImport({ loanTypes }: { loanTypes?: LoanTypeOption[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState<LoanImportRecord[]>([]);
  const [parseError, setParseError] = useState("");
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);

  const valid = records.filter((record) => record.errors.length === 0);
  const failed = records.length - valid.length;
  const imported = outcomes.filter((outcome) => outcome.ok).length;
  const rejected = outcomes.filter((outcome) => !outcome.ok).length;

  function closeModal() {
    setOpen(false);
    setStep("idle");
    setFileName("");
    setRecords([]);
    setParseError("");
    setOutcomes([]);
    setTotal(0);
    setDone(0);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setParseError("");
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Missing sheet");
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
      const parsed = parseLoanImportSheet(aoa, loanTypes);
      if (parsed.headerError) {
        setRecords([]);
        setStep("idle");
        setParseError(parsed.headerError);
        return;
      }
      setRecords(parsed.records);
      setStep("preview");
    } catch {
      setRecords([]);
      setStep("idle");
      setParseError("Could not read this file. Please choose a valid .xlsx, .xls or .csv file.");
    }
  }

  async function startImport() {
    if (!valid.length || step === "importing") return;
    setStep("importing");
    setTotal(valid.length);
    setDone(0);
    setOutcomes([]);

    const collected: ImportOutcome[] = [];
    for (const record of valid) {
      let outcome: ImportOutcome;
      const customer = record.payload.customer?.name ?? "";
      try {
        const res = await fetch("/api/loans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record.payload),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          loan?: { loanNo: string };
        } | null;
        if (res.ok && data?.loan?.loanNo) {
          outcome = { row: record.row, customer, ok: true, loanNo: data.loan.loanNo };
        } else {
          outcome = {
            row: record.row,
            customer,
            ok: false,
            message: data?.error || `Row ${record.row}: could not create the loan.`,
          };
        }
      } catch {
        outcome = { row: record.row, customer, ok: false, message: "Could not reach the server." };
      }
      collected.push(outcome);
      setOutcomes([...collected]);
      setDone(collected.length);
    }

    invalidateCached(CUSTOMERS_LIST_CACHE_KEY);
    router.refresh();
    setStep("done");
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Icon name="upload" size={16} />
        Import Excel
      </Button>

      {open && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900">Import loans from Excel</h2>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {fileName || "Upload an .xlsx, .xls or .csv file"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={step === "importing"}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {step === "idle" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
                    <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-zinc-200">
                      <Icon name="file" size={22} />
                    </span>
                    <p className="mx-auto max-w-md text-sm text-zinc-600">
                      Select a sheet where the first row is the header. Each row below it becomes a
                      new loan with an auto-generated loan number and EMI schedule.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button size="sm" onClick={() => fileInput.current?.click()}>
                        <Icon name="upload" size={15} />
                        Choose file
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void downloadLoanTemplate()}>
                        <Icon name="download" size={15} />
                        Download template
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    Customers are matched by mobile number. Importing the same file twice will
                    create duplicate loans, so only import new rows.
                  </div>

                  {parseError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}
                </div>
              )}

              {step === "preview" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                      {records.length} row{records.length === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                      {valid.length} ready
                    </span>
                    {failed > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
                        {failed} with errors
                      </span>
                    )}
                  </div>

                  <div className="max-h-[46vh] overflow-auto rounded-lg border border-zinc-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Row</th>
                          <th className="px-3 py-2 font-medium">Customer</th>
                          <th className="px-3 py-2 font-medium">Mobile</th>
                          <th className="px-3 py-2 font-medium">Vehicle</th>
                          <th className="px-3 py-2 text-right font-medium">Price</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {records.map((record) => (
                          <tr key={record.row} className={record.errors.length ? "bg-red-50/50" : ""}>
                            <td className="px-3 py-2 font-mono text-zinc-500">{record.row}</td>
                            <td className="px-3 py-2 font-medium text-zinc-900">
                              {record.payload.customer?.name || "—"}
                            </td>
                            <td className="px-3 py-2 text-zinc-600">{record.payload.customer?.mobile || "—"}</td>
                            <td className="px-3 py-2 text-zinc-600">{record.payload.vehicle.name || "—"}</td>
                            <td className="px-3 py-2 text-right text-zinc-700">
                              {Number.isFinite(record.payload.financial.vehiclePrice)
                                ? inr(record.payload.financial.vehiclePrice)
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {record.errors.length ? (
                                <span className="text-red-600" title={record.errors.join("\n")}>
                                  {record.errors[0]}
                                  {record.errors.length > 1 ? ` (+${record.errors.length - 1} more)` : ""}
                                </span>
                              ) : (
                                <span className="font-medium text-emerald-600">Ready</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {failed > 0 && (
                    <p className="text-xs text-zinc-500">
                      Rows with errors are skipped during import. Hover a status to see every issue.
                    </p>
                  )}
                </div>
              )}

              {step === "importing" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700">Importing loans…</span>
                    <span className="font-mono text-zinc-500">
                      {done} / {total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
                    />
                  </div>
                  <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto">
                    {outcomes.map((outcome) => (
                      <li
                        key={outcome.row}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
                          outcome.ok ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-zinc-900">
                            Row {outcome.row} · {outcome.customer}
                          </span>
                          {!outcome.ok && (
                            <span className="block truncate text-red-600">{outcome.message}</span>
                          )}
                        </span>
                        <span className={`shrink-0 font-mono font-semibold ${outcome.ok ? "text-emerald-700" : "text-red-600"}`}>
                          {outcome.ok ? outcome.loanNo : "Failed"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step === "done" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Icon name="check" size={18} />
                    </span>
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-800">
                        Imported {imported} of {total} loan{total === 1 ? "" : "s"}
                      </p>
                      <p className="text-emerald-700">
                        {rejected > 0
                          ? `${rejected} row${rejected === 1 ? "" : "s"} could not be created. Details below.`
                          : "Loan numbers and EMI schedules were created automatically."}
                      </p>
                    </div>
                  </div>

                  <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-zinc-200">
                    <ul className="divide-y divide-zinc-100 text-xs">
                      {outcomes.map((outcome) => (
                        <li key={outcome.row} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0">
                            <span className="font-medium text-zinc-900">
                              Row {outcome.row} · {outcome.customer}
                            </span>
                            {!outcome.ok && (
                              <span className="block truncate text-red-600">{outcome.message}</span>
                            )}
                          </span>
                          <span
                            className={`shrink-0 font-mono font-semibold ${
                              outcome.ok ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {outcome.ok ? outcome.loanNo : "Failed"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
              <div className="min-w-0 truncate text-xs text-zinc-400">
                {step === "preview" && failed > 0 ? `${failed} row${failed === 1 ? "" : "s"} will be skipped` : ""}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {step === "idle" && (
                  <>
                    <Button variant="ghost" size="sm" onClick={closeModal}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => fileInput.current?.click()}>
                      <Icon name="upload" size={15} />
                      Choose file
                    </Button>
                  </>
                )}
                {step === "preview" && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                      Choose another
                    </Button>
                    <Button size="sm" onClick={() => void startImport()} disabled={!valid.length}>
                      Import {valid.length} loan{valid.length === 1 ? "" : "s"}
                    </Button>
                  </>
                )}
                {step === "importing" && (
                  <Button size="sm" disabled>
                    Importing…
                  </Button>
                )}
                {step === "done" && (
                  <>
                    <Button variant="secondary" size="sm" onClick={closeModal}>
                      Close
                    </Button>
                    <Button size="sm" onClick={() => { closeModal(); setOpen(true); }}>
                      Import another file
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

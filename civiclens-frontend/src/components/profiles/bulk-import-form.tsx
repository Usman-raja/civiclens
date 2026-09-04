"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, type BulkImportSummary, type ImportColumnMapping, type ImportInspect } from "@/lib/api";
import { Users, X, CheckCircle2, AlertTriangle, XCircle, Database, Table2 } from "lucide-react";

type Step = "select" | "map" | "summary";

const MAPPABLE_FIELDS: { key: keyof ImportColumnMapping; label: string; required?: boolean }[] = [
  { key: "name", label: "Full name", required: true },
  { key: "image", label: "Photo filename (must match a file in the ZIP)", required: true },
  { key: "external_id", label: "CNIC / ID number" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "notes", label: "Notes" },
];

export function BulkImportForm() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [inspect, setInspect] = useState<ImportInspect | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [source, setSource] = useState("");
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const mappingInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setStep("select");
    setZipFile(null);
    setMappingFile(null);
    setInspect(null);
    setMapping({});
    setSource("");
    setSummary(null);
    setError(null);
    if (zipInputRef.current) zipInputRef.current.value = "";
    if (mappingInputRef.current) mappingInputRef.current.value = "";
  };

  const handleMappingFile = async (file: File | null) => {
    setMappingFile(file);
    setInspect(null);
    setMapping({});
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.participants.inspectImportFile(file);
      setInspect(result);
      setMapping(result.suggested_mapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the data file.");
      setMappingFile(null);
      if (mappingInputRef.current) mappingInputRef.current.value = "";
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!zipFile) {
      setError("A ZIP of face photos is required.");
      return;
    }
    if (mappingFile && (!mapping.name || !mapping.image)) {
      setError("Map which columns hold the name and photo filename first.");
      setStep("map");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.participants.bulkImport(
        zipFile, mappingFile, true, mappingFile ? mapping : undefined, source.trim() || undefined
      );
      setSummary(result);
      setStep("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!zipFile) return;
    setBusy(true);
    setError(null);
    try {
      await api.participants.bulkImport(
        zipFile, mappingFile, false, mappingFile ? mapping : undefined, source.trim() || undefined
      );
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Users className="size-4" /> Bulk import
      </Button>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Bulk import — citizens from external data
        </span>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-ink-faint hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      {step === "select" && (
        <>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-dim">
                ZIP of face photos — filenames become names unless a data file maps them
              </label>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink-dim outline-none file:mr-2 file:rounded file:border-0 file:bg-panel-raised file:px-2 file:py-1 file:text-ink"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-ink-dim">
                <Database className="size-3.5 text-signal-cyan" />
                External data file — CSV / XLSX (NADRA export, HR sheet, …) — optional
              </label>
              <input
                ref={mappingInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleMappingFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink-dim outline-none file:mr-2 file:rounded file:border-0 file:bg-panel-raised file:px-2 file:py-1 file:text-ink"
              />
              {mappingFile && inspect && (
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {inspect.filename}: {inspect.row_count} rows · {inspect.columns.length} columns detected
                  {source.trim() ? ` · source: ${source.trim()}` : ""}
                </p>
              )}
            </div>

            <div className="max-w-sm">
              <label className="mb-1 block text-xs text-ink-dim">Source label (optional) — e.g. &ldquo;NADRA export&rdquo;</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="NADRA export, Excel sheet, HR database…"
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
              />
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}

          <div className="mt-3 flex justify-end gap-2 border-t border-hairline pt-3">
            {mappingFile && inspect && (
              <Button variant="outline" disabled={busy} onClick={() => setStep("map")}>
                <Table2 className="size-3.5" /> Map columns
              </Button>
            )}
            <Button disabled={busy} onClick={handlePreview}>
              {busy ? "Analyzing…" : "Preview import"}
            </Button>
          </div>
        </>
      )}

      {step === "map" && inspect && (
        <>
          <p className="mb-3 text-xs text-ink-dim">
            Pick which column of <span className="font-mono text-ink">{inspect.filename}</span> holds each piece of
            data. Name and photo filename are required; the rest are stored on the citizen record.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MAPPABLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-ink-dim">
                  {f.label}
                  {f.required && <span className="text-signal-red"> *</span>}
                </label>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value || undefined }))}
                  className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
                >
                  <option value="">— none —</option>
                  {inspect.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {inspect.preview_rows.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-hairline bg-panel-raised/50">
                    {Object.entries(mapping)
                      .filter(([, col]) => col)
                      .map(([field, col]) => (
                        <th key={field} className="px-2 py-1.5 font-medium text-ink-dim">
                          {field} <span className="text-ink-faint">← {col}</span>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {inspect.preview_rows.map((row, i) => (
                    <tr key={i} className="border-b border-hairline/50 last:border-0">
                      {Object.entries(mapping)
                        .filter(([, col]) => col)
                        .map(([field, col]) => (
                          <td key={field} className="max-w-40 truncate px-2 py-1.5 text-ink">
                            {row[col] || <span className="text-ink-faint">—</span>}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}

          <div className="mt-3 flex justify-end gap-2 border-t border-hairline pt-3">
            <Button variant="ghost" onClick={() => setStep("select")}>
              Back
            </Button>
            <Button disabled={!mapping.name || !mapping.image} onClick={() => setStep("select")}>
              <CheckCircle2 className="size-3.5" /> Use this mapping
            </Button>
          </div>
        </>
      )}

      {step === "summary" && summary && (
        <div className="space-y-3">
          <SummaryRow
            icon={CheckCircle2}
            tone="text-signal-green"
            label={`Will be registered${summary.source ? ` from ${summary.source}` : ""}`}
            items={summary.registered.map((r) =>
              r.external_id ? `${r.name} (${r.image}) · ${r.external_id}` : `${r.name} (${r.image})`
            )}
          />
          <SummaryRow
            icon={AlertTriangle}
            tone="text-signal-amber"
            label="Duplicates skipped"
            items={summary.duplicates_skipped.map(
              (d) => `${d.name} (${d.image}) — matches ${d.matched_person_id}, ${(d.similarity * 100).toFixed(0)}%`
            )}
          />
          <SummaryRow
            icon={XCircle}
            tone="text-signal-red"
            label="No face detected"
            items={summary.no_face.map((d) => `${d.name} (${d.image})`)}
          />
          <SummaryRow
            icon={XCircle}
            tone="text-signal-red"
            label="Multiple faces detected"
            items={summary.multiple_faces.map((d) => `${d.name} (${d.image}) — ${d.faces_detected} faces`)}
          />
          <SummaryRow
            icon={AlertTriangle}
            tone="text-signal-amber"
            label="Low quality images"
            items={summary.low_quality.map((d) => `${d.name} (${d.image}) — ${d.reason}`)}
          />
          <SummaryRow
            icon={XCircle}
            tone="text-signal-red"
            label="Errors"
            items={summary.errors.map((d) => `${d.name} (${d.image}) — ${d.error}`)}
          />
          <SummaryRow
            icon={AlertTriangle}
            tone="text-signal-amber"
            label="Unmatched mapping rows (image not found in ZIP)"
            items={summary.unmatched_mapping_rows.map((d) => `${d.name} → ${d.image}`)}
          />

          {error && <p className="text-xs text-signal-red">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-hairline pt-3">
            <Button variant="ghost" onClick={() => setStep("select")}>
              Back
            </Button>
            <Button disabled={busy || summary.registered.length === 0} onClick={handleConfirm}>
              {busy ? "Importing…" : `Confirm — register ${summary.registered.length}`}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function SummaryRow({
  icon: Icon,
  tone,
  label,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-sm font-medium ${tone}`}>
        <Icon className="size-3.5" /> {label} ({items.length})
      </div>
      <ul className="mt-1 space-y-0.5 pl-5 font-mono text-xs text-ink-dim">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

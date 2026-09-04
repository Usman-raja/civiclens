"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, type CameraImportResult } from "@/lib/api";
import { Upload, X, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function ImportCamerasButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CameraImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handlePreview = async () => {
    if (!file) {
      setError("Pick a CSV or XLSX camera list first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await api.cameras.importCameras(file, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.cameras.importCameras(file, false);
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
        <Upload className="size-4" /> Import camera list
      </Button>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Import cameras — control-room list (CSV / XLSX)
        </span>
        <button onClick={() => { reset(); setOpen(false); }} className="text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>

      <label className="mb-1 block text-xs text-ink-dim">
        One row per camera — columns: <span className="font-mono text-ink">camera_name</span>,{" "}
        <span className="font-mono text-ink">rtsp_url</span>, optional{" "}
        <span className="font-mono text-ink">purpose</span> /{" "}
        <span className="font-mono text-ink">capture_interval</span>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
        className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink-dim outline-none file:mr-2 file:rounded file:border-0 file:bg-panel-raised file:px-2 file:py-1 file:text-ink"
      />

      {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[11px] text-ink-faint">
            {result.filename} · {result.row_count} rows · detected:{" "}
            {Object.entries(result.detected_columns).map(([f, c]) => `${f}←${c}`).join(", ")}
          </p>

          {result.cameras.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-hairline bg-panel-raised/50 text-ink-dim">
                    <th className="px-2 py-1.5">Camera</th>
                    <th className="px-2 py-1.5">RTSP URL</th>
                    <th className="px-2 py-1.5">Purpose</th>
                    <th className="px-2 py-1.5">Interval</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cameras.map((c) => (
                    <tr key={c.camera_name} className="border-b border-hairline/50 last:border-0">
                      <td className="px-2 py-1.5 text-ink">{c.camera_name}</td>
                      <td className="max-w-72 truncate px-2 py-1.5 text-ink-dim">{c.rtsp_url}</td>
                      <td className="px-2 py-1.5 text-ink-dim">{c.purpose}</td>
                      <td className="px-2 py-1.5 text-ink-dim">{c.capture_interval}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.already_exists.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-signal-amber">
              <AlertTriangle className="size-3.5" /> {result.already_exists.length} already registered (skipped):{" "}
              {result.already_exists.map((a) => a.camera).join(", ")}
            </p>
          )}
          {result.errors.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-signal-red">
              <XCircle className="size-3.5" /> {result.errors.length} bad rows:{" "}
              {result.errors.map((e) => `#${e.row}${e.camera ? ` (${e.camera})` : ""} — ${e.error}`).join("; ")}
            </p>
          )}
          {result.cameras.length === 0 && result.errors.length === 0 && (
            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
              <CheckCircle2 className="size-3.5" /> Nothing new to import — every row already exists.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2 border-t border-hairline pt-3">
        <Button disabled={busy} onClick={handlePreview}>
          {busy ? "Reading…" : "Preview"}
        </Button>
        <Button disabled={busy || !result || result.cameras.length === 0} onClick={handleConfirm}>
          {busy ? "Importing…" : `Confirm — add ${result?.cameras.length ?? 0} cameras & start monitoring`}
        </Button>
      </div>
    </Panel>
  );
}

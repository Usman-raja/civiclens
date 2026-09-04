"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, RedListDuplicateError } from "@/lib/api";
import { ShieldPlus, X } from "lucide-react";

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

interface DuplicateState {
  existingRedlistId: string;
  existingName: string;
  similarity: number;
}

export function AddRedListForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [riskLevel, setRiskLevel] = useState("Medium");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setName("");
    setRiskLevel("Medium");
    setCategory("");
    setNotes("");
    setFile(null);
    setError(null);
    setDuplicate(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (force: boolean) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.redlist.create({ name: name.trim(), riskLevel, category: category.trim(), notes, faceImage: file, force });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof RedListDuplicateError) {
        setDuplicate({
          existingRedlistId: err.existingRedlistId,
          existingName: err.existingName,
          similarity: err.similarity,
        });
      } else {
        setError(err instanceof Error ? err.message : "Failed to create Red List entry.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category.trim() || !file) {
      setError("Name, category, and a face photo are all required.");
      return;
    }
    submit(false);
  };

  const handleMerge = async () => {
    if (!file || !duplicate) return;
    setBusy(true);
    try {
      await api.redlist.mergeImage(duplicate.existingRedlistId, file);
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Merge failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleForceCreate = () => submit(true);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <ShieldPlus className="size-4" /> Add Red List person
      </Button>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-dim">
          New Red List entry
        </span>
        <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>

      {duplicate ? (
        <div className="space-y-3 rounded-md border border-signal-amber/40 bg-signal-amber/5 p-3">
          <p className="text-sm text-ink">
            A similar profile already exists: <strong>{duplicate.existingName}</strong> (
            <span className="font-mono">{duplicate.existingRedlistId}</span>) — similarity{" "}
            {(duplicate.similarity * 100).toFixed(1)}%.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleMerge} disabled={busy}>
              Merge photo into {duplicate.existingRedlistId}
            </Button>
            <Button size="sm" variant="outline" onClick={handleForceCreate} disabled={busy}>
              Create as new profile anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDuplicate(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-ink-faint">
            To edit the existing profile&rsquo;s name/risk/notes instead, cancel here and use its detail page.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-ink-dim">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-ink-dim">Risk level</label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-ink-dim">Category / reason</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. repeat trespassing"
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-ink-dim">Face photo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink-dim outline-none file:mr-2 file:rounded file:border-0 file:bg-panel-raised file:px-2 file:py-1 file:text-ink"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-ink-dim">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context"
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Add to Red List"}
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}
    </Panel>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, MissingPersonDuplicateError } from "@/lib/api";
import { UserSearch, X } from "lucide-react";

interface DuplicateState {
  existingMissingId: string;
  existingName: string;
  similarity: number;
}

export function AddMissingPersonForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setName("");
    setAge("");
    setDescription("");
    setContactInfo("");
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
      await api.missingPersons.create({
        name: name.trim(),
        age: age.trim() || undefined,
        description,
        contactInfo,
        faceImage: file,
        force,
      });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof MissingPersonDuplicateError) {
        setDuplicate({
          existingMissingId: err.existingMissingId,
          existingName: err.existingName,
          similarity: err.similarity,
        });
      } else {
        setError(err instanceof Error ? err.message : "Failed to create missing person record.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !file) {
      setError("Name and a face photo are required.");
      return;
    }
    submit(false);
  };

  const handleMerge = async () => {
    if (!file || !duplicate) return;
    setBusy(true);
    try {
      await api.missingPersons.mergeImage(duplicate.existingMissingId, file);
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
        <UserSearch className="size-4" /> Report missing person
      </Button>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-dim">
          New missing person record
        </span>
        <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>

      {duplicate ? (
        <div className="space-y-3 rounded-md border border-signal-amber/40 bg-signal-amber/5 p-3">
          <p className="text-sm text-ink">
            A similar record already exists: <strong>{duplicate.existingName}</strong> (
            <span className="font-mono">{duplicate.existingMissingId}</span>) — similarity{" "}
            {(duplicate.similarity * 100).toFixed(1)}%.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleMerge} disabled={busy}>
              Merge photo into {duplicate.existingMissingId}
            </Button>
            <Button size="sm" variant="outline" onClick={handleForceCreate} disabled={busy}>
              Create as new record anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDuplicate(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
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
          <div className="min-w-[80px]">
            <label className="mb-1 block text-xs text-ink-dim">Age</label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 8"
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-ink-dim">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. red shirt, blue shorts, last seen near..."
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-ink-dim">Contact info</label>
            <input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Who to notify if found"
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
          <Button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Report missing"}
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}
    </Panel>
  );
}

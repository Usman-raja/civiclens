"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { UserPlus, X } from "lucide-react";

export function RegisterParticipantForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setName("");
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !file) {
      setError("Name and a face photo are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.participants.register(name.trim(), file);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Register citizen
      </Button>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-dim">
          New citizen
        </span>
        <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs text-ink-dim">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-ink-dim">Face photo (one clear face)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink-dim outline-none file:mr-2 file:rounded file:border-0 file:bg-panel-raised file:px-2 file:py-1 file:text-ink"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Registering…" : "Register"}
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}
    </Panel>
  );
}

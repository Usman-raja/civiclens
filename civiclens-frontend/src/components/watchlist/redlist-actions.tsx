"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, type RedListDetail } from "@/lib/api";
import { Trash2, Pencil, Power } from "lucide-react";

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

export function RedListActions({ person }: { person: RedListDetail }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [riskLevel, setRiskLevel] = useState<string>(person.risk_level);
  const [category, setCategory] = useState(person.category);
  const [notes, setNotes] = useState(person.notes);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const saveEdits = async () => {
    setBusy(true);
    try {
      await api.redlist.update(person.redlist_id, { name, risk_level: riskLevel, category, notes });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      if (person.active) {
        await api.redlist.deactivate(person.redlist_id);
      } else {
        await api.redlist.activate(person.redlist_id);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.redlist.remove(person.redlist_id);
      router.push("/watchlist");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-hairline-bright bg-panel-raised p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-hairline-bright bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-signal-cyan"
        />
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="rounded-md border border-hairline-bright bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-signal-cyan"
        >
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="category"
          className="rounded-md border border-hairline-bright bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-signal-cyan"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="notes"
          className="min-w-[160px] flex-1 rounded-md border border-hairline-bright bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-signal-cyan"
        />
        <Button size="sm" disabled={busy} onClick={saveEdits}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" /> Edit
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={toggleActive}>
        <Power className="size-3.5" /> {person.active ? "Deactivate" : "Activate"}
      </Button>
      {confirmingDelete ? (
        <>
          <span className="text-xs text-ink-dim">Delete permanently?</span>
          <Button size="sm" variant="destructive" disabled={busy} onClick={handleDelete}>
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(true)}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
      )}
    </div>
  );
}

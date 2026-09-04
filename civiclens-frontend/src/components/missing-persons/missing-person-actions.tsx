"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, type MissingPersonDetail } from "@/lib/api";
import { Trash2, Pencil, CheckCircle2, RotateCcw } from "lucide-react";

export function MissingPersonActions({ person }: { person: MissingPersonDetail }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [age, setAge] = useState(person.age !== null ? String(person.age) : "");
  const [description, setDescription] = useState(person.description ?? "");
  const [contactInfo, setContactInfo] = useState(person.contact_info ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const saveEdits = async () => {
    setBusy(true);
    try {
      await api.missingPersons.update(person.missing_id, { name, age, description, contact_info: contactInfo });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleFound = async () => {
    setBusy(true);
    try {
      if (person.active) {
        await api.missingPersons.markFound(person.missing_id);
      } else {
        await api.missingPersons.reopen(person.missing_id);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.missingPersons.remove(person.missing_id);
      router.push("/missing-persons");
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
        <input
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="age"
          className="w-20 rounded-md border border-hairline-bright bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-signal-cyan"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="description"
          className="min-w-[160px] flex-1 rounded-md border border-hairline-bright bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-signal-cyan"
        />
        <input
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          placeholder="contact info"
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
      <Button size="sm" variant="outline" disabled={busy} onClick={toggleFound}>
        {person.active ? (
          <>
            <CheckCircle2 className="size-3.5" /> Mark as found
          </>
        ) : (
          <>
            <RotateCcw className="size-3.5" /> Reopen case
          </>
        )}
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

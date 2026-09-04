"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Trash2 } from "lucide-react";

export function DeleteParticipantButton({ personId }: { personId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.participants.remove(personId);
      router.push("/profiles");
    } finally {
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-dim">Remove this profile permanently?</span>
      <Button variant="destructive" size="sm" disabled={busy} onClick={handleDelete}>
        {busy ? "Removing…" : "Confirm"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}

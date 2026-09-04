"use client";

import { useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

export function ChangePassword() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.auth.changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Change password</PanelTitle>
        <span className="font-mono text-xs text-ink-faint">
          signed in as {user?.username ?? "—"}
        </span>
      </PanelHeader>
      <form onSubmit={submit} className="max-w-md space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-dim">New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
          />
        </div>

        {error && <p className="text-xs text-signal-red">{error}</p>}
        {done && (
          <p className="flex items-center gap-1.5 text-xs text-signal-green">
            <CheckCircle2 className="size-3.5" /> Password updated — use it next time you sign in.
          </p>
        )}

        <Button type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Update password
        </Button>
      </form>
    </Panel>
  );
}

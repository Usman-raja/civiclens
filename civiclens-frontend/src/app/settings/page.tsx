"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type EventType } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ThresholdSettings } from "@/components/settings/threshold-settings";
import { UserManagement } from "@/components/settings/user-management";
import { ChangePassword } from "@/components/settings/change-password";
import { Settings as SettingsIcon, Plus, Pencil, Trash2, X, Save } from "lucide-react";

const emptyForm = { event_type_id: "", display_name: "", category: "negative" as "positive" | "negative", score_delta: -1, description: "" };

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [types, setTypes] = useState<EventType[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // event_type_id being edited, or "new"
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.eventTypes
      .list()
      .then((data) => {
        setTypes(data);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
  };

  useEffect(load, []);

  const startNew = () => {
    setForm(emptyForm);
    setEditing("new");
    setError(null);
  };

  const startEdit = (t: EventType) => {
    setForm({ ...t });
    setEditing(t.event_type_id);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
  };

  const save = async () => {
    if (!form.event_type_id.trim() || !form.display_name.trim()) {
      setError("An ID and a display name are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") {
        await api.eventTypes.create(form);
      } else {
        await api.eventTypes.update(form.event_type_id, form);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event type.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await api.eventTypes.remove(id);
    load();
  };

  return (
    <div className="mx-auto max-w-[1400px] animate-rise space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Civic event types — the behaviors the system scores, and how much each one moves a person&rsquo;s score.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={startNew}>
            <Plus className="size-4" /> New event type
          </Button>
        )}
      </div>

      {unreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      )}

      {editing && (
        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-dim">
              {editing === "new" ? "New event type" : `Editing ${editing}`}
            </span>
            <button onClick={cancelEdit} className="text-ink-faint hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <label className="mb-1 block text-xs text-ink-dim">Event type ID</label>
              <input
                value={form.event_type_id}
                disabled={editing !== "new"}
                onChange={(e) => setForm((f) => ({ ...f, event_type_id: e.target.value }))}
                placeholder="e.g. loud_music"
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan disabled:opacity-60"
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-ink-dim">Display name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. Loud Music After Hours"
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
              />
            </div>
            <div className="min-w-[120px]">
              <label className="mb-1 block text-xs text-ink-dim">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as "positive" | "negative" }))}
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
              >
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="mb-1 block text-xs text-ink-dim">Score delta</label>
              <input
                type="number"
                value={form.score_delta}
                onChange={(e) => setForm((f) => ({ ...f, score_delta: parseInt(e.target.value, 10) || 0 }))}
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-ink-dim">Description (optional)</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
              />
            </div>
            <Button disabled={busy} onClick={save}>
              <Save className="size-4" /> Save
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Event types</PanelTitle>
        </PanelHeader>
        <div className="divide-y divide-hairline">
          {types.length === 0 && !unreachable && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <SettingsIcon className="size-8 text-ink-faint" />
              <p className="text-sm text-ink-faint">No event types defined yet.</p>
            </div>
          )}
          {types.map((t) => (
            <div key={t.event_type_id} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{t.display_name}</span>
                  <span className="font-mono text-xs text-ink-faint">{t.event_type_id}</span>
                  <Badge tone={t.category === "positive" ? "green" : "red"}>
                    {t.category === "positive" ? "+" : ""}
                    {t.score_delta}
                  </Badge>
                </div>
                {t.description && <div className="mt-1 text-xs text-ink-dim">{t.description}</div>}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(t.event_type_id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <span className="font-mono text-[10px] text-ink-faint">view only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <ThresholdSettings />

      <ChangePassword />

      {isAdmin && <UserManagement />}
    </div>
  );
}

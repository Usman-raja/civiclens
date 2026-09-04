"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Users, Plus, X, UserX } from "lucide-react";

interface UserRow {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
  active: boolean;
  last_login: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operator");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.auth.listUsers().then(setUsers).catch(() => setError("Could not load users."));
  };

  useEffect(load, []);

  const createUser = async () => {
    if (!username.trim() || password.length < 8) {
      setError("Username required and password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.auth.createUser(username.trim(), password, fullName, role);
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("operator");
      setAdding(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+\s\w+:\s*/, "") : "Failed to create user.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: number) => {
    try {
      await api.auth.deactivateUser(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+\s\w+:\s*/, "") : "Failed.");
    }
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <span className="flex items-center gap-2">
            <Users className="size-4" /> User accounts
          </span>
        </PanelTitle>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> New user
          </Button>
        )}
      </PanelHeader>

      {adding && (
        <div className="border-b border-hairline p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-dim">New account</span>
            <button onClick={() => setAdding(false)} className="text-ink-faint hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="full name"
              className="rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password (8+ chars)"
              className="rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-hairline-bright bg-panel-raised px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
            <Button size="sm" disabled={busy} onClick={createUser}>
              Create
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}
        </div>
      )}

      <div className="divide-y divide-hairline">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{u.full_name || u.username}</span>
                <span className="font-mono text-xs text-ink-faint">{u.username}</span>
                <Badge tone={u.role === "admin" ? "cyan" : "neutral"}>{u.role}</Badge>
                {!u.active && <Badge tone="red">deactivated</Badge>}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
                {u.last_login ? `last login ${new Date(u.last_login).toLocaleString()}` : "never logged in"}
              </div>
            </div>
            {u.active && (
              <Button size="sm" variant="outline" onClick={() => deactivate(u.id)}>
                <UserX className="size-3.5" /> Deactivate
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

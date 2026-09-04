"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

interface SettingItem {
  key: string;
  value: number;
  default: number;
  min: number;
  max: number;
  type: string;
  label: string;
  help: string;
}

export function ThresholdSettings() {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.settings.list().then(setSettings).catch(() => setError("Could not load settings."));
  };

  useEffect(load, []);

  const update = async (key: string, value: number) => {
    setSavingKey(key);
    setError(null);
    // optimistic
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
    try {
      await api.settings.update(key, value);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+\s\w+:\s*/, "") : "Update failed.");
      load(); // revert to server truth
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" /> Detection thresholds
          </span>
        </PanelTitle>
      </PanelHeader>
      <div className="p-4">
        <p className="mb-4 text-xs text-ink-dim">
          These tune how detection behaves. {isAdmin ? "Changes take effect immediately." : "Only administrators can change these."}
        </p>
        {error && <p className="mb-3 text-xs text-signal-red">{error}</p>}
        <div className="space-y-4">
          {settings.map((s) => {
            const step = s.type === "int" ? 1 : 0.01;
            return (
              <div key={s.key} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-signal-cyan">
                      {s.type === "int" ? s.value : s.value.toFixed(2)}
                    </span>
                    {isAdmin && s.value !== s.default && (
                      <button
                        onClick={() => update(s.key, s.default)}
                        title={`Reset to default (${s.default})`}
                        className="text-ink-faint hover:text-ink"
                      >
                        <RotateCcw className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mb-2 text-[11px] text-ink-faint">{s.help}</p>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={step}
                  value={s.value}
                  disabled={!isAdmin || savingKey === s.key}
                  onChange={(e) => update(s.key, parseFloat(e.target.value))}
                  className="w-full accent-signal-cyan disabled:opacity-50"
                />
                <div className="flex justify-between font-mono text-[10px] text-ink-faint">
                  <span>{s.min}</span>
                  <span>{s.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

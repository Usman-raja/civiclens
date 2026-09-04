"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, type IncidentLogEntry } from "@/lib/api";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const [rows, setRows] = useState<IncidentLogEntry[]>([]);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    api.reports
      .incidentLog(200)
      .then((data) => {
        setRows(data);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
  }, []);

  const exportCsv = () => {
    const header = "occurred_at,person_id,name,event_type_id,camera_name,score_delta,score_after";
    const lines = rows.map((r) =>
      [r.occurred_at, r.person_id, `"${r.name.replace(/"/g, '""')}"`, r.event_type_id, r.camera_name, r.score_delta, r.score_after].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civiclens-incident-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1600px] animate-rise space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Reports</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Incident log — every negative civic event across all citizens. Watchlist and Missing Person alerts
            have their own feed on the Alerts page.
          </p>
        </div>
        <Button onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {unreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Incident log ({rows.length})</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2">Time</th>
                <th className="px-2 py-2">Person</th>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2">Camera</th>
                <th className="px-4 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && !unreachable && (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-ink-faint">
                      <FileText className="size-6" />
                      No negative civic events recorded yet.
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.event_id}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-faint">{new Date(r.occurred_at).toLocaleString()}</td>
                  <td className="px-2 py-2 text-ink">{r.name}</td>
                  <td className="px-2 py-2 text-ink-dim">{r.event_type_id}</td>
                  <td className="px-2 py-2 font-mono text-xs text-ink-faint">{r.camera_name}</td>
                  <td className="px-4 py-2 text-right font-mono text-signal-red">
                    {r.score_delta} → {r.score_after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

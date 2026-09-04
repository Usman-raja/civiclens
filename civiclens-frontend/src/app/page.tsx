import { api, imageUrl } from "@/lib/api";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ScoreDot } from "@/components/ui/score-dot";
import { Badge, riskTone } from "@/components/ui/badge";
import { RadarWidget } from "@/components/ui/radar-widget";
import { Users, ShieldAlert, TrendingDown, Radio } from "lucide-react";

async function safeLoad<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function OverviewPage() {
  const [participants, alerts, events, sceneEvents] = await Promise.all([
    safeLoad(api.participants.list(), []),
    safeLoad(api.alerts.list(5), []),
    safeLoad(api.dashboard.recentEvents(8), []),
    safeLoad(api.sceneEvents.list(5), []),
  ]);

  const backendUnreachable =
    participants.length === 0 && alerts.length === 0 && events.length === 0 && sceneEvents.length === 0;

  const scoreCounts = participants.reduce(
    (acc, p) => {
      acc[p.score_color] += 1;
      return acc;
    },
    { green: 0, gray: 0, red: 0 }
  );

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Overview</h1>
        <p className="mt-1 text-sm text-ink-dim">Live status across every registered citizen and camera.</p>
      </div>

      {backendUnreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>. Start the backend
          (<code className="font-mono">uvicorn app.main:app --reload</code>) then refresh.
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Registered citizens" value={participants.length} />
        <StatCard icon={ShieldAlert} label="Recent watchlist alerts" value={alerts.length} tone="red" />
        <StatCard
          icon={TrendingDown}
          label="Low-score citizens"
          value={scoreCounts.red}
          tone={scoreCounts.red > 0 ? "red" : undefined}
        />
        <StatCard icon={Radio} label="Scene events logged" value={sceneEvents.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <Panel className="hud-corners flex items-center justify-center p-3">
          <RadarWidget label="SECTOR SWEEP" />
        </Panel>
        <Panel>
          <PanelHeader>
            <PanelTitle>Live activity feed</PanelTitle>
            <span className="font-mono text-xs text-ink-faint">continuous watch</span>
          </PanelHeader>
          <div className="divide-y divide-hairline">
            {sceneEvents.length === 0 && (
              <p className="p-4 text-center text-sm text-ink-faint">No scene events yet.</p>
            )}
            {sceneEvents.map((s) => (
              <div key={s.scene_event_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="text-ink-dim">{s.event_type.replace(/_/g, " ")}</span>
                  <span className="ml-2 font-mono text-[11px] text-ink-faint">{s.camera_name}</span>
                </div>
                <span className="font-mono text-xs text-ink-faint">
                  {new Date(s.occurred_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Citizens</PanelTitle>
            <span className="font-mono text-xs text-ink-faint">
              {scoreCounts.green} green · {scoreCounts.gray} gray · {scoreCounts.red} red
            </span>
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {participants.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-ink-faint">No citizens registered yet.</p>
            )}
            {participants.map((p) => (
              <div
                key={p.person_id}
                className="flex items-center gap-3 rounded-md border border-hairline bg-panel-raised p-3"
              >
                <Avatar url={imageUrl(p.image_url)} name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <ScoreDot color={p.score_color} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                  </div>
                  <div className="font-mono text-[11px] text-ink-faint">{p.person_id}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Watchlist alerts</PanelTitle>
          </PanelHeader>
          <div className="divide-y divide-hairline">
            {alerts.length === 0 && (
              <p className="p-4 text-center text-sm text-ink-faint">No alerts yet.</p>
            )}
            {alerts.map((a) => (
              <div key={a.alert_id} className="flex items-center gap-3 p-3">
                <Avatar url={imageUrl(a.image_url)} name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                  <div className="text-[11px] text-ink-faint">{a.camera_name}</div>
                </div>
                <Badge tone={riskTone(a.risk_level)}>{a.risk_level}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Recent events</PanelTitle>
          </PanelHeader>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-hairline">
              {events.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-ink-faint">No events yet.</td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.event_id}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-faint">
                    {new Date(e.occurred_at).toLocaleTimeString()}
                  </td>
                  <td className="px-2 py-2 text-ink">{e.name}</td>
                  <td className="px-2 py-2 text-ink-dim">{e.event_type_id.replace(/_/g, " ")}</td>
                  <td
                    className={`px-4 py-2 text-right font-mono ${
                      e.score_delta > 0 ? "text-signal-green" : "text-signal-red"
                    }`}
                  >
                    {e.score_delta > 0 ? `+${e.score_delta}` : e.score_delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Scene events</PanelTitle>
          </PanelHeader>
          <div className="divide-y divide-hairline">
            {sceneEvents.length === 0 && (
              <p className="p-4 text-center text-sm text-ink-faint">No crowd or parking events yet.</p>
            )}
            {sceneEvents.map((s) => (
              <div key={s.scene_event_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <div className="text-ink">{s.event_type.replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-ink-faint">{s.camera_name} · {s.detail}</div>
                </div>
                <div className="font-mono text-xs text-ink-faint">
                  {new Date(s.occurred_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "red";
}) {
  return (
    <Panel className="hud-corners p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-ink-dim">{label}</span>
        <Icon className={`size-4 ${tone === "red" ? "animate-glow text-signal-red" : "text-signal-cyan"}`} />
      </div>
      <div
        className={`mt-2 font-display text-3xl font-bold tabular-nums ${
          tone === "red" ? "text-glow-red text-signal-red" : "text-glow-cyan text-ink"
        }`}
      >
        {value}
      </div>
    </Panel>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="size-9 rounded-full border border-hairline-bright object-cover" />;
  }
  return (
    <div className="flex size-9 items-center justify-center rounded-full border border-hairline-bright bg-panel text-xs font-semibold text-ink-dim">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

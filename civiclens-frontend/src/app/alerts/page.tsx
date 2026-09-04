"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Badge, riskTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, imageUrl, type Alert, type MissingPersonAlertListItem, type SceneAlert } from "@/lib/api";
import { BellRing, ShieldAlert, UserSearch, Users, TrendingUp, CarFront, Clock, Package, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

type Filter = "all" | "watchlist" | "missing" | "crowd" | "surge" | "parking" | "loitering" | "unattended" | "accident";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "watchlist", label: "Watchlist" },
  { id: "missing", label: "Missing persons" },
  { id: "crowd", label: "Crowd" },
  { id: "surge", label: "Surge risk" },
  { id: "parking", label: "Parking" },
  { id: "loitering", label: "Loitering" },
  { id: "unattended", label: "Unattended" },
  { id: "accident", label: "Road accident" },
];

function filterTone(f: Filter) {
  if (f === "watchlist") return "border-signal-red/40 bg-signal-red/10 text-signal-red";
  if (f === "missing") return "border-signal-green/40 bg-signal-green/10 text-signal-green";
  if (f === "crowd") return "border-signal-amber/40 bg-signal-amber/10 text-signal-amber";
  if (f === "surge") return "border-signal-red/40 bg-signal-red/10 text-signal-red";
  if (f === "parking") return "border-signal-amber/40 bg-signal-amber/10 text-signal-amber";
  if (f === "loitering") return "border-signal-amber/40 bg-signal-amber/10 text-signal-amber";
  if (f === "unattended") return "border-signal-red/40 bg-signal-red/10 text-signal-red";
  if (f === "accident") return "border-signal-red/40 bg-signal-red/10 text-signal-red";
  return "border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan";
}

export default function AlertsPage() {
  const [redlistAlerts, setRedlistAlerts] = useState<Alert[]>([]);
  const [missingAlerts, setMissingAlerts] = useState<MissingPersonAlertListItem[]>([]);
  const [crowdAlerts, setCrowdAlerts] = useState<SceneAlert[]>([]);
  const [surgeAlerts, setSurgeAlerts] = useState<SceneAlert[]>([]);
  const [parkingAlerts, setParkingAlerts] = useState<SceneAlert[]>([]);
  const [loiteringAlerts, setLoiteringAlerts] = useState<SceneAlert[]>([]);
  const [unattendedAlerts, setUnattendedAlerts] = useState<SceneAlert[]>([]);
  const [accidentAlerts, setAccidentAlerts] = useState<SceneAlert[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [ackedRedlist, setAckedRedlist] = useState<Set<number>>(new Set());
  const [ackedMissing, setAckedMissing] = useState<Set<number>>(new Set());
  const [ackedScene, setAckedScene] = useState<Set<number>>(new Set());
  const [unreachable, setUnreachable] = useState(false);

  const load = () => {
    Promise.all([
      api.alerts.list(50),
      api.missingPersonAlerts.list(50),
      api.sceneAlerts.list(50, "crowd_detected"),
      api.sceneAlerts.list(50, "crowd_surge"),
      api.sceneAlerts.list(50, "illegal_parking"),
      api.sceneAlerts.list(50, "loitering"),
      api.sceneAlerts.list(50, "unattended_object"),
      api.sceneAlerts.list(50, "road_accident"),
    ])
      .then(([r, m, crowd, surge, parking, loiter, unattended, accident]) => {
        setRedlistAlerts(r);
        setMissingAlerts(m);
        setCrowdAlerts(crowd);
        setSurgeAlerts(surge);
        setParkingAlerts(parking);
        setLoiteringAlerts(loiter);
        setUnattendedAlerts(unattended);
        setAccidentAlerts(accident);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
  };

  useEffect(load, []);

  const ackScene = async (id: number) => {
    await api.sceneAlerts.acknowledge(id);
    setAckedScene((prev) => new Set(prev).add(id));
  };
  const ackRedlist = async (id: number) => {
    await api.alerts.acknowledge(id);
    setAckedRedlist((prev) => new Set(prev).add(id));
  };
  const ackMissing = async (id: number) => {
    await api.missingPersonAlerts.acknowledge(id);
    setAckedMissing((prev) => new Set(prev).add(id));
  };

  type Row =
    | { kind: "watchlist"; occurred_at: string; data: Alert }
    | { kind: "missing"; occurred_at: string; data: MissingPersonAlertListItem }
    | { kind: "scene"; occurred_at: string; data: SceneAlert };

  const rows: Row[] = [
    ...(filter === "all" || filter === "watchlist"
      ? redlistAlerts.map((a): Row => ({ kind: "watchlist", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "missing"
      ? missingAlerts.map((a): Row => ({ kind: "missing", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "crowd"
      ? crowdAlerts.map((a): Row => ({ kind: "scene", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "surge"
      ? surgeAlerts.map((a): Row => ({ kind: "scene", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "parking"
      ? parkingAlerts.map((a): Row => ({ kind: "scene", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "loitering"
      ? loiteringAlerts.map((a): Row => ({ kind: "scene", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "unattended"
      ? unattendedAlerts.map((a): Row => ({ kind: "scene", occurred_at: a.occurred_at, data: a }))
      : []),
    ...(filter === "all" || filter === "accident"
      ? accidentAlerts.map((a): Row => ({ kind: "scene", occurred_at: a.occurred_at, data: a }))
      : []),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  function sceneIcon(eventType: string) {
    if (eventType === "crowd_detected") return <Users className="size-4" />;
    if (eventType === "crowd_surge") return <TrendingUp className="size-4" />;
    if (eventType === "illegal_parking") return <CarFront className="size-4" />;
    if (eventType === "loitering") return <Clock className="size-4" />;
    if (eventType === "unattended_object") return <Package className="size-4" />;
    if (eventType === "road_accident") return <Siren className="size-4" />;
    return <BellRing className="size-4" />;
  }

  function sceneBorderColor(eventType: string) {
    if (eventType === "crowd_surge" || eventType === "unattended_object" || eventType === "road_accident") return "border-signal-red/40";
    return "border-signal-amber/40";
  }

  function sceneBadgeLabel(eventType: string) {
    if (eventType === "crowd_detected") return "CROWD";
    if (eventType === "crowd_surge") return "SURGE RISK";
    if (eventType === "illegal_parking") return "PARKING";
    if (eventType === "loitering") return "LOITERING";
    if (eventType === "unattended_object") return "UNATTENDED";
    if (eventType === "road_accident") return "ACCIDENT";
    return eventType.toUpperCase();
  }

  function sceneBadgeTone(eventType: string): "amber" | "red" {
    if (eventType === "crowd_surge" || eventType === "unattended_object" || eventType === "road_accident") return "red";
    return "amber";
  }

  function sceneTitle(a: SceneAlert) {
    if (a.event_type === "crowd_detected") return `Crowd — ${a.person_count ?? "?"}+ persons`;
    if (a.event_type === "crowd_surge") return `Surge risk — ${a.person_count ?? "?"}+ persons`;
    if (a.event_type === "illegal_parking") return `Illegal parking`;
    if (a.event_type === "loitering") return `Loitering in restricted zone`;
    if (a.event_type === "unattended_object") return `Unattended object`;
    if (a.event_type === "road_accident") return `Road accident — ${a.detail ?? "probable accident"}`;
    return a.event_type;
  }

  return (
    <div className="mx-auto max-w-[1400px] animate-rise space-y-6 px-2 sm:px-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Alerts</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Every Watchlist match, Missing Person detection, and civic-event alert in one feed.
        </p>
      </div>

      {unreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors",
              filter === f.id
                ? filterTone(f.id)
                : "border-hairline-bright text-ink-dim hover:text-ink"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Feed</PanelTitle>
        </PanelHeader>
        <div className="divide-y divide-hairline">
          {rows.length === 0 && !unreachable && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <BellRing className="size-8 text-ink-faint" />
              <p className="text-sm text-ink-faint">No alerts yet.</p>
            </div>
          )}
          {rows.map((row) => {
            if (row.kind === "watchlist") {
              const a = row.data;
              const acked = a.acknowledged || ackedRedlist.has(a.alert_id);
              const photo = imageUrl(a.image_url);
              return (
                <div key={`w-${a.alert_id}`} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={a.name} className="size-10 rounded-md border border-signal-red/40 object-cover" />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-md border border-signal-red/40 bg-panel-raised text-ink-faint">
                        <ShieldAlert className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{a.name}</span>
                        <Badge tone={riskTone(a.risk_level)}>{a.risk_level}</Badge>
                      </div>
                      <div className="font-mono text-xs text-ink-faint">
                        {a.camera_name} · {(a.similarity_score * 100).toFixed(1)}% · {new Date(a.occurred_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant={acked ? "ghost" : "outline"} disabled={acked} onClick={() => ackRedlist(a.alert_id)}>
                    {acked ? "Acknowledged" : "Acknowledge"}
                  </Button>
                </div>
              );
            }

            if (row.kind === "missing") {
              const a = row.data;
              const acked = a.acknowledged || ackedMissing.has(a.alert_id);
              const photo = imageUrl(a.image_url);
              return (
                <div key={`m-${a.alert_id}`} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={a.name} className="size-10 rounded-md border border-signal-green/40 object-cover" />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-md border border-signal-green/40 bg-panel-raised text-ink-faint">
                        <UserSearch className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{a.name}</span>
                        <Badge tone="green">Missing person found</Badge>
                      </div>
                      <div className="font-mono text-xs text-ink-faint">
                        {a.camera_name} · {(a.similarity_score * 100).toFixed(1)}% · {new Date(a.occurred_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant={acked ? "ghost" : "outline"} disabled={acked} onClick={() => ackMissing(a.alert_id)}>
                    {acked ? "Acknowledged" : "Acknowledge"}
                  </Button>
                </div>
              );
            }

            // scene alert
            const a = row.data;
            const acked = a.acknowledged || ackedScene.has(a.alert_id);
            const photo = imageUrl(a.image_url);
            const borderColor = sceneBorderColor(a.event_type);
            return (
              <div key={`s-${a.alert_id}`} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={a.event_type} className={cn("size-10 rounded-md border object-cover", borderColor)} />
                  ) : (
                    <div className={cn("flex size-10 items-center justify-center rounded-md border bg-panel-raised text-ink-faint", borderColor)}>
                      {sceneIcon(a.event_type)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{sceneTitle(a)}</span>
                      <Badge tone={sceneBadgeTone(a.event_type)}>{sceneBadgeLabel(a.event_type)}</Badge>
                    </div>
                    <div className="font-mono text-xs text-ink-faint">
                      {a.camera_name}
                      {a.zone_name ? ` · ${a.zone_name}` : ""}
                      {a.detail ? ` · ${a.detail}` : ""}
                      {" · "}{new Date(a.occurred_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant={acked ? "ghost" : "outline"} disabled={acked} onClick={() => ackScene(a.alert_id)}>
                  {acked ? "Acknowledged" : "Acknowledge"}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

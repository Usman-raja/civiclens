"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, imageUrl, type MonitoringStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Grid3x3,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Radio,
  ScanFace,
  Settings2,
  AlertTriangle,
  Users,
  RefreshCw,
} from "lucide-react";

const PER_PAGE = 12;
const POLL_MS = 5000;

const STATE_STYLES: Record<MonitoringStatus["state"], { label: string; className: string; pulse: boolean }> = {
  live: { label: "LIVE", className: "text-signal-green", pulse: true },
  reconnecting: { label: "RECONNECTING", className: "text-signal-amber", pulse: true },
  error: { label: "ERROR", className: "text-signal-red", pulse: false },
  stopped: { label: "OFFLINE", className: "text-ink-faint", pulse: false },
};

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const s = Math.max(0, Math.round((Date.now() - ts * 1000) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function CameraWallPage() {
  const { isAdmin } = useAuth();
  const [statuses, setStatuses] = useState<MonitoringStatus[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.cameras
      .monitoringStatus()
      .then((data) => {
        setStatuses(data);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      load();
    }
  };

  const totalPages = Math.max(1, Math.ceil(statuses.length / PER_PAGE));
  const pageItems = statuses.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const liveCount = statuses.filter((s) => s.state === "live").length;
  const totalAlerts = statuses.reduce((n, s) => n + (s.alert_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Camera Wall</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-dim">
            Control-room view of every registered camera. The server watches RTSP / file feeds
            continuously — this page is a window onto what it sees, refreshed every {POLL_MS / 1000}s.
            No browser needs to stay open for detection to run.
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(api.cameras.startAllMonitoring)}>
              <Play className="size-3.5" /> Start all
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(api.cameras.stopAllMonitoring)}>
              <Square className="size-3.5" /> Stop all
            </Button>
          </div>
        )}
      </div>

      {unreachable ? (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API — start the backend to load your registered cameras.
        </Panel>
      ) : (
        <div className="hud-corners flex flex-wrap items-center gap-4 rounded-md border border-hairline-bright bg-panel px-4 py-2.5 font-mono text-xs text-ink-dim">
          <span className="flex items-center gap-1.5">
            <Radio className={`size-3.5 ${liveCount > 0 ? "animate-glow text-signal-green" : "text-ink-faint"}`} />
            {liveCount} live / {statuses.length} cameras
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-signal-cyan" />
            <span className="text-glow-cyan">{statuses.reduce((n, s) => n + (s.person_count ?? 0), 0)}+ persons</span> in view
          </span>
          {totalAlerts > 0 && (
            <span className="flex animate-blink items-center gap-1.5 font-semibold text-signal-red text-glow-red">
              <AlertTriangle className="size-3.5" /> {totalAlerts} watchlist hits in view
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 text-ink-faint">
            <span className="eq-bars text-signal-cyan/70">
              <span /><span /><span /><span />
            </span>
            <RefreshCw className="size-3 animate-spin [animation-duration:3s]" /> SWEEP {POLL_MS / 1000}s
          </span>
        </div>
      )}

      {statuses.length === 0 && !unreachable && (
        <Panel className="flex flex-col items-center gap-3 py-16 text-center">
          <ScanFace className="size-8 text-ink-faint" />
          <p className="text-sm text-ink-faint">No cameras registered yet.</p>
          <Link href="/cameras">
            <Button size="sm">
              <Settings2 className="size-3.5" /> Register a camera
            </Button>
          </Link>
        </Panel>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
        {pageItems.map((s) => (
          <WallTile key={s.camera_name} status={s} isAdmin={isAdmin} busy={busy}
            onStart={() => run(() => api.cameras.startMonitoring(s.camera_name))}
            onStop={() => run(() => api.cameras.stopMonitoring(s.camera_name))} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="flex items-center gap-2 font-mono text-xs text-ink-dim">
            <Grid3x3 className="size-3.5" /> Page {page + 1} of {totalPages} · {statuses.length} feeds
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function WallTile({
  status: s,
  isAdmin,
  busy,
  onStart,
  onStop,
}: {
  status: MonitoringStatus;
  isAdmin: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const manual = s.source_type === "manual";
  const state = STATE_STYLES[manual ? "stopped" : s.state];
  const frameSrc = imageUrl(s.frame_url);
  // The worker overwrites the same JPEG, so bust the cache per processed frame.
  const src = s.frames_processed > 0 && frameSrc ? `${frameSrc}?v=${s.frames_processed}` : frameSrc;
  const alerts = s.alert_count ?? 0;

  return (
    <div className="hud-corners overflow-hidden rounded-md border border-hairline-bright bg-panel shadow-[0_0_24px_rgba(53,199,224,0.05)]">
      <div className="relative aspect-video overflow-hidden bg-black">
        {!manual && s.frames_processed > 0 && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={s.camera_name} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-faint">
            {manual ? <ScanFace className="size-6" /> : <Radio className="size-6 animate-pulse" />}
            <span className="font-mono text-[10px] uppercase">
              {manual ? "Manual camera" : s.state === "stopped" ? "Monitoring off" : "Acquiring signal…"}
            </span>
          </div>
        )}

        {/* scanning sweep over live feeds */}
        {s.state === "live" && !manual && s.frames_processed > 0 && <div className="scanline" />}

        {/* targeting-frame tick marks on the edges */}
        {s.state === "live" && !manual && s.frames_processed > 0 && <div className="hud-ticks opacity-60" />}

        {/* HUD reticle crosshair on live feeds */}
        {s.state === "live" && !manual && s.frames_processed > 0 && (
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-signal-cyan" />
            <div className="absolute left-1/2 top-1/2 h-px w-16 -translate-x-1/2 -translate-y-1/2 bg-signal-cyan/60" />
            <div className="absolute left-1/2 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-signal-cyan/60" />
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-ink backdrop-blur-sm">{s.camera_name}</span>
          <span className={`flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold ${state.className}`}>
            {state.pulse && <span className="size-1 animate-pulse-ring rounded-full bg-current" />}
            {state.label}
          </span>
        </div>

        {alerts > 0 && (
          <span className="absolute right-2 top-2 flex animate-blink items-center gap-1 rounded bg-signal-red px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void shadow-[0_0_16px_rgba(240,71,63,0.6)]">
            <AlertTriangle className="size-2.5" /> {alerts} ALERT{alerts > 1 ? "S" : ""}
          </span>
        )}

        {s.state === "live" && s.person_count != null && s.person_count > 0 && (
          <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim backdrop-blur-sm">
            {s.person_count}+ persons · {s.face_count ?? 0} faces
          </div>
        )}

        {s.state === "live" && s.last_update != null && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-signal-green/80 backdrop-blur-sm">
            {timeAgo(s.last_update)}
          </div>
        )}
      </div>

      <div className="space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-ink-dim">{s.purpose}</p>
            <p className="truncate font-mono text-[10px] text-ink-faint">
              {manual
                ? "browser-fed · use Live Monitoring"
                : `${s.source_type} · every ${s.capture_interval}s · ${s.frames_processed} frames`}
            </p>
          </div>
          {!s.has_zones && (
            <Link href="/cameras" className="shrink-0 font-mono text-[10px] text-signal-amber hover:underline">
              no zones
            </Link>
          )}
        </div>

        {s.state === "error" && s.last_error && (
          <p className="truncate font-mono text-[10px] text-signal-red" title={s.last_error}>
            {s.last_error}
          </p>
        )}

        {isAdmin && (
          <div className="flex gap-1.5">
            {manual ? (
              <Link href="/cameras" className="flex-1">
                <button className="flex w-full items-center justify-center gap-1 rounded border border-hairline-bright px-2 py-1.5 text-[11px] text-ink-dim hover:text-ink">
                  <Settings2 className="size-3" /> Configure source
                </button>
              </Link>
            ) : s.monitoring_active ? (
              <button
                onClick={onStop}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-signal-red/40 px-2 py-1.5 text-[11px] text-signal-red hover:bg-signal-red/10 disabled:opacity-50"
              >
                <Square className="size-3" /> Stop
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-signal-cyan px-2 py-1.5 text-[11px] font-semibold text-void hover:opacity-90 disabled:opacity-50"
              >
                <Play className="size-3" /> Start monitoring
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

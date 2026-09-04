"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoneEditor } from "@/components/cameras/zone-editor";
import { ImportCamerasButton } from "@/components/cameras/import-cameras-button";
import { api, type CameraInfo } from "@/lib/api";
import { Camera as CameraIcon, Plus, Trash2 } from "lucide-react";

const ZONE_LABELS: Record<string, string> = {
  crosswalk: "Crosswalk",
  road: "Road",
  restricted_zone: "Restricted",
  crowd_zone: "Crowd",
  no_parking_zone: "No-parking",
};

const DETECTION_LABELS: Record<string, string> = {
  road_events: "Jaywalking/crossing/loitering",
  vehicle_parking: "Vehicle & parking",
  crowd: "Crowd detection",
  littering: "Littering",
};

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [editing, setEditing] = useState<CameraInfo | null | "new">(null);

  const load = () => {
    api.cameras
      .list()
      .then((data) => {
        setCameras(data);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
  };

  useEffect(load, []);

  const handleDelete = async (name: string) => {
    await api.cameras.remove(name);
    load();
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-[1400px] animate-rise space-y-6 px-2 sm:px-0">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {editing === "new" ? "New camera" : `Edit — ${editing.camera_name}`}
          </h1>
          <p className="mt-1 text-sm text-ink-dim">
            Set the camera&rsquo;s purpose and which extra detections it runs, then draw or AI-suggest its zones.
          </p>
        </div>
        <ZoneEditor
          initialCameraName={editing === "new" ? "" : editing.camera_name}
          initialZones={editing === "new" ? {} : editing.zones}
          initialPurpose={editing === "new" ? "Custom" : editing.purpose}
          initialEnabledDetections={editing === "new" ? [] : editing.enabled_detections}
          initialSource={
            editing === "new"
              ? undefined
              : {
                  source_type: editing.source_type ?? "manual",
                  source_path: editing.source_path ?? "",
                  capture_interval: editing.capture_interval ?? 5,
                  monitoring_enabled: editing.monitoring_enabled ?? false,
                }
          }
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Cameras</h1>
          <p className="mt-1 text-sm text-ink-dim">Registered cameras, their purpose, and detection zones.</p>
        </div>
        <div className="flex gap-2">
          <ImportCamerasButton />
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" /> New camera
          </Button>
        </div>
      </div>

      {unreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Camera registry</PanelTitle>
        </PanelHeader>
        <div className="divide-y divide-hairline">
          {cameras.length === 0 && !unreachable && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CameraIcon className="size-8 text-ink-faint" />
              <p className="text-sm text-ink-faint">No cameras configured yet.</p>
            </div>
          )}
          {cameras.map((c) => (
            <div key={c.camera_name} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-ink">{c.camera_name}</span>
                  <Badge tone="cyan">{c.purpose}</Badge>
                  {(c.source_type ?? "manual") !== "manual" ? (
                    <Badge tone={c.monitoring_enabled ? "green" : "amber"}>
                      {c.source_type === "rtsp" ? "RTSP" : "File"} · {c.monitoring_enabled ? "24/7" : "on demand"}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Manual</Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="font-mono text-[11px] text-ink-faint">Always: Face + Watchlist ·</span>
                  {c.enabled_detections.length === 0 ? (
                    <span className="font-mono text-[11px] text-ink-faint">no extra detections</span>
                  ) : (
                    c.enabled_detections.map((d) => (
                      <span key={d} className="rounded-full border border-hairline-bright px-2 py-0.5 font-mono text-[11px] text-ink-dim">
                        {DETECTION_LABELS[d] ?? d}
                      </span>
                    ))
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.keys(c.zones).length === 0 ? (
                    <span className="font-mono text-[11px] text-ink-faint">no zones drawn</span>
                  ) : (
                    Object.keys(c.zones).map((z) => (
                      <span key={z} className="rounded-full border border-hairline-bright px-2 py-0.5 font-mono text-[11px] text-ink-dim">
                        {ZONE_LABELS[z] ?? z}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(c.camera_name)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

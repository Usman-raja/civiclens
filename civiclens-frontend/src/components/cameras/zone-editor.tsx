"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { api, type CameraSourceConfig, type ZoneSuggestion } from "@/lib/api";
import { Undo2, Check, Trash2, Save, Upload, Sparkles, ThumbsUp, Pencil, X, Video } from "lucide-react";

type Point = [number, number];

const SOURCE_TYPE_OPTIONS: { key: CameraSourceConfig["source_type"]; label: string; hint: string }[] = [
  { key: "manual", label: "Manual (browser session)", hint: "Operator opens Live Monitoring and picks the camera — nothing runs on the server." },
  { key: "rtsp", label: "RTSP stream (live camera)", hint: "e.g. rtsp://user:pass@192.168.1.10:554/stream1 — the server connects and watches 24/7." },
  { key: "file", label: "Video file (demo / test feed)", hint: "Path on the backend machine, e.g. C:\\videos\\street.mp4 — loops for testing." },
];

const ZONE_TYPES: { key: string; label: string; color: string }[] = [
  { key: "crosswalk", label: "Crosswalk", color: "#2ed47a" },
  { key: "road", label: "Road (jaywalking)", color: "#f0473f" },
  { key: "restricted_zone", label: "Restricted zone (loitering)", color: "#f0a63c" },
  { key: "crowd_zone", label: "Crowd zone", color: "#35c7e0" },
  { key: "no_parking_zone", label: "No-parking zone", color: "#a78bfa" },
];

const PURPOSE_PRESETS: Record<string, string[]> = {
  "Traffic Intersection":    ["vehicle_parking", "road_events", "crowd"],
  "City Square / Plaza":     ["crowd", "road_events"],
  "Bus / Train Terminal":    ["vehicle_parking", "crowd", "road_events"],
  "Stadium / Event Venue":   ["crowd", "vehicle_parking", "road_events"],
  "Market / Bazaar":         ["crowd", "road_events", "vehicle_parking"],
  "City Park":               ["crowd", "road_events"],
  "Highway Checkpoint":      ["vehicle_parking", "road_events", "crowd"],
  "Government / Civic Area": ["crowd", "road_events", "vehicle_parking"],
  "Parking Structure":       ["vehicle_parking", "crowd"],
  Custom:                    [],
};

const DETECTION_OPTIONS: { key: string; label: string; disabled?: boolean }[] = [
  { key: "road_events", label: "Jaywalking / crossing / loitering" },
  { key: "vehicle_parking", label: "Vehicle detection & illegal parking" },
  { key: "crowd", label: "Crowd detection" },
  { key: "littering", label: "Littering (not automated yet)", disabled: true },
];

function colorFor(key: string) {
  return ZONE_TYPES.find((z) => z.key === key)?.color ?? "#7e8ca0";
}

export function ZoneEditor({
  initialCameraName = "",
  initialZones = {},
  initialPurpose = "Custom",
  initialEnabledDetections = [],
  initialSource,
  onSaved,
  onCancel,
}: {
  initialCameraName?: string;
  initialZones?: Record<string, Point[]>;
  initialPurpose?: string;
  initialEnabledDetections?: string[];
  initialSource?: CameraSourceConfig;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isNew = !initialCameraName;
  const [cameraName, setCameraName] = useState(initialCameraName);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [enabledDetections, setEnabledDetections] = useState<string[]>(initialEnabledDetections);
  const [sourceType, setSourceType] = useState<CameraSourceConfig["source_type"]>(initialSource?.source_type ?? "manual");
  const [sourcePath, setSourcePath] = useState(initialSource?.source_path ?? "");
  const [captureInterval, setCaptureInterval] = useState(initialSource?.capture_interval ?? 5);
  const [monitoringEnabled, setMonitoringEnabled] = useState(initialSource?.monitoring_enabled ?? false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoneType, setZoneType] = useState(ZONE_TYPES[0].key);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [savedZones, setSavedZones] = useState<Record<string, Point[]>>(initialZones);
  const [suggestions, setSuggestions] = useState<ZoneSuggestion[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageSrc(url);
    };
    img.src = url;
  };

  const applyPreset = (presetName: string) => {
    setPurpose(presetName);
    if (presetName in PURPOSE_PRESETS) {
      setEnabledDetections(PURPOSE_PRESETS[presetName]);
    }
  };

  const toggleDetection = (key: string) => {
    setEnabledDetections((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  };

  // Zones are stored normalized to 0-1000 so they work at any capture
  // resolution; the canvas is photo-sized, so convert at the boundaries.
  const toPx = (points: Point[]): Point[] =>
    points.map(([x, y]) => [(x * imageSize.width) / 1000, (y * imageSize.height) / 1000]);
  const toNorm = (points: Point[]): Point[] =>
    points.map(([x, y]) => [
      Math.round((x * 1000) / imageSize.width),
      Math.round((y * 1000) / imageSize.height),
    ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * 1000) / rect.width;
    const y = ((e.clientY - rect.top) * 1000) / rect.height;
    setCurrentPoints((prev) => [...prev, [Math.round(x), Math.round(y)]]);
  };

  const undoLastPoint = () => setCurrentPoints((prev) => prev.slice(0, -1));

  const finishZone = () => {
    if (currentPoints.length < 3) {
      setError("A zone needs at least 3 points.");
      return;
    }
    setSavedZones((prev) => ({ ...prev, [zoneType]: currentPoints }));
    setCurrentPoints([]);
    setError(null);
  };

  const removeZone = (key: string) => {
    setSavedZones((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const editZone = (key: string) => {
    setZoneType(key);
    setCurrentPoints(savedZones[key] ?? []);
    removeZone(key);
  };

  const handleSuggest = async () => {
    if (!imageFile) return;
    setSuggestBusy(true);
    setError(null);
    try {
      const results = await api.cameras.suggestRoadZone(imageFile, 0.5);
      setSuggestions(results);
      if (results.length === 0) {
        setError("No road region found with enough confidence on this photo — draw it manually instead.");
      }
    } catch {
      setError("AI suggestion request failed — is the backend running?");
    } finally {
      setSuggestBusy(false);
    }
  };

  const acceptSuggestion = (s: ZoneSuggestion, index: number) => {
    setSavedZones((prev) => ({ ...prev, [s.zone_type]: toNorm(s.polygon) }));
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const adjustSuggestion = (s: ZoneSuggestion, index: number) => {
    setZoneType(s.zone_type);
    setCurrentPoints(toNorm(s.polygon));
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const rejectSuggestion = (index: number) => setSuggestions((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!cameraName.trim()) {
      setError("Camera name is required.");
      return;
    }
    if (sourceType !== "manual" && !sourcePath.trim()) {
      setError("An RTSP URL or file path is required for server-side monitoring.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const source: CameraSourceConfig = {
        source_type: sourceType,
        source_path: sourceType === "manual" ? "" : sourcePath.trim(),
        capture_interval: captureInterval,
        monitoring_enabled: monitoringEnabled && sourceType !== "manual",
      };
      if (isNew) {
        await api.cameras.create(cameraName.trim(), purpose, enabledDetections, source);
      } else {
        await api.cameras.updateSettings(cameraName.trim(), purpose, enabledDetections, source);
      }
      await api.cameras.saveZones(cameraName.trim(), savedZones);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save camera.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || imageSize.width === 0) return;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawPolygon = (points: Point[], color: string, closed: boolean, label?: string, dashed = false) => {
      if (points.length === 0) return;
      ctx.setLineDash(dashed ? [10, 6] : []);
      ctx.strokeStyle = color;
      ctx.fillStyle = `${color}33`;
      ctx.lineWidth = Math.max(2, imageSize.width / 400);
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      if (closed) ctx.closePath();
      ctx.stroke();
      if (closed) ctx.fill();
      ctx.setLineDash([]);
      points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3, imageSize.width / 250), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
      if (label) {
        ctx.font = `600 ${Math.max(14, imageSize.width / 60)}px var(--font-mono)`;
        ctx.fillStyle = color;
        ctx.fillText(label, points[0][0] + 6, points[0][1] - 6);
      }
    };

    Object.entries(savedZones).forEach(([key, points]) => {
      drawPolygon(toPx(points), colorFor(key), true, ZONE_TYPES.find((z) => z.key === key)?.label);
    });
    suggestions.forEach((s) => {
      drawPolygon(s.polygon, "#35c7e0", true, `AI: ${s.label} (${(s.confidence * 100).toFixed(0)}%)`, true);
    });
    drawPolygon(toPx(currentPoints), colorFor(zoneType), false);
  }, [savedZones, currentPoints, zoneType, imageSize, suggestions]);

  return (
    <Panel className="p-4">
      <div className="mb-4 grid grid-cols-1 gap-4 border-b border-hairline pb-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Camera name</label>
          <input
            value={cameraName}
            onChange={(e) => setCameraName(e.target.value)}
            placeholder="e.g. gate-cam"
            disabled={!isNew}
            className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-dim">Purpose</label>
          <select
            value={purpose in PURPOSE_PRESETS ? purpose : "Custom"}
            onChange={(e) => applyPreset(e.target.value)}
            className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
          >
            {Object.keys(PURPOSE_PRESETS).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1.5 block text-xs text-ink-dim">
            Additional detections for this camera — face recognition &amp; Watchlist always run, on every camera, regardless of these settings
          </label>
          <div className="flex flex-wrap gap-3">
            {DETECTION_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className={`flex items-center gap-1.5 text-xs ${opt.disabled ? "text-ink-faint" : "text-ink-dim"}`}
              >
                <input
                  type="checkbox"
                  checked={enabledDetections.includes(opt.key)}
                  disabled={opt.disabled}
                  onChange={() => toggleDetection(opt.key)}
                  className="accent-signal-cyan"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-hairline bg-panel-raised/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Video className="size-4 text-signal-cyan" />
          <span className="font-mono text-xs uppercase tracking-wide text-ink-dim">Video source</span>
          <span className="text-[11px] text-ink-faint">— server-side monitoring runs with no browser open</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ink-dim">Source type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as CameraSourceConfig["source_type"])}
              className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
            >
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-snug text-ink-faint">
              {SOURCE_TYPE_OPTIONS.find((o) => o.key === sourceType)?.hint}
            </p>
          </div>
          <div className="space-y-3">
            {sourceType !== "manual" && (
              <div>
                <label className="mb-1 block text-xs text-ink-dim">
                  {sourceType === "rtsp" ? "RTSP URL" : "Video file path (on the backend machine)"}
                </label>
                <input
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  placeholder={sourceType === "rtsp" ? "rtsp://user:pass@192.168.1.10:554/stream1" : "C:\\videos\\street.mp4"}
                  className="w-full rounded-md border border-hairline-bright bg-panel px-3 py-2 font-mono text-xs text-ink outline-none focus:border-signal-cyan"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-ink-dim">
                Analyze every
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={captureInterval}
                  onChange={(e) => setCaptureInterval(Number(e.target.value) || 5)}
                  className="w-16 rounded-md border border-hairline-bright bg-panel px-2 py-1 font-mono text-xs text-ink outline-none focus:border-signal-cyan"
                />
                sec
              </label>
              <label className={`flex items-center gap-1.5 text-xs ${sourceType === "manual" ? "text-ink-faint" : "text-ink-dim"}`}>
                <input
                  type="checkbox"
                  checked={monitoringEnabled && sourceType !== "manual"}
                  disabled={sourceType === "manual"}
                  onChange={(e) => setMonitoringEnabled(e.target.checked)}
                  className="accent-signal-cyan"
                />
                Run 24/7 on server
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink-dim hover:text-ink">
          <Upload className="size-4" />
          {imageSrc ? "Replace reference photo" : "Upload reference photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
            }}
          />
        </label>
        <Button variant="outline" size="sm" disabled={!imageFile || suggestBusy} onClick={handleSuggest}>
          <Sparkles className="size-3.5" /> {suggestBusy ? "Analyzing…" : "Suggest road zone (AI)"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {!imageSrc ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-hairline-bright text-sm text-ink-faint">
          Upload a reference photo of this camera&rsquo;s view to start drawing zones.
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full overflow-hidden rounded-md border border-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="reference" className="w-full" />
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="absolute inset-0 h-full w-full cursor-crosshair"
          />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-2 rounded-md border border-signal-cyan/40 bg-signal-cyan/5 p-3">
          <p className="font-mono text-xs uppercase tracking-wide text-signal-cyan">AI suggestions — review before use</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {s.label} &mdash; <span className="font-mono text-ink-dim">{(s.confidence * 100).toFixed(0)}% confidence</span>
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => acceptSuggestion(s, i)}>
                  <ThumbsUp className="size-3.5" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => adjustSuggestion(s, i)}>
                  <Pencil className="size-3.5" /> Adjust
                </Button>
                <Button size="sm" variant="ghost" onClick={() => rejectSuggestion(i)}>
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={zoneType}
          onChange={(e) => {
            setZoneType(e.target.value);
            setCurrentPoints([]);
          }}
          className="rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
        >
          {ZONE_TYPES.map((z) => (
            <option key={z.key} value={z.key}>
              {z.label}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={!imageSrc || currentPoints.length === 0} onClick={undoLastPoint}>
          <Undo2 className="size-3.5" /> Undo point
        </Button>
        <Button size="sm" disabled={!imageSrc || currentPoints.length < 3} onClick={finishZone}>
          <Check className="size-3.5" /> Finish this zone ({currentPoints.length} pts)
        </Button>
      </div>

      {Object.keys(savedZones).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
          {Object.entries(savedZones).map(([key, points]) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: colorFor(key), color: colorFor(key) }}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: colorFor(key) }} />
              {ZONE_TYPES.find((z) => z.key === key)?.label ?? key} ({points.length} pts)
              <button onClick={() => editZone(key)} className="text-ink-dim hover:text-ink">
                edit
              </button>
              <button onClick={() => removeZone(key)} className="text-ink-dim hover:text-signal-red">
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-signal-red">{error}</p>}

      <div className="mt-4 flex justify-end border-t border-hairline pt-4">
        <Button disabled={saving} onClick={handleSave}>
          <Save className="size-4" /> {saving ? "Saving…" : "Save camera"}
        </Button>
      </div>
    </Panel>
  );
}

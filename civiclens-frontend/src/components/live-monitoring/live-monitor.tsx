"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ScoreDot } from "@/components/ui/score-dot";
import { Button } from "@/components/ui/button";
import { DetectionOverlay } from "./detection-overlay";
import { ScanningPanel } from "./scanning-panel";
import { DetectionCard } from "./detection-card";
import { api, imageUrl, type CameraInfo, type DetectFrameResponse, type RedlistAlert, type DetectionResult, type MissingPersonAlertData, type CrowdEventData, type SceneEventHit } from "@/lib/api";
import { useDetectionHistory, type HistoryItem } from "@/lib/detection-history-store";
import { Video, VideoOff, ScanFace, Users2, CarFront, FileVideo, X, TrendingUp, Clock, Package, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

const CAPTURE_INTERVAL_MS = 4000;

interface CardEntry {
  id: string;
  tone: "redlist" | "known" | "missing" | "crowd" | "surge" | "loitering" | "unattended" | "accident";
  redlistData?: RedlistAlert;
  knownData?: DetectionResult;
  missingData?: MissingPersonAlertData;
  crowdData?: CrowdEventData;
  sceneData?: SceneEventHit;
}

interface Position {
  x: number;
  y: number;
}

type MediaSource = "camera" | "file" | null;

export function LiveMonitor() {
  const { history, addHistoryItems } = useDetectionHistory();
  const [cameraName, setCameraName] = useState("gate-cam");
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [mediaSource, setMediaSource] = useState<MediaSource>(null);
  const [autoCapture, setAutoCapture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectFrameResponse | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [ackedIds, setAckedIds] = useState<Set<number>>(new Set());
  const [ackedSceneIds, setAckedSceneIds] = useState<Set<number>>(new Set());
  const [dismissedSceneIds, setDismissedSceneIds] = useState<Set<number>>(new Set());
  const [cardPositions, setCardPositions] = useState<Record<string, Position>>({});

  const cameraOn = mediaSource !== null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false); // guards against state updates after unmount, not after a mere stop
  const inFlightRef = useRef(false); // guards against overlapping requests when one is slower than the 4s interval

  const startCamera = async () => {
    stopMedia();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setVideoSize({
            width: videoRef.current?.videoWidth ?? 0,
            height: videoRef.current?.videoHeight ?? 0,
          });
        };
      }
      setMediaSource("camera");
    } catch {
      setError("Could not access the camera — denied, or blocked by device policy.");
    }
  };

  const loadVideoFile = (file: File) => {
    stopMedia();
    setError(null);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.onloadedmetadata = () => {
        setVideoSize({
          width: videoRef.current?.videoWidth ?? 0,
          height: videoRef.current?.videoHeight ?? 0,
        });
      };
      videoRef.current.play().catch(() => {
        setError("Could not play the video file — try a standard MP4/WebM export.");
      });
    }
    setMediaSource("file");
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setMediaSource(null);
    setAutoCapture(false);
  };

  const captureBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return resolve(null);
      const MAX_WIDTH = 640;
      const scale = video.videoWidth > MAX_WIDTH ? MAX_WIDTH / video.videoWidth : 1;
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });

  const runDetection = async () => {
    if (inFlightRef.current) return; // a request is already pending - never overlap, avoids stale results winning a race
    const blob = await captureBlob();
    if (!blob) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await api.detect.frame(cameraName, blob);
      if (stoppedRef.current) return; // component unmounted while this request was in flight
      setResult(res);
      setError(null);

      const timeLabel = new Date().toLocaleTimeString();
      const newItems: HistoryItem[] = res.detections.map((d, i) => ({
        key: `${Date.now()}-${i}`,
        name: d.redlist_alert
          ? d.redlist_alert.name
          : d.status === "matched"
            ? d.name ?? "Unknown"
            : `Unknown (${d.unknown_id})`,
        subLabel: d.redlist_alert
          ? `WATCHLIST · ${d.redlist_alert.risk_level}`
          : d.status === "matched"
            ? `${((d.match_confidence ?? 0) * 100).toFixed(0)}% match`
            : "No match",
        imageUrl: imageUrl(d.image_url),
        tone: d.redlist_alert ? "redlist" : d.status === "matched" ? "matched" : "unknown",
        scoreColor: d.score_color,
        time: timeLabel,
      }));
      if (newItems.length > 0) {
        addHistoryItems(newItems);
      }
    } catch {
      setError("Detection request failed — is the backend running?");
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    api.cameras
      .list()
      .then((list) => {
        setCameras(list);
        if (list.length > 0 && !list.some((c) => c.camera_name === cameraName)) {
          setCameraName(list[0].camera_name);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoCapture && cameraOn) {
      intervalRef.current = setInterval(runDetection, CAPTURE_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture, cameraOn, cameraName]);

  const [cardMap, setCardMap] = useState<Record<string, CardEntry>>({});

  // Every matched face and every Red List match gets its own card, and once a card
  // appears it stays — a person briefly stepping out of frame (or one capture
  // missing them) doesn't erase their card. Cards only update or get dismissed,
  // never silently vanish on their own.
  useEffect(() => {
    if (!result) return;
    setCardMap((prev) => {
      const next = { ...prev };
      result.detections.forEach((d) => {
        if (d.redlist_alert) {
          const id = `redlist:${d.redlist_alert.redlist_id}`;
          next[id] = { id, tone: "redlist", redlistData: d.redlist_alert };
        } else if (d.status === "matched") {
          const id = `known:${d.person_id}`;
          next[id] = { id, tone: "known", knownData: d };
        }
        if (d.missing_person_alert) {
          const id = `missing:${d.missing_person_alert.missing_id}`;
          next[id] = { id, tone: "missing", missingData: d.missing_person_alert };
        }
      });
      result.scene_events.forEach((s) => {
        if (s.event_type === "crowd_detected" && s.alert_id != null) {
          const id = `crowd:${s.zone_name ?? cameraName}`;
          next[id] = {
            id,
            tone: "crowd",
            crowdData: {
              alert_id: s.alert_id,
              zone_name: s.zone_name ?? "crowd_zone",
              person_count: s.person_count ?? s.count ?? 0,
              camera_name: s.camera_name ?? cameraName,
              occurred_at: s.occurred_at ?? null,
              image_url: s.image_url ?? null,
              recommended_action:
                s.recommended_action ?? "Crowd forming in this zone — notify authorities immediately.",
            },
          };
        }
        if (s.event_type === "crowd_surge" && s.alert_id != null) {
          const id = `surge:${s.zone_name ?? cameraName}`;
          next[id] = { id, tone: "surge", sceneData: { ...s, camera_name: s.camera_name ?? cameraName } };
        }
        if (s.event_type === "loitering" && s.alert_id != null) {
          const id = `loitering:${s.person_id ?? s.alert_id}`;
          next[id] = { id, tone: "loitering", sceneData: { ...s, camera_name: s.camera_name ?? cameraName } };
        }
        if (s.event_type === "unattended_object" && s.alert_id != null) {
          const id = `unattended:${s.object_id ?? s.alert_id}`;
          next[id] = { id, tone: "unattended", sceneData: { ...s, camera_name: s.camera_name ?? cameraName } };
        }
        if (s.event_type === "road_accident" && s.alert_id != null) {
          const id = `accident:${s.alert_id}`;
          next[id] = { id, tone: "accident", sceneData: { ...s, camera_name: s.camera_name ?? cameraName } };
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const activeCards = Object.values(cardMap);

  const dismissCard = (id: string) => {
    setCardMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCardPositions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  useEffect(() => {
    setCardPositions((prev) => {
      const next: Record<string, Position> = { ...prev };
      let freshCount = Object.keys(prev).length;
      activeCards.forEach((c) => {
        if (!next[c.id]) {
          next[c.id] = { x: 480 + (freshCount % 3) * 16, y: 16 + freshCount * 150 };
          freshCount++;
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCards.length]);

  const crowdEvent = result?.scene_events.find((s) => s.event_type === "crowd_detected");
  const crowdAlertId = crowdEvent?.alert_id ?? null;
  const crowdBannerVisible =
    crowdEvent != null &&
    crowdAlertId != null &&
    !ackedSceneIds.has(crowdAlertId) &&
    !dismissedSceneIds.has(crowdAlertId);

  const surgeEvent = result?.scene_events.find((s) => s.event_type === "crowd_surge");
  const surgeAlertId = surgeEvent?.alert_id ?? null;
  const surgeBannerVisible =
    surgeEvent != null &&
    surgeAlertId != null &&
    !ackedSceneIds.has(surgeAlertId) &&
    !dismissedSceneIds.has(surgeAlertId);

  const accidentEvent = result?.scene_events.find((s) => s.event_type === "road_accident");
  const accidentAlertId = accidentEvent?.alert_id ?? null;
  const accidentBannerVisible =
    accidentEvent != null &&
    accidentAlertId != null &&
    !ackedSceneIds.has(accidentAlertId) &&
    !dismissedSceneIds.has(accidentAlertId);

  const loiteringEvents = result?.scene_events.filter((s) => s.event_type === "loitering") ?? [];
  const unattendedEvents = result?.scene_events.filter((s) => s.event_type === "unattended_object") ?? [];
  const parkingEvents = result?.scene_events.filter((s) => s.event_type === "illegal_parking") ?? [];

  const acknowledgeSceneAlert = async (alertId: number) => {
    try {
      await api.sceneAlerts.acknowledge(alertId);
      setAckedSceneIds((prev) => new Set(prev).add(alertId));
    } catch {
      // silent — non-critical UI action
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await api.alerts.acknowledge(alertId);
      setAckedIds((prev) => new Set(prev).add(alertId));
    } catch {
      // silent — non-critical UI action
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Live Monitoring</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Real-time face recognition and civic event detection. Every match gets its own card — drag them anywhere.
        </p>
        <p className="mt-1.5 text-xs text-ink-faint">
          This is the operator/demo console — frames come from this browser. For 24/7 unattended
          monitoring, configure camera sources (RTSP / video file) on the{" "}
          <Link href="/cameras" className="text-signal-cyan hover:underline">Cameras</Link> page and
          watch them on the <Link href="/camera-wall" className="text-signal-cyan hover:underline">Camera Wall</Link>.
        </p>
      </div>

      {error && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-3 text-sm text-signal-amber">{error}</Panel>
      )}

      {crowdBannerVisible && crowdEvent && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border-2 border-signal-red bg-signal-red/10 p-4 shadow-[0_0_24px_rgba(239,68,68,0.25)]">
          <div className="flex items-center gap-3">
            <span className="relative flex size-11 items-center justify-center rounded-full bg-signal-red/20 text-signal-red">
              <span className="absolute inset-0 animate-ping rounded-full bg-signal-red/30" />
              <Users2 className="relative size-5" />
            </span>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wide text-signal-red">
                Crowd alert
              </div>
              <div className="font-mono text-xs text-ink-dim">{crowdEvent.zone_name ?? "crowd_zone"}</div>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold leading-none text-ink">
              {crowdEvent.person_count ?? crowdEvent.count ?? 0}+
            </span>
            <span className="font-mono text-xs text-ink-dim">persons in zone</span>
          </div>
          <div className="min-w-48 flex-1 space-y-0.5 font-mono text-[11px] text-ink-dim">
            <div>
              Camera: <span className="text-ink">{crowdEvent.camera_name ?? cameraName}</span>
              {crowdEvent.occurred_at && (
                <>
                  {" · "}
                  <span className="text-ink">{new Date(crowdEvent.occurred_at).toLocaleTimeString()}</span>
                </>
              )}
            </div>
            <div className="text-signal-amber">
              {crowdEvent.recommended_action ?? "Crowd forming in this zone — notify authorities immediately."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => crowdAlertId != null && acknowledgeSceneAlert(crowdAlertId)}
            >
              Acknowledge
            </Button>
            <button
              onClick={() =>
                crowdAlertId != null &&
                setDismissedSceneIds((prev) => new Set(prev).add(crowdAlertId))
              }
              className="text-ink-faint hover:text-ink"
              aria-label="Dismiss crowd banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {surgeBannerVisible && surgeEvent && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border-2 border-signal-red bg-signal-red/10 p-4 shadow-[0_0_24px_rgba(239,68,68,0.35)]">
          <div className="flex items-center gap-3">
            <span className="relative flex size-11 items-center justify-center rounded-full bg-signal-red/20 text-signal-red">
              <span className="absolute inset-0 animate-ping rounded-full bg-signal-red/30" />
              <TrendingUp className="relative size-5" />
            </span>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wide text-signal-red">
                Crowd surge risk
              </div>
              <div className="font-mono text-xs text-ink-dim">{surgeEvent.zone_name ?? "crowd_zone"}</div>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold leading-none text-ink">
              +{surgeEvent.increase ?? "?"}
            </span>
            <span className="font-mono text-xs text-ink-dim">persons in {surgeEvent.window_seconds ?? "?"}s</span>
          </div>
          <div className="min-w-48 flex-1 space-y-0.5 font-mono text-[11px] text-ink-dim">
            <div>
              Camera: <span className="text-ink">{surgeEvent.camera_name ?? cameraName}</span>
              {surgeEvent.occurred_at && (
                <> · <span className="text-ink">{new Date(surgeEvent.occurred_at).toLocaleTimeString()}</span></>
              )}
            </div>
            <div className="text-signal-red">
              {surgeEvent.recommended_action ?? "Rapid crowd growth — risk of crush or stampede. Alert crowd-control personnel immediately."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm"
              onClick={() => surgeAlertId != null && acknowledgeSceneAlert(surgeAlertId)}>
              Acknowledge
            </Button>
            <button
              onClick={() => surgeAlertId != null && setDismissedSceneIds((prev) => new Set(prev).add(surgeAlertId))}
              className="text-ink-faint hover:text-ink" aria-label="Dismiss surge banner">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {accidentBannerVisible && accidentEvent && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border-2 border-signal-red bg-signal-red/10 p-4 shadow-[0_0_24px_rgba(239,68,68,0.35)]">
          <div className="flex items-center gap-3">
            <span className="relative flex size-11 items-center justify-center rounded-full bg-signal-red/20 text-signal-red">
              <span className="absolute inset-0 animate-ping rounded-full bg-signal-red/30" />
              <Siren className="relative size-5" />
            </span>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wide text-signal-red">
                Road accident detected
              </div>
              <div className="font-mono text-xs text-ink-dim">{accidentEvent.detail ?? "probable accident"}</div>
            </div>
          </div>
          <div className="min-w-48 flex-1 space-y-0.5 font-mono text-[11px] text-ink-dim">
            <div>
              Camera: <span className="text-ink">{accidentEvent.camera_name ?? cameraName}</span>
              {accidentEvent.occurred_at && (
                <> · <span className="text-ink">{new Date(accidentEvent.occurred_at).toLocaleTimeString()}</span></>
              )}
            </div>
            <div className="text-signal-red">
              {accidentEvent.recommended_action ?? "Probable road accident. Dispatch emergency services immediately."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm"
              onClick={() => accidentAlertId != null && acknowledgeSceneAlert(accidentAlertId)}>
              Acknowledge
            </Button>
            <button
              onClick={() => accidentAlertId != null && setDismissedSceneIds((prev) => new Set(prev).add(accidentAlertId))}
              className="text-ink-faint hover:text-ink" aria-label="Dismiss accident banner">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <Panel className="relative overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={mediaSource === "file"}
                className="h-full w-full object-cover"
              />
              <canvas ref={captureCanvasRef} className="hidden" />
              {videoSize.width > 0 && (
                <DetectionOverlay result={result} videoWidth={videoSize.width} videoHeight={videoSize.height} active={cameraOn} />
              )}

              {cameraOn && (
                <div className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-px bg-signal-cyan shadow-[0_0_12px_2px_rgba(53,199,224,0.8)]" />
              )}

              <ScanningPanel active={busy} />

              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded bg-black/60 px-2 py-1 font-mono text-xs text-ink">{cameraName}</span>
                {mediaSource === "camera" && (
                  <span className="flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 font-mono text-xs text-signal-red">
                    <span className="size-1.5 animate-pulse-ring rounded-full bg-signal-red" />
                    LIVE
                  </span>
                )}
                {mediaSource === "file" && (
                  <span className="flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 font-mono text-xs text-signal-amber">
                    <FileVideo className="size-3" />
                    DEMO PLAYBACK
                  </span>
                )}
                {result?.person_count != null && result.person_count > 0 && (
                  <span className="rounded bg-black/60 px-2 py-1 font-mono text-xs text-ink-dim">
                    {result.person_count}+ persons · {result.detections.length} faces
                  </span>
                )}
              </div>

              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-faint">
                  <ScanFace className="size-8" />
                  <span className="font-mono text-xs uppercase tracking-wide">No video source</span>
                </div>
              )}
            </div>
          </Panel>

          <div className="flex flex-wrap items-center gap-2">
            {!cameraOn ? (
              <>
                <Button onClick={startCamera}>
                  <Video className="size-4" /> Start camera
                </Button>
                <Button variant="outline" onClick={() => videoFileInputRef.current?.click()}>
                  <FileVideo className="size-4" /> Upload video for demo
                </Button>
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadVideoFile(f);
                  }}
                />
              </>
            ) : (
              <Button variant="destructive" onClick={stopMedia}>
                <VideoOff className="size-4" /> {mediaSource === "file" ? "Stop demo video" : "Stop camera"}
              </Button>
            )}
            <Button variant="outline" disabled={!cameraOn || busy} onClick={runDetection}>
              {busy ? "Scanning…" : "Capture + detect"}
            </Button>
            <label className="flex items-center gap-2 rounded-md border border-hairline-bright px-3 py-2 text-sm text-ink-dim">
              <input
                type="checkbox"
                checked={autoCapture}
                disabled={!cameraOn}
                onChange={(e) => setAutoCapture(e.target.checked)}
                className="accent-signal-cyan"
              />
              Auto-detect every 4s
            </label>
            {cameras.length > 0 ? (
              <select
                value={cameraName}
                onChange={(e) => setCameraName(e.target.value)}
                className="rounded-md border border-hairline-bright bg-panel px-3 py-2 font-mono text-sm text-ink outline-none focus:border-signal-cyan"
              >
                {cameras.map((c) => (
                  <option key={c.camera_name} value={c.camera_name}>
                    {c.camera_name} · {c.purpose}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={cameraName}
                onChange={(e) => setCameraName(e.target.value)}
                placeholder="camera name"
                className="rounded-md border border-hairline-bright bg-panel px-3 py-2 font-mono text-sm text-ink outline-none focus:border-signal-cyan"
              />
            )}
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Recent detections</PanelTitle>
            </PanelHeader>
            <div className="flex gap-3 overflow-x-auto p-4">
              {history.length === 0 && (
                <p className="py-6 text-sm text-ink-faint">No detections yet — start the camera and capture a frame.</p>
              )}
              {history.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    "flex w-32 shrink-0 flex-col gap-2 rounded-md border p-2",
                    item.tone === "redlist" ? "border-signal-red/50 bg-signal-red/5" : "border-hairline bg-panel-raised"
                  )}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-20 w-full rounded object-cover" />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded bg-panel text-ink-faint">
                      <ScanFace className="size-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate text-xs font-medium text-ink">
                      {item.scoreColor && <ScoreDot color={item.scoreColor} size="sm" />}
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-ink-faint">{item.subLabel}</div>
                    <div className="font-mono text-[10px] text-ink-faint">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {activeCards.length === 0 && (
            <Panel className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <ScanFace className="size-6 text-ink-faint" />
              <p className="font-mono text-xs text-ink-faint">No active match</p>
            </Panel>
          )}

          <Panel>
            <PanelHeader>
              <PanelTitle>Recent alerts</PanelTitle>
            </PanelHeader>
            <RecentAlertsList ackedIds={ackedIds} onAcknowledge={handleAcknowledge} />
          </Panel>

          {result?.scene_events.some((s) => s.event_type === "illegal_parking") && (
            <Panel className="border-signal-amber/40 p-3">
              <div className="flex items-center gap-2 text-signal-amber">
                <CarFront className="size-4" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wide">Illegal parking</span>
              </div>
              {parkingEvents.map((e, i) => (
                <div key={i} className="mt-1 font-mono text-[11px] text-ink-faint">
                  Vehicle in no-parking zone · {e.dwell_seconds ?? "?"}s
                </div>
              ))}
            </Panel>
          )}

          {loiteringEvents.length > 0 && (
            <Panel className="border-signal-amber/40 p-3">
              <div className="flex items-center gap-2 text-signal-amber">
                <Clock className="size-4" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wide">Loitering detected</span>
              </div>
              {loiteringEvents.map((e, i) => (
                <div key={i} className="mt-1 font-mono text-[11px] text-ink-faint">
                  {e.zone_name ?? "Restricted zone"} · {e.recommended_action ?? "Dispatch security."}
                </div>
              ))}
            </Panel>
          )}

          {unattendedEvents.length > 0 && (
            <Panel className="border-signal-red/40 p-3">
              <div className="flex items-center gap-2 text-signal-red">
                <Package className="size-4" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wide">Unattended object</span>
              </div>
              {unattendedEvents.map((e, i) => (
                <div key={i} className="mt-1 font-mono text-[11px] text-ink-faint">
                  {e.object_id ?? "Object"} · {e.dwell_seconds ?? "?"}s unattended
                </div>
              ))}
              <div className="mt-1.5 text-[11px] text-signal-red">Treat as suspicious — follow security protocol.</div>
            </Panel>
          )}
        </div>

        {activeCards.map((c) => (
          <DetectionCard
            key={c.id}
            tone={c.tone}
            redlistData={c.redlistData}
            knownData={c.knownData}
            missingData={c.missingData}
            crowdData={c.crowdData}
            sceneData={c.sceneData}
            position={cardPositions[c.id] ?? { x: 480, y: 16 }}
            onMove={(pos) => setCardPositions((prev) => ({ ...prev, [c.id]: pos }))}
            onDismiss={() => dismissCard(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RecentAlertsList({
  ackedIds,
  onAcknowledge,
}: {
  ackedIds: Set<number>;
  onAcknowledge: (id: number) => void;
}) {
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof api.alerts.list>>>([]);

  useEffect(() => {
    api.alerts
      .list(5)
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, []);

  if (alerts.length === 0) {
    return <p className="p-4 text-center text-sm text-ink-faint">No alerts yet.</p>;
  }

  return (
    <div className="divide-y divide-hairline">
      {alerts.map((a) => {
        const acked = a.acknowledged || ackedIds.has(a.alert_id);
        return (
          <div key={a.alert_id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-ink">{a.name}</div>
              <div className="font-mono text-[11px] text-ink-faint">{a.camera_name}</div>
            </div>
            <Button
              size="sm"
              variant={acked ? "ghost" : "outline"}
              disabled={acked}
              onClick={() => onAcknowledge(a.alert_id)}
            >
              {acked ? "Acknowledged" : "Acknowledge"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

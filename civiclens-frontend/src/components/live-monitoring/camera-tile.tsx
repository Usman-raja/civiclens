"use client";

import { useEffect, useRef, useState } from "react";
import { api, type DetectFrameResponse } from "@/lib/api";
import { Video, VideoOff, ShieldAlert, UserSearch, ScanFace, FileVideo, Users, TrendingUp, Clock, Package, CarFront, Siren } from "lucide-react";

const CAPTURE_INTERVAL_MS = 4000;

type Source = "camera" | "file" | null;

export function CameraTile({ cameraName }: { cameraName: string }) {
  const [source, setSource] = useState<Source>(null);
  const [result, setResult] = useState<DetectFrameResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);

  const on = source !== null;

  const stop = () => {
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
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSource(null);
    setResult(null);
  };

  const startCamera = async () => {
    stop();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setSource("camera");
    } catch {
      setError("Camera blocked");
    }
  };

  const loadFile = (file: File) => {
    stop();
    setError(null);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => setError("Playback failed"));
    }
    setSource("file");
  };

  const captureBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.videoWidth === 0) return resolve(null);
      const MAX_WIDTH = 640;
      const scale = v.videoWidth > MAX_WIDTH ? MAX_WIDTH / v.videoWidth : 1;
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });

  const detect = async () => {
    if (inFlightRef.current) return;
    const blob = await captureBlob();
    if (!blob) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await api.detect.frame(cameraName, blob);
      if (!stoppedRef.current) setResult(res);
    } catch {
      // silent per-tile
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (on) {
      intervalRef.current = setInterval(detect, CAPTURE_INTERVAL_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, cameraName]);

  // status summary from the latest result
  const redlistHit = result?.detections.some((d) => d.redlist_alert);
  const missingHit = result?.detections.some((d) => d.missing_person_alert);
  const knownCount = result?.detections.filter((d) => d.status === "matched").length ?? 0;
  const faceCount = result?.detections.length ?? 0;
  const personCount = result?.person_count ?? faceCount;
  const crowdHit = result?.scene_events?.find((e) => e.event_type === "crowd_detected");
  const surgeHit = result?.scene_events?.find((e) => e.event_type === "crowd_surge");
  const parkingHit = result?.scene_events?.some((e) => e.event_type === "illegal_parking");
  const loiteringHit = result?.scene_events?.some((e) => e.event_type === "loitering");
  const unattendedHit = result?.scene_events?.some((e) => e.event_type === "unattended_object");
  const accidentHit = result?.scene_events?.some((e) => e.event_type === "road_accident");
  const hasSceneAlerts = surgeHit || crowdHit || parkingHit || loiteringHit || unattendedHit || accidentHit;

  return (
    <div className="overflow-hidden rounded-md border border-hairline-bright bg-panel">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* camera label */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-ink">{cameraName}</span>
          {source === "camera" && (
            <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-signal-red">
              <span className="size-1 animate-pulse-ring rounded-full bg-signal-red" /> LIVE
            </span>
          )}
          {source === "file" && (
            <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-signal-amber">
              <FileVideo className="size-2.5" /> DEMO
            </span>
          )}
          {busy && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-signal-cyan">scan…</span>
          )}
        </div>

        {/* alert badges — top-right */}
        {(redlistHit || missingHit || hasSceneAlerts) && (
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            {accidentHit && (
              <span className="flex items-center gap-1 rounded bg-signal-red px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <Siren className="size-2.5" /> ACCIDENT
              </span>
            )}
            {surgeHit && (
              <span className="flex items-center gap-1 rounded bg-signal-red px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <TrendingUp className="size-2.5" /> SURGE
              </span>
            )}
            {redlistHit && (
              <span className="flex items-center gap-1 rounded bg-signal-red px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <ShieldAlert className="size-2.5" /> WATCHLIST
              </span>
            )}
            {unattendedHit && (
              <span className="flex items-center gap-1 rounded bg-signal-red px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <Package className="size-2.5" /> UNATTENDED
              </span>
            )}
            {missingHit && (
              <span className="flex items-center gap-1 rounded bg-signal-green px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <UserSearch className="size-2.5" /> FOUND
              </span>
            )}
            {crowdHit && !surgeHit && (
              <span className="flex items-center gap-1 rounded bg-signal-amber px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <Users className="size-2.5" /> CROWD {crowdHit.person_count ?? ""}+
              </span>
            )}
            {parkingHit && (
              <span className="flex items-center gap-1 rounded bg-signal-amber px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                PARKING
              </span>
            )}
            {loiteringHit && (
              <span className="flex items-center gap-1 rounded bg-signal-amber px-1.5 py-0.5 font-mono text-[10px] font-semibold text-void">
                <Clock className="size-2.5" /> LOITER
              </span>
            )}
          </div>
        )}

        {!on && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-faint">
            <ScanFace className="size-6" />
            <span className="font-mono text-[10px] uppercase">Offline</span>
          </div>
        )}

        {on && personCount > 0 && !redlistHit && !missingHit && (
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
            {personCount}+ person{personCount > 1 ? "s" : ""} · {faceCount} face{faceCount > 1 ? "s" : ""} · {knownCount} known
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 p-2">
        {!on ? (
          <>
            <button
              onClick={startCamera}
              className="flex flex-1 items-center justify-center gap-1 rounded bg-signal-cyan px-2 py-1.5 text-[11px] font-semibold text-void hover:opacity-90"
            >
              <Video className="size-3" /> Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-hairline-bright px-2 py-1.5 text-[11px] text-ink-dim hover:text-ink"
            >
              <FileVideo className="size-3" /> Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
              }}
            />
          </>
        ) : (
          <button
            onClick={stop}
            className="flex flex-1 items-center justify-center gap-1 rounded border border-signal-red/40 px-2 py-1.5 text-[11px] text-signal-red hover:bg-signal-red/10"
          >
            <VideoOff className="size-3" /> Stop
          </button>
        )}
      </div>
      {error && <div className="px-2 pb-2 text-[10px] text-signal-red">{error}</div>}
    </div>
  );
}

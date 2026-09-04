"use client";

import { useEffect, useRef } from "react";
import type { DetectFrameResponse } from "@/lib/api";

const COLOR_MATCHED: Record<string, string> = {
  green: "#2ed47a",
  gray: "#7e8ca0",
  red: "#f0473f",
};
const COLOR_UNKNOWN = "#f0a63c";
const COLOR_REDLIST = "#f0473f";
const COLOR_MISSING_FOUND = "#2ed47a";

function drawFaceMesh(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  timeMs: number,
  keypoints?: [number, number][] | null
) {
  const w = x2 - x1;
  const h = y2 - y1;
  const pulse = (Math.sin(timeMs / 900) + 1) / 2;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // Grid rows anchor to real eye/nose/mouth positions when insightface provides them,
  // clustering detail around actual facial structure instead of a uniform rectangle.
  let rowYs: number[];
  if (keypoints && keypoints.length >= 5) {
    const eyeY = (keypoints[0][1] + keypoints[1][1]) / 2;
    const noseY = keypoints[2][1];
    const mouthY = (keypoints[3][1] + keypoints[4][1]) / 2;
    rowYs = [y1, (y1 + eyeY) / 2, eyeY, (eyeY + noseY) / 2, noseY, (noseY + mouthY) / 2, mouthY, (mouthY + y2) / 2, y2];
  } else {
    rowYs = Array.from({ length: 9 }, (_, i) => y1 + (h * i) / 8);
  }
  const cols = 6;

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3 + pulse * 0.25;
  ctx.lineWidth = 1;

  for (let i = 1; i < cols; i++) {
    const x = x1 + (w * i) / cols;
    ctx.beginPath();
    ctx.moveTo(x, rowYs[0]);
    rowYs.forEach((ry) => ctx.lineTo(x, ry));
    ctx.stroke();
  }
  rowYs.forEach((ry) => {
    ctx.beginPath();
    ctx.moveTo(x1, ry);
    ctx.lineTo(x2, ry);
    ctx.stroke();
  });

  // real landmark markers - genuine detector output, not decorative placeholders
  if (keypoints) {
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = color;
    keypoints.forEach(([kx, ky]) => {
      ctx.beginPath();
      ctx.arc(kx, ky, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // sweeping scan beam, oscillating around the real eye line when available
  const eyeLevelY = keypoints && keypoints.length >= 2 ? (keypoints[0][1] + keypoints[1][1]) / 2 : y1 + h * 0.4;
  const sweepY = eyeLevelY + Math.sin(timeMs / 700) * (h * 0.22);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, sweepY);
  ctx.lineTo(x2, sweepY);
  ctx.stroke();

  ctx.restore();
}

function drawCornerBrackets(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, glow: boolean) {
  const cornerLen = Math.min(18, (x2 - x1) / 3);
  ctx.save();
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  const corners: [number, number, number, number, number, number][] = [
    [x1, y1 + cornerLen, x1, y1, x1 + cornerLen, y1],
    [x2 - cornerLen, y1, x2, y1, x2, y1 + cornerLen],
    [x1, y2 - cornerLen, x1, y2, x1 + cornerLen, y2],
    [x2 - cornerLen, y2, x2, y2, x2, y2 - cornerLen],
  ];
  corners.forEach(([ax, ay, bx, by, cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  });
  ctx.restore();
}

export function DetectionOverlay({
  result,
  videoWidth,
  videoHeight,
  active,
}: {
  result: DetectFrameResponse | null;
  videoWidth: number;
  videoHeight: number;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef(result);
  resultRef.current = result;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoWidth || !videoHeight) return;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const render = (timeMs: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!activeRef.current) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const current = resultRef.current;
      if (current) {
        ctx.font = "600 13px var(--font-mono)";
        ctx.textBaseline = "bottom";

        const primary =
          current.detections.find((d) => d.redlist_alert) ??
          current.detections.find((d) => d.missing_person_alert) ??
          current.detections.find((d) => d.status === "matched");

        for (const d of current.detections) {
          const [x1, y1, x2, y2] = d.face_bbox;
          const isRedlist = Boolean(d.redlist_alert);
          const isMissingFound = Boolean(d.missing_person_alert);
          const color = isRedlist
            ? COLOR_REDLIST
            : isMissingFound
              ? COLOR_MISSING_FOUND
              : d.status === "matched"
                ? COLOR_MATCHED[d.score_color ?? "gray"]
                : COLOR_UNKNOWN;

          if (d === primary) {
            drawFaceMesh(ctx, x1, y1, x2, y2, color, timeMs, d.keypoints);
          }

          drawCornerBrackets(ctx, x1, y1, x2, y2, color, d === primary);

          const label = isRedlist
            ? `⚠ WATCHLIST: ${d.redlist_alert?.name}`
            : isMissingFound
              ? `✓ FOUND: ${d.missing_person_alert?.name}`
              : d.status === "matched"
                ? `${d.name} · ${((d.match_confidence ?? 0) * 100).toFixed(0)}%`
                : `UNKNOWN · ${d.unknown_id ?? ""}`;

          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = color;
          ctx.fillRect(x1, y1 - 20, textWidth + 10, 20);
          ctx.fillStyle = "#07090d";
          ctx.fillText(label, x1 + 5, y1 - 5);
        }

        for (const s of current.scene_events) {
          if (!s.bbox) continue;
          const [x1, y1, x2, y2] = s.bbox;
          ctx.strokeStyle = "#f0a63c";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          ctx.setLineDash([]);
          ctx.fillStyle = "#f0a63c";
          const label = `PARKING · ${s.dwell_seconds?.toFixed(0)}s`;
          const w = ctx.measureText(label).width;
          ctx.fillRect(x1, y1 - 20, w + 10, 20);
          ctx.fillStyle = "#07090d";
          ctx.fillText(label, x1 + 5, y1 - 5);
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [videoWidth, videoHeight]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

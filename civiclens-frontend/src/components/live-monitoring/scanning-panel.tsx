"use client";

import { useEffect, useRef, useState } from "react";
import { ScanFace } from "lucide-react";

export function ScanningPanel({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setVisible(true);
      setProgress(0);
      // Climbs toward ~92% while the real request is in flight, then snaps to 100%
      // once the actual response arrives (active becomes false) — this represents
      // genuine wait time, not a fabricated detection metric.
      intervalRef.current = setInterval(() => {
        setProgress((p) => (p < 92 ? p + (92 - p) * 0.15 + 1 : p));
      }, 120);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress((p) => (p > 0 ? 100 : p));
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div className="absolute bottom-3 left-3 w-36 rounded-md border border-signal-cyan/40 bg-black/70 p-2.5 backdrop-blur-sm">
      <div className="flex items-center justify-between text-signal-cyan">
        <span className="font-mono text-[11px] font-semibold tracking-wide">SCANNING</span>
        <span className="flex gap-0.5">
          <span className="size-1 animate-pulse rounded-full bg-signal-cyan" />
          <span className="size-1 animate-pulse rounded-full bg-signal-cyan [animation-delay:0.15s]" />
          <span className="size-1 animate-pulse rounded-full bg-signal-cyan [animation-delay:0.3s]" />
        </span>
      </div>
      <div className="my-2 flex justify-center">
        <ScanFace className="size-11 text-signal-cyan/70" strokeWidth={1.2} />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-ink-dim">
        <span>ANALYZING</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-raised">
        <div className="h-full bg-signal-cyan transition-all duration-150" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

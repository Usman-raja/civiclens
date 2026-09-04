"use client";

import { useEffect, useState } from "react";

const BLIPS = [
  { x: 30, y: 22, delay: 0 },
  { x: 68, y: 38, delay: 1.2 },
  { x: 46, y: 70, delay: 2.4 },
  { x: 20, y: 55, delay: 0.6 },
  { x: 78, y: 16, delay: 1.8 },
];

export function RadarWidget({ label = "SECTOR SWEEP" }: { label?: string }) {
  const [sweepAngle, setSweepAngle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSweepAngle((a) => (a + 1) % 360), 20);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative aspect-square w-full">
        {/* rings */}
        <div className="absolute inset-0 rounded-full border border-signal-cyan/25" />
        <div className="absolute inset-[18%] rounded-full border border-signal-cyan/20" />
        <div className="absolute inset-[36%] rounded-full border border-signal-cyan/15" />
        <div className="absolute inset-[46%] rounded-full bg-signal-cyan/10" />
        {/* cross hairs */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-signal-cyan/15" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-signal-cyan/15" />
        <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 rotate-45 bg-signal-cyan/10" />
        <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-signal-cyan/10" />

        {/* rotating sweep beam — full-radius wedge with soft trailing edge */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from ${sweepAngle}deg, transparent 0deg, transparent 250deg, rgba(53,199,224,0.18) 300deg, rgba(53,199,224,0.5) 345deg, rgba(53,199,224,0.95) 358deg, rgba(53,199,224,1) 360deg)`,
            maskImage: "radial-gradient(circle at 50% 50%, black 0%, black 98%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 0%, black 98%, transparent 100%)",
          }}
        />
        {/* beam edge line */}
        <div
          className="absolute left-1/2 top-1/2 h-[3px] w-1/2 origin-left rounded-full bg-signal-cyan shadow-[0_0_12px_rgba(53,199,224,0.9)]"
          style={{ transform: `translateY(-50%) rotate(${sweepAngle}deg)`, transformOrigin: "left center" }}
        />

        {/* blips — brighten when the beam passes over them */}
        {BLIPS.map((b, i) => {
          const blipAngle = (Math.atan2(50 - b.y, b.x - 50) * 180) / Math.PI;
          const diff = Math.abs(((sweepAngle - blipAngle + 540) % 360) - 180);
          const closeness = 1 - Math.min(diff, 180) / 180;
          const opacity = 0.25 + closeness * 0.75;
          return (
            <span
              key={i}
              className="absolute size-1.5 rounded-full bg-signal-green shadow-[0_0_8px_rgba(46,212,122,0.9)]"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                opacity,
                boxShadow: `0 0 ${6 + closeness * 10}px rgba(46,212,122,${opacity})`,
              }}
            />
          );
        })}

        {/* center dot */}
        <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-cyan shadow-[0_0_12px_rgba(53,199,224,1)]" />

        {/* degree labels */}
        <span className="absolute left-1/2 top-1 -translate-x-1/2 font-mono text-[8px] text-signal-cyan/40">000</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono text-[8px] text-signal-cyan/40">090</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[8px] text-signal-cyan/40">180</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 font-mono text-[8px] text-signal-cyan/40">270</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-ink-faint">
        <span className="animate-blink text-signal-cyan">●</span> {label}
      </div>
    </div>
  );
}

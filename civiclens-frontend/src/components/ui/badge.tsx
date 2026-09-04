import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "cyan" | "green" | "amber" | "red" | "neutral";

const TONE_MAP: Record<Tone, string> = {
  cyan: "bg-signal-cyan/10 text-signal-cyan border-signal-cyan/30",
  green: "bg-signal-green/10 text-signal-green border-signal-green/30",
  amber: "bg-signal-amber/10 text-signal-amber border-signal-amber/30",
  red: "bg-signal-red/10 text-signal-red border-signal-red/30",
  neutral: "bg-ink-faint/10 text-ink-dim border-hairline-bright",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide",
        TONE_MAP[tone],
        className
      )}
      {...props}
    />
  );
}

export function riskTone(riskLevel: string): Tone {
  switch (riskLevel) {
    case "Critical":
      return "red";
    case "High":
      return "amber";
    case "Medium":
      return "cyan";
    default:
      return "neutral";
  }
}

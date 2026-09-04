import { cn } from "@/lib/utils";

type ScoreColor = "green" | "gray" | "red";

const COLOR_MAP: Record<ScoreColor, string> = {
  green: "bg-signal-green shadow-[0_0_8px_rgba(46,212,122,0.6)]",
  gray: "bg-ink-faint",
  red: "bg-signal-red shadow-[0_0_8px_rgba(240,71,63,0.6)]",
};

export function ScoreDot({
  color,
  size = "md",
  className,
}: {
  color: ScoreColor;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "size-2" : size === "lg" ? "size-4" : "size-2.5";
  return (
    <span
      role="img"
      aria-label={`status: ${color}`}
      className={cn("inline-block rounded-full", sizeClass, COLOR_MAP[color], className)}
    />
  );
}

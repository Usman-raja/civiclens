import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Panel({
  className,
  glow = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "glass rounded-lg border border-hairline",
        glow && "shadow-[0_0_0_1px_rgba(53,199,224,0.15),0_0_24px_-8px_rgba(53,199,224,0.35)]",
        className
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-hairline px-4 py-3",
        className
      )}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-sm font-semibold uppercase tracking-wide text-ink",
        className
      )}
      {...props}
    />
  );
}

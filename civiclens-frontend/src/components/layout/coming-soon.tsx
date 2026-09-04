import { Panel } from "@/components/ui/panel";
import type { ComponentType } from "react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex h-full max-w-[1800px] animate-rise flex-col px-2 sm:px-0">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-dim">{description}</p>
      </div>
      <Panel className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <Icon className="size-8 text-ink-faint" />
        <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">Module under construction</p>
      </Panel>
    </div>
  );
}

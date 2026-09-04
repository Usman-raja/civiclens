import { Panel } from "@/components/ui/panel";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-6 px-2 sm:px-0">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-panel-raised" />
        <div className="h-4 w-72 animate-pulse rounded bg-panel-raised" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Panel key={i} className="p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-panel-raised" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-panel-raised" />
          </Panel>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2 h-64 animate-pulse" />
        <Panel className="h-64 animate-pulse" />
      </div>
    </div>
  );
}

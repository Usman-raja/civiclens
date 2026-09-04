import { api } from "@/lib/api";
import { Panel } from "@/components/ui/panel";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { Users, ShieldAlert, Users2, CarFront } from "lucide-react";

export default async function AnalyticsPage() {
  const data = await api.analytics.summary().catch(() => null);

  if (!data) {
    return (
      <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
        <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
        <p className="mt-1 text-sm text-ink-dim">Aggregated trends across citizens, events, and alerts.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Citizens" value={data.total_participants} />
        <StatCard icon={ShieldAlert} label="Total alerts" value={data.total_alerts} />
        <StatCard
          icon={Users2}
          label="Crowd events"
          value={data.scene_event_counts["crowd_detected"] ?? 0}
        />
        <StatCard
          icon={CarFront}
          label="Illegal parking events"
          value={data.scene_event_counts["illegal_parking"] ?? 0}
        />
      </div>

      <AnalyticsCharts data={data} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-dim">{label}</span>
        <Icon className="size-4 text-signal-cyan" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
    </Panel>
  );
}

"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import type { AnalyticsSummary } from "@/lib/api";

const SCORE_COLORS: Record<string, string> = {
  green: "#2ed47a",
  gray: "#7e8ca0",
  red: "#f0473f",
};

const RISK_COLORS: Record<string, string> = {
  Low: "#7e8ca0",
  Medium: "#35c7e0",
  High: "#f0a63c",
  Critical: "#f0473f",
};

const tooltipStyle = {
  background: "#131a24",
  border: "1px solid #2c3a4d",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  color: "#e8edf3",
};

export function AnalyticsCharts({ data }: { data: AnalyticsSummary }) {
  const scoreData = Object.entries(data.score_distribution)
    .map(([key, value]) => ({ name: key, value }))
    .filter((d) => d.value > 0);

  const riskData = Object.entries(data.redlist_risk_counts)
    .map(([key, value]) => ({ name: key, value }))
    .filter((d) => d.value > 0);

  const eventData = data.event_type_counts.map((e) => ({
    name: e.event_type_id.replace(/_/g, " "),
    count: e.count,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <PanelHeader>
          <PanelTitle>Score distribution</PanelTitle>
        </PanelHeader>
        <div className="flex items-center gap-6 p-4">
          <div className="h-48 w-48 shrink-0">
            {scoreData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={scoreData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {scoreData.map((d) => (
                      <Cell key={d.name} fill={SCORE_COLORS[d.name]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <Legend items={scoreData.map((d) => ({ label: d.name, value: d.value, color: SCORE_COLORS[d.name] }))} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Red List risk breakdown</PanelTitle>
        </PanelHeader>
        <div className="flex items-center gap-6 p-4">
          <div className="h-48 w-48 shrink-0">
            {riskData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {riskData.map((d) => (
                      <Cell key={d.name} fill={RISK_COLORS[d.name]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <Legend items={riskData.map((d) => ({ label: d.name, value: d.value, color: RISK_COLORS[d.name] }))} />
        </div>
      </Panel>

      <Panel className="col-span-2">
        <PanelHeader>
          <PanelTitle>Civic events by type</PanelTitle>
        </PanelHeader>
        <div className="h-64 p-4">
          {eventData.length === 0 ? (
            <EmptyChart label="No events logged yet." />
          ) : (
            <ResponsiveContainer>
              <BarChart data={eventData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2733" vertical={false} />
                <XAxis dataKey="name" stroke="#4c5768" fontSize={11} tickLine={false} />
                <YAxis stroke="#4c5768" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1e2733" }} />
                <Bar dataKey="count" fill="#35c7e0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Legend({ items }: { items: { label: string; value: number; color: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 font-mono text-xs">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="capitalize text-ink-dim">{item.label}</span>
          <span className="text-ink">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ label = "No data yet." }: { label?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-ink-faint">{label}</div>;
}

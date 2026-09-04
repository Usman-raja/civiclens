import Link from "next/link";
import { notFound } from "next/navigation";
import { api, imageUrl } from "@/lib/api";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ScoreDot } from "@/components/ui/score-dot";
import { DeleteParticipantButton } from "@/components/profiles/delete-participant-button";
import { ArrowLeft, ScanFace, MapPin } from "lucide-react";

export default async function CitizenDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;

  const [detail, events, detections] = await Promise.all([
    api.participants.get(personId).catch(() => null),
    api.participants.events(personId).catch(() => []),
    api.participants.detections(personId).catch(() => []),
  ]);

  if (!detail) {
    notFound();
  }

  const photo = imageUrl(detail.image_url);
  const latestSnapshot = imageUrl(detail.latest_detection_image_url);

  return (
    <div className="mx-auto max-w-[1600px] animate-rise space-y-6 px-2 sm:px-0">
      <Link href="/profiles" className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-ink">
        <ArrowLeft className="size-4" /> Back to profiles
      </Link>

      <Panel className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={detail.name} className="size-20 rounded-lg border border-hairline-bright object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-lg border border-hairline-bright bg-panel-raised text-ink-faint">
                <ScanFace className="size-8" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <ScoreDot color={detail.score_color} size="lg" />
                <h1 className="font-display text-2xl font-bold text-ink">{detail.name}</h1>
              </div>
              <div className="font-mono text-sm text-ink-faint">{detail.person_id}</div>
              <div className="mt-1 font-mono text-xs text-ink-dim">
                Score {detail.current_score}/10 · {detail.positive_event_count} positive · {detail.negative_event_count} negative
              </div>
            </div>
          </div>
          <DeleteParticipantButton personId={detail.person_id} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-hairline pt-4 font-mono text-xs">
          <Stat label="Total detections" value={String(detail.total_detections)} />
          <Stat label="Last camera" value={detail.last_camera_name ?? "—"} />
          <Stat label="Last confidence" value={detail.last_match_confidence ? `${(detail.last_match_confidence * 100).toFixed(1)}%` : "—"} />
          <Stat label="Last seen" value={detail.last_seen ? new Date(detail.last_seen).toLocaleString() : "—"} />
        </div>

        {(detail.external_id || detail.phone || detail.address || detail.notes || detail.source) && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-hairline pt-4 font-mono text-xs">
            <Stat label="External ID" value={detail.external_id ?? "—"} />
            <Stat label="Phone" value={detail.phone ?? "—"} />
            <Stat label="Address" value={detail.address ?? "—"} />
            <Stat label="Imported from" value={detail.source ?? "—"} />
          </div>
        )}

        {detail.notes && (
          <p className="mt-3 border-t border-hairline pt-3 text-xs text-ink-dim">{detail.notes}</p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Event timeline</PanelTitle>
          </PanelHeader>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-hairline">
              {events.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-ink-faint">No events yet.</td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.event_id}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-faint">
                    {new Date(e.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-ink-dim">{e.event_type_id.replace(/_/g, " ")}</td>
                  <td className={`px-4 py-2 text-right font-mono ${e.score_delta > 0 ? "text-signal-green" : "text-signal-red"}`}>
                    {e.score_delta > 0 ? `+${e.score_delta}` : e.score_delta} → {e.score_after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Movement history</PanelTitle>
          </PanelHeader>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-hairline">
              {detections.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-ink-faint">No detections yet.</td>
                </tr>
              )}
              {detections.slice(0, 10).map((d) => (
                <tr key={d.detection_id}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-faint">
                    {new Date(d.detected_at).toLocaleTimeString()}
                  </td>
                  <td className="px-2 py-2 text-ink-dim">{d.camera_name}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-ink-faint">
                    {d.centroid ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {d.centroid[0].toFixed(0)}, {d.centroid[1].toFixed(0)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Captured snapshots</PanelTitle>
        </PanelHeader>
        <div className="flex gap-3 overflow-x-auto p-4">
          {detections.length === 0 && !latestSnapshot && (
            <p className="py-6 text-sm text-ink-faint">No snapshots captured yet.</p>
          )}
          {detections.map((d) => {
            const url = imageUrl(d.image_url);
            if (!url) return null;
            return (
              <div key={d.detection_id} className="w-28 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-full rounded-md border border-hairline object-cover" />
                <div className="mt-1 font-mono text-[10px] text-ink-faint">
                  {new Date(d.detected_at).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { api, imageUrl } from "@/lib/api";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { MissingPersonActions } from "@/components/missing-persons/missing-person-actions";
import { ArrowLeft, ScanFace } from "lucide-react";

export default async function MissingPersonDetailPage({
  params,
}: {
  params: Promise<{ missingId: string }>;
}) {
  const { missingId } = await params;
  const person = await api.missingPersons.get(missingId).catch(() => null);

  if (!person) {
    notFound();
  }

  const photo = imageUrl(person.image_url);

  return (
    <div className="mx-auto max-w-[1400px] animate-rise space-y-6 px-2 sm:px-0">
      <Link href="/missing-persons" className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-ink">
        <ArrowLeft className="size-4" /> Back to missing persons
      </Link>

      <Panel className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={person.name} className="size-20 rounded-lg border border-hairline-bright object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-lg border border-hairline-bright bg-panel-raised text-ink-faint">
                <ScanFace className="size-8" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-ink">{person.name}</h1>
                <Badge tone={person.active ? "amber" : "green"}>{person.active ? "Still missing" : "Found"}</Badge>
              </div>
              <div className="font-mono text-sm text-ink-faint">{person.missing_id}</div>
              {person.age !== null && <div className="mt-1 text-sm text-ink-dim">Age {person.age}</div>}
            </div>
          </div>
        </div>

        {person.description && (
          <p className="mt-4 rounded-md bg-panel-raised p-3 text-sm text-ink-dim">{person.description}</p>
        )}
        {person.contact_info && (
          <p className="mt-2 font-mono text-xs text-ink-faint">Contact: {person.contact_info}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-hairline pt-4 font-mono text-xs">
          <Stat label="Detections" value={String(person.detection_count)} />
          <Stat label="Last camera" value={person.last_camera_name ?? "—"} />
          <Stat label="Last seen" value={person.last_seen ? new Date(person.last_seen).toLocaleString() : "—"} />
          <Stat
            label="Reported missing"
            value={person.reported_missing_since ? new Date(person.reported_missing_since).toLocaleDateString() : "—"}
          />
        </div>

        <div className="mt-4 border-t border-hairline pt-4">
          <MissingPersonActions person={person} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Detection history</PanelTitle>
        </PanelHeader>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-hairline">
            {person.alerts.length === 0 && (
              <tr>
                <td className="p-4 text-center text-ink-faint">No detections yet.</td>
              </tr>
            )}
            {person.alerts.map((a) => (
              <tr key={a.alert_id}>
                <td className="px-4 py-2 font-mono text-xs text-ink-faint">
                  {new Date(a.occurred_at).toLocaleString()}
                </td>
                <td className="px-2 py-2 text-ink-dim">{a.camera_name}</td>
                <td className="px-4 py-2 text-right font-mono text-ink">
                  {(a.similarity_score * 100).toFixed(1)}% match
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

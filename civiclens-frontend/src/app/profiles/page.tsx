import Link from "next/link";
import { api, imageUrl } from "@/lib/api";
import { Panel } from "@/components/ui/panel";
import { ScoreDot } from "@/components/ui/score-dot";
import { RegisterParticipantForm } from "@/components/profiles/register-participant-form";
import { BulkImportForm } from "@/components/profiles/bulk-import-form";
import { ScanFace } from "lucide-react";

export default async function ProfilesPage() {
  let participants: Awaited<ReturnType<typeof api.participants.list>> = [];
  let unreachable = false;
  try {
    participants = await api.participants.list();
  } catch {
    unreachable = true;
  }

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Profiles</h1>
          <p className="mt-1 text-sm text-ink-dim">Every registered citizen, current score, and history.</p>
        </div>
        <div className="flex gap-2">
          <RegisterParticipantForm />
          <BulkImportForm />
        </div>
      </div>

      {unreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {participants.length === 0 && !unreachable && (
          <Panel className="col-span-full flex flex-col items-center gap-2 py-16 text-center">
            <ScanFace className="size-8 text-ink-faint" />
            <p className="text-sm text-ink-faint">No citizens registered yet.</p>
          </Panel>
        )}
        {participants.map((p) => {
          const photo = imageUrl(p.image_url);
          return (
            <Link key={p.person_id} href={`/profiles/${p.person_id}`}>
              <Panel className="p-4 transition-colors hover:border-signal-cyan/40">
                <div className="flex items-center gap-3">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={p.name} className="size-14 rounded-full border border-hairline-bright object-cover" />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded-full border border-hairline-bright bg-panel-raised text-ink-faint">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <ScoreDot color={p.score_color} size="sm" />
                      <span className="truncate font-medium text-ink">{p.name}</span>
                    </div>
                    <div className="truncate font-mono text-xs text-ink-faint">
                      {p.person_id}
                      {p.external_id ? ` · ${p.external_id}` : ""}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 font-mono text-xs text-ink-dim">
                  <span>Score: {p.current_score}/10</span>
                  <span>{p.total_detections} detections</span>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

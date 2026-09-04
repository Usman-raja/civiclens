"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { AddMissingPersonForm } from "@/components/missing-persons/add-missing-person-form";
import { api, imageUrl, type MissingPerson } from "@/lib/api";
import { UserSearch } from "lucide-react";

export default function MissingPersonsPage() {
  const { isAdmin } = useAuth();
  const [people, setPeople] = useState<MissingPerson[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    api.missingPersons
      .list({ active: activeOnly ? true : undefined, name: search || undefined })
      .then((data) => {
        setPeople(data);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
  }, [activeOnly, search]);

  return (
    <div className="mx-auto max-w-[1800px] animate-rise space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Missing Persons</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Registered missing persons. Any connected camera checks against this list at all times, same as the
            Watchlist — a match here is good news, not a threat.
          </p>
        </div>
        {isAdmin && <AddMissingPersonForm />}
      </div>

      {unreachable && (
        <Panel className="border-signal-amber/30 bg-signal-amber/5 p-4 text-sm text-signal-amber">
          Can&rsquo;t reach the API at <code className="font-mono">127.0.0.1:8000</code>.
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="rounded-md border border-hairline-bright bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-signal-cyan"
        />
        <label className="flex items-center gap-2 rounded-md border border-hairline-bright px-3 py-2 text-sm text-ink-dim">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-signal-cyan"
          />
          Still missing only
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {people.length === 0 && !unreachable && (
          <Panel className="col-span-full flex flex-col items-center gap-2 py-16 text-center">
            <UserSearch className="size-8 text-ink-faint" />
            <p className="text-sm text-ink-faint">No missing person records match these filters.</p>
          </Panel>
        )}
        {people.map((p) => {
          const photo = imageUrl(p.image_url);
          return (
            <Link key={p.missing_id} href={`/missing-persons/${p.missing_id}`}>
              <Panel className={`p-4 transition-colors hover:border-signal-cyan/40 ${!p.active ? "opacity-50" : ""}`}>
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
                    <div className="truncate font-medium text-ink">{p.name}</div>
                    <div className="font-mono text-xs text-ink-faint">{p.missing_id}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
                  <Badge tone={p.active ? "amber" : "green"}>{p.active ? "Still missing" : "Found"}</Badge>
                  <span className="font-mono text-xs text-ink-dim">{p.detection_count} detections</span>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
